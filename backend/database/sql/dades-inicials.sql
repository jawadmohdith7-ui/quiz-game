USE howmuch;

--ROLS DEL SISTEMA. L'1 ES EL PER DEFECTE DE TOTS ELS USUARIS
-- Re-executable: ON DUPLICATE KEY UPDATE id = id no modifica les files que ja existeixen.
INSERT INTO rol (id, nom) VALUES (1, 'usuari'), (2, 'admin')
ON DUPLICATE KEY UPDATE id = id;

START TRANSACTION;

-- ---------- Usuari administrador ----------
-- CONTRASENYA: admin (hash scrypt del mateix format que authService.js)
INSERT INTO usuaris (nom, email, password_hash, verificat, rol_id)
VALUES ('admin', 'admin@gmail.com', 'd9e25fdab91630a4cbb0d5b9d490781a:3b75c0bb65aa8bd4246f83c7b710fc982b89ffa351d73765cb207ba89e21d8b2660693e15db079d1b0254c7a18fef3ccaae5149691ad35521d9f08f00f01968e', 1, 2)
ON DUPLICATE KEY UPDATE id = id;

-- ---------- Categories ----------
INSERT INTO categoria (id, nom)
VALUES
  (1, 'Geografia'),
  (2, 'Ciencia'),
  (3, 'Historia'),
  (4, 'Esports'),
  (5, 'Cultura'),
  (6, 'Cos Humà'),
  (7, 'Tecnologia'),
  (8, 'Curiositats')
ON DUPLICATE KEY UPDATE id = id;

-- ---------- Preguntes ----------
-- Orden: id, categoria_id, text, resposta_correcta, unitat, dificultat, explicacio, min_value, max_value, step_value
INSERT INTO pregunta (id, categoria_id, text, resposta_correcta, unitat, dificultat, explicacio, min_value, max_value, step_value)
VALUES
  -- Geografia
  (1, 1, 'Quants quilòmetres mesura el riu Nil?', 6650, 'km', 'media', 'És el riu més llarg del món.', 6350, 7350, 10),
  (2, 1, 'Quants metres mesura la Torre Eiffel?', 330, 'm', 'facil', 'Incloent les antenes, creix uns 15 cm a l''estiu per dilatació tèrmica.', 300, 400, 1),
  (3, 1, 'Quina és l''altura del Monte Everest?', 8848, 'm', 'facil', 'El punt més alt de la Terra sobre el nivell del mar.', 8548, 9548, 10),
  (5, 1, 'Quina és la profunditat de la Fosa de les Marianes?', 10994, 'm', 'dificil', 'El punt més profund dels oceans.', 7994, 17994, 100),
  -- Ciencia
  (20, 2, 'Quina és la velocitat de la llum en el buit?', 300000, 'km/s', 'facil', 'Aproximadament 300.000 km/s, exactament 299.792,458 km/s.', 270000, 370000, 1000),
  (21, 2, 'Quina és la temperatura d''ebullició de l''aigua en Fahrenheit?', 212, '°F', 'facil', 'A nivell del mar, 100 °C = 212 °F.', 182, 282, 1),
  (24, 2, 'Quina és la velocitat del so en l''aire a 20 °C?', 343, 'm/s', 'media', 'Depèn de la temperatura i humitat.', 313, 413, 1),
  (25, 2, 'Quina és la temperatura més baixa registrada a la Terra?', -89.2, '°C', 'dificil', 'Registrada a l''Antàrtida (estació Vostok) el 1983.', -92.2, -82.2, 0.1),
  (28, 2, 'Quin és el valor de Pi fins a 5 decimals?', 3.14159, '', 'facil', 'Nombre irracional, infinit decimals no periòdics.', 2.84159, 3.84159, 0.01),
  -- Historia
  (40, 3, 'En quin any es va enfonsar el Titanic?', 1912, 'any', 'facil', 'El 15 d''abril de 1912 en el seu viatge inaugural.', 1882, 1982, 1),
  (41, 3, 'En quin any va arribar l''home a la Lluna?', 1969, 'any', 'facil', 'Apollo 11, 20 de juliol de 1969 (Neil Armstrong).', 1939, 2039, 1),
  (45, 3, 'Quina és la durada exacta de la Guerra dels Cent Anys?', 116, 'anys', 'dificil', '1337-1453, en realitat 116 anys.', 86, 186, 1),
  (46, 3, 'En quin any va caure el Mur de Berlín?', 1989, 'any', 'facil', 'El 9 de novembre de 1989.', 1959, 2059, 1),
  (52, 3, 'En quin any es va fundar Roma (data llegendària)?', -753, 'any', 'media', '753 aC, fundació llegendària per Ròmul i Rem.', -783, -683, 1),
  -- Esports
  (57, 4, 'Quina és la distància oficial d''una marató?', 42195, 'm', 'facil', '42,195 km, estandarditzada als JJOO de Londres 1908.', 39195, 49195, 100),
  (59, 4, 'Quants gols oficials va marcar Messi al FC Barcelona?', 672, 'gols', 'media', 'Rècord en un sol club.', 642, 742, 1),
  (65, 4, 'Quina és l''altura oficial de l''aró de bàsquet?', 3.05, 'm', 'facil', 'Estàndard NBA/FIBA des de 1891.', 2.75, 3.75, 0.01),
  -- Cultura
  (71, 5, 'Quantes tecles té un piano estàndard?', 88, 'tecles', 'facil', '52 blanques + 36 negres.', 58, 158, 1),
  (72, 5, 'Quantes pel·lícules oficials de James Bond hi ha?', 25, 'pel·lícules', 'facil', 'Serie EON (No Time to Die = 25a).', 0, 95, 1),
  (76, 5, 'Quantes obres de teatre va escriure Shakespeare?', 37, 'obres', 'media', 'Atribuïdes amb certesa (algunes col·laboratives).', 7, 107, 1),
  -- Cos Humà
  (80, 6, 'Quants ossos té un adult humà?', 206, 'ossos', 'facil', 'El nadó en té ~270, alguns es fusionen.', 176, 276, 1),
  (83, 6, 'Quants litres de sang té un adult?', 5, 'litres', 'facil', 'Entre 4,5 i 5,5 litres (prenem 5 com a mitjana).', 4.7, 5.7, 0.01),
  (90, 6, 'Quina és la longitud de l''intestí prim?', 6.5, 'm', 'media', 'Entre 6 i 7 metres en adults.', 6.2, 7.2, 0.01),
  (93, 6, 'Quina és la temperatura corporal d''un gos?', 38.5, '°C', 'media', 'Entre 38 i 39 °C.', 35.5, 45.5, 0.1),
  -- Tecnologia
  (95, 7, 'Quantes tecles té un teclat estàndard?', 104, 'tecles', 'facil', '104 (Windows) o 105 (ISO/Europeu).', 74, 174, 1),
  (96, 7, 'Quina és la resolució 4K en píxels?', 8300000, 'píxels', 'media', '3840 × 2160 = 8.294.400 píxels.', 8000000, 9000000, 10000),
  (102, 7, 'Quants idiomes vius hi ha al món?', 7100, 'idiomes', 'dificil', 'Ethnologue: ~7.100 llengües vius.', 6800, 7800, 10),
  -- Curiositats
  (105, 8, 'Quina és la població mundial (2026)?', 8200000000, 'persones', 'media', 'Estimació ONU per 2026: ~8.200 milions.', 7900000000, 8900000000, 10000000),
  (113, 8, 'Quin temps triga la llum del Sol a la Terra?', 500, 'segons', 'facil', '8 min 20 seg = 500 segons.', 470, 570, 1),
  (122, 8, 'Quantes calories un Big Mac?', 550, 'calories', 'facil', '~550 kcal.', 520, 620, 1),
  (172, 8, 'Població Índia 2026?', 1450000000, 'habitants', 'dificil', '~1.450 milions.', 1150000000, 2150000000, 10000000)
ON DUPLICATE KEY UPDATE id = id;

COMMIT;

--PER FER ADMINISTRADOR UN ALTRE USUARI: REGISTRAR-LO PER LA PANTALLA I DESPRES EXECUTAR
--UPDATE usuaris SET rol_id = 2 WHERE email = 'el-teu@email.com';
