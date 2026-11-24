CREATE DATABASE IF NOT EXISTS howmuch
  CHARACTER SET utf8mb4;

USE howmuch;

SET NAMES utf8mb4;

-- =====================================================
-- 1. TAULES
-- =====================================================

-- Categorias de las preguntas (Geografia, Ciencia...)
CREATE TABLE IF NOT EXISTS categoria (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_categoria_nom UNIQUE (nom),
  CONSTRAINT chk_categoria_nom CHECK (CHAR_LENGTH(TRIM(nom)) > 0)
) ENGINE=InnoDB;

-- Preguntas del juego, cada una pertenece a una categoria
CREATE TABLE IF NOT EXISTS pregunta (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  categoria_id INT UNSIGNED NOT NULL,
  text TEXT NOT NULL,
  resposta_correcta DOUBLE NOT NULL,
  min_value DOUBLE NOT NULL,
  max_value DOUBLE NOT NULL,
  step_value DOUBLE NOT NULL,
  unitat VARCHAR(50) NOT NULL DEFAULT '',
  dificultat VARCHAR(32) NOT NULL,
  explicacio TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_pregunta_categoria_id (categoria_id),
  CONSTRAINT chk_pregunta_text CHECK (CHAR_LENGTH(TRIM(text)) > 0),
  CONSTRAINT chk_pregunta_slider CHECK (
    min_value < max_value AND step_value > 0
    AND resposta_correcta BETWEEN min_value AND max_value
  ),
  CONSTRAINT fk_pregunta_categoria
    FOREIGN KEY (categoria_id) REFERENCES categoria (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Partidas y su estado durante el ciclo de vida del juego
CREATE TABLE IF NOT EXISTS partida (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  tipus ENUM('publica', 'privada') NOT NULL,
  codi VARCHAR(20) NOT NULL,
  estat ENUM('esperant', 'en_curs', 'acabada') NOT NULL DEFAULT 'esperant',
  max_jugadors INT UNSIGNED NOT NULL,
  dificultat VARCHAR(32) NOT NULL DEFAULT 'media',
  data_inici DATETIME NULL DEFAULT NULL,
  data_fi DATETIME NULL DEFAULT NULL,
  data_creacio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_partida_codi UNIQUE (codi),
  CONSTRAINT chk_partida_codi CHECK (CHAR_LENGTH(TRIM(codi)) > 0),
  CONSTRAINT chk_partida_max_jugadors CHECK (max_jugadors BETWEEN 2 AND 20),
  CONSTRAINT chk_partida_dates CHECK (
    data_fi IS NULL OR (data_inici IS NOT NULL AND data_fi >= data_inici)
  )
) ENGINE=InnoDB;

-- Participantes; la clasificación se calcula desde las respuestas
CREATE TABLE IF NOT EXISTS participant (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  partida_id INT UNSIGNED NOT NULL,
  nickname VARCHAR(15) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT uq_participant_partida_nickname UNIQUE (partida_id, nickname),
  CONSTRAINT uq_participant_id_partida UNIQUE (id, partida_id),
  CONSTRAINT chk_participant_nickname CHECK (
    CHAR_LENGTH(TRIM(nickname)) BETWEEN 3 AND 15
  ),
  KEY idx_participant_partida_id (partida_id),
  CONSTRAINT fk_participant_partida
    FOREIGN KEY (partida_id) REFERENCES partida (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Pregunta usada en una ronda de una partida
CREATE TABLE IF NOT EXISTS ronda (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  partida_id INT UNSIGNED NOT NULL,
  pregunta_id INT UNSIGNED NOT NULL,
  numero INT UNSIGNED NOT NULL,
  estat ENUM('oberta', 'tancada') NOT NULL DEFAULT 'oberta',
  PRIMARY KEY (id),
  CONSTRAINT uq_ronda_partida_numero UNIQUE (partida_id, numero),
  CONSTRAINT uq_ronda_partida_pregunta UNIQUE (partida_id, pregunta_id),
  CONSTRAINT uq_ronda_id_partida UNIQUE (id, partida_id),
  CONSTRAINT chk_ronda_numero CHECK (numero > 0),
  KEY idx_ronda_partida_id (partida_id),
  KEY idx_ronda_pregunta_id (pregunta_id),
  CONSTRAINT fk_ronda_partida
    FOREIGN KEY (partida_id) REFERENCES partida (id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_ronda_pregunta
    FOREIGN KEY (pregunta_id) REFERENCES pregunta (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Estimación del participante; posición y puntos se asignan al cerrar la ronda.
-- partida_id es redundante a propósito: las FK compuestas obligan a que la
-- ronda y el participante pertenezcan a la misma partida.
CREATE TABLE IF NOT EXISTS resposta (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  ronda_id INT UNSIGNED NOT NULL,
  partida_id INT UNSIGNED NOT NULL,
  participant_id INT UNSIGNED NOT NULL,
  valor DECIMAL(20, 6) NOT NULL,
  posicio SMALLINT UNSIGNED NULL DEFAULT NULL,
  punts INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT uq_resposta_ronda_participant UNIQUE (ronda_id, participant_id),
  CONSTRAINT chk_resposta_posicio CHECK (posicio IS NULL OR posicio > 0),
  KEY idx_resposta_ronda_partida (ronda_id, partida_id),
  KEY idx_resposta_participant_partida (participant_id, partida_id),
  CONSTRAINT fk_resposta_ronda
    FOREIGN KEY (ronda_id, partida_id) REFERENCES ronda (id, partida_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_resposta_participant
    FOREIGN KEY (participant_id, partida_id) REFERENCES participant (id, partida_id)
    ON UPDATE CASCADE
    ON DELETE CASCADE
) ENGINE=InnoDB;

USE howmuch;

-- TAULA DE ROLS. UN ROL POT TENIR MOLTS USUARIS
CREATE TABLE IF NOT EXISTS rol (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_rol_nom (nom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS usuaris (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nom VARCHAR(30) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar VARCHAR(32) NOT NULL DEFAULT '😀',
  avatar_image LONGTEXT NULL,
  avatar_color VARCHAR(16) NOT NULL DEFAULT '#22c55e',
  rol_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
  verificat TINYINT(1) NOT NULL DEFAULT 0,
  codi_verificacio VARCHAR(6) NULL DEFAULT NULL,
  codi_expira DATETIME NULL DEFAULT NULL,
  data_creacio DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_usuaris_nom UNIQUE (nom),
  CONSTRAINT uq_usuaris_email UNIQUE (email),
  CONSTRAINT chk_usuaris_nom CHECK (CHAR_LENGTH(TRIM(nom)) BETWEEN 3 AND 30),
  CONSTRAINT fk_usuari_rol FOREIGN KEY (rol_id) REFERENCES rol (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB;

-- TAULA DE PARTIDES RESUM QUE CONSULTA EL STATS-SERVICE
-- CADA FILA ÉS UNA PARTIDA ACABADA; LES DADES DEL JOC VIUEN A partida/participant/ronda/resposta
CREATE TABLE IF NOT EXISTS partides (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuari_id INT UNSIGNED NULL,
  nom_sala VARCHAR(100) NOT NULL,
  categoria VARCHAR(100) NOT NULL DEFAULT 'General',
  posicio INT UNSIGNED NOT NULL DEFAULT 1,
  encerts INT UNSIGNED NOT NULL DEFAULT 0,
  rondes TINYINT UNSIGNED NOT NULL DEFAULT 0,
  data_partida DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_partides_usuari
    FOREIGN KEY (usuari_id) REFERENCES usuaris (id)
    ON DELETE SET NULL,
  KEY idx_partides_data (data_partida),
  KEY idx_partides_sala (nom_sala),
  KEY idx_partides_usuari (usuari_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- TAULA DE REGISTRE D'ACCESSOS HTTP (ENCERTS I ERRORS)
CREATE TABLE IF NOT EXISTS registre (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  servei VARCHAR(30) NOT NULL,
  metode VARCHAR(10) NOT NULL,
  ruta VARCHAR(200) NOT NULL,
  estat SMALLINT UNSIGNED NOT NULL,
  creat_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_registre_data (creat_at),
  KEY idx_registre_estat (estat)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;