//ARXIU QUE GUARDA L'ESTAT DEL PANELL D'ADMINISTRACIO

//=====================
//IMPORTEM
//=====================
import { defineStore } from "pinia";
import { ref } from "vue";

//=====================
//DECLAREM EL STORE
//=====================
export const useAdminStore = defineStore("admin", () => {
  //AUTENTICACIO
  const autenticat = ref(false);
  const errorAuth = ref("");

  //DIRECTE
  const jugadors = ref(0);
  const sales = ref([]);
  const partidesEnCurs = ref(0);
  const errorDirecte = ref("");

  //PREGUNTES
  const preguntes = ref([]);
  const errorPreguntes = ref("");
  const errorsPreguntes = ref({});

  //CATEGORIES
  const categories = ref([]);
  const errorCategories = ref("");

  //USUARIS
  const usuaris = ref([]);
  const errorUsuaris = ref("");

  //ESTADISTIQUES (COMENCEN A ZERO PER NO HAVER DE COMPROVAR RES A LA PLANTILLA)
  const general = ref({ partides: 0, jugadors: 0, encerts: 0 });
  const salesStats = ref([]);
  const errorEstadistiques = ref("");

  //REGISTRE I US
  const registre = ref({
    total: 0,
    encerts: 0,
    errors: 0,
    percentatgeEncerts: 0,
    percentatgeErrors: 0,
  });
  const errorRegistre = ref("");
  const usage = ref(null);
  const errorUsage = ref("");

  //PROMESA QUE ES RESOL QUAN EL CANAL HA PASSAT ADMIN:AUTH (LES VISTES FILLES L'ESPEREN)
  let authReadyResolve = null;
  const authReady = new Promise(function executor(resolve) {
    authReadyResolve = resolve;
  });

  function markAuthReady() {
    authReadyResolve();
  }

  //=====================
  //AUTENTICACIO
  //=====================
  function setAutenticat(valor) {
    autenticat.value = valor;
  }

  function setErrorAuth(missatge) {
    errorAuth.value = missatge;
  }

  //=====================
  //DIRECTE
  //=====================
  function applyLive(data) {
    jugadors.value = data.jugadors;
    sales.value = data.sales;
    partidesEnCurs.value = data.partidesEnCurs;
    errorDirecte.value = "";
  }

  function setErrorDirecte(missatge) {
    errorDirecte.value = missatge;
  }

  //=====================
  //PREGUNTES
  //=====================
  function setPreguntes(llista) {
    preguntes.value = llista;
    errorPreguntes.value = "";
    errorsPreguntes.value = {};
  }

  function setErrorPreguntes(missatge) {
    errorPreguntes.value = missatge;
  }

  function setErrorsPreguntes(errors) {
    errorsPreguntes.value = errors || {};
  }

  //=====================
  //CATEGORIES
  //=====================
  function setCategories(llista) {
    categories.value = llista;
    errorCategories.value = "";
  }

  function setErrorCategories(missatge) {
    errorCategories.value = missatge;
  }

  //=====================
  //USUARIS
  //=====================
  function setUsuaris(llista) {
    usuaris.value = llista;
    errorUsuaris.value = "";
  }

  function setErrorUsuaris(missatge) {
    errorUsuaris.value = missatge;
  }

  //=====================
  //ESTADISTIQUES
  //=====================
  function setEstadistiques(dadesGeneral, dadesSales) {
    general.value = dadesGeneral;
    salesStats.value = dadesSales;
    errorEstadistiques.value = "";
  }

  function setErrorEstadistiques(missatge) {
    errorEstadistiques.value = missatge;
  }

  //=====================
  //REGISTRE I US
  //=====================
  function setRegistre(dades) {
    registre.value = dades;
    errorRegistre.value = "";
  }

  function setErrorRegistre(missatge) {
    errorRegistre.value = missatge;
  }

  function setUsage(dades) {
    usage.value = dades;
    errorUsage.value = "";
  }

  function setErrorUsage(missatge) {
    errorUsage.value = missatge;
  }

  return {
    autenticat,
    errorAuth,
    jugadors,
    sales,
    partidesEnCurs,
    errorDirecte,
    preguntes,
    errorPreguntes,
    errorsPreguntes,
    categories,
    errorCategories,
    usuaris,
    errorUsuaris,
    general,
    salesStats,
    errorEstadistiques,
    registre,
    errorRegistre,
    usage,
    errorUsage,
    authReady,
    markAuthReady,
    setAutenticat,
    setErrorAuth,
    applyLive,
    setErrorDirecte,
    setPreguntes,
    setErrorPreguntes,
    setErrorsPreguntes,
    setCategories,
    setErrorCategories,
    setUsuaris,
    setErrorUsuaris,
    setEstadistiques,
    setErrorEstadistiques,
    setRegistre,
    setErrorRegistre,
    setUsage,
    setErrorUsage,
  };
});
