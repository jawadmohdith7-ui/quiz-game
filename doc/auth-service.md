# auth-service

Documentació tècnica del microservei `backend/auth-service/` (TR1 – HowMuch).

> Tot el contingut és deduït del codi del repositori. Quan una dada no es pot
> determinar llegint-lo, s'indica explícitament **no determinat**. No s'inclou
> cap valor de secret.

---

## 1. Resum i responsabilitat

`auth-service` és el microservei d'identitat de la plataforma. És una API REST
(Node.js + Express) sobre la base de dades MariaDB `howmuch`, al port **3011**.

**Què fa**

- Registre d'usuaris amb validació de camps i hash de contrasenya (scrypt).
- Verificació del compte mitjançant un codi numèric de 6 dígits enviat per
  correu (o mostrat per consola si no hi ha SMTP).
- Reenviament del codi de verificació.
- Inici de sessió per nom d'usuari **o** correu, amb emissió d'un JWT HS256.
- Lectura i actualització del perfil i de l'avatar de l'usuari autenticat.
- Servei de la imatge d'avatar com a recurs binari.
- Estadístiques bàsiques d'un usuari calculades a partir de les partides.
- CRUD d'usuaris per al panell d'administració, en rutes internes protegides.
- Registre (log) de cada resposta HTTP a la taula `registre` (excepte els
  preflight `OPTIONS`, que s'aturen abans del middleware).

**Què NO fa**

- No gestiona sales, rondes, preguntes ni respostes: això és de `game-service`
  i `catalog-service`.
- No calcula el rànquing ni l'historial de partides: això és de `stats-service`.
- No emet ni valida permisos d'altres serveis: només signa el JWT; cada servei
  el verifica pel seu compte amb `AUTH_SECRET`.
- No fa WebSocket (el panell d'admin hi arriba indirectament via
  `game-service`).
- No té refresc de token, logout ni revocació de sessions.
- No fa servir migracions pròpies: l'esquema viu a `backend/database/sql/` i
  l'aplica el contenidor de MariaDB en inicialitzar-se.

---

## 2. Stack i dependències

| Element | Valor | Evidència |
|---|---|---|
| Runtime | Node.js 22 (imatge `node:22-alpine`) | `Dockerfile` |
| Mòduls | ESM (`"type": "module"`) | `package.json` |
| Framework HTTP | Express `^4.19.2` | `package.json` |
| Base de dades | MariaDB 11, client `mysql2/promise ^3.24.6` | `docker-compose.yml`, `package.json` |
| Tokens | `jsonwebtoken ^9.0.2` (HS256) | `package.json` |
| Correu | `nodemailer ^10.6.0` | `package.json` |
| Criptografia | `node:crypto` (`scryptSync`, `randomBytes`, `randomInt`, `timingSafeEqual`) | `src/authService.js` |
| Tests | `node:test` + `node:assert/strict`, script `npm test` | `package.json`, `test/password.test.js` |

No hi ha TypeScript, ORM, validació amb llibreria (es fa a mà), ni eines de
lint. Els tests només cobreixen el hash de contrasenyes.

---

## 3. Estructura de fitxers

```text
backend/auth-service/
├── Dockerfile                  # Imatge node:22-alpine, npm install --omit=dev, EXPOSE 3011
├── package.json                # Metadades, scripts start/test i dependències
├── package-lock.json           # Arbre de dependències fixat
├── .env.example                # Plantilla de variables d'entorn (sense valors reals)
├── .env                        # Config local real (gitignorat; no es documenta)
├── src/
│   ├── server.js               # App Express: CORS, JSON, rutes, 404 i middleware d'errors
│   ├── authService.js          # Tota la lògica de negoci (registre, login, avatar, stats, admin)
│   ├── pool.js                 # Pool mysql2 (10 connexions) amb valors per defecte locals
│   ├── emailService.js         # Transport SMTP de Nodemailer i enviament del codi (o consola)
│   ├── middleware/
│   │   ├── requireAuth.js      # Valida el JWT HS256 i omple req.user
│   │   ├── requireAdmin.js     # requireAuth + comprova rol === "admin"
│   │   ├── requireInternalService.js # Compara x-internal-secret en temps constant
│   │   └── registre.js         # Insereix una fila a `registre` en acabar la resposta
│   └── admin/
│       └── admin.routes.js     # Router /internal/admin (CRUD d'usuaris)
└── test/
    └── password.test.js        # Test de hashPassword/verifyPassword (format i verificació)
```

---

## 4. Flux principal pas a pas

### 4.1 Canonada comuna a totes les peticions

1. **CORS**: s'afegeixen `Access-Control-Allow-Origin: *`,
   `Access-Control-Allow-Methods: GET,POST,PATCH,OPTIONS` i
   `Access-Control-Allow-Headers: Content-Type,Authorization`. Els `OPTIONS`
   responen `204` i s'aturen aquí.
2. **Cos JSON**: `express.json({ limit: "3mb" })`. El límit és gran perquè
   l'avatar viatja com a data URL (màxim acceptat: 2.200.000 caràcters).
3. **Registre**: `registre("auth")` escolta l'esdeveniment `finish` i fa un
   `INSERT INTO registre (servei, metode, ruta, estat)` sense bloquejar la
   resposta; si falla, només escriu a `console.error`. Els `OPTIONS` no
   s'anoten perquè el middleware de CORS respon abans d'arribar-hi.
4. **Handler**: cada ruta embolcalla la seva lògica amb `wrap()`, que envia
   qualsevol excepció al middleware d'errors.

### 4.2 Registre (`POST /register`)

1. `registerUser({ username, email, password, avatarImage, avatarColor })`.
2. Comprova que `username`, `email` i `password` siguin strings.
3. Normalitza: `username.trim()` (regex `^[a-zA-Z0-9_]{3,30}$`),
   `email.trim().toLowerCase()` (regex simple i màxim 255), contrasenya de 6 a
   72 caràcters.
4. Avatar: si és `null`/buit → `null`; ha de ser string que comenci per
   `data:image/` i com a màxim 2.200.000 caràcters. Color: `#RRGGBB` o
   `#22c55e` per defecte.
5. `hashPassword`: `salt` aleatori de 16 bytes (hex) + `scryptSync(password,
   salt, 64)` → `salt:clau` (hex).
6. Genera un codi de 6 dígits (`randomInt(100000, 1000000)`).
7. `INSERT INTO usuaris (nom, email, password_hash, avatar_image,
   avatar_color, verificat, codi_verificacio, codi_expira) VALUES (?, ?, ?, ?,
   ?, 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`. No s'especifica `rol_id`:
   agafa el `DEFAULT 1` de l'esquema (rol `usuari`). Tampoc no s'especifica
   `data_creacio` (default `CURRENT_TIMESTAMP`).
8. Si MySQL retorna `ER_DUP_ENTRY`: `EMAIL_TAKEN` si el missatge conté
   `uq_usuaris_email`, si no `USERNAME_TAKEN`.
9. `sendVerificationEmail` (SMTP o consola).
10. Resposta `201` amb `{ ok, requiresVerification: true, email, message }`.

### 4.3 Verificació (`POST /verify`)

1. Valida que `email` i `code` siguin strings i normalitza el correu.
2. `SELECT` de l'usuari per correu, calculant `is_valid_time` amb
   `codi_expira > NOW()`.
3. Comprova en aquest ordre: existeix (`404`), no verificat (`400`), codi
   coincideix (`400`), no caducat (`400`).
4. `UPDATE usuaris SET verificat = 1, codi_verificacio = NULL, codi_expira =
   NULL`.
5. Signa el JWT i respon amb `{ ok, userId, username, token, user }`
   (**sense `rol` a la resposta**).

Atenció: el `SELECT` de `/verify` no llegeix `rol`, així que `user.rol` és
`undefined` i `jsonwebtoken` **elimina la clau `rol` del token** emès per
aquesta ruta (el token de `/login` sí que la porta). Conseqüència pràctica: el
frontend desa directament aquest token i el fa servir per al joc; funciona
perquè `game-service` només en llegeix `sub`, però aquest token mai no pot
autenticar el panell (`comprovaTokenAdmin` exigeix `payload.rol === "admin"`) i
qualsevol servei que necessiti el rol el veurà `undefined`. Vegeu §6.1 i §9.14.

### 4.3.1 Reenviament del codi (`POST /resend-code`)

1. Valida que `email` sigui string i no buit (`INVALID_INPUT`).
2. `SELECT id, nom, verificat FROM usuaris WHERE email = ?`; si no existeix →
   `404 USER_NOT_FOUND`; si ja està verificat → `400 ALREADY_VERIFIED`.
3. Genera un codi nou, `UPDATE usuaris SET codi_verificacio = ?, codi_expira =
   NOW() + 15 min` (reinicia la caducitat) i torna a enviar el correu.
4. Respon `{ ok, email, message }`. No hi ha cooldown ni límit de reenviaments.

### 4.4 Inici de sessió (`POST /login`)

1. Valida `username` i `password` com a strings.
2. `SELECT ... FROM usuaris u INNER JOIN rol r ON r.id = u.rol_id WHERE u.nom =
   ? OR u.email = ? LIMIT 1` (el segon paràmetre en minúscules). El `nom` es
   compara sense `BINARY`: amb la col·lació per defecte (`utf8mb4_*_ci`) és
   insensible a majúscules, de manera que `Alex` i `alex` són el mateix compte
   (no verificat en viu).
3. Si no hi ha fila o `verifyPassword` falla → `401 INVALID_CREDENTIALS`
   (mateix missatge per als dos casos).
4. Si `verificat !== 1` → `403 EMAIL_NOT_VERIFIED`.
5. Signa el JWT i respon amb `{ ok, userId, username, rol, token, user }`.

El JWT és HS256, `expiresIn: "7d"`, amb payload
`{ sub: <id numèric>, username: <nom>, rol: <nom del rol>, iat, exp }`.

### 4.5 Rutes protegides (`PATCH /avatar`, `GET /profile/:id`)

1. `requireAuth` exigeix `Authorization: Bearer <token>`, verifica signatura i
   caducitat amb `algorithms: ["HS256"]` i comprova que `sub` sigui un enter
   positiu. Desa `req.user = { userId, username, rol }`.
2. `PATCH /avatar`: si el cos porta `userId`, ha de coincidir amb el token
   (`403 NOT_OWNER`; compara amb `Number()`). Actualitza **sempre** les dues
   columnes i retorna el perfil. Si el cos no porta `avatarImage`, s'escriu
   `NULL` (esborra l'avatar); si no porta `avatarColor`, s'escriu el color per
   defecte `#22c55e`. No hi ha manera de canviar només un dels dos camps
   conservant l'altre.
3. `GET /profile/:id`: l'ID ha de ser enter positiu i igual al del token
   (`403 NOT_OWNER`); retorna el perfil.

### 4.6 Estadístiques (`GET /stats/:id`, pública)

1. Valida l'ID numèric (`INVALID_USER_ID`).
2. Comprova que l'usuari existeixi (`USER_NOT_FOUND`).
3. Calcula, **per `nickname` = `usuaris.nom` i només partides `acabada`**:
   partides jugades (distinct), victòries (empat a punts màxim), preguntes
   respostes, respostes correctes (`posicio = 1`).
4. `accuracyPercentage` amb un decimal, o `0` si no ha respost res.

### 4.7 Avatar binari (`GET /avatar/:id`)

1. Selecciona `avatar_image`; si l'ID no és enter positiu o no hi ha imatge →
   `404`.
2. Fa match de `data:(image/...);base64,(...)`.
3. Respon amb `Content-Type` del data URL, `Cache-Control: public, max-age=60`
   i el buffer descodificat.

### 4.8 Rutes internes d'administració (`/internal/admin/*`)

1. `requireInternalService`: si `INTERNAL_SECRET` no existeix → `503`; si la
   capçalera `x-internal-secret` falta, és buida, té longitud diferent o no
   coincideix (`timingSafeEqual`) → `403`.
2. `requireAdmin`: executa `requireAuth` i després comprova `req.user.rol ===
   "admin"` → si no, `403 NOT_ADMIN`.
3. CRUD: llista, crea (reutilitza `registerUser`, per tant envia correu i deixa
   l'usuari sense verificar), edita nom+email, esborra.

---

## 5. Contracte de comunicació

### 5.1 Rutes HTTP

Format general d'error:

```json
{ "ok": false, "code": "CODI_ERROR", "reason": "Missatge per a l'usuari." }
```

| Mètode | Path | Auth | Cos d'exemple | Resposta d'exemple | Errors |
|---|---|---|---|---|---|
| `GET` | `/health` | Pública | — | `200 {"ok":true}` | — |
| `POST` | `/register` | Pública | `{"username":"alex","email":"alex@example.com","password":"secret12","avatarImage":"data:image/png;base64,AAAA","avatarColor":"#22c55e"}` | `201 {"ok":true,"requiresVerification":true,"email":"alex@example.com","message":"S'ha enviat un codi de verificació al teu correu."}` | `400 INVALID_INPUT / INVALID_USERNAME / INVALID_EMAIL / INVALID_PASSWORD / INVALID_AVATAR_IMAGE / AVATAR_TOO_LARGE / INVALID_AVATAR_COLOR`; `409 EMAIL_TAKEN / USERNAME_TAKEN`; `413` cos > 3 MB; `503` BD; `500` si falla l'enviament SMTP (el compte ja s'ha creat) |
| `POST` | `/verify` | Pública | `{"email":"alex@example.com","code":"123456"}` | `200 {"ok":true,"userId":2,"username":"alex","token":"<jwt>","user":{"id":2,"name":"alex","email":"alex@example.com","avatarImage":"","avatarColor":"#22c55e"}}` | `400 INVALID_INPUT / ALREADY_VERIFIED / INVALID_CODE / CODE_EXPIRED`; `404 USER_NOT_FOUND` |
| `POST` | `/resend-code` | Pública | `{"email":"alex@example.com"}` | `200 {"ok":true,"email":"alex@example.com","message":"S'ha reenviat un nou codi de verificació."}` | `400 INVALID_INPUT / ALREADY_VERIFIED`; `404 USER_NOT_FOUND` |
| `POST` | `/login` | Pública | `{"username":"alex","password":"secret12"}` | `200 {"ok":true,"userId":2,"username":"alex","rol":"usuari","token":"<jwt>","user":{"id":2,"name":"alex","email":"alex@example.com","avatarImage":"","avatarColor":"#22c55e"}}` | `400 INVALID_INPUT`; `401 INVALID_CREDENTIALS`; `403 EMAIL_NOT_VERIFIED` |
| `PATCH` | `/avatar` | JWT | `{"userId":2,"avatarImage":"data:image/png;base64,AAAA","avatarColor":"#0ea5e9"}` | `200 {"ok":true,"user":{"id":2,"name":"alex","email":"alex@example.com","avatarImage":"data:image/png;base64,AAAA","avatarColor":"#0ea5e9"}}` | `400 INVALID_INPUT / INVALID_AVATAR_IMAGE / AVATAR_TOO_LARGE / INVALID_AVATAR_COLOR`; `401 NO_TOKEN / INVALID_TOKEN`; `403 NOT_OWNER`; `404 USER_NOT_FOUND`; `503 AUTH_NOT_CONFIGURED` |
| `GET` | `/profile/:id` | JWT | — | `200 {"ok":true,"user":{"id":2,"name":"alex","email":"alex@example.com","avatarImage":"","avatarColor":"#22c55e"}}` | `400 INVALID_INPUT`; `401 NO_TOKEN / INVALID_TOKEN`; `403 NOT_OWNER`; `404 USER_NOT_FOUND`; `503 AUTH_NOT_CONFIGURED` |
| `GET` | `/stats/:id` | Pública | — | `200 {"ok":true,"userId":2,"nickname":"alex","gamesPlayed":3,"gamesWon":1,"answeredQuestions":30,"correctAnswers":18,"accuracyPercentage":60}` | `400 INVALID_USER_ID`; `404 USER_NOT_FOUND` |
| `GET` | `/avatar/:id` | Pública | — | `200` binari amb `Content-Type: image/png` (o el MIME del data URL) | `404 {"ok":false,"reason":"Sense avatar"}` (sense camp `code`) |
| `GET` | `/internal/admin/usuaris` | `x-internal-secret` + JWT admin | — | `200 {"ok":true,"usuaris":[{"id":1,"nom":"admin","email":"admin@example.com","rol":"admin","verificat":1,"data_creacio":"2026-01-01T10:00:00.000Z"}]}` | `401 NO_TOKEN / INVALID_TOKEN`; `403 INTERNAL_ACCESS_DENIED / NOT_ADMIN`; `503 INTERNAL_ACCESS_NOT_CONFIGURED / AUTH_NOT_CONFIGURED`; `500 {"ok":false,"reason":"..."}` |
| `POST` | `/internal/admin/usuaris` | `x-internal-secret` + JWT admin | `{"nom":"nou","email":"nou@example.com","password":"secret12"}` | `201 {"ok":true,"usuari":{"email":"nou@example.com"}}` | `400` **sempre** (qualsevol error, amb `code` intern si n'hi ha); `403`/`503` dels middlewares |
| `PATCH` | `/internal/admin/usuaris/:id` | `x-internal-secret` + JWT admin | `{"nom":"canviat","email":"canviat@example.com"}` | `200 {"ok":true,"usuari":{"id":2,"nom":"canviat","email":"canviat@example.com","rol":"usuari","verificat":0,"data_creacio":"2026-01-01T10:00:00.000Z"}}` | `400` **sempre** (inclou `NOT_FOUND` i errors de BD); `403`/`503` |
| `DELETE` | `/internal/admin/usuaris/:id` | `x-internal-secret` + JWT admin | — | `200 {"ok":true}` | `400` **sempre** (inclou `NOT_FOUND`); `403`/`503` |

**Notes de contracte:**

- `GET /health` no consulta la BD: retorna `{ok:true}` encara que MariaDB estigui
  caiguda.
- `PATCH /avatar` no és parcial: els camps absents es tracten com a `null` i
  s'escriuen (imatge `NULL`, color per defecte).
- Un cos que supera `3mb` el talla `express.json` amb `413`; com que l'error no
  porta `code`, el JSON de resposta surt amb `"code":"INTERNAL_ERROR"` i el
  missatge del parser com a `reason`.
- Les rutes d'admin retornen els camps tal com surten de MySQL (`verificat` com
  a número `0/1`, `data_creacio` com a `Date` serialitzada a ISO).

**Middleware per ruta:** totes passen per `corsMiddleware` →
`express.json({limit:"3mb"})` → `registre("auth")`. A més: `/avatar` i
`/profile/:id` fan servir `requireAuth`; tot `/internal/admin/*` fa servir
`requireInternalService` → `requireAdmin`; la resta només `wrap()` (que envia
excepcions al middleware d'errors).

**Codis de negoci:**

| Codi | HTTP | Condició / missatge |
|---|---|---|
| `INVALID_INPUT` | 400 | Falta un string obligatori (`"Usuari, correu i contrasenya són obligatoris."`, `"Correu i codi són obligatoris."`, `"Usuari i contrasenya són obligatoris."`) o `userId` no vàlid |
| `INVALID_USERNAME` | 400 | No compleix `^[a-zA-Z0-9_]{3,30}$` (`"El nom d'usuari ha de tenir entre 3 i 30 caràcters alfanumèrics."`) |
| `INVALID_EMAIL` | 400 | No compleix regex simple o > 255 caràcters |
| `INVALID_PASSWORD` | 400 | Longitud < 6 o > 72 |
| `INVALID_AVATAR_IMAGE` | 400 | No és string o no comença per `data:image/` |
| `AVATAR_TOO_LARGE` | 400 | > 2.200.000 caràcters |
| `INVALID_AVATAR_COLOR` | 400 | No compleix `^#[0-9a-fA-F]{6}$` |
| `EMAIL_TAKEN` / `USERNAME_TAKEN` | 409 | `ER_DUP_ENTRY` amb `uq_usuaris_email` / qualsevol altre |
| `USER_NOT_FOUND` | 404 | No hi ha fila (també a `updateUserAvatar` si `affectedRows = 0`) |
| `ALREADY_VERIFIED` | 400 | `verificat = 1` a `/verify` o `/resend-code` |
| `INVALID_CODE` | 400 | `codi_verificacio` buit o diferent (comparació `!==`) |
| `CODE_EXPIRED` | 400 | `codi_expira` nul o anterior a `NOW()` |
| `INVALID_CREDENTIALS` | 401 | Usuari inexistent o contrasenya incorrecta (mateix missatge) |
| `EMAIL_NOT_VERIFIED` | 403 | Contrasenya correcta però `verificat != 1` |
| `NOT_OWNER` | 403 | `userId`/`:id` diferent del `sub` del token |
| `INVALID_USER_ID` | 400 | `/stats/:id` no és enter > 0 |
| `NOT_ADMIN` | 403 | Token vàlid sense `rol === "admin"` |
| `NOT_FOUND` | 400 | `PATCH`/`DELETE` d'admin sense files afectades |

Codis transversals:

| Codi | HTTP | Origen |
|---|---|---|
| `INVALID_JSON` | 400 | Cos no parsejable (`entity.parse.failed`) |
| `ROUTE_NOT_FOUND` | 404 | Ruta desconeguda |
| `INTERNAL_ERROR` | 500 | Excepció no controlada (el `reason` s'amaga) |
| `ECONNREFUSED`, `PROTOCOL_CONNECTION_LOST` | 503 | Sense connexió a MariaDB (`reason` de BD) |
| `AUTH_NOT_CONFIGURED` | 503 | Falta `AUTH_SECRET` en validar un token |
| `INTERNAL_ACCESS_NOT_CONFIGURED` | 503 | Falta `INTERNAL_SECRET` |
| `INTERNAL_ACCESS_DENIED` | 403 | Secret intern absent o incorrecte |

Els `OPTIONS` (preflight) responen `204` sense cos.

### 5.2 WebSocket

`auth-service` **no exposa cap WebSocket** ni cap tipus de missatge propi.

El panell d'administració, però, arriba a les rutes internes d'aquest servei a
través del WebSocket de `game-service`. Aquest tram és de `game-service`; es
documenta aquí només com a contracte indirecte:

| `type` (game-service) | Payload | Ruta interna cridada | Ack (resposta WS) |
|---|---|---|---|
| `admin:auth` | `{"token":"<jwt>"}` | — (només verifica JWT) | `admin:auth:ok {"type":"admin:auth:ok","requestId":null,"ok":true,"usuari":"admin"}` o `admin:auth:error` |
| `admin:usuaris:list` | `{}` | `GET /internal/admin/usuaris` | `{"type","requestId","ok","usuaris","reason"}` |
| `admin:usuaris:create` | `{"dades":{"nom":"...","email":"...","password":"..."}}` | `POST /internal/admin/usuaris` | `{"type","requestId","ok","usuari","reason"}` |
| `admin:usuaris:update` | `{"id":2,"dades":{"nom":"...","email":"..."}}` | `PATCH /internal/admin/usuaris/2` | `{"type","requestId","ok","usuari","reason"}` |
| `admin:usuaris:delete` | `{"id":2}` | `DELETE /internal/admin/usuaris/2` | `{"type","requestId","ok","reason"}` |

`game-service` hi afegeix `Authorization: Bearer <token admin>` i
`x-internal-secret` a cada crida.

---

## 6. Comunicació amb altres serveis i la BD

### 6.1 Serveis

| Origen → destí | URL | Com |
|---|---|---|
| Vue → auth-service | `VITE_AUTH_BASE_URL` o `http://localhost:3011` | `fetch` directe des del navegador (`frontend/client-vue/src/services/authApi.js`) |
| Vue → imatge d'avatar | `VITE_AUTH_BASE_URL` (per defecte `http://localhost:3011`) + `/avatar/:id` | `<img :src>` a `PlayerAvatar.vue` |
| game-service → auth-service | `AUTH_URL` (`http://auth-service:3011` a Compose) | `cridaAuth()` amb `x-internal-secret` + JWT admin |
| auth-service → SMTP | `SMTP_HOST:SMTP_PORT` | Nodemailer; si falta configuració, el codi surt per consola |
| auth-service → altres serveis | — | **No fa cap crida sortint** a game/catalog/stats |

`auth-service` no publica ni consumeix esdeveniments. La resta de serveis no li
pregunten res: verifiquen el JWT localment amb el mateix `AUTH_SECRET`
(`game-service/src/guests/verifyAuthToken.js`, `game-service/src/admin/adminAuth.js`,
`stats-service/src/auth.middleware.js`).

Contracte compartit del token:

```json
{ "sub": 2, "username": "alex", "rol": "usuari", "iat": 1760000000, "exp": 1760604800 }
```

- Algoritme: HS256, 7 dies de validesa (`TOKEN_TTL = "7d"`).
- `sub` sempre numèric (l'`id` de `usuaris`).
- `rol` és el `nom` de la taula `rol` (`"usuari"` o `"admin"`), però **només
  existeix al token emès per `/login`**. El token de `/verify` no porta `rol`
  perquè la seva consulta no el selecciona (§4.3); els serveis que llegeixin
  `rol` han de tolerar `undefined`.
- `x-internal-secret` és el segon secret compartit entre serveis (no forma part
  del JWT).

### 6.2 Variables d'entorn (nom i valor per defecte)

| Variable | Per defecte al codi | Ús |
|---|---|---|
| `PORT` | `3011` | Port HTTP; si la variable és buida o absent s'usa 3011 |
| `DB_HOST` | `localhost` | Pool `mysql2` |
| `DB_PORT` | `3306` | Pool `mysql2` |
| `DB_USER` | `root` | Pool `mysql2` |
| `DB_PASSWORD` | `""` (buit) | Pool `mysql2` |
| `DB_NAME` | `howmuch` | Pool `mysql2` |
| `AUTH_SECRET` | **cap** | Signatura i verificació JWT. Si falta o és buit, `authService.js` llança en carregar-se i el procés no arrenca |
| `INTERNAL_SECRET` | **cap** | Secret de servei. Si falta, el servei arrenca però `/internal/admin/*` respon `503 INTERNAL_ACCESS_NOT_CONFIGURED` |
| `SMTP_HOST` | `""` | Juntament amb `SMTP_USER` i `SMTP_PASS`, decideix si es crea el transport SMTP (els tres han d'existir) |
| `SMTP_PORT` | `587` | Port SMTP |
| `SMTP_SECURE` | `false` | Només activa TLS si el valor és exactament la cadena `"true"` |
| `SMTP_USER` | `""` | Usuari SMTP i remitent per defecte |
| `SMTP_PASS` | `""` | Contrasenya SMTP |
| `SMTP_FROM` | `"HowMuch" <SMTP_USER>` | Remitent del correu |

Detalls:

- El transport es construeix **una sola vegada** en importar `emailService.js`.
  Si falta qualsevol de les tres variables (`SMTP_HOST`, `SMTP_USER`,
  `SMTP_PASS`), `transporter` és `null` i el codi surt per consola amb el format
  `[EMAIL DEV] Destinatari: ... / [EMAIL DEV] Codi de verificació: ...`.
- `AUTH_SECRET` no apareix a l'`environment` de Compose: només pot arribar del
  `.env` del servei (o de l'entorn del contenidor).
- `NODE_ENV` no s'usa enlloc del servei.

(`VITE_AUTH_BASE_URL` és del frontend, no del servei.)

### 6.3 Base de dades

Base: `howmuch` (MariaDB 11). Pool: 10 connexions, `waitForConnections`.

| Taula | Operacions | Columnes rellevants |
|---|---|---|
| `usuaris` | `INSERT`, `SELECT`, `UPDATE`, `DELETE` | `id`, `nom`, `email`, `password_hash`, `avatar`, `avatar_image`, `avatar_color`, `rol_id`, `verificat`, `codi_verificacio`, `codi_expira`, `data_creacio` |
| `rol` | `SELECT` (join) | `id`, `nom` (`usuari`=1, `admin`=2) |
| `partida` | `SELECT` (stats) | `id`, `estat = 'acabada'` |
| `participant` | `SELECT` (stats) | `id`, `partida_id`, `nickname` |
| `resposta` | `SELECT` (stats) | `participant_id`, `ronda_id`, `punts`, `posicio` |
| `ronda` | `SELECT` (stats) | `id`, `partida_id` |
| `registre` | `INSERT` (cada resposta HTTP) | `servei` (`'auth'`), `metode`, `ruta` (`req.path`, sense query), `estat`, `creat_at` |

Columnes i detalls que el codi assumeix:

- `usuaris.rol_id BIGINT UNSIGNED NOT NULL DEFAULT 1` amb FK a `rol(id)`; el
  registre no l'envia i cau al default.
- `usuaris.avatar VARCHAR(32) NOT NULL` és una columna heretada amb un valor per
  defecte que apareix mal codificat al fitxer SQL: el servei no la llegeix ni
  l'escriu mai. L'avatar real és `avatar_image LONGTEXT NULL`.
- `usuaris.nom` té `CHECK (CHAR_LENGTH(TRIM(nom)) BETWEEN 3 AND 30)` i
  `usuaris.email` no té `CHECK`; la validació de format la fa només el servei.
  Els `UNIQUE` són `uq_usuaris_nom` i `uq_usuaris_email` (l'error de duplicat es
  distingeix pel nom del constraint al missatge de MySQL).
- `registre.estat` és `SMALLINT UNSIGNED`; s'hi desa el codi HTTP.
- Existeix una taula `partides` (plural, per a `stats-service`) que
  `auth-service` no toca; no s'ha de confondre amb `partida`.

**Migracions / esquema**: no n'hi ha dins del servei. L'esquema s'inicialitza
amb `backend/database/sql/schema.sql` i `backend/database/sql/dades-inicials.sql`,
muntats al contenidor de MariaDB com a `/docker-entrypoint-initdb.d/01-*.sql` i
`02-*.sql`. `schema.sql` fa `DROP TABLE IF EXISTS usuaris` abans de crear-la:
reaplicar-lo esborra els usuaris (i `dades-inicials.sql` no és idempotent: els
`INSERT` de `rol` i `usuaris` fallen si ja existeixen). Les migracions de
`backend/database/sql/migrations/` són de preguntes/dificultats, no toquen
`usuaris`.

**Codis d'error de BD que el servei interpreta**: `ER_DUP_ENTRY` (mapa a
`EMAIL_TAKEN`/`USERNAME_TAKEN`), `ECONNREFUSED` i `PROTOCOL_CONNECTION_LOST`
(mapa a `503`).

---

## 7. Configuració i arrencada

### 7.1 En local

```bash
cd backend/auth-service
cp .env.example .env     # primer cop (PowerShell: Copy-Item .env.example .env)
npm install
npm start                # node --env-file-if-exists=.env src/server.js
npm test                 # node --test
```

`package.json` només té dos scripts, `start` i `test`; no hi ha `dev`, ni lint,
ni build. `start` aprofita `--env-file-if-exists`, de manera que arrenca sense
`.env` si les variables ja són a l'entorn. El test defineix `AUTH_SECRET` abans
d'importar el mòdul i **no necessita BD**.

`AUTH_SECRET` és obligatori: `authService.js` llança un error en carregar-se si
falta i el procés no arrenca. Sense SMTP configurat el servei funciona, però el
codi de verificació només surt per consola.

### 7.2 Docker

```bash
docker build -t auth-service ./backend/auth-service
docker run --env-file backend/auth-service/.env -p 3011:3011 auth-service
```

El `Dockerfile` fa `npm install --omit=dev`, copia només `src/` i arrenca amb
`node src/server.js` (les variables li arriben per `env_file`).

### 7.3 Docker Compose

```bash
docker compose up --build auth-service
```

Al `docker-compose.yml`:

- Servei `auth-service`, `container_name: auth-service`, port `3011:3011`,
  `restart: unless-stopped`, xarxa `tr1-network`.
- `env_file: ./backend/auth-service/.env` (aquí viu `AUTH_SECRET` i la config
  SMTP).
- `environment` fixa `PORT`, `DB_HOST=mariadb`, `DB_PORT`, `DB_USER`,
  `DB_PASSWORD`, `DB_NAME` i `INTERNAL_SECRET` (aquest últim interpolat de
  `${INTERNAL_SECRET}` del `.env` de l'arrel). Docker Compose aplica
  `environment` **després** de `env_file`, així que aquests valors guanyen.
- `AUTH_SECRET` **no** apareix a `environment`; només pot venir del
  `.env` del servei.
- `depends_on: mariadb` sense condició de salut; el servei no té healthcheck
  propi (només en té MariaDB).

---

## 8. Fitxers clau

| Path | Responsabilitat |
|---|---|
| `backend/auth-service/src/server.js` | Defineix l'app Express, CORS, límit de cos, totes les rutes públiques/protegides, 404 i traducció d'errors. |
| `backend/auth-service/src/authService.js` | Lògica completa: validacions, scrypt, codi de verificació, JWT, perfil, avatar, stats i funcions d'admin. |
| `backend/auth-service/src/pool.js` | Pool `mysql2` compartit per totes les consultes i pel registre. |
| `backend/auth-service/src/emailService.js` | Transport SMTP opcional i enviament del codi; fallback per consola. |
| `backend/auth-service/src/middleware/requireAuth.js` | Contracte JWT: `Bearer`, HS256, `sub` numèric, `req.user`. |
| `backend/auth-service/src/middleware/requireAdmin.js` | Restringeix les rutes d'admin al rol `admin`. |
| `backend/auth-service/src/middleware/requireInternalService.js` | Autenticació servei-a-servei amb comparació en temps constant. |
| `backend/auth-service/src/middleware/registre.js` | Auditoria HTTP a la taula `registre`. |
| `backend/auth-service/src/admin/admin.routes.js` | CRUD intern d'usuaris i el seu format de resposta propi. |
| `backend/auth-service/test/password.test.js` | Únic test: format `salt:clau`, que el hash no contingui la contrasenya i que `verifyPassword` accepti/rebutgi. |
| `backend/auth-service/Dockerfile` | `node:22-alpine`, `npm install --omit=dev`, només copia `src/`, `EXPOSE 3011`. |
| `backend/database/sql/schema.sql` | Esquema de `usuaris`, `rol`, `registre` i taules de joc que llegeixen les stats. |
| `backend/database/sql/dades-inicials.sql` | Rols 1/2, usuari `admin` verificat, 8 categories i 31 preguntes (no idempotent). |

---

## 9. Riscos i punts febles observats

1. **`/stats/:id` i `/avatar/:id` són públics i enumerables.** Qualsevol pot
   recórrer IDs i obtenir nickname, partides, victòries i precisió, o la imatge
   d'avatar. No hi ha auth ni rate limit (`server.js`).
2. **Sense rate limiting ni bloqueig d'intents** a `/login`, `/verify` i
   `/resend-code`. El codi és de 6 dígits, viu 15 minuts i admet intents
   il·limitats; a més, cada reenviament genera correu nou. No hi ha cap
   comptador a `usuaris` ni middleware de limitació.
3. **Sessions sense revocació.** El JWT dura 7 dies, no hi ha logout ni
   llista negra, i `requireAuth` no consulta la BD: un usuari esborrat o degradat
   conserva accés fins que caduca el token, amb el `rol` antic incrustat.
4. **Estadístiques lligades al nickname, no a l'ID.** `getUserStats` fa
   `participant.nickname = usuaris.nom`; convidats o usuaris amb el mateix nom
   contaminen les dades i un canvi de nom perd l'historial.
5. **`affectedRows === 0` es tracta com a "no trobat".** `updateUserAvatar` i
   `updateUserByAdmin` llancen `USER_NOT_FOUND`/`NOT_FOUND` si l'`UPDATE` no
   canvia cap valor; el pool no activa `FOUND_ROWS`, així que desar el mateix
   avatar o editar sense canvis pot retornar error.
6. **Registre parcial si falla el correu.** El `INSERT` es fa abans de
   `sendVerificationEmail`; si l'enviament peta, el client rep `500` però el
   compte ja existeix. Sense SMTP, el codi acaba als logs del servidor i el
   correu no s'envia mai.
7. **Avatar poc restrictiu i pesat.** S'accepta qualsevol `data:image/...`
   (inclòs `image/svg+xml`) fins a 2,2 MB, es desa a `LONGTEXT` i es torna a
   servir amb el MIME indicat pel client; a més, viatja dins de `/profile` i de
   la resposta de `/login`, i infla les respostes.
8. **Rutes d'admin: errors sempre `400` i missatges crus.** `admin.routes.js`
   captura qualsevol error i respon `400` amb `error.message` (pot exposar
   errors SQL); `PATCH` no valida format de nom/correu i pot violar els `CHECK`
   de la taula. Tampoc no es pot canviar `rol` ni `verificat` des del panell.
9. **Compte admin sembrat amb contrasenya feble.** `dades-inicials.sql` crea un
   admin verificat i documenta la contrasenya en un comentari; si la BD es
   reinicialitza en un entorn real, l'accés és trivial.
10. **`/health` no comprova la BD** i respon `{ok:true}` sempre; Compose no té
    healthcheck per a `auth-service` i `depends_on` no espera MariaDB, així que
    el servei pot rebre tràfic abans que la BD estigui a punt (les peticions
    fallen amb `503`).
11. **`scryptSync` bloqueja l'event loop** durant registre i login; amb
    connexions concurrents la latència del servei sencer puja.
12. **CORS obert (`*`) amb `Authorization` permès** i token desat a
    `localStorage` al frontend: qualsevol origen pot cridar l'API i un XSS pot
    robar la sessió.
13. **`/register`, `/verify` i `/resend-code` permeten enumerar comptes**
    (`USER_NOT_FOUND`) i no tenen cooldown; el codi es compara amb `!==` (no en
    temps constant), tot i que el risc pràctic és menor que el dels intents
    il·limitats.
14. **Contracte inconsistent entre `/login` i `/verify`**: el primer retorna
    `rol` i el segon no. A més, com que el `SELECT` de `/verify` no llegeix
    `rol`, el token que emet tampoc no porta aquesta clau: qui només verifica el
    compte rep un JWT sense rol.
15. **`PATCH /avatar` no és parcial i pot esborrar l'avatar.** Enviar només el
    color (o un cos buit) desa `avatar_image = NULL` i el color per defecte; no
    hi ha cap manera de conservar la imatge existent si no es reenvia sencera.
16. **El panell d'admin no pot assignar rol ni contrasenya.** `POST` crea sempre
    amb el rol per defecte (`usuari`, `rol_id = 1`) i `PATCH` només toca `nom` i
    `email`; canviar un usuari a admin exigeix SQL manual (ho indica el comentari
    final de `dades-inicials.sql`) i no hi ha restabliment de contrasenya.
17. **Victòries amb zero punts compten.** La consulta de `gamesWon` compara la
    suma de punts amb el màxim de la partida; si tothom ha quedat a 0, tots els
    participants empatats surten com a guanyadors.