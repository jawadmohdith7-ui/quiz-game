<!--ARXIU QUE GESTIONA EL CRUD DE CATEGORIES DES DEL PANELL D'ADMINISTRACIO-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import { useAdminStore } from "../../stores/admin.js";
import {
  adminCategoriesList,
  adminCategoriesCreate,
  adminCategoriesUpdate,
  adminCategoriesDelete,
} from "../../services/adminApi.js";
import { confirmaEsborrar, mostraError } from "../../services/alertes.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();
const dialeg = ref(false);
const editant = ref(false);
const formulari = ref({ id: null, nom: "", descripcio: "" });

const capcaleres = [
  { title: "ID", key: "id" },
  { title: "Nom", key: "nom" },
  { title: "Descripcio", key: "descripcio" },
  { title: "Accions", key: "accions", sortable: false },
];

//=====================
//CARREGA
//=====================
async function carrega() {
  try {
    const dades = await adminCategoriesList();
    admin.setCategories(dades.categories);
  } catch (error) {
    admin.setErrorCategories(error.message);
  }
}

onMounted(carrega);

//=====================
//FORMULARI
//=====================
function obreNova() {
  editant.value = false;
  formulari.value = { id: null, nom: "", descripcio: "" };
  dialeg.value = true;
}

function obreEdicio(categoria) {
  editant.value = true;
  formulari.value = {
    id: categoria.id,
    nom: categoria.nom,
    descripcio: categoria.descripcio,
  };
  dialeg.value = true;
}

async function desa() {
  try {
    if (editant.value === true) {
      await adminCategoriesUpdate(formulari.value.id, formulari.value);
    }

    if (editant.value === false) {
      await adminCategoriesCreate(formulari.value);
    }

    dialeg.value = false;
    carrega();
  } catch (error) {
    admin.setErrorCategories(error.message);
  }
}

async function esborra(categoria) {
  const confirmat = await confirmaEsborrar("Segur que vols esborrar aquesta categoria?");

  if (confirmat === false) {
    return;
  }

  try {
    await adminCategoriesDelete(categoria.id);
    carrega();
  } catch (error) {
    mostraError(error.message);
  }
}
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Categories</h2>

    <v-alert v-if="admin.errorCategories" type="error" variant="tonal" class="mb-4" :text="admin.errorCategories" />

    <v-btn color="primary" class="mb-4" @click="obreNova">Nova categoria</v-btn>

    <v-data-table :headers="capcaleres" :items="admin.categories">
      <template #item.accions="{ item }">
        <v-btn size="small" variant="text" @click="obreEdicio(item)">Editar</v-btn>
        <v-btn size="small" variant="text" color="error" @click="esborra(item)">Esborrar</v-btn>
      </template>
    </v-data-table>

    <v-dialog v-model="dialeg" max-width="500">
      <v-card>
        <v-card-title>Categoria</v-card-title>
        <v-card-text>
          <v-text-field v-model="formulari.nom" label="Nom" />
          <v-textarea v-model="formulari.descripcio" label="Descripcio" />
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
