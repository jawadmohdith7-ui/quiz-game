<!--ARXIU QUE GESTIONA EL CRUD DE PREGUNTES DES DEL PANELL D'ADMINISTRACIO-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import { useAdminStore } from "../../stores/admin.js";
import {
  adminPreguntesList,
  adminPreguntesCreate,
  adminPreguntesUpdate,
  adminPreguntesDelete,
  adminCategoriesList,
} from "../../services/adminApi.js";
import { confirmaEsborrar, mostraError as alertaError } from "../../services/alertes.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();
const dialeg = ref(false);
const editant = ref(false);
const formulari = ref({
  id: null,
  categoria_id: "",
  text: "",
  resposta_correcta: "",
  unitat: "",
  dificultat: "facil",
  explicacio: "",
  //EL RANG DEL SLIDER: SENSE AQUESTS TRES CAMPS EL SERVIDOR REBUTJA LA PREGUNTA
  min_value: 0,
  max_value: 100,
  step_value: 1,
});

const capcaleres = [
  { title: "ID", key: "id" },
  { title: "Text", key: "text" },
  { title: "Dificultat", key: "dificultat" },
  { title: "Categoria", key: "categoria.nom" },
  { title: "Accions", key: "accions", sortable: false },
];

//=====================
//CARREGA
//=====================
function mostraError(error) {
  admin.setErrorPreguntes(error.message);
  admin.setErrorsPreguntes(error.errors);
}

async function carrega() {
  try {
    const dades = await adminPreguntesList();
    admin.setPreguntes(dades.preguntes);
  } catch (error) {
    mostraError(error);
  }
}

onMounted(carrega);

//=====================
//CATEGORIES DEL DESPLEGABLE
//=====================
//LA PRIMERA VEGADA LES DEMANEM; DESPRES EL SERVIDOR LES ENVIA SOLES (admin:categories:live)
async function carregaCategories() {
  try {
    const dades = await adminCategoriesList();
    admin.setCategories(dades.categories);
  } catch (error) {
    admin.setErrorCategories(error.message);
  }
}

onMounted(carregaCategories);

//=====================
//FORMULARI
//=====================
function obreNova() {
  editant.value = false;
  admin.setErrorPreguntes("");
  admin.setErrorsPreguntes({});
  formulari.value = {
    id: null,
    categoria_id: "",
    text: "",
    resposta_correcta: "",
    unitat: "",
    dificultat: "facil",
    explicacio: "",
    min_value: 0,
    max_value: 100,
    step_value: 1,
  };
  dialeg.value = true;
}

function obreEdicio(pregunta) {
  editant.value = true;
  admin.setErrorPreguntes("");
  admin.setErrorsPreguntes({});
  formulari.value = {
    id: pregunta.id,
    categoria_id: pregunta.categoria_id,
    text: pregunta.text,
    resposta_correcta: pregunta.resposta_correcta,
    unitat: pregunta.unitat,
    dificultat: pregunta.dificultat,
    explicacio: pregunta.explicacio,
    //EL SERVIDOR RETORNA EL RANG AMB ELS NOMS min/max/step
    min_value: pregunta.min,
    max_value: pregunta.max,
    step_value: pregunta.step,
  };
  dialeg.value = true;
}

//=====================
//VALIDACIO DEL RANG
//=====================
//LES MATEIXES COMPROVACIONS QUE EL CHECK DE LA TAULA: SI PASSA AQUI, EL SERVIDOR L'ACCEPTA
function validarRang() {
  if (formulari.value.resposta_correcta === "" || formulari.value.resposta_correcta === null) {
    return "La resposta correcta és obligatòria";
  }

  const minim = Number(formulari.value.min_value);
  const maxim = Number(formulari.value.max_value);
  const increment = Number(formulari.value.step_value);
  const resposta = Number(formulari.value.resposta_correcta);

  if (Number.isFinite(minim) === false) {
    return "El valor mínim ha de ser un número";
  }

  if (Number.isFinite(maxim) === false) {
    return "El valor màxim ha de ser un número";
  }

  if (minim >= maxim) {
    return "El valor mínim ha de ser més petit que el màxim";
  }

  if (Number.isFinite(increment) === false) {
    return "L'increment ha de ser un número";
  }

  if (increment <= 0) {
    return "L'increment ha de ser més gran que zero";
  }

  if (Number.isFinite(resposta) === false) {
    return "La resposta correcta ha de ser un número";
  }

  if (resposta < minim || resposta > maxim) {
    return "La resposta correcta ha d'estar entre el mínim i el màxim";
  }

  return null;
}

async function desa() {
  const errorRang = validarRang();

  if (errorRang !== null) {
    admin.setErrorPreguntes(errorRang);
    return;
  }

  //EL REPOSITORI LLEGEIX min/max/step (LES COLUMNES min_value/max_value/step_value)
  const dades = {
    text: formulari.value.text,
    resposta_correcta: formulari.value.resposta_correcta,
    categoria_id: formulari.value.categoria_id,
    dificultat: formulari.value.dificultat,
    explicacio: formulari.value.explicacio,
    min: formulari.value.min_value,
    max: formulari.value.max_value,
    step: formulari.value.step_value,
    unitat: formulari.value.unitat,
  };

  try {
    if (editant.value === true) {
      await adminPreguntesUpdate(formulari.value.id, dades);
    }

    if (editant.value === false) {
      await adminPreguntesCreate(dades);
    }

    dialeg.value = false;
    carrega();
  } catch (error) {
    mostraError(error);
  }
}

async function esborra(pregunta) {
  const confirmat = await confirmaEsborrar("Segur que vols esborrar aquesta pregunta?");

  if (confirmat === false) {
    return;
  }

  try {
    await adminPreguntesDelete(pregunta.id);
    carrega();
  } catch (error) {
    alertaError(error.message);
  }
}
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Preguntes</h2>

    <v-alert v-if="admin.errorPreguntes" type="error" variant="tonal" class="mb-4" :text="admin.errorPreguntes" />

    <v-btn color="primary" class="mb-4" @click="obreNova">Nova pregunta</v-btn>

    <v-data-table :headers="capcaleres" :items="admin.preguntes">
      <template #item.accions="{ item }">
        <v-btn size="small" variant="text" @click="obreEdicio(item)">Editar</v-btn>
        <v-btn size="small" variant="text" color="error" @click="esborra(item)">Esborrar</v-btn>
      </template>
    </v-data-table>

    <v-dialog v-model="dialeg" max-width="600">
      <v-card>
        <v-card-title>Pregunta</v-card-title>
        <v-card-text>
          <v-select
            v-model="formulari.categoria_id"
            label="Categoria"
            :items="admin.categories"
            item-title="nom"
            item-value="id"
            :error-messages="admin.errorsPreguntes.categoria_id"
          />
          <v-text-field
            v-model="formulari.text"
            label="Text"
            :error-messages="admin.errorsPreguntes.text"
          />
          <v-text-field
            v-model.number="formulari.resposta_correcta"
            label="Resposta correcta"
            type="number"
            step="any"
            :error-messages="admin.errorsPreguntes.resposta_correcta"
          />
          <!-- RANG DE LA RESPOSTA: EL SLIDER DEL JOC VA D'AQUEST MIN AL MAX -->
          <v-text-field
            v-model.number="formulari.min_value"
            label="Valor mínim"
            type="number"
            step="any"
            required
            :error-messages="admin.errorsPreguntes.min"
          />
          <v-text-field
            v-model.number="formulari.max_value"
            label="Valor màxim"
            type="number"
            step="any"
            required
            :error-messages="admin.errorsPreguntes.max"
          />
          <v-text-field
            v-model.number="formulari.step_value"
            label="Increment"
            type="number"
            step="any"
            min="0.0001"
            required
            :error-messages="admin.errorsPreguntes.step"
          />
          <v-text-field
            v-model="formulari.unitat"
            label="Unitat"
            maxlength="50"
            placeholder="m, kg, anys..."
            :error-messages="admin.errorsPreguntes.unitat"
          />
          <v-select
            v-model="formulari.dificultat"
            label="Dificultat"
            :items="['facil', 'media', 'dificil']"
            :error-messages="admin.errorsPreguntes.dificultat"
          />
          <v-textarea
            v-model="formulari.explicacio"
            label="Explicacio"
            :error-messages="admin.errorsPreguntes.explicacio"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="dialeg = false">Cancel·lar</v-btn>
          <v-btn color="primary" @click="desa">Desar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>
