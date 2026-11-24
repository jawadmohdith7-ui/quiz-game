
<script setup>
//VISTA DE L'OBSERVADOR: VEURE LA PARTIDA DEL JUGADOR OBSERVAT, SENSE JUGAR

//=====================
//IMPORTEM
//=====================
import { computed, ref, watch } from "vue";
import { useGameStore } from "../stores/game";
import { selectObservedPlayer } from "../services/websocket";
import RoundTimer from "../components/RoundTimer.vue";
import RoomRanking from "../components/RoomRanking.vue";
import PlayerAvatar from "../components/PlayerAvatar.vue";

//=====================
//ESTAT
//=====================
const game = useGameStore();
const selectingPlayerId = ref(null);
const selecting = ref(false);
const selectError = ref("");

const currentQuestion = computed(() => game.currentQuestion);

const playersToObserve = computed(() => {
  return game.players.filter((player) => player.role === "player");
});

const observedLabel = computed(() => {
  if (game.observedPlayerNickname) {
    return game.observedPlayerNickname;
  }

  return "";
});

//=====================
//SLIDER DEL JUGADOR OBSERVAT
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

//EL SLIDER ES MOU AMB EL QUE ENVIA EL JUGADOR PER gameplay:update
const observedSliderValue = computed(() => {
  const question = currentQuestion.value;

  if (!question) {
    return 0;
  }

  const numeric = Number(game.observedGameplay);

  if (Number.isNaN(numeric) === true) {
    return question.min;
  }

  if (numeric < question.min) {
    return question.min;
  }

  if (numeric > question.max) {
    return question.max;
  }

  return numeric;
});

//=====================
//RESULTATS DE LA RONDA DEL JUGADOR OBSERVAT
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
    return "SENSE RESULTAT DEL JUGADOR OBSERVAT";
  }

  if (game.results.you.answer === null) {
    return "EL JUGADOR NO HA RESPOSTAT";
  }

  if (game.results.you.answer === game.results.correctAnswer) {
    return "EL JUGADOR HA ENCERTAT";
  }

  return "EL JUGADOR HA FALLAT";
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

const personalLabel = computed(() => {
  if (!observedLabel.value) {
    return "POSICIÓ DEL JUGADOR OBSERVAT";
  }

  return "POSICIÓ DE " + observedLabel.value;
});

//=====================
//SELECCIÓ DEL JUGADOR OBSERVAT
//=====================
function pickRandomPlayer() {
  const candidates = playersToObserve.value;

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

async function observePlayer(playerId) {
  selectError.value = "";
  selecting.value = true;

  try {
    await selectObservedPlayer(playerId);
  } catch (reason) {
    selectError.value = String(reason || "No s'ha pogut seleccionar el jugador.");
  } finally {
    selecting.value = false;
  }
}

async function handleSelectObservedPlayer() {
  if (!selectingPlayerId.value) {
    selectError.value = "Selecciona un jugador per observar.";
    return;
  }

  await observePlayer(selectingPlayerId.value);
}

//SI NO HI HA JUGADOR OBSERVAT, EN TRIEM UN A L'ATZAR
//EL store NETEJA EL TRACKING QUAN EL JUGADOR MARXA, AIXÍ QUE AQUEST watch ES TORNA A DISPARAR
watch(
  () => playersToObserve.value.map((player) => player.id).join(","),
  () => {
    if (selecting.value === true) {
      return;
    }

    const observedStillThere = playersToObserve.value.some(
      (player) => player.id === game.observedPlayerId
    );

    if (observedStillThere === true) {
      return;
    }

    const target = pickRandomPlayer();

    if (target === null) {
      return;
    }

    observePlayer(target.id);
  },
  { immediate: true }
);
</script>

<template>
  <div>
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

      <v-alert v-if="observedLabel" type="info" variant="tonal" class="mb-4">
        OBSERVANT: <strong>{{ observedLabel }}</strong>
      </v-alert>

      <v-alert v-else type="warning" variant="tonal" class="mb-4">
        ESPERANT UN JUGADOR PER OBSERVAR…
      </v-alert>

      <v-card class="pa-6 mb-4">
        <h3 class="text-h5 mb-4">{{ currentQuestion.text }}</h3>

        <v-slider
          v-if="hasSlider"
          :model-value="observedSliderValue"
          :min="currentQuestion.min"
          :max="currentQuestion.max"
          :step="currentQuestion.step"
          disabled
          color="grey"
          thumb-label="always"
          class="mb-4"
        >
          <template #append>
            <span>{{ currentQuestion.unit }}</span>
          </template>
        </v-slider>

        <v-text-field
          :model-value="game.observedGameplay"
          label="RESPOSTA DEL JUGADOR"
          type="text"
          :suffix="currentQuestion.unit"
          disabled
        />
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

    <v-alert
      v-if="game.screen === 'result' && !game.results"
      type="info"
      variant="tonal"
      class="mb-4"
    >
      ESPERANT LA SEGÜENT RONDA…
    </v-alert>

    <div
      v-if="!currentQuestion && game.screen !== 'result' && game.screen !== 'ranking' && game.screen !== 'finished'"
      class="text-center py-8"
    >
      <h2>ESPERANT QUE COMENCI LA PARTIDA…</h2>
    </div>

    <v-card class="pa-4 mb-4">
      <v-card-title>ETS ESPECTADOR</v-card-title>

      <v-card-text>
        <p class="text-subtitle-1 mb-2">TRIA A QUI VOLS OBSERVAR</p>

        <v-row>
          <v-col cols="12" md="8">
            <v-select
              v-model="selectingPlayerId"
              :items="playersToObserve"
              item-title="nickname"
              item-value="id"
              label="Jugador"
              variant="outlined"
              :disabled="playersToObserve.length === 0"
            >
              <template #item="{ props: itemProps, item }">
                <v-list-item v-bind="itemProps">
                  <template #prepend>
                    <PlayerAvatar
                      :nickname="item.nickname"
                      :user-id="item.userId"
                      :color="item.avatarColor"
                      class="mr-3"
                    />
                  </template>
                </v-list-item>
              </template>
            </v-select>
          </v-col>

          <v-col cols="12" md="4" class="d-flex align-center">
            <v-btn
              color="primary"
              block
              :disabled="playersToObserve.length === 0"
              :loading="selecting"
              @click="handleSelectObservedPlayer"
            >
              OBSERVAR
            </v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="selectError" type="error" class="mt-4">
          {{ selectError }}
        </v-alert>
      </v-card-text>
    </v-card>

    <RoomRanking
      v-if="game.screen === 'ranking' && game.ranking"
      :ranking="game.ranking.ranking"
      :you="game.ranking.you"
      :you-label="personalLabel"
      :spectator="game.ranking.you === null"
      title="CLASSIFICACIÓ DE LA RONDA"
    >
      <p class="mt-4">LA SEGÜENT RONDA COMENÇA AVIAT…</p>
    </RoomRanking>

    <RoomRanking
      v-if="game.screen === 'finished' && game.ranking"
      :ranking="game.ranking.ranking"
      :you="game.ranking.you"
      :you-label="personalLabel"
      :spectator="game.ranking.you === null"
      title="CLASSIFICACIÓ FINAL"
    >
      <p class="mt-4">TORNANT AL LOBBY DE LA SALA…</p>
    </RoomRanking>
  </div>
</template>
