
<script setup>
//VISTA DEL JUGADOR: READY, CONFIGURACIÓ, PREGUNTA, RESULTATS I RÀNQUING

//=====================
//IMPORTEM
//=====================
import { ref, computed, watch } from "vue";
import { useGameStore } from "../stores/game";
import {
  submitAnswer,
  startRound,
  nextRound,
  setReady,
  updateConfiguration,
  sendChatMessage,
  sendGameplayUpdate,
} from "../services/websocket";
import RoundSetup from "../components/RoundSetup.vue";
import RoundTimer from "../components/RoundTimer.vue";
import RoomRanking from "../components/RoomRanking.vue";

//=====================
//DECLAREM L'ESTAT
//=====================
const emit = defineEmits(["error", "leave"]);
const game = useGameStore();

const userAnswer = ref("");
const loading = ref(false);

const currentQuestion = computed(() => game.currentQuestion);

//CADA RONDA COMENÇA AMB EL CAMP DE RESPOSTA BUIT
watch(
  () => game.currentQuestion,
  () => {
    userAnswer.value = "";
    sendGameplayUpdate("");
  }
);

watch(userAnswer, (value) => {
  if (game.screen !== "round") {
    return;
  }

  sendGameplayUpdate(String(value ?? ""));
});

//=====================
//SLIDER DE RESPOSTA
//=====================
//NOMÉS ES PINTA SI LA PREGUNTA PORTA UNA ESCALA VÀLIDA
const hasSlider = computed(() => {
  const question = currentQuestion.value;

  if (!question) {
    return false;
  }

  return (
    typeof question.min === "number" &&
    typeof question.max === "number" &&
    typeof question.step === "number" &&
    question.step > 0 &&
    question.max > question.min
  );
});

//EL SLIDER I EL CAMP NUMÈRIC COMPARTEIXEN userAnswer
//AIXÍ EL watch(userAnswer) CONTINUA ENVIANT gameplay:update SENSE CANVIS
const sliderValue = computed({
  get() {
    const question = currentQuestion.value;

    if (!question) {
      return 0;
    }

    const numeric = Number(userAnswer.value);

    //EL CAMP BUIT O NO NUMÈRIC PARTEIX DEL MÍNIM, NO DE 0
    if (String(userAnswer.value ?? "").trim() === "" || Number.isNaN(numeric) === true) {
      return question.min;
    }

    if (numeric < question.min) {
      return question.min;
    }

    if (numeric > question.max) {
      return question.max;
    }

    return numeric;
  },
  set(value) {
    userAnswer.value = String(value);
  },
});

//EL MEU JUGADOR DINS LA SALA (PER SABER SI ESTIC A PUNT)
const me = computed(() =>
  game.players.find((player) => player.id === game.guestId)
);

const myReady = computed(() => me.value?.ready === true);

const readyLabel = computed(() => {
  if (myReady.value) {
    return "A PUNT";
  }

  return "MARCAR-SE A PUNT";
});

const readyColor = computed(() => {
  if (myReady.value) {
    return "success";
  }

  return "grey";
});

//=====================
//RESULTATS DE LA RONDA
//=====================
const resultType = computed(() => {
  if (!game.results || !game.results.you) {
    return "warning";
  }

  if (game.results.you.answer === null) {
    return "warning";
  }

  if (game.results.you.answer === game.results.correctAnswer) {
    return "success";
  }

  return "error";
});

const resultTitle = computed(() => {
  if (!game.results || !game.results.you) {
    return "ETS ESPECTADOR · NO HAS JUGAT AQUESTA RONDA";
  }

  if (game.results.you.answer === null) {
    return "NO HAS RESPOST";
  }

  if (game.results.you.answer === game.results.correctAnswer) {
    return "¡RESPOSTA CORRECTA!";
  }

  return "RESPOSTA INCORRECTA";
});

const roundPoints = computed(() => {
  if (!game.results || !game.results.you) {
    return 0;
  }

  return game.results.you.roundPoints;
});

const totalScore = computed(() => {
  if (!game.results || !game.results.you) {
    return 0;
  }

  return game.results.you.totalScore;
});

//=====================
//ACCIONS
//=====================
function handleToggleReady() {
  setReady(!myReady.value);
}

async function handleSaveConfiguration(configuration) {
  emit("error", "");

  try {
    await updateConfiguration(configuration);
  } catch (reason) {
    emit("error", reason);
  }
}

function handleStartRound() {
  emit("error", "");

  if (!game.connected) {
    emit("error", "NO ESTÀS CONNECTAT AL SERVIDOR.");
    return;
  }

  if (!game.isHost) {
    emit("error", "NOMÉS EL KING POT INICIAR LA PARTIDA.");
    return;
  }

  startRound();
}

function handleNextRound() {
  if (!game.isHost) {
    return;
  }

  nextRound();
}

async function handleSendAnswer() {
  const rawAnswer = String(userAnswer.value ?? "").trim();

  if (rawAnswer === "") {
    return;
  }

  const numericAnswer = Number(rawAnswer);
  if (Number.isNaN(numericAnswer) === true) {
    emit("error", "La resposta ha de ser un numero valid.");
    return;
  }

  loading.value = true;

  try {
    await submitAnswer(currentQuestion.value.id, numericAnswer);
  } catch (err) {
    console.error("ERROR ENVIANT RESPOSTA:", err);
    emit("error", err);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <RoundSetup
      v-if="!currentQuestion && game.isHost && game.screen !== 'finished'"
      :can-start="game.canStart"
      :configuration="game.configuration"
      @save="handleSaveConfiguration"
      @start="handleStartRound"
    />

    <div
      v-else-if="!currentQuestion && !game.isHost && game.screen !== 'finished'"
      class="text-center py-8"
    >
      <h2>ESPERANT QUE EL HOST INICI LA PARTIDA...</h2>

      <v-btn :color="readyColor" class="mt-4" @click="handleToggleReady">
        {{ readyLabel }}
      </v-btn>

      <v-btn color="grey" class="mt-4 ml-2" @click="emit('leave')">
        SORTIR DE LA SALA
      </v-btn>
    </div>

    <div v-if="currentQuestion && game.screen === 'round'">
      <div class="d-flex justify-space-between align-center mb-4 flex-wrap ga-3">
        <h2>
          RONDA {{ game.currentRound }} DE {{ game.totalRounds }}
        </h2>

        <div class="d-flex align-center ga-2">
          <v-chip color="info">
            {{ currentQuestion.difficulty }}
          </v-chip>

          <RoundTimer :ends-at="game.roundEndsAt" />
        </div>
      </div>

      <v-card class="pa-6 mb-4">
        <h3 class="text-h5 mb-4">{{ currentQuestion.text }}</h3>

        <v-slider
          v-if="hasSlider"
          v-model="sliderValue"
          :min="currentQuestion.min"
          :max="currentQuestion.max"
          :step="currentQuestion.step"
          :disabled="game.answered || loading"
          color="primary"
          thumb-label="always"
          class="mb-4"
        >
          <template #append>
            <span>{{ currentQuestion.unit }}</span>
          </template>
        </v-slider>

        <v-row align="center" class="mt-2">
          <v-col cols="12" sm="8">
            <v-text-field
              v-model="userAnswer"
              label="LA TEVA RESPOSTA"
              type="text"
              inputmode="decimal"
              :suffix="currentQuestion.unit"
              :disabled="game.answered || loading"
              @keyup.enter="handleSendAnswer"
            />
          </v-col>

          <v-col cols="12" sm="4">
            <v-btn
              color="grey"
              block
              size="large"
              :disabled="game.answered || loading || String(userAnswer).trim() === ''"
              :loading="loading"
              @click="handleSendAnswer"
            >
              ENVIAR
            </v-btn>
          </v-col>
        </v-row>
      </v-card>
    </div>

    <v-alert
      v-if="game.screen === 'result' && game.results"
      :type="resultType"
      class="mb-4"
    >
      <div class="text-h6">{{ resultTitle }}</div>

      <p class="mt-1">{{ game.results.explanation }}</p>

      <p>
        LA RESPOSTA CORRECTA ERA:
        {{ game.results.correctAnswer }} {{ game.results.unit }}
      </p>

      <p>PUNTS D'AQUESTA RONDA: {{ roundPoints }}</p>

      <p>PUNTS TOTALS: {{ totalScore }}</p>

      <p class="mt-2">EL RÀNQUING ARRIBA EN UNS SEGONS…</p>
    </v-alert>

    <RoomRanking
      v-if="game.screen === 'ranking' && game.ranking"
      :ranking="game.ranking.ranking"
      :you="game.ranking.you"
      title="CLASSIFICACIÓ DE LA RONDA"
    >
      <v-btn
        v-if="game.isHost && game.ranking.round < game.ranking.totalRounds"
        color="grey"
        class="mt-4"
        @click="handleNextRound"
      >
        SEGÜENT RONDA
      </v-btn>

      <p v-if="!game.isHost" class="mt-4">LA SEGÜENT RONDA COMENÇA AVIAT…</p>
    </RoomRanking>

    <RoomRanking
      v-if="game.screen === 'finished' && game.ranking"
      :ranking="game.ranking.ranking"
      :you="game.ranking.you"
      title="CLASSIFICACIÓ FINAL"
    >
      <p class="mt-4">TORNANT AL LOBBY DE LA SALA…</p>
    </RoomRanking>
  </div>
</template>
