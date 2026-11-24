# Documentació

Documentació tècnica del projecte **tr1-dam-equip6** (quiz multijugador amb microserveis).
Cada document segueix la mateixa estructura de 9 seccions: resum, stack, estructura de fitxers,
flux principal, contracte, comunicació/BD, configuració, fitxers clau i riscos.

## Índex

| Document | Què explica |
|----------|-------------|
| [`auth-service.md`](auth-service.md) | Registre, login, JWT, verificació per correu, avatars i estadístiques d'usuari |
| [`catalog-service.md`](catalog-service.md) | Categories, dificultats, preguntes i partides del catàleg (rutes `/internal/*`) |
| [`game-service.md`](game-service.md) | Motor de joc: protocol WebSocket de joc i `admin:*`, sales, rànquing i persistència |
| [`stats-service.md`](stats-service.md) | Estadístiques, rànquing públic i mètriques d'admin (`usage`, `registre`) |
| [`bbdd.md`](bbdd.md) | Base de dades MariaDB: taules, relacions, connexions per servei i incongruències |
| [`frontend-vue.md`](frontend-vue.md) | Client web Vue 3: vistes, stores, servei WebSocket, rutes i admin |
| [`frontend-unity.md`](frontend-unity.md) | Client Unity: escenes, connexió WS, contracte de missatges |
| [`projecte.md`](projecte.md) | Visió del projecte, disseny UX/UI, arquitectura, accés a dades i backlog |

## Arquitectura en una línia

```
Vue / Unity  ──WS──▶  game-service  ──HTTP /internal/*──▶  auth-service
                              │                    ├──▶  catalog-service
                              └──HTTP /stats/*─────┴──▶  stats-service
                                            MariaDB (una BD, taules per servei)
```

## Entorn de desenvolupament

Dos camins possibles:

**Tot amb Docker:**

- `docker-compose.dev.yml`: stack sencer de desenvolupament (ports oberts, phpMyAdmin i Vite).
- `docker-compose.yml`: producció (només nginx és públic; els secrets surten del `.env` de l'arrel).

```bash
docker compose -f docker-compose.dev.yml up -d   # desenvolupament
docker compose up -d --build                     # producció
docker compose logs -f game-service
docker compose down           # conserva les dades
docker compose down -v        # ESBORRA el volum mariadb_data (torna a executar schema.sql)
```

| Contenidor | Imatge / build | Port | Notes |
|---|---|---|---|
| `mariadb` | `mariadb:11` | 3306 | BD `howmuch`, root/root; munta `schema.sql` i `dades-inicials.sql` com a init scripts (només s'executen amb el volum buit) |
| `phpmyadmin` | `phpmyadmin` | 8081 | Administració web de la BD |
| `game-service` | `backend/game-service/Dockerfile` | `${PORT}` (3000) | Depèn de catàleg, auth i stats |
| `catalog-service` | `backend/catalog-service/Dockerfile` | 3001 | `PORT` del codi està fixat a 3001 |
| `auth-service` | `backend/auth-service/Dockerfile` | 3011 | |
| `stats-service` | `backend/stats-service/Dockerfile` | 3012 | Usa `DB_PASS`, els altres `DB_PASSWORD` |
| `client-vue` | `frontend/client-vue/Dockerfile` | 5173 | Servidor de Vite |

**En local** (serveis amb `npm`, només la BD a Docker):

```bash
docker compose up -d mariadb
cd backend/game-service && npm install && npm start
cd frontend/client-vue && npm install && npm run dev
```

Variables d'entorn i ports concrets: secció 7 de cada document. El directori `dev/` és un placeholder buit (només READMEs): la infraestructura real viu a l'arrel.

## On són els endpoints

- **WebSocket de joc:** `game-service`, port 3000 (`ws://localhost:3000`) — vegeu `game-service.md`, secció 5.
- **HTTP intern:** `/internal/*` amb capçalera `x-internal-secret` — vegeu `auth-service.md`, `catalog-service.md` i `stats-service.md`.
- **HTTP públic:** `/stats/ranking` i endpoints d'auth — vegeu els mateixos documents.

## Altres documents

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — visió global de carpetes i responsabilitats.
- [`../README.md`](../README.md) — presentació del projecte i posada en marxa ràpida.
