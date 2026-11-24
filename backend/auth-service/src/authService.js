//ARXIU QUE CONTÉ LA LÒGICA DE NEGOCI DEL SERVEI D'AUTENTICACIÓ

//=====================
//IMPORTEM
//=====================
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";
import { pool } from "./pool.js";
import { sendVerificationEmail } from "./emailService.js";
import { esAvatarValid } from "./avatar.js";

//=====================
//CONSTANT: SECRET PER SIGNAR ELS TOKENS (OBLIGATORI)
//=====================
const TOKEN_SECRET = process.env.AUTH_SECRET;

//SI NO HI HA SECRET, EL SERVEI NO ARRENCA: MAI FEM SERVIR UN VALOR PER DEFECTE
if (TOKEN_SECRET === undefined || TOKEN_SECRET.length === 0) {
  throw new Error("Falta la variable d'entorn AUTH_SECRET: el servei no pot arrencar sense secret.");
}

//=====================
//CONSTANTS DE TEMPS I D'AVATAR
//=====================
const TOKEN_TTL = "7d";
const CODE_TTL_MINUTES = 15;
const DEFAULT_AVATAR_COLOR = "#22c55e";
const MAX_AVATAR_IMAGE_LENGTH = 2_200_000;

function authError(code, status, message) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

//=====================
//FUNCIÓ: GENERA EL HASH D'UNA CONTRASENYA
//=====================
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derivedKey}`;
}

//=====================
//FUNCIÓ: COMPROVA UNA CONTRASENYA CONTRA EL HASH DESAT
//=====================
export function verifyPassword(password, storedHash) {
  const parts = storedHash.split(":");

  if (parts.length !== 2) {
    return false;
  }

  const salt = parts[0];
  const keyHex = parts[1];

  if (salt.length === 0 || keyHex.length === 0) {
    return false;
  }

  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedKey = scryptSync(password, salt, 64);

  if (keyBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(keyBuffer, derivedKey);
}

//=====================
//FUNCIÓ: CREA EL TOKEN JWT DE SESSIÓ
//=====================
function createSessionToken(user) {
  //EL SUBJECTE ÉS L'ID NUMÈRIC DE L'USUARI
  //EL ROL VIATJA DINS EL TOKEN PERQUE ELS ALTRES SERVEIS NO HAGIN DE CONSULTAR LA BASE DE DADES
  const payload = {
    sub: user.id,
    username: user.nom,
    rol: user.rol,
  };

  //SIGNEM AMB HS256 I DONEM SET DIES DE VALIDESA
  const token = jwt.sign(payload, TOKEN_SECRET, { expiresIn: TOKEN_TTL });

  return token;
}

function generateCode() {
  return String(randomInt(100000, 1000000));
}

function sanitizeAvatarImage(rawAvatarImage) {
  if (rawAvatarImage === null || rawAvatarImage === undefined) {
    return null;
  }

  if (typeof rawAvatarImage !== "string") {
    throw authError("INVALID_AVATAR_IMAGE", 400, "La imatge d'avatar no és vàlida.");
  }

  const avatarImage = rawAvatarImage.trim();
  if (avatarImage === "") {
    return null;
  }

  if (avatarImage.length > MAX_AVATAR_IMAGE_LENGTH) {
    throw authError("AVATAR_TOO_LARGE", 400, "La imatge d'avatar és massa gran.");
  }

  if (esAvatarValid(avatarImage) === false) {
    throw authError("AVATAR_INVALID", 400, "L'avatar ha de ser un enllaç https o una imatge png, jpeg, webp o gif.");
  }

  return avatarImage;
}

function sanitizeAvatarColor(rawAvatarColor) {
  if (rawAvatarColor === null || rawAvatarColor === undefined) {
    return DEFAULT_AVATAR_COLOR;
  }

  if (typeof rawAvatarColor !== "string") {
    throw authError("INVALID_AVATAR_COLOR", 400, "El color d'avatar no és vàlid.");
  }

  const avatarColor = rawAvatarColor.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    throw authError("INVALID_AVATAR_COLOR", 400, "El color d'avatar no és vàlid.");
  }

  return avatarColor;
}

function mapUserRowToPublicUser(row) {
  return {
    id: Number(row.id),
    name: row.nom,
    email: row.email,
    avatarImage: row.avatar_image || "",
    avatarColor: row.avatar_color || DEFAULT_AVATAR_COLOR,
  };
}

export async function registerUser({ username, email, password, avatarImage, avatarColor }) {
  if (typeof username !== "string" || typeof email !== "string" || typeof password !== "string") {
    throw authError("INVALID_INPUT", 400, "Usuari, correu i contrasenya són obligatoris.");
  }

  const cleanUser = username.trim();
  if (!/^[a-zA-Z0-9_]{3,30}$/.test(cleanUser)) {
    throw authError("INVALID_USERNAME", 400, "El nom d'usuari ha de tenir entre 3 i 30 caràcters alfanumèrics.");
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 255) {
    throw authError("INVALID_EMAIL", 400, "El correu electrònic no és vàlid.");
  }

  if (password.length < 6 || password.length > 72) {
    throw authError("INVALID_PASSWORD", 400, "La contrasenya ha de tenir entre 6 i 72 caràcters.");
  }

  const cleanAvatarImage = sanitizeAvatarImage(avatarImage);
  const cleanAvatarColor = sanitizeAvatarColor(avatarColor);

  const passwordHash = hashPassword(password);
  const code = generateCode();

  try {
    await pool.execute(
      `INSERT INTO usuaris (nom, email, password_hash, avatar_image, avatar_color, verificat, codi_verificacio, codi_expira)
       VALUES (?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [cleanUser, cleanEmail, passwordHash, cleanAvatarImage, cleanAvatarColor, code, CODE_TTL_MINUTES]
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      if (error.message.includes("uq_usuaris_email")) {
        throw authError("EMAIL_TAKEN", 409, "Aquest correu electrònic ja està registrat.");
      }
      throw authError("USERNAME_TAKEN", 409, "Aquest nom d'usuari ja existeix.");
    }
    throw error;
  }

  await sendVerificationEmail(cleanEmail, cleanUser, code);

  return {
    requiresVerification: true,
    email: cleanEmail,
    message: "S'ha enviat un codi de verificació al teu correu.",
  };
}

export async function verifyEmailCode({ email, code }) {
  if (typeof email !== "string" || typeof code !== "string") {
    throw authError("INVALID_INPUT", 400, "Correu i codi són obligatoris.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const [rows] = await pool.execute(
    `SELECT id, nom, email, avatar_image, avatar_color, verificat, codi_verificacio,
            (codi_expira IS NOT NULL AND codi_expira > NOW()) AS is_valid_time
     FROM usuaris WHERE email = ? LIMIT 1`,
    [cleanEmail]
  );

  if (rows.length === 0) throw authError("USER_NOT_FOUND", 404, "No existeix cap compte amb aquest correu.");
  const user = rows[0];

  if (Number(user.verificat) === 1) throw authError("ALREADY_VERIFIED", 400, "Aquest compte ja està verificat.");
  if (!user.codi_verificacio || user.codi_verificacio !== cleanCode) {
    throw authError("INVALID_CODE", 400, "El codi de verificació és incorrecte.");
  }
  if (Number(user.is_valid_time) !== 1) {
    throw authError("CODE_EXPIRED", 400, "El codi ha caducat. Demana'n un de nou.");
  }

  await pool.execute(
    "UPDATE usuaris SET verificat = 1, codi_verificacio = NULL, codi_expira = NULL WHERE id = ?",
    [user.id]
  );

  const token = createSessionToken(user);
  return {
    userId: Number(user.id),
    username: user.nom,
    token,
    user: mapUserRowToPublicUser(user),
  };
}

export async function resendVerificationCode({ email }) {
  if (typeof email !== "string" || email.trim() === "") {
    throw authError("INVALID_INPUT", 400, "El correu és obligatori.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const [rows] = await pool.execute("SELECT id, nom, verificat FROM usuaris WHERE email = ? LIMIT 1", [cleanEmail]);

  if (rows.length === 0) throw authError("USER_NOT_FOUND", 404, "No existeix cap compte amb aquest correu.");
  if (Number(rows[0].verificat) === 1) throw authError("ALREADY_VERIFIED", 400, "Aquest compte ja està verificat.");

  const code = generateCode();
  await pool.execute(
    "UPDATE usuaris SET codi_verificacio = ?, codi_expira = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?",
    [code, CODE_TTL_MINUTES, rows[0].id]
  );

  await sendVerificationEmail(cleanEmail, rows[0].nom, code);
  return { email: cleanEmail, message: "S'ha reenviat un nou codi de verificació." };
}

export async function loginUser({ username, password }) {
  if (typeof username !== "string" || typeof password !== "string") {
    throw authError("INVALID_INPUT", 400, "Usuari i contrasenya són obligatoris.");
  }

  const cleanInput = username.trim();
  const [rows] = await pool.execute(
    "SELECT u.id, u.nom, u.email, u.avatar_image, u.avatar_color, u.password_hash, u.verificat, r.nom AS rol " +
      "FROM usuaris u INNER JOIN rol r ON r.id = u.rol_id " +
      "WHERE u.nom = ? OR u.email = ? LIMIT 1",
    [cleanInput, cleanInput.toLowerCase()]
  );

  if (rows.length === 0 || !verifyPassword(password, rows[0].password_hash)) {
    throw authError("INVALID_CREDENTIALS", 401, "Usuari o contrasenya incorrectes.");
  }

  const user = rows[0];
  if (Number(user.verificat) !== 1) {
    throw authError("EMAIL_NOT_VERIFIED", 403, "Has de verificar el teu correu abans d'iniciar sessió.");
  }

  const token = createSessionToken(user);
  return {
    userId: Number(user.id),
    username: user.nom,
    rol: user.rol,
    token,
    user: mapUserRowToPublicUser(user),
  };
}

//=====================
//ACTUALITZEM NOMÉS ELS CAMPS QUE ARRIBEN
//=====================
export async function updateUserAvatar({ userId, avatarImage, avatarColor }) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw authError("INVALID_INPUT", 400, "L'identificador d'usuari no és vàlid.");
  }

  const camps = [];
  const valors = [];

  //ABANS, OMETRE avatarImage ESCREVIA NULL I ESBORRAVA LA IMATGE
  if (avatarImage !== undefined && avatarImage !== null) {
    camps.push("avatar_image = ?");
    valors.push(sanitizeAvatarImage(avatarImage));
  }

  if (avatarColor !== undefined && avatarColor !== null) {
    camps.push("avatar_color = ?");
    valors.push(sanitizeAvatarColor(avatarColor));
  }

  //CAP CAMP: NO HI HA RES A ACTUALITZAR
  if (camps.length === 0) {
    return getUserProfileById(userId);
  }

  valors.push(userId);

  const sql = "UPDATE usuaris SET " + camps.join(", ") + " WHERE id = ?";
  await pool.execute(sql, valors);

  return getUserProfileById(userId);
}

export async function getUserProfileById(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    throw authError("INVALID_INPUT", 400, "L'identificador d'usuari no és vàlid.");
  }

  const [rows] = await pool.execute(
    "SELECT id, nom, email, avatar_image, avatar_color FROM usuaris WHERE id = ? LIMIT 1",
    [userId]
  );

  if (rows.length === 0) {
    throw authError("USER_NOT_FOUND", 404, "No s'ha trobat l'usuari.");
  }

  return mapUserRowToPublicUser(rows[0]);
}

export async function getUserAvatarImage(userId) {
  if (!Number.isInteger(userId) || userId <= 0) {
    return null;
  }

  const [rows] = await pool.execute("SELECT avatar_image FROM usuaris WHERE id = ? LIMIT 1", [userId]);
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is.exec(rows[0]?.avatar_image || "");
  if (!match) {
    return null;
  }

  return { mime: match[1], data: Buffer.from(match[2], "base64") };
}

//=====================
//FUNCIONS DEL PANELL D'ADMINISTRACIO
//=====================
//LLISTA TOTS ELS USUARIS SENSE CAP CONTRASENYA
export async function listUsers() {
  const [files] = await pool.query(
    "SELECT u.id, u.nom, u.email, r.nom AS rol, u.verificat, u.data_creacio " +
      "FROM usuaris u INNER JOIN rol r ON r.id = u.rol_id " +
      "ORDER BY u.id DESC"
  );

  return files;
}

//ACTUALITZA NOM I EMAIL. LA CONTRASENYA NO ES TOCA MAI
export async function updateUserByAdmin(id, dades) {
  const nom = String(dades.nom || "").trim();
  const email = String(dades.email || "").trim();

  if (nom === "" || email === "") {
    const error = new Error("Nom i email son obligatoris");
    error.code = "INVALID_INPUT";
    throw error;
  }

  const [resultat] = await pool.query(
    "UPDATE usuaris SET nom = ?, email = ? WHERE id = ?",
    [nom, email, id]
  );

  if (resultat.affectedRows === 0) {
    const error = new Error("Usuari no trobat");
    error.code = "NOT_FOUND";
    throw error;
  }

  const [files] = await pool.query(
    "SELECT u.id, u.nom, u.email, r.nom AS rol, u.verificat, u.data_creacio " +
      "FROM usuaris u INNER JOIN rol r ON r.id = u.rol_id " +
      "WHERE u.id = ?",
    [id]
  );

  return files[0];
}

//ESBORRA UN USUARI
export async function deleteUserByAdmin(id) {
  const [resultat] = await pool.query("DELETE FROM usuaris WHERE id = ?", [id]);

  if (resultat.affectedRows === 0) {
    const error = new Error("Usuari no trobat");
    error.code = "NOT_FOUND";
    throw error;
  }
}
