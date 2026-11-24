<!--ARXIU QUE PINTA LA BARRA LATERAL DEL PANELL D'ADMINISTRACIO I REP LES SECCIONS PER PROPS-->
<script setup>
//=====================
//PROPS
//=====================
const props = defineProps({
  seccions: {
    type: Array,
    required: true,
  },
});
</script>

<template>
  <v-list nav density="compact">
    <v-list-item
      v-for="seccio in props.seccions"
      :key="seccio.ruta"
      :to="seccio.ruta"
      :prepend-icon="seccio.icona"
      :title="seccio.titol"
    />
  </v-list>
</template>
