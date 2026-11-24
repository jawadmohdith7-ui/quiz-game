<!--ARXIU QUE LLISTA LES SALES OBERTES DEL PANELL D'ADMINISTRACIO-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { useAdminStore } from "../../stores/admin.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();

//=====================
//COLUMNES
//=====================
const capcaleres = [
  { title: "Nom", key: "nom" },
  { title: "Categoria", key: "categoria" },
  { title: "Jugadors", key: "jugadors" },
  { title: "Estat", key: "estat" },
];
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Sales obertes</h2>

    <v-alert v-if="admin.errorDirecte" type="error" variant="tonal" class="mb-4" :text="admin.errorDirecte" />

    <v-data-table :headers="capcaleres" :items="admin.sales" no-data-text="Cap sala oberta." />
  </div>
</template>
