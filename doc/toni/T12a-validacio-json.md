# T12a · Llegir i validar el JSON amb `validarPregunta()` i informe de descartades (RA1 · 5%)

## Nota

**Excel·lent — 10 / 10** (era 8/10).

Totes les preguntes invàlides es descarten, l'informe dona **tots** els errors de cadascuna
i ara també diu **quina** pregunta és (categoria + text), no només un índex. El fitxer amb
sintaxi trencada dona un missatge clar amb la posició i el servei segueix funcionant.

## Per què (evidència)

### El validador acumula tots els errors

`backend/catalog-service/src/questions/validarPregunta.js:5-101`:

```js
export function validarPregunta(pregunta) {
  const errors = [];
  ...
  if (!text) errors.push("El text de la pregunta és obligatori.");
  ...
  return { valid: errors.length === 0, errors };
}
```

Nou regles: text (buit / massa llarg), resposta (numèrica / rang), rang (`min < max`,
`step > 0`, passos enters, resposta dins el rang), unitat (≤ 50), dificultat (no buida,
≤ 32, no `mix`), explicació (no buida / massa llarga), categoria (no buida, ≤ 100) i
`categoria_id` (enter).

Mai fa `throw` al primer error: acumula i retorna el conjunt. Per això una pregunta pot
sortir amb **cinc errors alhora**.

### L'informe diu quina pregunta és

`backend/catalog-service/src/questions/importQuestions.js:26-40`:

```js
if (!result.valid) {
  rejected.push({
    categoria: nomDeCategoria(group),
    pregunta: textDePregunta(question),
    categoryIndex: categoryIndex,
    questionIndex: questionIndex,
    errors: result.errors,
  });
}
```

Els dos helpers (`:7-33`) tenen cura dels casos extrems:

| Situació | Etiqueta |
|---|---|
| pregunta sense `text` | `(sense text)` |
| `text` buit o només espais | `(text buit)` |
| pregunta que no és objecte | `(pregunta no vàlida)` |
| grup sense `category` | `(sense categoria)` |
| grup sense `questions` | `(el grup no té una llista de preguntes)` |

### La prova en viu

Fitxer de 2 grups i 3 preguntes:

```
Importades: 1 | Actualitzades: 0 | Saltades: 0 | Rebutjades: 3

[ZZT12] (text buit)
  - El text de la pregunta és obligatori.
  - La resposta correcta ha de ser numèrica.
  - min, max i step han de definir un rang vàlid i divisible per a la resposta.
  - La dificultat ha de tenir entre 1 i 32 caràcters i no pot ser mix.
  - La explicació és obligatòria.

[ZZT12] (sense text)
  - El text de la pregunta és obligatori.

[ZZT12-BUIT] (el grup no té una llista de preguntes)
  - La categoria ha de contenir una llista de preguntes.
```

Cinc errors en una sola pregunta, i se sap de quina pregunta es tracta.

### El fitxer mal format

`loadQuestions.js:31-45` envolta el `JSON.parse`:

```js
try {
  const data = JSON.parse(fileContent);
  return data;
} catch (error) {
  const wrappedError = new Error(
    `No s'ha pogut carregar el fitxer de preguntes: ${error.message}`
  );
  wrappedError.code = "QUESTIONS_FILE_ERROR";
  wrappedError.cause = error;
  throw wrappedError;
}
```

Provat amb una coma de més:

```
Error d'importació: No s'ha pogut carregar el fitxer de preguntes:
Expected double-quoted property name in JSON at position 51 (line 1 column 52)
```

`process.exitCode = 1` (`cli/importQuestions.js:13`) i el servei segueix viu: la petició
següent a `/internal/catalog/options` respon `HTTP 200`. El CLI no tomba el servidor perquè
és un procés a part.

## Abans i després de l'informe

**Abans** (índex 0-based, sense text):

```json
{ "categoryIndex": 7, "questionIndex": 143,
  "errors": ["La resposta correcta ha de ser numèrica."] }
```

Amb el `preguntas.json` real (8 categories, 254 preguntes, `Curiositats` amb 150), això vol
dir "la pregunta 144 de la vuitena categoria" i per saber quina és cal obrir el fitxer i
comptar 144 objectes. A més, `questionIndex: 1` és la **segona** pregunta, no la primera.

**Ara:**

```
[Curiositats] Quin és l'animal més ràpid del món?
  - La resposta correcta ha de ser numèrica.
```

S'entén sense obrir res.

## Què falta per ser Excel·lent

Res. La tasca està completa.

**Què has de vigilar:**

1. **El CLI necessita un path.** El `Dockerfile` només copia `src/`, així que el fitxer per
   defecte (`/database/preguntas/preguntas.json`) **no existeix dins el contenidor**:
   ```
   Error d'importació: ... ENOENT: no such file or directory, open '/database/preguntas/preguntas.json'
   ```
   No és un bug, però a la demo cal passar sempre el fitxer:
   ```powershell
   docker compose cp .\prova.json catalog-service:/tmp/prova.json
   docker compose exec -T catalog-service node src/cli/importQuestions.js /tmp/prova.json
   ```
2. **No hi ha cap test del validador.** És una funció pura i seria el test més fàcil del
   projecte. La rúbrica no el demana.
3. **Commit.** `importQuestions.js` i `cli/importQuestions.js` estan sense commitejar.
4. El CLI ara imprimeix text, no JSON. Si alguna eina antiga esperava el JSON, caldria
   afegir un mode `--json`. No hi ha cap eina així al projecte.

## Fitxers clau

| Fitxer | Què fa |
|---|---|
| `backend/catalog-service/src/questions/validarPregunta.js` | Les 9 regles, acumulades en un array |
| `backend/catalog-service/src/questions/importQuestions.js` | Recorre els grups, descarta i desa; l'informe amb text |
| `backend/catalog-service/src/questions/loadQuestions.js` | Llegeix el fitxer i converteix el `JSON.parse` en `QUESTIONS_FILE_ERROR` |
| `backend/catalog-service/src/cli/importQuestions.js` | El CLI: imprimeix el resum i els rebutjos, `exitCode 1` si peta |
| `backend/database/preguntas/preguntas.json` | El fitxer real: 8 categories, 254 preguntes |

## Explicació dels fitxers

**`validarPregunta.js`** — Funció pura: rep una pregunta (amb el format antic o el nou,
perquè accepta `text`/`enunciat`, `correctAnswer`/`respuesta_correcta`/`correcta`…) i retorna
`{ valid, errors }`. No toca la BD ni llança excepcions.

**`importQuestions.js`** — Orquestra: `loadQuestions` → validar cada pregunta → desar les
vàlides en una transacció. Els rebutjos es guarden amb categoria, text, índexs i errors.
Retorna `{ imported, updated, skipped, rejected }`.

**`loadQuestions.js`** — Accepta un path opcional; si no, usa el fitxer del repositori. Aquí
és on es tradueix qualsevol error de lectura o de sintaxi en un error amb `code`.

**`cli/importQuestions.js`** — Punt d'entrada per terminal. Imprimeix el resum en una línia i
després un bloc per cada rebutjat. `finally` tanca el pool de Sequelize perquè el procés
acabi.

## Preguntes probables

1. **Per què no llences al primer error?**
   Perquè l'informe ha de servir per corregir d'un cop. Si llencés, l'usuari hauria de
   reimportar una vegada per error. La rúbrica ho diu explícitament: "incloent-hi tots els
   errors d'una mateixa pregunta".

2. **Què valida `validarPregunta` exactament?**
   Nou regles: text (no buit, ≤ 65535 bytes), resposta (numèrica, |valor| < 1e14), rang
   (`min < max`, `step > 0`, passos enters, ≤ 100000, resposta dins), unitat (≤ 50),
   dificultat (no buida, ≤ 32, ≠ `mix`), explicació (no buida, ≤ 65535), categoria (no buida,
   ≤ 100), `categoria_id` (enter si ve).

3. **Si el JSON no és una llista?**
   `importQuestions.js:7-9` llança "El JSON ha de contenir una llista de categories" i el CLI
   ho imprimeix amb `exitCode 1`.

4. **Si un grup no té `questions`?**
   No s'intenta validar res dins seu: es descarta el grup amb un error propi i es continua amb
   el següent.

5. **D'on surt la categoria d'una pregunta?**
   Del grup (`group.category`). `importQuestions.js:37-40` la injecta a la pregunta abans de
   validar, perquè el format del JSON té la categoria a nivell de grup.

6. **Què passa amb una categoria que no existeix a la BD?**
   Es crea amb `findOrCreate` (`:42-46`). No es rebutja. (Això és T12b.)

7. **Com demostres que un fitxer trencat no tomba el servei?**
   Importes un JSON amb una coma de més, surt l'error amb la posició, `exitCode 1`, i la
   petició següent al catàleg respon 200.

8. **Per què l'informe imprimeix text i no JSON?**
   Perquè l'informe és per a una persona. Amb 254 preguntes, un índex no identifica res; el
   text sí. El JSON estructura encara hi és dins l'objecte retornat (`rejected`), només canvia
   la presentació del CLI.

9. **Què és `categoryIndex` i `questionIndex`?**
   Posicions 0-based dins del fitxer: el grup i la pregunta dins del grup. Es mantenen per si
   es vol processar l'informe automàticament, però ja no són l'única manera d'identificar-la.

10. **Què passa si el fitxer no existeix?**
    `ENOENT` → `QUESTIONS_FILE_ERROR` amb el missatge de Node. És el que passa si executes el
    CLI sense argument dins el contenidor, perquè el `Dockerfile` no copia
    `database/preguntas/`.

11. **Per què el CLI tanca Sequelize al `finally`?**
    Perquè el pool té connexions obertes i el procés no acabaria. `sequelize.close()` les
    tanca i el terminal torna.

12. **Què passaria si una pregunta vàlida no es pot desar?**
    Ara atura la transacció sencera. És el que falta a T12b.

## Guió de demostració (90 s)

**0-15 s — Enquadrar.** "L'importador llegeix un JSON, valida cada pregunta amb
`validarPregunta` i descarta les dolentes informant de tots els errors."

**15-35 s — El validador.** Obrir `validarPregunta.js:5-101` i assenyalar l'array d'errors.
"Cap `throw`: s'acumula tot perquè l'informe serveixi per corregir d'un cop."

**35-60 s — La prova.** El professor et diu què trencar; tu edites el fitxer, el copies al
contenidor i l'importes:

```powershell
docker compose cp .\prova.json catalog-service:/tmp/prova.json
docker compose exec -T catalog-service node src/cli/importQuestions.js /tmp/prova.json
```

Surt una línia de resum i, per cada rebutjada, la categoria, el text i la llista d'errors.

**60-75 s — El fitxer trencat.** Torna a importar un JSON amb una coma de més. Missatge amb
la posició, `exitCode 1`, i el servei respon.

**75-90 s — Tancar.** "Les vàlides queden a la BD (això és T12b); les invàlides no toquen la
BD i l'informe diu per què, pregunta per pregunta."
