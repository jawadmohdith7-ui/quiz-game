# Índex d'avaluació — How Much?! LIVE

Revisió estàtica de les 17 tasques de la rúbrica (commit `b8c8eee`).
Cada fitxer `T*.md` conté: nota, evidència amb `fitxer:línia`, què falta per a Excel·lent, fitxers a obrir, explicació, preguntes probables amb resposta i guió de demostració.

## Taula resum

| Tasca | Pes | Nota | Punts | Què falta (1 línia) | Fitxer |
|---|---|---|---|---|---|
| T1 · Diagrama ER | 8% | **Excel·lent** | 8,0 | — | [T1](T1-model-de-dades.md) |
| T2 · schema.sql | 8% | **Excel·lent** | 8,0 | — | [T2](T2-schema-sql.md) |
| T3 · dades-inicials | 4% | **Excel·lent** | 4,0 | Docs diuen que no és idempotent (fals) | [T3](T3-dades-inicials.md) |
| T4 · Models Sequelize | 5% | **Excel·lent** | 5,0 | — (2 instàncies = 1 per microservei, justificat) | [T4](T4-models-sequelize.md) |
| T5 · CRUD + validacions | 8% | **Excel·lent** | 8,0 | — (queda `descripcio` cosmètic) | [T5](T5-crud-validacions.md) |
| T6 · Associació + include | 7% | **Excel·lent** | 7,0 | — (la taula ja mostra `categoria.nom`) | [T6](T6-associacio-categoria.md) |
| T7 · Pool + partides | 7% | **Excel·lent** | 7,0 | Missatge genèric si s'esgoten 3 intents | [T7](T7-pool-partides.md) |
| T8 · Rondes + UNIQUE | 8% | **Excel·lent** | 8,0 | — (exclusió SQL implementada i provada) | [T8](T8-rondes-respostes.md) |
| T9 · Classificació SQL | 10% | **Excel·lent** | 10,0 | — | [T9](T9-classificacio.md) |
| T10 · Transacció ronda | 7% | **Excel·lent** | 7,0 | — (explicació + demo amb trigger) | [T10](T10-transaccio-ronda.md) |
| T11 · FOR UPDATE | 8% | **Excel·lent** | 8,0 | — (observer explicat + 2 demos forçades) | [T11](T11-for-update.md) |
| T12a · Validar JSON | 5% | **Excel·lent** | 5,0 | — (informe amb categoria + text) | [T12a](T12a-validacio-json.md) |
| T12b · Desar Sequelize | 2% | **Bé** | 1,5 | Una fallada reverteix tot el lot | [T12b](T12b-desar-sequelize.md) |
| T13 · Export CSV | 5% | **Bé** | 3,75 | Sense BOM (accents) i decimals `42.000000` | [T13](T13-exportacio-csv.md) |
| T14a · Mòduls mysql2 | 3% | **Bé** | 2,25 | Cap funció compartida REST+WS | [T14a](T14a-moduls-mysql2.md) |
| T14b · Mòduls Sequelize | 2% | **Suficient** | 1,0 | Zero traducció d'errors per tipus | [T14b](T14b-moduls-sequelize.md) |
| T15 · Justificació dades | 3% | **Suficient** | 1,5 | No existeix la taula columna→requisit | [T15](T15-justificacio-dades.md) |

**Estimació actual: ~95/100** (Excel·lent=100%, Bé=75%, Suficient=50%). És orientatiu: la nota real la marca la pitjor mancança observada a cada tasca, no la mitjana.

## Pla d'acció per rendibilitat

Ordenat per punts recuperats / esforç.

| # | Tasca | Guany | Esforç | Acció |
|---|---|---|---|---|
| 1 | T15 | +1,5 | **1 taula Markdown** | Escriure `docs/taula-dades.md`: 10 taules × columna → requisit (durabilitat / càlcul SQL / bloqueig transaccional) |
| 2 | T13 | +1,25 | **2 línies** | `bom: true` i `Number()` a `punts`/`resposta` |
| 3 | T14b | +1,0 | **~15 línies** | `instanceof UniqueConstraintError` ABANS de `ValidationError`, + `ForeignKeyConstraintError`, + `asyncHandler` a admin |
| 4 | T5 | +2,0 | **mitjà** | Retornar errors per camp (`{ camp: missatge }`) i pintar-los al formulari |
| 5 | T8 | +2,0 | **mitjà** | `NOT IN (SELECT pregunta_id FROM ronda WHERE partida_id = ?)` a la selecció |
| 6 | T12b | +0,5 | **petit** | `try/catch` per pregunta dins el bucle d'importació |
| 7 | T11 | +2,0 | **decisió** | Rebutjar l'entrada en partida començada, o justificar l'observer com a funcionalitat |

## Riscos operatius (abans de la sessió)

1. **`docker compose down -v` obligatori.** La FK de `partides` és un canvi no commitejat; si la BD en viu és antiga, no quadra amb `schema.sql` i cauen T1 i T2 en directe.
2. **`descripcio` a `AdminCategoriesView.vue`** — camp que no existeix ni al model ni a l'esquema. Es veurà a T5.
3. **`resposta_correcta` buida es desa com a `0`** — pot marcar respostes com a correctes. Bug real.
4. **Docs contradictoris:** `catalog-service.md:414` i `auth-service.md:416` diuen que el seed no és idempotent (és fals); `bbdd.md:370,373,489` no quadra amb l'esquema; `bbdd.md:842` és obsolet; `EXPLICACIONBBDD.md:33` («conservar l'historial») xoca amb l'esborrat al lobby.
5. **`simulacio-entrega.md`** conté una consulta de T8 (`:246-250`) que **no és la del codi** i un guió de T11 (`:347-349`) imprecís.
6. **Provar el CSV en un Excel de veritat** abans de la sessió; cap subagent ho ha pogut fer.
7. El professor diu `/docs`; la carpeta real és `doc/`. Tingues el repositori obert i obre-la tu.

## Ordre de la sessió

1. Model de dades — 4 min — T1, T2, T3
2. Banc de preguntes — 5 min — T4, T5, T6
3. Joc — 5 min — T7, T8, T9
4. Transaccions — 4 min — T10, T11
5. Fitxers — 4 min — T12a, T12b, T13
6. Capa de dades — 3 min — T14a, T14b, T15

Els blocs 3 i 4 són **una sola partida**: es crea al bloc 3, dues rondes, es tanca al bloc 4, i al bloc 5 s'exporta aquesta mateixa partida.
