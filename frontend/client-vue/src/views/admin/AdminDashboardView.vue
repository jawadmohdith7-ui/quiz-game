<!--ARXIU QUE PINTA EL DASHBOARD: DIRECTE, PERCENTATGES I GRAFICS D'US-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import AdminTargeta from "../../components/admin/AdminTargeta.vue";
import AdminUsageChart from "../../components/admin/AdminUsageChart.vue";
import { useAdminStore } from "../../stores/admin.js";
import { adminRegistreGet, adminUsageGet } from "../../services/adminApi.js";

//=====================
//ESTAT
//=====================
const admin = useAdminStore();
const periode = ref("dia");
const periodes = ["dia", "setmana", "mes"];

//=====================
//CARREGA
//=====================
async function carregaRegistre() {
  try {
    const dades = await adminRegistreGet("avui");
    admin.setRegistre(dades);
  } catch (error) {
    admin.setErrorRegistre(error.message);
  }
}

async function carregaUsage() {
  try {
    const dades = await adminUsageGet(periode.value);
    admin.setUsage(dades.usage);
  } catch (error) {
    admin.setErrorUsage(error.message);
  }
}

onMounted(function enMontar() {
  //DUES PETICIONS INDEPENDENTS: SI UNA FALLA, L'ALTRA ES PINTA
  carregaRegistre();
  carregaUsage();
});
</script>

<template>
  <div>
    <h2 class="text-h5 mb-4">Dashboard</h2>

    <v-row>
      <v-col cols="12" md="3">
        <AdminTargeta titol="Jugadors ara" :valor="admin.jugadors" :error="admin.errorDirecte" />
      </v-col>
      <v-col cols="12" md="3">
        <AdminTargeta titol="Partides en curs" :valor="admin.partidesEnCurs" :error="admin.errorDirecte" />
      </v-col>
      <v-col cols="12" md="3">
        <AdminTargeta titol="% encerts" :valor="admin.registre.percentatgeEncerts" :error="admin.errorRegistre" />
      </v-col>
      <v-col cols="12" md="3">
        <AdminTargeta titol="% errors" :valor="admin.registre.percentatgeErrors" :error="admin.errorRegistre" />
      </v-col>
    </v-row>

    <v-card variant="tonal" class="mt-4">
      <v-card-title class="text-subtitle-1">Us comparat amb el periode anterior</v-card-title>
      <v-card-text>
        <v-btn-toggle v-model="periode" mandatory density="compact" @update:model-value="carregaUsage">
          <v-btn v-for="p in periodes" :key="p" :value="p">{{ p }}</v-btn>
        </v-btn-toggle>

        <div v-if="admin.errorUsage" class="text-error text-body-2 mt-3">
          {{ admin.errorUsage }}
        </div>

        <v-row v-if="admin.usage && !admin.errorUsage" class="mt-3">
          <v-col cols="12" md="6">
            <AdminUsageChart
              titol="Usuaris"
              :etiqueta-actual="admin.usage.etiquetaActual"
              :etiqueta-anterior="admin.usage.etiquetaAnterior"
              :actual="admin.usage.usuaris.actual"
              :anterior="admin.usage.usuaris.anterior"
            />
          </v-col>
          <v-col cols="12" md="6">
            <AdminUsageChart
              titol="Partides"
              :etiqueta-actual="admin.usage.etiquetaActual"
              :etiqueta-anterior="admin.usage.etiquetaAnterior"
              :actual="admin.usage.partides.actual"
              :anterior="admin.usage.partides.anterior"
            />
          </v-col>
        </v-row>
      </v-card-text>
    </v-card>
  </div>
</template>
