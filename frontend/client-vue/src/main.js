//ARXIU QUE INICIALITZA L'APLICACIO VUE

//=====================
//IMPORTEM
//=====================
import { createApp } from "vue";
import { createPinia } from "pinia";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";
import "vuetify/styles";
import "@mdi/font/css/materialdesignicons.css";
import App from "./App.vue";
import router from "./router";

//=====================
//CONFIGURACIO DE VUETIFY
//=====================
const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: "dark",
    themes: {
      dark: {
        colors: { primary: "#7c4dff", secondary: "#b388ff", indigo: "#7c4dff" },
      },
    },
  },
});

//=====================
//CREACIO I MUNTATGE DE L'APLICACIO
//=====================
createApp(App).use(createPinia()).use(router).use(vuetify).mount("#app");