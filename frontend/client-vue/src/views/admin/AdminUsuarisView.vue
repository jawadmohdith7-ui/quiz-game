<!--ARXIU QUE GESTIONA EL CRUD D'USUARIS DES DEL PANELL D'ADMINISTRACIO-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import { useAdminStore } from "../../stores/admin.js";
import {
  adminUsuarisList,
  adminUsuarisCreate,
  adminUsuarisUpdate,
  adminUsuarisDelete,
} from "../../services/adminApi.js";
import { confirmaEsborrar, mostraError } from "../../services/alertes.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();
const dialeg = ref(false);
const editant = ref(false);
const formulari = ref({ id: null, nom: "", email: "", password: "" });

const capcaleres = [
  { title: "ID", key: "id" },
  { title: "Nom", key: "nom" },
  { title: "Email", key: "email" },
  { title: "Rol", key: "rol" },
  { title: "Verificat", key: "verificat" },
  { title: "Accions", key: "accions", sortable: false },
];

//=====================
//CARREGA
//=====================
async function carrega() {
  try {
    const dades = await adminUsuarisList();
    admin.setUsuaris(dades.usuaris);
  } catch (error) {
    admin.setErrorUsuaris(error.message);
  }
}

onMounted(carrega);

//=====================
//FORMULARI
//=====================
function obreNou() {
  editant.value = false;
  formulari.value = { id: null, nom: "", email: "", password: "" };
  dialeg.value = true;
}

function obreEdicio(usuari) {
  editant.value = true;
  formulari.value = {
    id: usuari.id,
    nom: usuari.nom,
    email: usuari.email,
    password: "",
  };
  dialeg.value = true;
}

async function desa() {
  try {
    //LA CONTRASENYA NOMES S'ENVIA EN CREAR
    if (editant.value === true) {
      await adminUsuarisUpdate(formulari.value.id, {
        nom: formulari.value.nom,
        email: formulari.value.email,
      });
    }

    if (editant.value === false) {
      await adminUsuarisCreate({
        nom: formulari.value.nom,
        email: formulari.value.email,
        password: formulari.value.password,
      });
    }

    dialeg.value = false;
    carrega();
  } catch (error) {
    admin.setErrorUsuaris(error.message);
  }
}

async function esborra(usuari) {
  const confirmat = await confirmaEsborrar("Segur que vols esborrar aquest usuari?");

  if (confirmat === false) {
    return;
  }

  try {
    await adminUsuarisDelete(usuari.id);
    carrega();
  } catch (error) {
    mostraError(error.message);
  }
}
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Usuaris</h2>

    <v-alert v-if="admin.errorUsuaris" type="error" variant="tonal" class="mb-4" :text="admin.errorUsuaris" />

    <v-btn color="primary" class="mb-4" @click="obreNou">Nou usuari</v-btn>

    <v-data-table :headers="capcaleres" :items="admin.usuaris">
      <template #item.accions="{ item }">
        <v-btn size="small" variant="text" @click="obreEdicio(item)">Editar</v-btn>
        <v-btn size="small" variant="text" color="error" @click="esborra(item)">Esborrar</v-btn>
      </template>
    </v-data-table>

    <v-dialog v-model="dialeg" max-width="500">
      <v-card>
        <v-card-title>Usuari</v-card-title>
        <v-card-text>
          <v-text-field v-model="formulari.nom" label="Nom" />
          <v-text-field v-model="formulari.email" label="Email" />
          <v-text-field v-if="editant === false" v-model="formulari.password" label="Contrasenya" type="password" />
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
