# T2 · `schema.sql` (RA2 · 8%)

## Nota

**Excel·lent — 10 / 10.**

S'executa sense errors en una base de dades buida, crea les 10 taules en ordre de
dependència, té 8 claus foranes amb `ON DELETE` explícit i coherent, 11 `UNIQUE`
(inclosos els 3 compostos que demana la rúbrica), 10 `CHECK` i `NOT NULL` a totes les
columnes crítiques. Provat en viu: un `INSERT` amb `max_jugadors = 1` el rebutja el
`CHECK` amb `ERROR 4025` i no deixa cap fila.

## Per què (evidència)

### S'executa en una BD buida

`schema.sql:1-6` és autosuficient — no depèn que la BD existeixi ni de l'ordre dels
altres scripts:

```sql
CREATE DATABASE IF NOT EXISTS howmuch CHARACTER SET utf8mb4;
USE howmuch;
SET NAMES utf8mb4;
```

`SET NAMES utf8mb4` a `:6` és important: sense això, en executar-lo des del client, els
accents i emojis podrien arribar mal codificats.

### Ordre de creació respecta les dependències

`categoria` `:13` → `pregunta` `:22` → `partida` `:47` → `participant` `:67` →
`ronda` `:85` → `resposta` `:111` → `rol` `:137` → `usuaris` `:144` → `partides` `:167` →
`registre` `:186`.

Cap taula referencia una altra que encara no existeixi.

### Les 3 restriccions que et faran ensenyar

**1. Clau forana amb `ON DELETE`.** La més bona per ensenyar és `fk_resposta_ronda`
(`:124-127`), perquè és **composta**:

```sql
CONSTRAINT fk_resposta_ronda
  FOREIGN KEY (ronda_id, partida_id) REFERENCES ronda (id, partida_id)
  ON UPDATE CASCADE
  ON DELETE CASCADE,
```

I la segona és `fk_partides_usuari` (`:177-179`), que és `ON DELETE SET NULL`.
Si vols una de `RESTRICT`, `fk_pregunta_categoria` (`:40-43`).

**2. `UNIQUE` compost.** `uq_resposta_ronda_participant` (`:120`):

```sql
CONSTRAINT uq_resposta_ronda_participant UNIQUE (ronda_id, participant_id),
```

És el que impedeix respondre dues vegades la mateixa ronda, i és la base de T8.
L'altre bon exemple és `uq_participant_partida_nickname` (`:72`): el nickname és únic
**per partida**, no globalment.

**3. `CHECK`.** `chk_partida_max_jugadors` (`:60`):

```sql
CONSTRAINT chk_partida_max_jugadors CHECK (max_jugadors BETWEEN 2 AND 20),
```

Provat en viu:

```
ERROR 4025 (23000) at line 1: CONSTRAINT `chk_partida_max_jugadors` failed for `howmuch`.`partida`
```

I la taula va quedar amb 1 fila: la fila invàlida no s'ha inserit.

### Inventari complet

| Tipus | Quantitat | On |
|---|---|---|
| Taules | 10 | `:13` … `:186` |
| Claus foranes | 8 | `:40`, `:78`, `:98`, `:102`, `:124`, `:128`, `:161`, `:177` |
| `UNIQUE` | 11 | `:17`, `:58`, `:72`, `:73`, `:92`, `:93`, `:94`, `:120`, `:141`, `:158`, `:159` |
| `CHECK` | 10 | `:18`, `:35`, `:36`, `:59`, `:60`, `:61`, `:74`, `:95`, `:121`, `:160` |
| `NOT NULL` | Totes les columnes de negoci excepte `partides.usuari_id`, `resposta.posicio`, `partida.data_inici`, `partida.data_fi`, `usuaris.codi_*` | — |

### Les 8 claus foranes i el seu `ON DELETE`

| FK | `ON DELETE` | Coherent perquè… |
|---|---|---|
| `fk_pregunta_categoria` `:40-43` | `RESTRICT` | No s'ha d'esborrar una categoria amb preguntes |
| `fk_participant_partida` `:78-81` | `CASCADE` | El participant no existeix sense la partida |
| `fk_ronda_partida` `:98-101` | `CASCADE` | La ronda no existeix sense la partida |
| `fk_ronda_pregunta` `:102-105` | `RESTRICT` | No s'ha d'esborrar una pregunta ja jugada |
| `fk_resposta_ronda` `:124-127` | `CASCADE` | La resposta cau amb la ronda |
| `fk_resposta_participant` `:128-131` | `CASCADE` | La resposta cau amb el participant |
| `fk_usuari_rol` `:161-163` | `RESTRICT` | No s'ha d'esborrar un rol amb usuaris |
| `fk_partides_usuari` `:177-179` | `SET NULL` | L'historial sobreviu a l'esborrat de l'usuari |

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **Commit.** `schema.sql` té canvis no commitejats (`partides.rondes`,
   `usuari_id INT UNSIGNED NULL`, `fk_partides_usuari`, i el `ON DELETE RESTRICT` que
   s'ha afegit avui a `fk_usuari_rol`). Si el professor agafa `b8c8eee`, no els veu.
2. **`docker compose down -v` abans de la demo.** Els scripts d'init només corren amb
   volum buit. Amb un volum vell, les taules són les d'abans i el `SHOW CREATE TABLE`
   no quadrarà amb el fitxer.
3. **`IF NOT EXISTS` no migra.** Si una taula ja existeix, el `CREATE TABLE` no fa res:
   no afegeix columnes ni restriccions noves. Això és T3, però ho han de saber.
4. **No hi ha `DROP DATABASE`.** És a propòsit: el fitxer no destrueix res. Per tant la
   demo és "drop manual + executar", no "executar i ja està".

## Fitxers clau

- `backend/database/sql/schema.sql` — 196 línies. L'únic fitxer que s'ha de tocar.
- `doc/model-de-dades.md` — el diagrama que justifica cada taula (T1).
- `doc/bbdd.md` §6 — detall columna a columna, si algú pregunta per un tipus.
- `docker-compose.yml:15` — on es munta el fitxer (`/docker-entrypoint-initdb.d/01-schema.sql`).
- `docker-compose.yml:11-12` — credencials (`root`/`root`, BD `howmuch`).

## Explicació dels fitxers

**`schema.sql`** — És l'única font de veritat de l'estructura. Ordre intern: capçalera
(`:1-6`), les 10 taules (`:13-195`). Totes amb `ENGINE=InnoDB` perquè les FK i les
transaccions necessiten InnoDB. Les taules del joc (`categoria` … `resposta`) van abans
de les d'usuaris perquè `partides` depèn de `usuaris`.

**`docker-compose.yml`** — El `01-` del nom del muntatge és el que garanteix que el
schema s'executi abans de `02-dades-inicials.sql`. Això és l'ordre alfabètic de l'entrypoint
de MariaDB, no una convenció de l'equip.

## Preguntes probables

1. **Per què la restricció a la BD i no només a JavaScript?**
   Perquè la BD és l'última línia de defensa: qualsevol client (Vue, Unity, phpMyAdmin,
   un script) hi pot escriure. Un `UNIQUE` o un `CHECK` no es pot saltar; una validació
   al controlador sí (per un altre camí, per un error, per una concurrència).

2. **Diferència entre `RESTRICT`, `CASCADE` i `SET NULL` en aquest esquema?**
   `RESTRICT` prohibeix esborrar el pare si té fills (`categoria` amb preguntes).
   `CASCADE` esborra els fills (`ronda` en esborrar la partida). `SET NULL` desvincula
   però conserva el fill (`partides.usuari_id` quan s'esborra l'usuari).

3. **Per què `resposta` és `CASCADE` i no `RESTRICT`?**
   Perquè una resposta no té cap valor sense la ronda ni el participant. Si s'esborra la
   partida, l'historial de respostes no s'ha de conservar: per a estadístiques hi ha
   l'agregat `partides`.

4. **Què fa exactament `CREATE TABLE IF NOT EXISTS`?**
   Si la taula ja existeix, no fa res i no dona error. No migra: no afegeix columnes ni
   canvia tipus. És el motiu pel qual la demo necessita `down -v`.

5. **Per què `UNIQUE (partida_id, nickname)` i no `UNIQUE (nickname)`?**
   Perquè el nickname és la identitat **dins d'una sala**: dos jugadors de partides
   diferents es poden dir igual. Un `UNIQUE` simple impediria que ningú reutilitzés mai
   un nickname.

6. **Com funciona un `CHECK` a MariaDB? I si la versió és vella?**
   Es va implementar a MariaDB 10.2.1; abans es parsejava i s'ignorava. La imatge és
   `mariadb:11` (`docker-compose.yml:3`), així que s'aplica de veritat. Ho acabem de
   provar: `ERROR 4025`.

7. **Què passa si intento inserir `max_jugadors = 1`?**
   `ERROR 4025 (23000): CONSTRAINT chk_partida_max_jugadors failed`. La fila no s'insereix.

8. **Per què `utf8mb4` i no `utf8`?**
   Perquè `utf8` a MySQL/MariaDB és un UTF-8 de 3 bytes que no admet emojis (els avatars
   són emojis, `usuaris.avatar`). `utf8mb4` és l'UTF-8 real de 4 bytes.

9. **Per què hi ha `USE howmuch` dues vegades (`:4` i `:134`)?**
   És redundant, no fa mal. Serveix de xarxa de seguretat si algú executa només la segona
   meitat del fitxer.

10. **Per què la FK de `resposta` és composta i no simple?**
    Perquè `partida_id` és redundant a propòsit: la FK `(ronda_id, partida_id)` obliga que
    la ronda sigui d'aquella partida, i la de `participant` fa el mateix. Amb FK simples,
    una resposta podria apuntar a una ronda d'una partida i a un participant d'una altra.
    Cal que `ronda` i `participant` tinguin `UNIQUE (id, partida_id)` (`:73`, `:94`) per
    poder ser referenciats.

11. **Què passaria si executes el fitxer dues vegades?**
    No dona error, però tampoc no reinicia res: tot és `IF NOT EXISTS`. Les files que hi
    hagi es queden. Això és el que resol `dades-inicials.sql` (T3).

12. **Per què `INT UNSIGNED` i no `INT`?**
    Perquè els ids no són negatius i `UNSIGNED` dobla el rang. `BIGINT UNSIGNED` a
    `partides` i `registre` perquè són taules de creixement continu (historial i log).

13. **On és el `DROP DATABASE`?**
    No n'hi ha. És una decisió: el fitxer no ha de destruir dades si s'executa per error.
    Conseqüència: la demo és `DROP DATABASE howmuch;` manual + executar el fitxer.

## Guió de demostració (90 s)

**0-15 s — Esborrar i executar.** Dir: "la BD buida i el fitxer, res més".

```powershell
docker compose exec -T mariadb mariadb -uroot -proot -e "DROP DATABASE howmuch;"
docker compose exec -T mariadb sh -c "mariadb -uroot -proot < /docker-entrypoint-initdb.d/01-schema.sql"
docker compose exec -T mariadb mariadb -uroot -proot howmuch -e "SHOW TABLES;"
```

Han de sortir les 10 taules i cap error. El fitxer és al contenidor perquè
`docker-compose.yml:15` el munta a `/docker-entrypoint-initdb.d/01-schema.sql`.

**15-40 s — FK amb `ON DELETE`.** Ensenyar `:124-127` al codi i després:

```powershell
docker compose exec -T mariadb mariadb -uroot -proot howmuch -e "SHOW CREATE TABLE resposta\G"
```

Assenyalar `FOREIGN KEY (ronda_id, partida_id)` i `ON DELETE CASCADE`.

**40-60 s — `UNIQUE` compost.** `:120` al codi, i a la mateixa sortida anterior:
`UNIQUE KEY uq_resposta_ronda_participant (ronda_id, participant_id)`.

**60-75 s — `CHECK` que rebutja.** És la prova forta:

```powershell
docker compose exec -T mariadb mariadb -uroot -proot howmuch -e "INSERT INTO partida (tipus, codi, max_jugadors) VALUES ('publica','ZZ',1);"
```

Surt `ERROR 4025 ... chk_partida_max_jugadors failed`. Després:

```powershell
docker compose exec -T mariadb mariadb -uroot -proot howmuch -e "SELECT COUNT(*) FROM partida;"
```

Segueix havent-hi 0 files (o les que hi hagués). És la resposta a "això ho comprova la
BD o només el codi?".

**75-90 s — Tancar.** "8 FK, totes amb `ON DELETE` explícit: `RESTRICT` on no s'ha de
perdre res, `CASCADE` on el fill no té sentit sol, i `SET NULL` a l'historial d'estadístiques".
