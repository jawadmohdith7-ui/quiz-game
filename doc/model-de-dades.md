# Model de dades de How Much?! LIVE

Aquest document recull el diagrama entitat-relació (ER) i el model relacional
de la base de dades `howmuch`, definida a
[`backend/database/sql/schema.sql`](../backend/database/sql/schema.sql).

## 1. Diagrama entitat-relació

![alt text](<Workshop Request Management-2026-11-22-165437.png>)

`partides` i `registre` no formen part del cicle de joc: `partides` és l'agregat
per usuari que consumeix `stats-service` i `registre` és un log d'accessos HTTP
sense cap relació. Es dibuixen igualment perquè són taules de l'esquema.

### 1.1 Multiplicitats de les associacions

| Associació | Multiplicitats (llegides) | On es veu a l'esquema |
| --- | --- | --- |
| categoria — pregunta | 1 a N (una categoria té 0..N preguntes; una pregunta té exactament 1 categoria) | `pregunta.categoria_id NOT NULL` + `fk_pregunta_categoria ... ON DELETE RESTRICT` |
| partida — participant | 1 a N (una partida té 2..20 participants; un participant és d'1 partida) | `participant.partida_id NOT NULL` + `chk_partida_max_jugadors` 2–20 |
| partida — ronda | 1 a N (una partida té 0..N rondes; una ronda és d'1 partida) | `ronda.partida_id NOT NULL` + `uq_ronda_partida_numero` |
| pregunta — ronda | 1 a N (una pregunta pot sortir en 0..N rondes; una ronda té 1 pregunta) | `ronda.pregunta_id NOT NULL` + `uq_ronda_partida_pregunta` |
| participant — resposta | 1 a N (un participant fa 0..N respostes, com a màxim una per ronda; una resposta és d'1 participant) | `uq_resposta_ronda_participant` + FK composta `(participant_id, partida_id)` |
| ronda — resposta | 1 a N (una ronda té 0..N respostes; una resposta és d'1 ronda) | FK composta `(ronda_id, partida_id)` |
| rol — usuari | 1 a N (un rol té 0..N usuaris; un usuari té 1 rol) | `usuaris.rol_id` + `fk_usuari_rol ... ON DELETE RESTRICT` |
| usuari — partides | 1 a N opcional (un usuari té 0..N partides desades; una partida desada és d'0..1 usuari) | `partides.usuari_id` nullable + `ON DELETE SET NULL` |

## 2. Model relacional

Subratllat (`PK`) = clau primària. `FK` = clau forana. `UK` = restricció `UNIQUE`.

### Catàleg i joc

- **categoria** (<u>id</u>, nom _UK_)
- **pregunta** (<u>id</u>, categoria_id → categoria.id, text, resposta_correcta, min_value, max_value, step_value, unitat, dificultat, explicacio)
- **partida** (<u>id</u>, tipus, codi _UK_, estat, max_jugadors, dificultat, data_inici, data_fi, data_creacio)
- **participant** (<u>id</u>, partida*id → partida.id, nickname) — \_UK (partida_id, nickname)*
- **ronda** (<u>id</u>, partida*id → partida.id, pregunta_id → pregunta.id, numero, estat) — \_UK (partida_id, numero)*, _UK (partida_id, pregunta_id)_
- **resposta** (<u>id</u>, partida*id, ronda_id → ronda(id, partida_id), participant_id → participant(id, partida_id), valor, posicio, punts) — \_UK (ronda_id, participant_id)*

### Usuaris i estadístiques

- **rol** (<u>id</u>, nom _UK_)
- **usuaris** (<u>id</u>, rol*id → rol.id, nom \_UK*, email _UK_, password_hash, avatar, avatar_image, avatar_color, verificat, codi_verificacio, codi_expira, data_creacio)
- **partides** (<u>id</u>, usuari*id → usuaris.id \_NULL*, nom_sala, categoria, posicio, encerts, rondes, data_partida)
- **registre** (<u>id</u>, servei, metode, ruta, estat, creat_at)

## 3. Regles d'integritat

| Regla                            | Com s'aplica                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Clau primària autoincremental    | `AUTO_INCREMENT` a totes les taules del joc.                                                                                                                                                                                                                                                                                                                                                                                      |
| Relacions obligatòries           | `FOREIGN KEY ... NOT NULL` a `pregunta`, `participant`, `ronda` i `resposta`.                                                                                                                                                                                                                                                                                                                                                     |
| Esborrat en cascada              | `participant`, `ronda` i `resposta` s'esborren amb la seva partida, ronda o participant (`ON DELETE CASCADE`).                                                                                                                                                                                                                                                                                                                    |
| Esborrat protegit                | Una `categoria` no es pot esborrar si té preguntes; un `rol` no es pot esborrar si té usuaris (FK `fk_usuari_rol`); una `pregunta` no es pot esborrar si és a una ronda (`ON DELETE RESTRICT`).                                                                                                                                                                                                                                   |
| Esborrat amb preservació         | `partides.usuari_id` és `NULL`-able i la FK és `ON DELETE SET NULL`: si s'esborra un usuari, el seu historial de partides es conserva per al rànquing.                                                                                                                                                                                                                                                                            |
| No repetir dades dins d'un àmbit | `UNIQUE` compostos: nickname per partida, codi de partida global, número i pregunta per partida, resposta per ronda i participant.                                                                                                                                                                                                                                                                                                |
| Coherència de la resposta        | `UNIQUE (id, partida_id)` a `ronda` i `participant`, i claus foranes compostes des de `resposta` (`ronda_id, partida_id` i `participant_id, partida_id`). Una resposta no pot apuntar a una ronda o participant d'una altra partida.                                                                                                                                                                                              |
| Valors vàlids                    | 10 `CHECK`: `chk_categoria_nom` (nom no buit), `chk_pregunta_text` (text no buit), `chk_pregunta_slider` (`min < max`, `step > 0` i `resposta_correcta` dins del rang), `chk_partida_codi` (codi no buit), `chk_partida_max_jugadors` (2–20), `chk_partida_dates` (fi ≥ inici), `chk_participant_nickname` (3–15 caràcters), `chk_ronda_numero` (> 0), `chk_resposta_posicio` (`NULL` o > 0), `chk_usuaris_nom` (3–30 caràcters). |
