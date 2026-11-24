//ARXIU QUE DEFINEIX EL MODEL DE LES PARTIDES RESUM QUE DESA EL STATS-SERVICE

//=====================
//IMPORTEM
//=====================
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

//=====================
//MODEL
//=====================
export const Partida = sequelize.define(
  "Partida",
  {
    id: { type: DataTypes.BIGINT.UNSIGNED, autoIncrement: true, primaryKey: true },
    usuari_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    },
    nom_sala: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "Sala Pública" },
    categoria: { type: DataTypes.STRING(100), allowNull: false, defaultValue: "General" },
    posicio: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    encerts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    rondes: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0
    },
    data_partida: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    tableName: "partides",
    timestamps: false
  }
);
