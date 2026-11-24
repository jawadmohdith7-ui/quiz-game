<!--ARXIU QUE PINTA LES ESTADISTIQUES GENERALS I PER SALA-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import { useAdminStore } from "../../stores/admin.js";
import { adminEstadistiquesGet } from "../../services/adminApi.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();
const sala = ref("");
const capcaleres = [
  { title: "Sala", key: "nom_sala" },
  { title: "Partides", key: "partides" },
  { title: "Jugadors", key: "jugadors" },
  { title: "Encerts mitjans", key: "encerts" },
];

//=====================
//CARREGA
//=====================
async function carrega() {
  try {
    const dades = await adminEstadistiquesGet(sala.value);
    admin.setEstadistiques(dades.general, dades.sales);
  } catch (error) {
    admin.setErrorEstadistiques(error.message);
  }
}

onMounted(carrega);
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Estadistiques</h2>

    <v-alert v-if="admin.errorEstadistiques" type="error" variant="tonal" class="mb-4" :text="admin.errorEstadistiques" />

    <v-row class="mb-2">
      <v-col cols="12" md="6">
        <v-text-field v-model="sala" label="Sala (buit = totes)" />
      </v-col>
      <v-col cols="12" md="6">
        <v-btn color="primary" @click="carrega">Filtrar</v-btn>
      </v-col>
    </v-row>

    <v-row>
      <v-col cols="12" md="4">
        <v-card variant="tonal">
          <v-card-title class="text-subtitle-1">Partides</v-card-title>
          <v-card-text class="text-h5">{{ admin.general.partides }}</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card variant="tonal">
          <v-card-title class="text-subtitle-1">Jugadors</v-card-title>
          <v-card-text class="text-h5">{{ admin.general.jugadors }}</v-card-text>
        </v-card>
      </v-col>
      <v-col cols="12" md="4">
        <v-card variant="tonal">
          <v-card-title class="text-subtitle-1">Encerts mitjans</v-card-title>
          <v-card-text class="text-h5">{{ admin.general.encerts }}</v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-data-table class="mt-4" :headers="capcaleres" :items="admin.salesStats" />
  </div>
</template>
