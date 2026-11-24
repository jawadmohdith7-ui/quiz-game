//ARXIU QUE DEFINEIX LES RUTES DE LA APLICACIO

//=====================
//IMPORTEM
//=====================
import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";
import LobbyView from "../views/LobbyView.vue";
import RoomView from "../views/RoomView.vue";
import StatsView from "../views/StatsView.vue";
import AdminLayout from "../views/admin/AdminLayout.vue";
import AdminDashboardView from "../views/admin/AdminDashboardView.vue";
import AdminSalesView from "../views/admin/AdminSalesView.vue";
import AdminPreguntesView from "../views/admin/AdminPreguntesView.vue";
import AdminCategoriesView from "../views/admin/AdminCategoriesView.vue";
import AdminUsuarisView from "../views/admin/AdminUsuarisView.vue";
import AdminEstadistiquesView from "../views/admin/AdminEstadistiquesView.vue";

//=====================
//DECLAREM LES RUTES
//=====================
const routes = [
  {
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    path: "/lobby",
    name: "lobby",
    component: LobbyView,
  },
  {
    path: "/room",
    name: "room",
    component: RoomView,
  },
  {
    path: "/stats",
    name: "stats",
    component: StatsView,
  },
  {
    path: "/admin",
    component: AdminLayout,
    children: [
      { path: "", component: AdminDashboardView },
      { path: "sales", component: AdminSalesView },
      { path: "preguntes", component: AdminPreguntesView },
      { path: "categories", component: AdminCategoriesView },
      { path: "usuaris", component: AdminUsuarisView },
      { path: "estadistiques", component: AdminEstadistiquesView },
    ],
  },
];

//=====================
//CREEM EL ROUTER
//=====================
const router = createRouter({
  history: createWebHistory(),
  routes: routes,
});

router.beforeEach((to, _from, next) => {
  //LES RUTES D'ADMIN NOMES SON PER A UN ADMINISTRADOR
  if (to.path === "/admin" || to.path.indexOf("/admin/") === 0) {
    const rol = localStorage.getItem("authRol");

    if (rol !== "admin") {
      next({ name: "home" });
      return;
    }

    next();
    return;
  }

  const forceHomePreview = to.name === "home" && to.query.preview === "1";
  const hasAuthUser = Boolean(localStorage.getItem("authUserId") || "");

  if ((to.name === "lobby" || to.name === "room" || to.name === "stats") && hasAuthUser === false) {
    next({ name: "home" });
    return;
  }

  if (to.name === "home" && hasAuthUser === true && forceHomePreview === false) {
    next({ name: "lobby" });
    return;
  }

  next();
});

export default router;
