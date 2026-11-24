# stats-service

Servei REST d'estadístiques al port 3012. Exposa `/stats/*` (perfil propi, rànquing i registre de
partides enviades pel `game-service`) i `/internal/admin/*` (estadístiques, registre HTTP i
gràfic d'ús del panell). Llegeix i escriu la taula resum `partides` i llegeix `usuaris` i
`registre`. L'exportació CSV no és aquí: viu al `game-service` (`npm run export:csv`).
