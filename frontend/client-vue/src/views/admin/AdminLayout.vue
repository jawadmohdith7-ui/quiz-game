<!--ARXIU QUE MUNTA LA BARRA LATERAL ESQUERRA I LA SECCIO ACTIVA DEL PANELL D'ADMINISTRACIO-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { useRouter } from "vue-router";
import AdminSidebar from "../../components/admin/AdminSidebar.vue";
import { useAdminStore } from "../../stores/admin.js";
import { adminAuth, adminLiveGet } from "../../services/adminApi.js";
import { initSocket } from "../../services/websocket.js";

//=====================
//ESTAT
//=====================
const router = useRouter();
const admin = useAdminStore();

//LA PRIMERA SECCIO ES SEMPRE EL DASHBOARD
const seccions = [
  { titol: "Dashboard", ruta: "/admin", icona: "mdi-view-dashboard" },
  { titol: "Sales", ruta: "/admin/sales", icona: "mdi-door-open" },
  { titol: "Preguntes", ruta: "/admin/preguntes", icona: "mdi-help-circle" },
  { titol: "Categories", ruta: "/admin/categories", icona: "mdi-tag" },
  { titol: "Usuaris", ruta: "/admin/usuaris", icona: "mdi-account" },
  { titol: "Estadistiques", ruta: "/admin/estadistiques", icona: "mdi-chart-bar" },
];

//=====================
//AUTENTICACIO DEL CANAL
//=====================
//VA AL SETUP I NO A onMounted: ELS FILLS ES MUNTEN ABANS QUE EL PARE, I TOTA PETICIO FILLA ESPERA authReady
initSocket();

adminAuth()
  .then(function onAuthOk() {
    admin.setAutenticat(true);
    admin.markAuthReady();

    //DESPRES DEMANEM L'ESTAT ACTUAL (PETICIO INDEPENDENT)
    return adminLiveGet().then(function onLive(dades) {
      admin.applyLive(dades);
    }, function onLiveError(error) {
      admin.setErrorDirecte(error.message);
    });
  })
  .catch(function onAuthError(error) {
    admin.setAutenticat(false);
    admin.setErrorAuth(error.message);
    router.push("/");
  });
</script>

<template>
  <div class="admin-panell">
    <aside class="admin-barra">
      <div class="text-h6 pa-3">Administracio</div>
      <AdminSidebar :seccions="seccions" />
    </aside>

    <main class="admin-contingut">
      <v-alert
        v-if="admin.errorAuth"
        type="error"
        variant="tonal"
        class="mb-4"
        :text="admin.errorAuth"
      />
      <router-view />
    </main>
  </div>
</template>

<style scoped>
/*LA BARRA ES FIJA I OCUPA TOTA L'ALCADA; EL CONTINGUT FA EL SEU PROPI SCROLL*/
.admin-panell {
  display: flex;
  min-height: 100vh;
}

.admin-barra {
  position: fixed;
  top: 0;
  left: 0;
  width: 240px;
  height: 100vh;
  overflow-y: auto;
  background: rgb(var(--v-theme-surface));
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.admin-contingut {
  flex: 1;
  min-height: 100vh;
  margin-left: 240px;
  padding: 24px;
}

/*EN PANTALLA PETITA LA BARRA DEIXA DE SER FIJA I VA A SOBRE*/
@media (max-width: 960px) {
  .admin-panell {
    display: block;
  }

  .admin-barra {
    position: static;
    width: 100%;
    height: auto;
    border-right: none;
    border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  }

  .admin-contingut {
    margin-left: 0;
  }
}
</style>
