# catalog-service

Servei REST intern de categories i preguntes: `/internal/catalog/options` i
`/internal/preguntas/get` per al joc, i `/internal/admin/*` per al panell d'administració (CRUD i
importació de JSON). Treballa sobre MariaDB (`categoria`, `pregunta`) i desa un registre HTTP a
`registre`.

Les preguntes necessiten els camps `min`, `max` i `step` per al control lliscant. Després d'actualitzar una base de dades existent, executa una vegada `backend/database/sql/migrations/add-question-slider-fields.sql` i torna a importar el catàleg des d'aquest directori amb `npm run import:questions -- ../database/preguntas/preguntas.json`; la importació actualitza els rangs existents i restaura la precisió de respostes que abans quedaven truncades.
