const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3011" : "/auth-api");

//CLAU DE localStorage ON DESEM EL TOKEN JWT DE LA SESSIÓ
const TOKEN_STORAGE_KEY = "authToken";

//LLEGIM EL TOKEN DESAT (CADENA BUIDA SI NO N'HI HA)
function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || "";
}

//DESEM EL TOKEN DE LA SESSIÓ
function storeToken(token) {
  if (typeof token !== "string" || token === "") {
    return;
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

async function request(path, options = {}) {
  const response = await fetch(`${AUTH_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const fallback = "S'ha produït un error inesperat";
    const message = payload?.reason || payload?.error?.message || fallback;
    throw new Error(message);
  }

  return payload;
}

export async function registerUser({
  name,
  email,
  password,
  avatarImage,
  avatarColor,
}) {
  const payload = await request("/register", {
    method: "POST",
    body: JSON.stringify({
      username: name,
      email,
      password,
      avatarImage,
      avatarColor,
    }),
  });

  return payload;
}

export async function loginUser({ email, password }) {
  const payload = await request("/login", {
    method: "POST",
    body: JSON.stringify({ username: email, password }),
  });

  //GUARDEM EL TOKEN PER A LES RUTES PROTEGIDES
  storeToken(payload.token);

  return {
    id: payload.userId,
    name: payload.username,
    email: payload.user?.email || email,
    avatarImage: payload.user?.avatarImage || "",
    avatarColor: payload.user?.avatarColor || "#22c55e",
    token: payload.token,
    rol: payload.rol,
  };
}

export async function verifyEmailCode({ email, code }) {
  const payload = await request("/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });

  //GUARDEM EL TOKEN PER A LES RUTES PROTEGIDES
  storeToken(payload.token);

  return {
    id: payload.userId,
    name: payload.username,
    email: payload.user?.email || email,
    avatarImage: payload.user?.avatarImage || "",
    avatarColor: payload.user?.avatarColor || "#22c55e",
    token: payload.token,
    rol: payload.rol,
  };
}

export async function resendVerificationCode({ email }) {
  return request("/resend-code", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function getAvatarColorOptions() {
  return ["#22c55e", "#0ea5e9", "#f97316", "#a855f7"];
}

export async function updateAvatar({ userId, avatarImage, avatarColor }) {
  const payload = await request("/avatar", {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${getStoredToken()}`,
    },
    body: JSON.stringify({ userId, avatarImage, avatarColor }),
  });

  return payload.user;
}
