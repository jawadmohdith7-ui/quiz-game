<script setup>
//ARXIU QUE MOSTRA LA TARGETA DE PERFIL DEL JUGADOR

//=====================
//IMPORTEM
//=====================
import { ref } from "vue";
import { useRouter } from "vue-router";
import { useGameStore } from "../stores/game";
import { disconnectSocket } from "../services/websocket";
import { getAvatarColorOptions, updateAvatar } from "../services/authApi";

//=====================
//DECLAREM EL COMPONENT
//=====================
const game = useGameStore();
const router = useRouter();
const emit = defineEmits(["edit-nickname"]);

const avatarDialog = ref(false);
const loadingAvatar = ref(false);
const avatarError = ref("");
const avatarColorOptions = ref(["#22c55e", "#0ea5e9", "#f97316", "#a855f7"]);
const selectedAvatarColor = ref("#22c55e");
const selectedAvatarImage = ref("");

function getInitialFromNickname() {
  const base = String(game.nickname || "?").trim();
  if (base.length === 0) {
    return "?";
  }

  return base.charAt(0).toUpperCase();
}

function onAvatarFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    return;
  }

  if (file.size > 1_500_000) {
    avatarError.value = "La imatge és massa gran (màxim 1.5 MB)";
    return;
  }

  const reader = new FileReader();
  reader.onload = function onLoad() {
    selectedAvatarImage.value = String(reader.result || "");
    avatarError.value = "";
  };
  reader.readAsDataURL(file);
}

function removeSelectedAvatarImage() {
  selectedAvatarImage.value = "";
}

async function openAvatarDialog() {
  avatarError.value = "";
  avatarDialog.value = true;
  selectedAvatarImage.value = game.avatarImage || "";
  selectedAvatarColor.value = game.avatarColor || "#22c55e";

  try {
    avatarColorOptions.value = await getAvatarColorOptions();
  } catch (error) {
    avatarError.value = String(error.message || "No s'han pogut carregar els colors d'avatar");
  }
}

async function saveAvatar() {
  avatarError.value = "";

  if (!game.authUserId) {
    avatarError.value = "No hi ha cap sessió activa";
    return;
  }

  loadingAvatar.value = true;
  try {
    const user = await updateAvatar({
      userId: Number(game.authUserId),
      avatarImage: selectedAvatarImage.value || null,
      avatarColor: selectedAvatarColor.value,
    });
    game.setAvatarValue(user.avatarImage || "", user.avatarColor || "#22c55e");
    avatarDialog.value = false;
  } catch (error) {
    avatarError.value = String(error.message || "No s'ha pogut desar l'avatar");
  } finally {
    loadingAvatar.value = false;
  }
}

function logout() {
  disconnectSocket();
  game.clearAuthUser();
  game.resetGame();
  router.push("/");
}
</script>

<template>
  <v-card class="pa-4">
    <v-card-title>EL TEU PERFIL</v-card-title>
    <v-card-text>
      <div class="avatar-preview mb-3" :style="{ backgroundColor: game.avatarColor || '#22c55e' }">
        <img v-if="game.avatarImage" :src="game.avatarImage" alt="avatar" class="avatar-image" />
        <span v-else class="avatar-fallback">{{ getInitialFromNickname() }}</span>
      </div>
      <p>NICKNAME: {{ game.nickname }}</p>
      <p>EMAIL: {{ game.authUserEmail || "PENDENT" }}</p>
    </v-card-text>
    <v-card-actions>
      <v-btn color="grey" block class="mb-2" @click="emit('edit-nickname')">
        MODIFICAR NICKNAME
      </v-btn>
    </v-card-actions>

    <v-card-actions>
      <v-btn color="primary" block class="mb-2" @click="openAvatarDialog">
        PERSONALITZAR AVATAR
      </v-btn>
    </v-card-actions>

    <v-card-actions>
      <v-btn color="error" variant="outlined" block @click="logout">
        TANCAR SESSIÓ
      </v-btn>
    </v-card-actions>

    <v-dialog v-model="avatarDialog" max-width="420">
      <v-card class="pa-4">
        <v-card-title>PERSONALITZA L'AVATAR</v-card-title>

        <v-card-text>
          <v-alert v-if="avatarError" type="error" class="mb-3">
            {{ avatarError }}
          </v-alert>

          <div class="avatar-preview mb-4" :style="{ backgroundColor: selectedAvatarColor }">
            <img v-if="selectedAvatarImage" :src="selectedAvatarImage" alt="avatar" class="avatar-image" />
            <span v-else class="avatar-fallback">{{ getInitialFromNickname() }}</span>
          </div>

          <v-file-input
            accept="image/png,image/jpeg,image/webp,image/gif"
            label="Puja una imatge (opcional, màx 1.5 MB)"
            variant="outlined"
            density="comfortable"
            prepend-icon="mdi-image"
            class="mb-3"
            @change="onAvatarFileChange"
          />

          <v-btn
            v-if="selectedAvatarImage"
            color="warning"
            variant="tonal"
            class="mb-4"
            @click="removeSelectedAvatarImage"
          >
            TREURE IMATGE
          </v-btn>

          <div class="avatar-color-grid">
            <v-btn
              v-for="color in avatarColorOptions"
              :key="color"
              :class="selectedAvatarColor === color ? 'avatar-color-btn selected' : 'avatar-color-btn'"
              :style="{ backgroundColor: color }"
              variant="tonal"
              @click="selectedAvatarColor = color"
            />
          </div>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" :loading="loadingAvatar" @click="saveAvatar">
            DESAR
          </v-btn>
          <v-btn @click="avatarDialog = false">TANCAR</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-card>
</template>

<style scoped>
.avatar-preview {
  width: 88px;
  height: 88px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-fallback {
  color: #fff;
  font-size: 1.8rem;
  font-weight: 700;
}

.avatar-color-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.6rem;
}

.avatar-color-btn {
  min-height: 42px;
  border: 2px solid transparent;
}

.avatar-color-btn.selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px #111827;
}
</style>