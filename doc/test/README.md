# doc/test · Verificació de la rúbrica

Un fitxer per tasca. Cada test imprimeix **què demana la rúbrica**, **què mostrem nosaltres** i un ✔/✘ per cada punt comprovable.

```
node doc/test/run-all.js                 # tots, en ordre T1..T15
node doc/test/bloque3-t8-rondes-unique.test.js   # una tasca
```

Sense dependències: només `node`. No toca ni la BD ni el codi, així que es pot executar sempre.

## Llegenda

| Marca | Vol dir |
|---|---|
| ✅ | Es compleix |
| ❌ | **No es compleix** → arreglar abans de la sessió |
| ⚠️ | Buit conegut i acceptat (test `conegut()`) → arreglar-lo puja nota |

## Buites coneguts (els 3 únics ⚠️)

| Buit | On | Com es tanca |
|---|---|---|
| SQL dins d'una ruta | `stats-service/src/admin/admin.routes.js` | Moure les consultes a `partidaRepository.js` |
| Cap funció compartida REST + WebSockets | `game-service/src/admin/adminRouter.js` | Fer que la ruta i l'handler cridin la mateixa funció del repositori |
| 2 instàncies de Sequelize al projecte | `catalog` i `stats` (processos diferents) | Defensar-ho: són microserveis, cadascun amb la seva connexió |

## Fitxers

| Fitxer | Tasca |
|---|---|
| `bloque1-t1-diagrama-er.test.js` | T1 diagrama ER i model relacional |
| `bloque1-t2-schema-sql.test.js` | T2 schema.sql (PK/FK/UNIQUE/CHECK) |
| `bloque1-t3-dades-inicials.test.js` | T3 dades-inicials idempotent |
| `bloque2-t4-models-sequelize.test.js` | T4 models sense sync() |
| `bloque2-t5-crud-validacions.test.js` | T5 CRUD + validacions al model |
| `bloque2-t6-include-esborrat.test.js` | T6 include + esborrat protegit |
| `bloque3-t7-pool-codi-participants.test.js` | T7 pool únic, codi únic, nicknames |
| `bloque3-t8-rondes-unique.test.js` | T8 no repetir pregunta + doble resposta |
| `bloque3-t9-classificacio.test.js` | T9 classificació amb SUM/GROUP BY |
| `bloque4-t10-tancar-ronda.test.js` | T10 tancar ronda amb rollback |
| `bloque4-t11-for-update.test.js` | T11 FOR UPDATE |
| `bloque5-t12a-validar-json.test.js` | T12a validarPregunta() |
| `bloque5-t12b-desar-sequelize.test.js` | T12b desar amb Sequelize |
| `bloque5-t13-export-csv.test.js` | T13 exportació CSV |
| `bloque6-t14a-moduls-mysql2.test.js` | T14a mòduls mysql2 |
| `bloque6-t14b-errors-sequelize.test.js` | T14b errors per tipus |
| `bloque6-t15-justificacio-dades.test.js` | T15 justificació de dades |

## Proves que NO es poden fer estàtiques (fer a mà a la sessió)

**T2 · el CHECK rebutja de veritat**
```sql
INSERT INTO pregunta (categoria_id, text, resposta_correcta, min_value, max_value, step_value, dificultat, explicacio)
VALUES (1, 'prova', 500, 0, 100, 1, 'facil', 'prova');
-- ERROR 3819: Check constraint 'chk_pregunta_slider' is violated.
```

**T3 · dues execucions seguides**
```sql
-- executar dades-inicials.sql, apuntar ids, executar-ho una altra vegada
SELECT id, nom FROM categoria ORDER BY id;
```

**T8 · doble resposta**
```sql
INSERT INTO resposta (ronda_id, partida_id, participant_id, valor) VALUES (1, 1, 1, 100);
-- ERROR 1062: Duplicate entry '...' for key 'uq_resposta_ronda_participant'
```

**T9 · comprovar els punts a mà**
```sql
SELECT SUM(punts) FROM resposta WHERE participant_id = 1;
```

**T10 · demostrar el rollback**: trigger temporal que faci `SIGNAL SQLSTATE '45000'`
a l'`UPDATE resposta`; en tancar la ronda ha de fallar i quedar tot igual.
```sql
CREATE TRIGGER prova_rollback BEFORE UPDATE ON resposta FOR EACH ROW
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'prova rollback';
```

**T13 · obrir el CSV a Excel** de veritat (accents + decimals + separador).
