# T3 · `dades-inicials.sql` (RA2 · 4 %) — re-executable i estat estable

## Nota

**4 / 4 — Excel·lent (100 %)**

Complert i verificat en viu, no només llegint el fitxer: he executat `dades-inicials.sql`
**tres vegades seguides** sobre la base de dades ja poblada del `docker-compose`
(MariaDB 11, contenidor `mariadb`). Les tres execucions acaben amb **exit code 0**
(cap error) i amb el **mateix hash MD5 de files i ids** a `rol`, `usuaris`,
`categoria` i `pregunta`.

| Taula | Files | MD5 (id + contingut) abans | després de 1a re-execució | després de 2a |
|---|---|---|---|---|
| `rol` | 2 | `72e1b654…c354` | `72e1b654…c354` | `72e1b654…c354` |
| `usuaris` | 1 | `fa12cab3…bbe2` | `fa12cab3…bbe2` | `fa12cab3…bbe2` |
| `categoria` | 8 | `419c945c…f00d` | `419c945c…f00d` | `419c945c…f00d` |
| `pregunta` | 31 | `6e66f249…ed3c` | `6e66f249…ed3c` | `6e66f249…ed3c` |

Per tant: **no és el nivell «Bé»** (els ids no canvien) i **no és «Suficient»**
(funciona sobre una BD ja poblada, no només nova), i **no dona errors de duplicats**.

Dades per jugar: **8 categories i 31 preguntes** (ràtio ~3,9 preguntes/categoria),
amb resposta, unitat, dificultat, explicació i rang de slider (`min`/`max`/`step`)
a totes. Suficient per a diverses partides de 5–10 rondes.

## Per què (evidència)

Idempotència real, línia a línia:

1. **No esborra res.** El fitxer no té cap `DELETE`, `TRUNCATE` ni `DROP`
   (`dades-inicials.sql:1-77`, sencer). Per tant re-executar-lo **no destrueix
   partides ni respostes en curs**: només toca `rol`, `usuaris`, `categoria` i
   `pregunta`, i deixa intactes `partida`, `participant`, `ronda`, `resposta`,
   `partides` i `registre`.
2. **Ids explícits a les taules de catàleg.** `categoria` s'insereix amb
   `id` 1–8 (`dades-inicials.sql:17-27`) i `pregunta` amb `id` explícit a cada fila
   (1, 2, 3, 5, 20, 21, 24, 25, 28, 40, 41, 45, 46, 52, 57, 59, 65, 71, 72, 76,
   80, 83, 90, 93, 95, 96, 102, 105, 113, 122, 172 → `dades-inicials.sql:31-72`).
   Com que l'id és `PRIMARY KEY` (`schema.sql:13-19` i `schema.sql:22-44`),
   la segona execució cau sempre en el mateix `id`.
3. **Upsert no-op.** Cada `INSERT` acaba amb `ON DUPLICATE KEY UPDATE id = id`
   (`dades-inicials.sql:5-6` rol, `:12-14` usuaris, `:17-27` categoria,
   `:31-72` pregunta). Si la fila ja existeix, l'`UPDATE` assigna la columna a si
   mateixa: **0 files modificades i cap error**, en lloc de l'error 1062 de duplicat.
4. **Ordre de taules respecta les FK.** `rol` (`:5`) va abans que `usuaris` (`:12`,
   `fk_usuari_rol` → `schema.sql:161`), i `categoria` (`:17`) abans que `pregunta`
   (`:31`, `fk_pregunta_categoria` → `schema.sql:40-43`). Sense aquest ordre la
   primera execució fallaria per FK.
5. **Transacció.** `START TRANSACTION` a `dades-inicials.sql:8` i `COMMIT` a `:74`:
   o entren totes les files de catàleg, o cap (no queda un catàleg a mitges).
6. **Compatibilitat amb el `schema.sql`.** Verificat amb consultes: **0 files**
   incompleixen `chk_pregunta_slider` (`schema.sql:36-39`: `min < max`,
   `step > 0`, `resposta BETWEEN min AND max`) i **0** preguntes amb
   `categoria_id` orfe. Les 31 files passen els `CHECK`; si no, MariaDB hauria
   avortat la inserció i el hash hauria canviat.
7. **`dificultat` dins del que accepta el codi.** Només valors `facil` / `media` /
   `dificil`, que és el que retorna `preguntas.repository.js:38` i valida
   `validarPregunta.js:63-67` (columna `VARCHAR(32)`, no `ENUM`, `schema.sql:31`).

Distribució real (per si algú pregunta «hi ha prou dades?»):

| Categoria | facil | media | dificil | total |
|---|---|---|---|---|
| Geografia | 2 | 1 | 1 | 4 |
| Ciencia | 3 | 1 | 1 | 5 |
| Historia | 3 | 1 | 1 | 5 |
| Esports | 2 | 1 | 0 | 3 |
| Cultura | 2 | 1 | 0 | 3 |
| Cos Humà | 2 | 2 | 0 | 4 |
| Tecnologia | 1 | 1 | 1 | 3 |
| Curiositats | 2 | 1 | 1 | 4 |
| **Total** | **17** | **9** | **5** | **31** |

Comandes exactes de la verificació (reproduïble):

```bash
cat backend/database/sql/dades-inicials.sql | docker exec -i mariadb mariadb -uroot -proot
# dues vegades més, i entre mig:
docker exec -i mariadb mariadb -uroot -proot --table -e "
USE howmuch;
SELECT 'categoria' t, COUNT(*) n, MD5(GROUP_CONCAT(CONCAT(id,':',nom) ORDER BY id)) h FROM categoria
UNION ALL
SELECT 'pregunta', COUNT(*), MD5(GROUP_CONCAT(CONCAT(id,':',text,':',resposta_correcta) ORDER BY id)) FROM pregunta;"
```

## Què falta per ser Excel·lent

La rúbrica ja es compleix. Aquests punts són **millores de robustesa**, no
requisits; cap d'ells canvia la nota:

1. **El comptador `AUTO_INCREMENT` sí que es mou** (les files i els ids no).
   `usuaris` s'insereix **sense `id` explícit** (`dades-inicials.sql:12`), i en
   cada re-execució MariaDB reserva un valor i el llença: he vist
   `AUTO_INCREMENT` 2 → 3 → 4 amb l'usuari sempre a `id = 1`. Igualment,
   `categoria` tenia el comptador a **17** amb només 8 files, perquè
   `ensureInitialCatalog()` fa `INSERT IGNORE` de les 8 categories a cada
   arrencada del catalog-service (`preguntas.repository.js:12-21`). Solució:
   posar `id` explícit també a l'admin (`INSERT INTO usuaris (id, nom, …) VALUES (1, …)`).
2. **L'upsert no refresca dades.** `ON DUPLICATE KEY UPDATE id = id` vol dir que si
   corregeixes un text o un `resposta_correcta` al fitxer i el tornes a executar,
   **la fila antiga no s'actualitza**. Per a un seed de desenvolupament és millor
   `ON DUPLICATE KEY UPDATE text = VALUES(text), resposta_correcta = VALUES(resposta_correcta), …`.
3. **El `INSERT` de `rol` queda fora de la transacció** (`:5-6` abans del
   `START TRANSACTION` de `:8`). Moure'l dins de la transacció deixa el seed
   atòmic del tot.
4. **Forats categoria × dificultat:** `Esports`, `Cultura` i `Cos Humà` no tenen
   cap pregunta `dificil`. Si algú crea una sala d'aquella categoria amb dificultat
   `dificil`, el catàleg respon «No hi ha preguntes per a aquesta categoria i
   dificultat» (`preguntas.controller.js:41`). Afegir 1 pregunta difícil a
   cadascuna de les tres ho tanca.
5. **Documentació desactualitzada:** `doc/catalog-service.md:414` i
   `doc/auth-service.md:416` diuen que el seed «no és idempotent». És fals des del
   commit `a159c07` («avaluacio base de dades»), que va afegir els quatre
   `ON DUPLICATE KEY UPDATE`. També és incorrecte que `schema.sql` faci
   `DROP TABLE IF EXISTS usuaris` (`auth-service.md:415`): el `schema.sql` només
   fa `CREATE TABLE IF NOT EXISTS` (`schema.sql:13-195`), sense cap `DROP`.

## Fitxers clau

| Fitxer | Per què és clau |
|---|---|
| `backend/database/sql/dades-inicials.sql` | El seed objecte de la nota: 77 línies, 4 taules, upsert no-op, transacció. |
| `backend/database/sql/schema.sql` | Defineix `PRIMARY KEY`, `UNIQUE`, `CHECK` i `FOREIGN KEY` que fan possible la idempotència i que validen les dades (`:13-44` catàleg, `:161` FK rol). |
| `docker-compose.yml` | Muntatge com a `02-dades-inicials.sql` després de `01-schema.sql` (`:15-16`); només s'executa amb el volum buit. |
| `backend/catalog-service/src/questions/preguntas.repository.js` | `ensureInitialCatalog()` (`:10-30`): segon camí de seed, per `INSERT IGNORE`, que explica el comptador de `categoria`. |
| `doc/bbdd.md` | Context de la BD única `howmuch` i de l'ordre dels scripts d'init (`:73-74`). |

## Explicació dels fitxers

**`dades-inicials.sql`** té quatre blocs, tots amb la mateixa idea: *inserir amb
id fix, i si ja hi és, no fer res*.

- `USE howmuch;` (`:1`) — treballa sobre la BD que ha creat `schema.sql`.
- `rol` (`:3-6`) — rols 1 (`usuari`) i 2 (`admin`). L'1 és el `DEFAULT` de
  `usuaris.rol_id` (`schema.sql:152`), per això ha d'existir abans que cap usuari.
- `START TRANSACTION` (`:8`) — agrupa la resta.
- `usuaris` (`:10-14`) — només l'admin, ja `verificat = 1` i amb `rol_id = 2`. El
  `password_hash` és `salt:hash` scrypt, el mateix format que valida `authService.js`
  (contrasenya: `admin`). **No porta `id` explícit**: per això el seu id depèn de
  l'ordre d'inserció i el comptador avança a cada passada.
- `categoria` (`:16-27`) — 8 files amb `id` 1–8. Cada nom és a més `UNIQUE`
  (`schema.sql:17`), així que hi ha dues claus que podrien provocar duplicat i les
  dues queden cobertes per l'upsert.
- `pregunta` (`:29-72`) — 31 files amb `id` explícit, repartides en les 8
  categories. La columna `categoria_id` apunta a les categories acabades
  d'inserir. Els rangs (`min_value`, `max_value`, `step_value`) són coherents amb
  la resposta perquè passin `chk_pregunta_slider`.
- `COMMIT` (`:74`) — confirma tot el bloc.
- `:76-77` — comentari operatiu: per fer admin un altre usuari, registrar-lo per la
  web i fer un `UPDATE usuaris SET rol_id = 2`.

**Per què `ON DUPLICATE KEY UPDATE id = id` i no `INSERT IGNORE`?** Funcionen igual
per a aquest cas, però `INSERT IGNORE` també amaga *altres* errors (FK, `CHECK`,
truncament de dades) convertint-los en warnings. `ON DUPLICATE KEY UPDATE` només
tracta el duplicat i deixa que qualsevol altra violació falli: és el que vols en un
seed que ha de ser fiable.

**Per què no `TRUNCATE` + reinserir?** Perquè `TRUNCATE` no respecta les FK
(`ronda.pregunta_id` → `pregunta.id` és `ON DELETE RESTRICT`, `schema.sql:102-105`)
i, sobretot, perquè esborraria el catàleg que estan fent servir partides en curs.
L'upsert és no destructiu: re-executar el seed amb gent jugant no trenca res.

## Preguntes probables

**1. Per què no fas `TRUNCATE` o `DELETE` abans d'insertar?**
Perquè el seed ha de poder córrer sobre una BD en ús. `TRUNCATE pregunta` fallaria
per la FK `fk_ronda_pregunta` (`ON DELETE RESTRICT`, `schema.sql:102-105`) si hi ha
rondes, i encara que funcionés deixaria òrfena qualsevol partida en curs. A més,
`TRUNCATE` fa `COMMIT` implícit i no es pot fer dins de la transacció. Amb l'upsert
no cal esborrar: la fila que ja existeix es queda igual.

**2. Què fa exactament `ON DUPLICATE KEY UPDATE id = id`?**
Quan l'`INSERT` xoca amb una `PRIMARY KEY` o un `UNIQUE`, en lloc d'error executa
l'`UPDATE`: assigna `id` a `id`, és a dir, no canvia res. Resultat: 0 files
modificades, cap error 1062, i el `id` original es conserva. És un upsert
deliberadament no-op.

**3. Si poses `AUTO_INCREMENT = 1`, què passa?**
`ALTER TABLE ... AUTO_INCREMENT = 1` no esborra files ni reindexa: només fixa el
següent valor a generar, i **mai per sota de `max(id) + 1`**. Amb 31 preguntes i
`max(id) = 172`, el proper id seria 173 igualment; el paràmetre s'ignora. Només
té sentit després d'un `DELETE`/`TRUNCATE` de tota la taula. Aquí no cal perquè
tots els ids del seed són explícits.

**4. Per què ids fixos a `categoria` i `pregunta`?**
Perquè són dades de referència: `pregunta.categoria_id` i `ronda.pregunta_id` hi
apunten, i el codi i les proves parlen d'ids concrets. Amb id explícit, la segona
execució cau sobre la mateixa fila (mateix `id`), que és exactament el que demana
la rúbrica. Si deixessis que l'`AUTO_INCREMENT` els assignés, la segona passada
crearia 31 preguntes noves amb ids 173+.

**5. I si esborres en ordre incorrecte, què passa amb les FK?**
MariaDB et bloqueja amb l'error 1451 (`Cannot delete or update a parent row`).
L'ordre correcte és el invers de creació:
`resposta` → `ronda` → `participant` → `partida`, i després `partida`/`partides`
si cal, `pregunta` → `categoria`, i `usuaris` → `rol`. Les FK que ho imposen:
`fk_ronda_pregunta` i `fk_pregunta_categoria` són `RESTRICT` (`schema.sql:43` i
`:105`); `fk_partides_usuari` és `SET NULL` (`:176-178`), o sigui que esborrar un
usuari no esborra l'estadística, només la desvincula.

**6. Per què l'usuari `admin` no té `id` explícit i què implica?**
Perquè no li cal: la taula té `UNIQUE (nom)` i `UNIQUE (email)`
(`schema.sql:158-159`), i l'upsert el troba per aquestes claus. La conseqüència és
que el comptador `AUTO_INCREMENT` d'`usuaris` avança +1 a cada execució (ho he
mesurat: 2 → 3 → 4) encara que la fila no canviï. És cosmètic, però si vols un
seed 100 % estable també en metadades, posa-hi `id = 1`.

**7. Per què `START TRANSACTION` … `COMMIT`?**
Perquè les 39 insercions de catàleg entrin totes o cap. Si una fila violés
`chk_pregunta_slider`, el `COMMIT` no s'executaria i no quedaria un catàleg a
mitges amb preguntes sense categoria. Detall honest: el `INSERT` de `rol` és fora
de la transacció (`:5-6`), i per tant no és atòmic amb la resta; no és un problema
perquè és idempotent, però és el punt a corregir si es vol perfecció.

**8. Si canvio el text d'una pregunta al fitxer i el torno a executar, s'actualitza?**
No. `ON DUPLICATE KEY UPDATE id = id` no toca cap columna de dades. Per refrescar
caldria `ON DUPLICATE KEY UPDATE text = VALUES(text), resposta_correcta = VALUES(resposta_correcta), …`.
És una limitació real del seed actual: serveix per *crear*, no per *sincronitzar*.

**9. Com demostres que les dades compleixen el `schema.sql`?**
Amb les mateixes restriccions: la inserció ha funcionat, i `chk_pregunta_slider`
(`schema.sql:36-39`) exigeix `min < max`, `step > 0` i
`resposta_correcta BETWEEN min AND max`. Ho he comprovat igualment amb una consulta
de violacions → **0**. També **0** preguntes amb `categoria_id` inexistent, i les
31 `dificultat` són dins del vocabulari que accepta el codi.

**10. Per què el rol 1 és especial?**
Perquè és el `DEFAULT` de `usuaris.rol_id` (`schema.sql:152`). Qualsevol usuari
registrat des de la web rep automàticament el rol 1 (`usuari`) sense que el codi
l'enviï. Si el rol 1 no existís, l'`INSERT` d'un usuari nou fallaria per FK
(`fk_usuari_rol`, `schema.sql:161`).

## Guió de demostració (60 s)

1. **(10 s) Ensenya el fitxer sencer.** «77 línies, 4 taules, cap `DELETE`, cap
   `TRUNCATE`, cap `DROP`. Tot són `INSERT … ON DUPLICATE KEY UPDATE id = id`.»
   Assenyala `:5-6`, `:14`, `:27`, `:72`.
2. **(10 s) Compta les dades.** «8 categories i 31 preguntes, amb resposta, unitat,
   dificultat, explicació i rang de slider.»
   ```sql
   SELECT COUNT(*) FROM categoria;  -- 8
   SELECT COUNT(*) FROM pregunta;   -- 31
   ```
3. **(20 s) La doble execució, en directe.** Fes un `SELECT id, text` de dues
   preguntes i un `COUNT(*)`, executa el fitxer **dues vegades** i torna a fer la
   mateixa consulta: mateixos ids, mateixos textos, cap error a la consola.
   ```bash
   cat backend/database/sql/dades-inicials.sql | docker exec -i mariadb mariadb -uroot -proot
   ```
4. **(10 s) Per què no falla.** «L'id és `PRIMARY KEY`; la segona vegada xoca, i
   l'`ON DUPLICATE KEY UPDATE id = id` converteix el duplicat en no-op: 0 files
   modificades.»
5. **(10 s) Tanca amb el detall que demostra domini.** «No esborro res perquè
   `ronda.pregunta_id` és `ON DELETE RESTRICT`: un `TRUNCATE` trencaria les
   partides en curs. I no reinicio l'`AUTO_INCREMENT` perquè no cal: tots els ids
   del catàleg són explícits.»

---

*Verificació feta el 22/11/2026 sobre `mariadb:11` en marxa (`docker compose up`),
executant el fitxer 3 vegades i comparant hashes MD5 calculats al servidor. No he
modificat cap fitxer del projecte; només he creat aquest document.*
