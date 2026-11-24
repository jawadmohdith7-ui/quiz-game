
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, nextTick } from "vue";
import { useGameStore } from "../stores/game";
import { useRouter } from "vue-router";
import {
  leaveRoom,
  joinRoom,
  initSocket,
  sendChatMessage,
  kickPlayer,
  selectObservedPlayer,
} from "../services/websocket";
import PlayerAvatar from "../components/PlayerAvatar.vue";
import PlayerRoomView from "./PlayerRoomView.vue";
import ObserverRoomView from "./ObserverRoomView.vue";

const game = useGameStore();
const router = useRouter();

const error = ref("");
const chatInput = ref("");
const kickTarget = ref(null);
const kickedMessage = ref("");
const kickedDialogOpen = ref(false);

watch(
  () => game.kickedNotice,
  (notice) => {
    if (!notice) {
      return;
    }
    kickedMessage.value = notice;
    kickedDialogOpen.value = true;
    game.clearKickedNotice();
  }
);

function confirmKick(player) {
  kickTarget.value = player;
}

function cancelKick() {
  kickTarget.value = null;
}

function executeKick() {
  if (kickTarget.value) {
    kickPlayer(kickTarget.value.id);
  }
  kickTarget.value = null;
}

function closeKickedDialog() {
  kickedDialogOpen.value = false;
  router.push("/lobby");
}

const chatMessagesEl = ref(null);
let forceScroll = false;

// scrollHeight: total content; scrollTop: how far you scrolled; clientHeight: visible box.
function isNearBottom(el, threshold = 40) {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
}

function scrollChatToBottom() {
  if (chatMessagesEl.value) {
    chatMessagesEl.value.scrollTop = chatMessagesEl.value.scrollHeight;
  }
}

watch(
  () => game.chatMessages,
  async () => {
    // Pre-flush: element still shows the old DOM, so this is the user's real position.
    const shouldScroll = forceScroll || !chatMessagesEl.value || isNearBottom(chatMessagesEl.value);
    forceScroll = false;
    await nextTick();
    if (shouldScroll) {
      scrollChatToBottom();
    }
  },
  { deep: true }
);

const visibleError = computed(() => {
  if (error.value) {
    return error.value;
  }

  return game.errorMessage;
});

let rejoinTried = false;

async function rejoinAfterRefresh() {
  if (rejoinTried || !game.roomId || game.players.length > 0 || !game.connected) {
    return;
  }
  rejoinTried = true;

  try {
    await joinRoom(game.roomId, game.nickname);
  } catch {
    game.resetRoom();
    router.push("/lobby");
  }
}

onMounted(() => {
  if (!game.roomId) {
    router.push("/lobby");
    return;
  }

  initSocket();
  rejoinAfterRefresh();
  nextTick(scrollChatToBottom);
});

watch(
  () => game.connected,
  (isConnected) => {
    if (isConnected) {
      rejoinAfterRefresh();
    }
  }
);

function handleError(message) {
  error.value = message;
}

async function copyRoomPassword() {
  try {
    await navigator.clipboard.writeText(game.roomPassword);
  } catch (err) {
    error.value = "NO S'HA POGUT COPIAR EL CODI.";
  }
}

async function handleLeaveRoom() {
  error.value = "";

  try {
    await leaveRoom(game.roomId);
    game.resetGame();
    router.push("/lobby");
  } catch (reason) {
    error.value = reason;
  }
}

//SI SORTIM DE LA VISTA (BOTÓ ENRERE INCLÒS) SENSE PREMIAR "SORTIR", TANQUEM LA SALA IGUALMENT
function surtEnDesmuntar() {
  if (game.roomId) {
    leaveRoom(game.roomId).catch(function ignoraError() {});
    game.resetGame();
  }
}

onBeforeUnmount(surtEnDesmuntar);

function sendChat() {
  const text = chatInput.value.trim();

  if (text === "") {
    return;
  }

  sendChatMessage(text);
  chatInput.value = "";
  forceScroll = true; // own message always scrolls, even if reading old ones
}

//=====================
//OBSERVAR UN JUGADOR DES DEL LLISTAT
//=====================
async function handleObserveClick(player) {
  if (game.isObserver !== true) {
    return;
  }

  game.clearError();

  if (player.role !== "player") {
    game.setError("Només pots observar jugadors.");
    return;
  }

  try {
    await selectObservedPlayer(player.id);
  } catch (reason) {
    game.setError(String(reason || "No s'ha pogut seleccionar el jugador."));
  }
}
</script>

<template>
  <div class="room-layout">
    <aside class="players-sidebar">
      <v-card class="pa-3" elevation="0">
        <v-card-title class="text-wrap">
          {{ game.roomName }}
        </v-card-title>

        <v-card-text>
          <v-btn
            v-if="game.isPrivateRoom && game.roomPassword"
            block
            variant="outlined"
            class="mb-3"
            @click="copyRoomPassword"
          >
            {{ game.roomPassword }}
          </v-btn>

          <div class="d-flex justify-space-between align-center mb-3">
            <strong>JUGADORES</strong>
            <v-chip size="small">
              {{ game.players.length }}
            </v-chip>
          </div>

          <v-divider class="mb-2" />

          <v-list density="compact">
            <v-list-item
              v-for="player in game.players"
              :key="player.id"
              class="px-1"
              :active="game.isObserver && player.id === game.observedPlayerId"
              :style="game.isObserver ? { cursor: 'pointer' } : {}"
              @click="handleObserveClick(player)"
            >
              <template #prepend>
                <PlayerAvatar
                  :nickname="player.nickname"
                  :user-id="player.userId"
                  :color="player.avatarColor"
                  class="mr-3"
                />
              </template>
              <template #append>
                <v-btn
                  v-if="game.isHost && player.id !== game.guestId"
                  icon="mdi-account-remove"
                  size="small"
                  variant="text"
                  color="error"
                  title="Expulsar jugador"
                  @click="confirmKick(player)"
                />
              </template>
              <v-list-item-title>
                {{ player.nickname }}
              </v-list-item-title>

              <v-list-item-subtitle>
                <span v-if="player.id === game.hostId">KING</span>
                <span v-if="player.id === game.guestId"> · TÚ</span>
                <span v-if="player.role === 'observer'"> · OBSERVADOR</span>
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>

          <v-divider class="my-2" />

          <p class="text-center">
            {{ game.readyCount }}/{{ game.readyRequired }} A PUNT
          </p>
        </v-card-text>
      </v-card>
    </aside>

    <main class="room-main">
      <v-row align="center" justify="space-between">
        <h1>HowMuch</h1>

        <v-btn color="grey" variant="outlined" @click="handleLeaveRoom">
          SORTIR DE LA SALA
        </v-btn>
      </v-row>

      <v-divider class="my-5" />

      <v-alert v-if="visibleError" type="error" class="mb-4">
        {{ visibleError }}
      </v-alert>

      <v-card v-if="game.players.length === 0" class="pa-4">
        CARREGANT LA SALA...
      </v-card>

      <PlayerRoomView
        v-else-if="!game.isObserver"
        @error="handleError"
        @leave="handleLeaveRoom"
      />
      <ObserverRoomView v-else />
    </main>

    <aside class="chat-sidebar">
      <div class="chat-header">
        <h3>CHAT DE LA SALA</h3>
      </div>

      <div ref="chatMessagesEl" class="chat-messages">
        <div
          v-for="message in game.chatMessages"
          :key="message.id"
          class="chat-message"
          :class="{ 'system-message': message.system || message.senderName === 'SISTEMA' }"
        >
          <div class="chat-message-header">
            <PlayerAvatar
              v-if="!message.system"
              :nickname="message.senderName"
              :user-id="message.senderUserId"
              :color="message.senderAvatarColor"
              :size="28"
            />
            <strong>{{ message.senderName }}</strong>
            <span>{{ new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }}</span>
          </div>

          <p>{{ message.text }}</p>
        </div>

        <div v-if="game.chatMessages.length === 0" class="chat-empty">
          No hi ha missatges encara.
        </div>
      </div>

      <form class="chat-input" @submit.prevent="sendChat">
        <v-text-field
          v-model="chatInput"
          placeholder="Escriu un missatge..."
          variant="outlined"
          density="compact"
          hide-details
        />

        <v-btn
          type="submit"
          color="primary"
          icon="mdi-send"
          :disabled="!chatInput.trim()"
        />
      </form>
    </aside>

    <v-dialog :model-value="kickTarget !== null" max-width="420" @update:model-value="(open) => !open && cancelKick()">
      <v-card>
        <v-card-title>Expulsar jugador</v-card-title>
        <v-card-text>
          Vols expulsar a <strong>{{ kickTarget?.nickname }}</strong> de la sala?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="cancelKick">Cancel·lar</v-btn>
          <v-btn color="error" variant="flat" @click="executeKick">Expulsar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog :model-value="kickedDialogOpen" max-width="420" persistent>
      <v-card>
        <v-card-title>Has estat expulsat</v-card-title>
        <v-card-text>{{ kickedMessage }}</v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="primary" variant="flat" @click="closeKickedDialog">Acceptar</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style>
  .chat-message-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .chat-message-header span {
    margin-left: auto;
  }

  .room-layout {
    min-height: 100vh;
  }

  .players-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    width: 240px;
    height: 100vh;
    overflow-y: auto;
    padding: 16px;
    background: white;
    border-right: 1px solid #e0e0e0;
    z-index: 10;
  }

  .room-main {
    margin-left: 240px;
    margin-right: 320px;
    width: calc(100% - 560px);
    min-width: 0;
    min-height: 100vh;
    padding: 24px 32px;
    box-sizing: border-box;
  }

  .chat-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    display: flex;
    flex-direction: column;
    z-index: 10;
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .chat-input {
    display: flex;
    align-items: center;
    gap: 8px;
  }
</style>
