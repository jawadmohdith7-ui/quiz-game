<!--ARXIU QUE PINTA UNA TARGETA DE XIFRA AMB EL SEU ERROR PROPI-->
<script setup>
//=====================
//PROPS
//=====================
const props = defineProps({
  titol: {
    type: String,
    required: true,
  },
  valor: {
    type: [String, Number],
    default: 0,
  },
  error: {
    type: String,
    default: "",
  },
});
</script>

<template>
  <v-card variant="tonal">
    <v-card-title class="text-subtitle-1">{{ props.titol }}</v-card-title>
    <v-card-text>
      <div v-if="props.error" class="text-error text-body-2">
        {{ props.error }}
      </div>
      <div v-if="!props.error" class="text-h4">{{ props.valor }}</div>
    </v-card-text>
  </v-card>
</template>
