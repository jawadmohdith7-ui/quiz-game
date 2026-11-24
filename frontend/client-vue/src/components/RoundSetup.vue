<script setup>
//ARXIU QUE MOSTRA I GUARDA LA CONFIGURACIO D'UNA SALA

//=====================
//IMPORTEM
//=====================
import { computed, onMounted, ref, watch } from "vue";
import { useGameStore } from "../stores/game";
import { requestCatalogOptions } from "../services/websocket";

//=====================
//DECLAREM EL COMPONENT
//=====================
const emit = defineEmits(["save", "start"]);

const props = defineProps({
  canStart: {
    type: Boolean,
    default: false,
  },
  configuration: {
    type: Object,
    default: null,
  },
});

const game = useGameStore();

//=====================
//VALORS INICIALS: SURTEN DE LA CONFIGURACIO REAL DE LA SALA
//=====================
let initialCategory = "Mix";
let initialDifficulty = "mix";
let initialMaxPlayers = 4;
let initialRounds = 5;
let initialDurationSeconds = 20;

if (props.configuration) {
  if (typeof props.configuration.category === "string") {
    initialCategory = props.configuration.category;
  }

  if (props.configuration.difficulty !== undefined) {
    initialDifficulty = props.configuration.difficulty;
  }

  if (props.configuration.maxPlayers !== undefined) {
    initialMaxPlayers = props.configuration.maxPlayers;
  }

  if (props.configuration.rounds !== undefined) {
    initialRounds = props.configuration.rounds;
  }

  if (props.configuration.durationSeconds !== undefined) {
    initialDurationSeconds = props.configuration.durationSeconds;
  }
}

//=====================
//ESTAT DEL FORMULARI
//=====================
const category = ref(initialCategory);
const difficulty = ref(initialDifficulty);
const maxPlayers = ref(initialMaxPlayers);
const rounds = ref(initialRounds);
const durationSeconds = ref(initialDurationSeconds);

//=====================
//OPCIONS DEL CATALEG (SEMPRE HI HA MIX)
//=====================
const categoryOptions = computed(() => {
  const options = [];
  let hasMix = false;

  for (let i = 0; i < game.categories.length; i = i + 1) {
    const option = game.categories[i];
    options.push(option);

    if (option.toLowerCase() === "mix") {
      hasMix = true;
    }
  }

  if (hasMix === false) {
    options.push("Mix");
  }

  return options;
});

const difficultyOptions = computed(() => {
  const options = [];
  let hasMix = false;

  for (let i = 0; i < game.difficulties.length; i = i + 1) {
    const value = game.difficulties[i];
    let title = value;

    if (value.length > 0) {
      title = value.charAt(0).toUpperCase() + value.slice(1);
    }

    options.push({
      title: title,
      value: value,
    });

    if (value.toLowerCase() === "mix") {
      hasMix = true;
    }
  }

  if (hasMix === false) {
    options.push({
      title: "Mix",
      value: "mix",
    });
  }

  return options;
});

//=====================
//QUAN CANVIA EL CATALEG, AJUSTEM LA SELECCIO
//SI UNA CATEGORIA O DIFICULTAT HA DESAPAREGUT, TORNEM A MIX
//=====================
function syncSelectionWithCatalog() {
  if (game.catalogLoading === true) {
    return;
  }

  if (game.catalogError !== "") {
    return;
  }

  let categoryFound = false;
  for (let i = 0; i < categoryOptions.value.length; i = i + 1) {
    const option = categoryOptions.value[i];

    if (option.toLowerCase() === String(category.value).toLowerCase()) {
      category.value = option;
      categoryFound = true;
      break;
    }
  }

  if (categoryFound === false) {
    category.value = "Mix";
  }

  let difficultyFound = false;
  for (let i = 0; i < difficultyOptions.value.length; i = i + 1) {
    const option = difficultyOptions.value[i];

    if (option.value.toLowerCase() === String(difficulty.value).toLowerCase()) {
      difficulty.value = option.value;
      difficultyFound = true;
      break;
    }
  }

  if (difficultyFound === false) {
    difficulty.value = "mix";
  }
}

//=====================
//CICLE DE VIDA
//=====================
onMounted(() => {
  if (game.categories.length === 0 || game.difficulties.length === 0) {
    requestCatalogOptions();
  }

  syncSelectionWithCatalog();
});

watch(
  [() => game.categories, () => game.difficulties, () => game.catalogLoading],
  () => {
    syncSelectionWithCatalog();
  }
);

//=====================
//GUARDAR LA CONFIGURACIO
//=====================
function handleSave() {
  if (game.catalogError !== "" || game.catalogLoading === true) {
    return;
  }

  emit("save", {
    category: category.value,
    difficulty: difficulty.value,
    maxPlayers: Number(maxPlayers.value),
    rounds: Number(rounds.value),
    durationSeconds: Number(durationSeconds.value),
  });
}

//=====================
//INICIAR LA PARTIDA
//=====================
function handleStart() {
  if (game.catalogError !== "" || game.catalogLoading === true) {
    return;
  }

  emit("start");
}
</script>

<template>
  <v-card class="pa-4">
    <v-card-title>CONFIGURACIÓ DE LA RONDA</v-card-title>

    <v-card-text>
      <v-alert
        v-if="game.catalogError"
        type="error"
        variant="tonal"
        class="mb-4"
      >
        {{ game.catalogError }}
      </v-alert>

      <v-select
        v-model="category"
        :items="categoryOptions"
        label="CATEGORIA DE LES PREGUNTES"
        variant="outlined"
        :loading="game.catalogLoading"
        :disabled="game.catalogLoading || Boolean(game.catalogError)"
      />

      <v-select
        v-model="difficulty"
        :items="difficultyOptions"
        item-title="title"
        item-value="value"
        label="DIFICULTAT"
        variant="outlined"
        :loading="game.catalogLoading"
        :disabled="game.catalogLoading || Boolean(game.catalogError)"
      />

      <v-text-field
        v-model.number="maxPlayers"
        label="JUGADORS MÀXIMS"
        type="number"
        min="2"
        max="20"
      />

      <v-text-field
        v-model.number="rounds"
        label="NÚMERO DE PREGUNTES"
        type="number"
        min="1"
      />

      <v-text-field
        v-model.number="durationSeconds"
        label="SEGONS PER PREGUNTA"
        type="number"
        min="5"
        max="60"
      />

      <v-btn
        color="grey"
        variant="outlined"
        block
        class="mb-3"
        :disabled="game.catalogLoading || Boolean(game.catalogError)"
        @click="handleSave"
      >
        GUARDAR CONFIGURACIÓN
      </v-btn>

      <p v-if="!props.canStart" class="mb-3">FALTA ALGÚ A PUNT PER COMENÇAR</p>

      <v-btn
        color="grey"
        block
        :disabled="!props.canStart || game.catalogLoading || Boolean(game.catalogError)"
        @click="handleStart"
      >
        INICIAR PARTIDA
      </v-btn>
    </v-card-text>
  </v-card>
</template>
