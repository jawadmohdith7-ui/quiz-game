
<script setup>
//COMPONENT COMPARTIT: RÀNQUING DE LA RONDA O FINAL
//UN ESPECTADOR VEU EL RÀNQUING COMPLET I EL TEXT D'ESPERA AL SEU LLOC

//=====================
//IMPORTEM
//=====================
import { computed } from "vue";
import PlayerAvatar from "./PlayerAvatar.vue";

//=====================
//PROPIETATS DEL COMPONENT
//=====================
const props = defineProps({
  ranking: { type: Array, default: () => [] },
  you: { type: Object, default: null },
  title: { type: String, default: "RÀNQUING" },
  spectator: { type: Boolean, default: false },
  youLabel: { type: String, default: "LA TEVA POSICIÓ" },
});

//=====================
//DADES PERSONALS DEL JUGADOR
//=====================
const personalPosition = computed(() => {
  if (!props.you) {
    return "-";
  }

  return props.you.position;
});

const personalScore = computed(() => {
  if (!props.you) {
    return 0;
  }

  if (props.you.totalScore !== undefined) {
    return props.you.totalScore;
  }

  if (props.you.score !== undefined) {
    return props.you.score;
  }

  return 0;
});
</script>

<template>
  <v-card class="pa-4 mb-4">
    <h2 class="mb-4">{{ title }}</h2>

    <v-list>
      <v-list-item
        v-for="entry in ranking"
        :key="entry.id"
        :title="entry.position + '. ' + entry.nickname"
        :subtitle="entry.score + ' punts'"
      >
        <template #prepend>
          <PlayerAvatar
            :nickname="entry.nickname"
            :user-id="entry.userId"
            :color="entry.avatarColor"
            class="mr-3"
          />
        </template>
      </v-list-item>
    </v-list>

    <v-divider class="my-3" />

    <div v-if="spectator">
      <p>ETS ESPECTADOR · ESPERA QUE ACABI LA PARTIDA</p>
    </div>

    <div v-else>
      <p>{{ youLabel }}: {{ personalPosition }}</p>
      <p>PUNTS TOTALS: {{ personalScore }}</p>
    </div>

    <slot />
  </v-card>
</template>
