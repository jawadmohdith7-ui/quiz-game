<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useGameStore } from "../stores/game";
import { getMyStats, getRanking } from "../services/statsApi";
import PlayerAvatar from "../components/PlayerAvatar.vue";

const router = useRouter();
const game = useGameStore();

const loading = ref(true);
const error = ref("");
const ranking = ref([]);
const profile = ref(null);
const history = ref([]);
const isRegistered = computed(() => Boolean(game.authToken));

onMounted(async () => {
  try {
    const requests = [getRanking()];
    if (isRegistered.value) {
      requests.push(getMyStats(game.authToken));
    }

    const [rankingResult, statsResult] = await Promise.all(requests);
    ranking.value = rankingResult.ranking || [];

    if (statsResult) {
      profile.value = statsResult.perfil;
      history.value = statsResult.historial || [];
    }
  } catch (requestError) {
    error.value = requestError.message;
  } finally {
    loading.value = false;
  }
});

function formatDate(value) {
  return new Intl.DateTimeFormat("ca-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
</script>

<template>
  <v-container class="py-8 stats-container" max-width="1100">
    <v-row align="center" justify="space-between" class="mb-6">
      <div>
        <p class="text-overline text-indigo">HOWMUCH</p>
        <h1>Estadístiques</h1>
      </div>
      <v-btn variant="tonal" prepend-icon="mdi-arrow-left" @click="router.back()">
        Tornar
      </v-btn>
    </v-row>

    <v-progress-linear v-if="loading" indeterminate color="indigo" class="mb-4" />
    <v-alert v-else-if="error" type="error">{{ error }}</v-alert>

    <template v-else>
      <v-row v-if="profile" class="mb-4">
        <v-col v-for="metric in [
          ['Partides', profile.partidesJugades, 'mdi-gamepad-variant'],
          ['Victòries', profile.victories, 'mdi-trophy'],
          ['Derrotes', profile.derrotes, 'mdi-close-circle'],
          ['Podis', profile.podis, 'mdi-podium'],
          ['% de victòries', `${profile.percentatgeVictories}%`, 'mdi-percent'],
          ['Mitjana d’encerts', profile.mitjanaEncerts, 'mdi-target'],
        ]" :key="metric[0]" cols="6" md="3">
          <v-card class="metric-card pa-5" elevation="3">
            <v-icon color="indigo" size="32">{{ metric[2] }}</v-icon>
            <div class="text-h4 mt-3">{{ metric[1] }}</div>
            <div class="text-body-2 text-medium-emphasis">{{ metric[0] }}</div>
          </v-card>
        </v-col>
      </v-row>

      <v-alert
        v-else-if="!isRegistered"
        type="info"
        variant="tonal"
        class="mb-4"
      >
        Inicia sessió amb un compte registrat per veure les teves estadístiques personals.
      </v-alert>

      <v-row>
        <v-col cols="12" md="6">
          <v-card elevation="3">
            <v-card-title>
              <v-icon start color="amber">mdi-trophy</v-icon>
              Rànquing global
            </v-card-title>
            <v-card-text>
              <v-list v-if="ranking.length">
                <v-list-item
                  v-for="player in ranking"
                  :key="player.userId"
                  :title="`${player.posicioRanking}. ${player.username}`"
                  :subtitle="`${player.victories} victòries · ${player.podis} podis · ${player.partidesJugades} partides`"
                >
                  <template #prepend>
                    <PlayerAvatar
                      :nickname="player.username"
                      :user-id="player.userId"
                      :color="player.avatarColor"
                      class="mr-3"
                    />
                  </template>
                </v-list-item>
              </v-list>
              <p v-else class="empty-state">Encara no hi ha partides registrades.</p>
            </v-card-text>
          </v-card>
        </v-col>

        <v-col cols="12" md="6">
          <v-card elevation="3">
            <v-card-title>
              <v-icon start color="indigo">mdi-history</v-icon>
              Historial recent
            </v-card-title>
            <v-card-text>
              <v-list v-if="history.length">
                <v-list-item
                  v-for="(match, index) in history"
                  :key="`${match.data}-${index}`"
                  :title="match.nomSala"
                  :subtitle="`${match.categoria} · Posició ${match.posicio} · ${formatDate(match.data)}`"
                />
              </v-list>
              <p v-else class="empty-state">
                {{ isRegistered ? "Encara no tens partides a l’historial." : "Inicia sessió per veure l’historial." }}
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.stats-container {
  min-height: 100vh;
}

.metric-card {
  height: 100%;
}

.empty-state {
  color: #64748b;
  padding: 1rem 0;
  text-align: center;
}
</style>
