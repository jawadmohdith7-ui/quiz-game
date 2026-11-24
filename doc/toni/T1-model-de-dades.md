# T1 · Diagrama ER i model relacional (RA2 · 8%)

## Nota

**Excel·lent — 10 / 10.**

Cobreix les 10 taules de `schema.sql`, les 8 associacions amb nom i cardinalitat
correcta, totes les claus (PK/UK/FK) i les 10 restriccions `CHECK` pel seu nom.
Les 8 associacions del diagrama es troben totes a `schema.sql`, sense cap
incoherència: qualsevol parella que triï el professor es pot ensenyar en 10 segons.
Els documents de `/docs` (`model-de-dades.md` i `bbdd.md`) ja no es contradiuen.

## Per què (evidència)

### Cobertura taula per taula

| Taula (`schema.sql`) | Al diagrama ER | Al model relacional | Veredicte |
|---|---|---|---|
| `categoria` `:13-19` | `model-de-dades.md:11` + `:20-23` (`nom` UK) | `:116` | Correcte |
| `pregunta` `:22-44` | `:11` + `:24-35` (`categoria_id` FK) | `:117` | Correcte |
| `partida` `:47-64` | `:12,14` + `:36-46` (`codi` UK) | `:118` | Correcte |
| `participant` `:67-82` | `:13` + `:47-51` | `:119` + UK | Correcte |
| `ronda` `:85-106` | `:15` + `:52-58` | `:120` + UKs | Correcte |
| `resposta` `:111-132` | `:15-16` + `:59-67` (amb `partida_id`) | `:121` | Correcte |
| `rol` `:137-142` | `:17` + `:68-71` (`nom` UK) | `:125` | Correcte |
| `usuaris` `:144-163` | `:17-18` + `:72-85` (11 columnes) | `:126` | Correcte |
| `partides` `:167-183` | `:18` + `:86-95` (`usuari_id` FK) | `:127` | Correcte |
| `registre` `:186-196` | `:96-103` (entitat aïllada) | `:128` | Correcte |

Les taules `partides` i `registre` són fora del cicle de joc (`model-de-dades.md:106-108`):
`partides` és l'agregat per usuari que consumeix `stats-service` i `registre` és un
log d'accessos HTTP. Es dibuixen igualment perquè són taules de l'esquema.

### Les 8 associacions

| Associació (`model-de-dades.md:11-18`) | Cardinalitat | Implementació a `schema.sql` |
|---|---|---|
| `CATEGORIA \|\|--o{ PREGUNTA` | 1:N, pregunta obligatòria | `categoria_id NOT NULL` `:24`, FK `RESTRICT` `:40-43` |
| `PREGUNTA \|\|--o{ RONDA` | 1:N | `pregunta_id NOT NULL` `:88`, FK `RESTRICT` `:102-105` |
| `PARTIDA \|\|--o{ PARTICIPANT` | 1:N | `:69`, FK `CASCADE` `:78-81` |
| `PARTIDA \|\|--o{ RONDA` | 1:N | `:87`, FK `CASCADE` `:98-101` |
| `RONDA \|\|--o{ RESPOSTA` | 1:N | `:113`, FK **composta** `:124-127` |
| `PARTICIPANT \|\|--o{ RESPOSTA` | 1:N | `:115`, FK **composta** `:128-131` |
| `ROL \|\|--o{ USUARIS` | 1:N, rol obligatori | `rol_id NOT NULL` `:152`, FK `:161` |
| `USUARIS \|o--o{ PARTIDES` | 1:N, usuari opcional | `usuari_id INT UNSIGNED NULL` `:169`, FK `SET NULL` `:177-179` |

El `|o` de l'esquerra de la darrera és a propòsit: una fila de `partides` pot quedar
sense usuari si s'esborra el compte, i l'historial no s'ha de perdre.

El `o` (zero) és correcte a tots els altres: una partida nounada no té rondes, i un
participant que no respon no té respostes.

### Claus i restriccions

**Claus úniques (11):**

| `UNIQUE` | `schema.sql` | Al document |
|---|---|---|
| `uq_categoria_nom` | `:17` | `:116`, `:139` |
| `uq_partida_codi` | `:58` | `:118`, `:139` |
| `uq_participant_partida_nickname` | `:72` | `:119`, `:139` |
| `uq_participant_id_partida` (suport FK) | `:73` | `:140` |
| `uq_ronda_partida_numero` | `:92` | `:120`, `:139` |
| `uq_ronda_partida_pregunta` | `:93` | `:120`, `:139` |
| `uq_ronda_id_partida` (suport FK) | `:94` | `:140` |
| `uq_resposta_ronda_participant` | `:120` | `:121`, `:139` |
| `uq_rol_nom` | `:141` | `:125` |
| `uq_usuaris_nom` | `:158` | `:126` |
| `uq_usuaris_email` | `:159` | `:126` |

**Claus foranes (8), totes amb `ON DELETE` explícit:**

| FK | `ON DELETE` | Per què |
|---|---|---|
| `fk_pregunta_categoria` | `RESTRICT` | No esborrar una categoria amb preguntes |
| `fk_ronda_pregunta` | `RESTRICT` | No esborrar una pregunta ja jugada |
| `fk_ronda_partida` | `CASCADE` | La ronda no existeix sense la partida |
| `fk_participant_partida` | `CASCADE` | El participant no existeix sense la partida |
| `fk_resposta_ronda` (composta) | `CASCADE` | La resposta cau amb la ronda |
| `fk_resposta_participant` (composta) | `CASCADE` | La resposta cau amb el participant |
| `fk_usuari_rol` | `RESTRICT` | No esborrar un rol amb usuaris |
| `fk_partides_usuari` | `SET NULL` | Conservar l'historial si esborren l'usuari |

**Els 10 `CHECK`** (`model-de-dades.md:141`), pel seu nom:
`chk_categoria_nom` `:18`, `chk_pregunta_text` `:35`, `chk_pregunta_slider` `:36-39`,
`chk_partida_codi` `:59`, `chk_partida_max_jugadors` `:60`, `chk_partida_dates` `:61-63`,
`chk_participant_nickname` `:74-76`, `chk_ronda_numero` `:95`,
`chk_resposta_posicio` `:121`, `chk_usuaris_nom` `:160`.

### La part difícil, que està bé i cal defensar

`resposta` porta `partida_id` **redundant a propòsit** (`schema.sql:108-110`): les FK
compostes `(ronda_id, partida_id)` i `(participant_id, partida_id)` obliguen que la
ronda i el participant siguin de la mateixa partida. Cap `CHECK` pot fer això.
Està documentat a `model-de-dades.md:121` i `:140`, i a `doc/bbdd.md` §6.5.

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar abans de la sessió:**

1. **Render del Mermaid.** Obre `doc/model-de-dades.md` a GitHub o Obsidian i comprova
   que `USUARIS |o--o{ PARTIDES` es pinta. Si el visor és antic, canvia'l per
   `USUARIS ||--o{ PARTIDES` i deixa la nota de `usuari_id NULL`.
2. **Commit.** `schema.sql` té canvis no commitejats (`partides.rondes`,
   `usuari_id INT UNSIGNED NULL`, `fk_partides_usuari`). Si el professor agafa
   `b8c8eee`, no els veu.
3. **Volum de la BD.** `docker compose down -v && docker compose up -d` abans d'entrar.
   L'init només corre amb volum buit; amb un volum vell, `SHOW CREATE TABLE partides`
   no tindrà ni `rondes` ni la FK i el diagrama no quadrarà amb la realitat.
4. `doc/bbdd.md` encara té dues afirmacions velles que **no són de T1**: `:930` diu que
   hi ha un `DROP TABLE usuaris` a `schema.sql` (fals) i `:931` que l'export CSV només
   funciona en una finestra de 15 s (desactualitzat). Es corregeixen a T2 i T13.

## Fitxers clau

- `doc/model-de-dades.md` — el lliurable. 142 línies: Mermaid (10 entitats, 8 associacions),
  model relacional de les 10 taules i taula de regles d'integritat.
- `backend/database/sql/schema.sql` — la prova. 195 línies, 10 taules, 8 FK, 11 UNIQUE, 10 CHECK.
- `doc/entregarbbdd/README.md` — índex "tasca → fitxer → línia" fet pel grup.
- `doc/entregarbbdd/EXPLICACIONBBDD.md` — resum de 2 pàgines per repassar.
- `doc/bbdd.md` — detall taula a taula. Obrir només si cal; §9 té punts encara vells.
- En directe: `http://localhost:8081` (phpMyAdmin) o el client `mariadb` del contenidor.

## Explicació dels fitxers

**`doc/model-de-dades.md`** — És el que s'ensenya. Tres blocs: el diagrama Mermaid
(`:9-104`), el model relacional amb PK/UK/FK de les 10 taules (`:114-128`) i la taula de
regles (`:130-142`). Cal saber explicar per què `resposta` porta `partida_id`, per què
`participant` no té `usuari_id`, i per què `USUARIS–PARTIDES` és `|o` i no `||`.

**`backend/database/sql/schema.sql`** — L'única font de veritat. No cal llegir-lo sencer:
les línies que es fan servir són `:40-43` (RESTRICT), `:72-81` (nickname únic + CASCADE),
`:92-105` (doble UNIQUE de ronda), `:120-131` (FK compostes) i `:177-179` (SET NULL).
Saber que `CREATE TABLE IF NOT EXISTS` vol dir que el fitxer no migra res.

**`doc/entregarbbdd/README.md`** — Mapa "tasca → fitxer → línia". Serveix per no buscar
en directe: si algú pregunta "on ho tens?", ja hi ha la resposta escrita.

**`doc/bbdd.md`** — 900+ línies amb molt de detall (tipus, índexs, collation,
transaccions). El model ja hi és correcte des de §6.1 fins a §6.11; el que queda vell és
la llista de "punts d'atenció" de §9. No l'ensenyaria a T1.

## Preguntes probables

1. **Quina diferència hi ha entre una associació i una clau forana?**
   L'associació és el concepte del diagrama (`CATEGORIA *agrupa* PREGUNTA`); la FK és com
   s'implementa (`pregunta.categoria_id`, `schema.sql:40`). En un 1:N, una associació =
   una columna FK al costat N. En un N:M caldria taula intermèdia.

2. **Per què `resposta` té `partida_id` si ja té `ronda_id` i `participant_id`?**
   Perquè una ronda i un participant podrien ser de partides distintes i la resposta
   quedaria òrfena lògicament. Amb les FK compostes (`schema.sql:124-131`) la BD obliga
   que tots tres siguin de la mateixa partida. És redundant a propòsit.

3. **`resposta.partida_id` té FK cap a `partida`?**
   No. No hi ha cap `REFERENCES partida` a `resposta`. `partida_id` només forma part de
   les dues FK compostes; la coherència amb `partida` arriba transitivament perquè
   `ronda.partida_id` sí que té FK (`:98-101`). Pregunta trampa.

4. **Què passa si esborro una partida? I una categoria? I un usuari?**
   Partida → cauen `participant`, `ronda` i, en cascada, `resposta` (`:81`, `:101`,
   `:127`, `:131`). Categoria → `RESTRICT`, falla si té preguntes (`:43`). Usuari → les
   seves `partides` sobreviuen amb `usuari_id = NULL` (`:178`), perquè el rànquing
   històric no es pot perdre.

5. **Per què `partides.usuari_id` és `NULL` i `SET NULL` en lloc de `CASCADE`?**
   Perquè `partides` és l'agregat d'estadístiques per usuari: si s'esborra el compte, la
   partida jugada continua sent certa. Amb `CASCADE` esborraries historial de joc, i amb
   `RESTRICT` no podries esborrar mai un usuari. Per això el diagrama és `|o` a l'esquerra.

6. **Què és la taula `registre` i per què no té relacions?**
   És el log d'accessos HTTP. Un middleware a cada servei REST (`middleware/registre.js`)
   fa `INSERT INTO registre (servei, metode, ruta, estat)`. El panell d'admin el llegeix
   amb `SELECT estat, COUNT(*) ... GROUP BY estat` (`stats-service/src/admin/admin.routes.js:198`)
   per al gràfic d'errors. No té FK perquè registra també peticions anònimes i 404.
   **Per què no un fitxer de log?** Perquè el dashboard ho consulta amb SQL agregat.

7. **Per què `participant` no té `usuari_id`? Com saps quin usuari registrat ha jugat?**
   Perquè el participant és per sala: hi ha convidats i el nickname és la identitat dins
   la partida. El vincle amb `usuaris` és textual (`participant.nickname = usuaris.nom`)
   i s'usa a `auth-service` (`/stats/:id`). No hi ha FK: és un deute conscient.

8. **Què vol dir `||--o{` exactament?**
   `||` = exactament un a l'esquerra; `o{` = zero o molts a la dreta. Per exemple
   `PARTIDA ||--o{ RONDA`: tota ronda té exactament una partida; una partida pot tenir
   zero rondes (quan encara és a `esperant`). I `|o` = zero o un.

9. **Per què `participant → resposta` és 0..N i no 1..N?**
   Perquè un jugador pot no respondre una ronda: la resposta només s'insereix en
   respondre (`gameRepository.saveAnswerRecord`). Zero respostes és un estat vàlid, i és
   el que fa que al rànquing surti amb 0 gràcies al `LEFT JOIN`.

10. **Quina taula és "febla" i per què?**
    `resposta` (i en menor grau `participant` i `ronda`): no té sentit sense la ronda i el
    participant, i desapareix amb ells per `CASCADE`. Té `id` subrogat però la seva
    identitat real és `(ronda_id, participant_id)`, que protegeix
    `uq_resposta_ronda_participant` (`:120`).

11. **`resposta` és una taula intermèdia? Hi ha cap N:M al model?**
    Funcionalment sí: resol la relació N:M entre participant i ronda, i per això té
    atributs propis (`valor`, `posicio`, `punts`). No hi ha cap altre N:M.

12. **Per què `partides` (plural) no és el mateix que `partida` (singular)?**
    Són dos models en paral·lel. `partida` és la sala viva (s'esborra en tornar al lobby);
    `partides` és l'agregat desnormalitzat per usuari que llegeix `stats-service`. No hi
    ha FK entre elles: l'agregat ha de sobreviure a l'esborrat de la sala. L'única relació
    de `partides` és amb `usuaris` (`:177-179`).

13. **Per què `estat` és `ENUM` i no una taula d'estats?**
    Perquè els estats són un conjunt tancat i petit (`esperant`/`en_curs`/`acabada`).
    Estalvia un `JOIN` i una taula. Cost: afegir-ne un és un `ALTER TABLE`.

14. **Com demostres en directe que el diagrama és cert?**
    `SHOW CREATE TABLE resposta\G` al contenidor: hi surten les dues FK compostes i
    l'UNIQUE. I `SHOW CREATE TABLE partides\G` per ensenyar `rondes` i el `SET NULL`.
    Alternativa sense escriure SQL: `information_schema.KEY_COLUMN_USAGE` filtrat per
    `TABLE_SCHEMA='howmuch'` a phpMyAdmin.

## Guió de demostració (60 s)

**0-10 s — Enquadrar.** Obrir `doc/model-de-dades.md` amb la previsualització Mermaid.
Dir: "10 taules a l'esquema; el diagrama en dibuixa les 10 i les 8 associacions, i el
model relacional de sota les cobreix totes".

**10-30 s — Dues associacions, triades per vosaltres.** Primer
`CATEGORIA ||--o{ PREGUNTA` → `schema.sql:40-43` (FK `RESTRICT`: no es pot esborrar una
categoria amb preguntes). Després `RONDA ||--o{ RESPOSTA` → `:124-127`, i aquí el punt
fort: la FK és `(ronda_id, partida_id)`, no només `ronda_id`.

**30-45 s — Prova en directe.** `docker compose exec mariadb mariadb -uroot -proot howmuch
-e "SHOW CREATE TABLE resposta\G"`. Assenyalar les dues línies `FOREIGN KEY` i
`uq_resposta_ronda_participant`. És la resposta a "això és de veritat o és un dibuix?".

**45-60 s — Tancar amb el "per què".** Explicar la redundància de `partida_id`: "una
resposta no pot apuntar a una ronda d'una partida i a un participant d'una altra; això no
ho pot fer cap `CHECK`, només una FK composta". Si sobra temps, ensenyar
`USUARIS |o--o{ PARTIDES` i el `SET NULL` (`:177-179`).
