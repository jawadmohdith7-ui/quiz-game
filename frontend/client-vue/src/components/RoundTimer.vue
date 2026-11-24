<script setup>
//COMPONENT QUE PINTA ELS SEGONS QUE QUEDEN DE RONDA
//EL TEMPS ÉS NOMÉS DECORATIU: EL BACKEND ÉS QUI TANCA LA RONDA

//=====================
//IMPORTEM
//=====================
import { onMounted, onUnmounted, ref } from "vue";

//=====================
//PROPS
//=====================
const props = defineProps({
  endsAt: {
    type: Number,
    default: 0,
  },
});

//=====================
//ESTAT
//=====================
const secondsLeft = ref(0);
let interval = null;

//=====================
//CÀLCUL DELS SEGONS RESTANTS
//=====================
function updateSeconds() {
  secondsLeft.value = Math.max(
    0,
    Math.ceil((props.endsAt - Date.now()) / 1000)
  );
}

//=====================
//CICLE DE VIDA
//=====================
onMounted(() => {
  updateSeconds();

  //SENSE DATA D'INICI NO HI HA RES A COMPTAR
  if (props.endsAt) {
    interval = setInterval(updateSeconds, 1000);
  }
});

onUnmounted(() => {
  clearInterval(interval);
});
</script>

<template>
  <v-chip color="warning">
    {{ secondsLeft }} SEGUNDOS
  </v-chip>
</template>
