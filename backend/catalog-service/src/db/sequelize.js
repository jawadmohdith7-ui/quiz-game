import { Sequelize, DataTypes } from "sequelize";

const dbName = process.env.DB_NAME || "howmuch";
const dbUser = process.env.DB_USER || "root";
const dbPassword = process.env.DB_PASSWORD || "";
const dbHost = process.env.DB_HOST || "localhost";
const dbPort = Number(process.env.DB_PORT || 3306);

export const sequelize = new Sequelize(dbName, dbUser, dbPassword, {
  host: dbHost,
  port: dbPort,
  dialect: "mysql",
  logging: false,
  define: {
    timestamps: false,
    freezeTableName: true,
  },
});

export const Categoria = sequelize.define(
  "Categoria",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    nom: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "categoria",
    timestamps: false,
    hooks: {
      beforeDestroy: async (categoria, options) => {
        const count = await Pregunta.count({
          where: { categoria_id: categoria.id },
          transaction: options.transaction,
        });

        if (count > 0) {
          const error = new Error(
            "No es pot eliminar una categoria que encara té preguntes associades."
          );
          error.code = "CATEGORY_HAS_QUESTIONS";
          throw error;
        }
      },
    },
  }
);

export const Pregunta = sequelize.define(
  "Pregunta",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    categoria_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      validate: {
        notNull: true,
      },
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
    resposta_correcta: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      validate: {
        notNull: true,
      },
    },
    min: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      field: "min_value",
    },
    max: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      field: "max_value",
    },
    step: {
      type: DataTypes.DOUBLE,
      allowNull: false,
      field: "step_value",
    },
    unitat: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "",
    },
    dificultat: {
      type: DataTypes.STRING(32),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 32],
      },
    },
    explicacio: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true,
      },
    },
  },
  {
    tableName: "pregunta",
    timestamps: false,
    //REGLES QUE NECESSITEN VEURE DIVERSOS CAMPS: NO CABEN EN EL validate D'UN ATRIBUT
    validate: {
      rangCoherent() {
        const { min, max, step, resposta_correcta: resposta, unitat } = this;

        //SI FALTA UN CAMP JA EL REBUTJA EL notNull; AQUI NOMES MIRAM COHERENCIA
        if (![min, max, step, resposta].every(Number.isFinite)) {
          return;
        }

        if (min >= max) {
          throw new Error("El valor màxim ha de ser més gran que el mínim.");
        }

        if (step <= 0) {
          throw new Error("L'increment ha de ser més gran que 0.");
        }

        const steps = (max - min) / step;
        const passosEnters =
          Math.abs(steps - Math.round(steps)) <= Math.max(1e-7, Math.abs(steps) * 1e-9);

        if (!Number.isFinite(steps) || steps > 100000 || passosEnters === false) {
          throw new Error("L'increment ha de fer un nombre enter de passos dins del rang.");
        }

        if (resposta < min || resposta > max) {
          throw new Error("La resposta correcta ha d'estar entre el mínim i el màxim.");
        }

        if (typeof unitat === "string" && unitat.length > 50) {
          throw new Error("La unitat no pot passar de 50 caràcters.");
        }
      },
    },
  }
);

Categoria.hasMany(Pregunta, {
  foreignKey: "categoria_id",
  as: "preguntas",
  onDelete: "RESTRICT",
});

Pregunta.belongsTo(Categoria, {
  foreignKey: "categoria_id",
  as: "categoria",
  onDelete: "RESTRICT",
});

Pregunta.addHook("beforeValidate", (pregunta) => {
  if (pregunta && typeof pregunta.text === "string") {
    pregunta.text = pregunta.text.trim();
  }
  if (pregunta && typeof pregunta.unitat === "string") {
    pregunta.unitat = pregunta.unitat.trim();
  }
  if (pregunta && typeof pregunta.explicacio === "string") {
    pregunta.explicacio = pregunta.explicacio.trim();
  }
});
