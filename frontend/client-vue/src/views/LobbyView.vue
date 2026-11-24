
<script setup>
//ARXIU QUE GESTIONA LA PÀGINA DEL LOBBY

//=====================
//IMPORTEM
//=====================
import { ref, onMounted } from "vue";
import { useGameStore } from "../stores/game";
import { useRouter } from "vue-router";
import {
  initSocket,
  updateNickname,
  joinRoom,
  createRoom,
  requestRoomsList,
  requestCatalogOptions,
} from "../services/websocket";
import PlayerProfile from "../components/PlayerProfile.vue";
import RoomList from "../components/RoomList.vue";
import CreateRoomDialog from "../components/CreateRoomDialog.vue";

//=====================
//DECLAREM L'ESTAT DE LA PÀGINA
//=====================
const router = useRouter();
const game = useGameStore();

const dialog = ref(false);
const nicknameInput = ref("");
const error = ref("");
const joiningRoomId = ref(null);
const showCreateDialog = ref(false);
const isPrivate = ref(false);
const privateCode = ref("");
const joiningPrivate = ref(false);
const privateError = ref("");

const creating = ref(false);
const createError = ref("");

//=====================
//CICLE DE VIDA
//=====================
onMounted(() => {
  if (!game.authUserId) {
    router.push("/");
    return;
  }

  initSocket();
  requestRoomsList();
  requestCatalogOptions();
  nicknameInput.value = game.nickname;
});

//=====================
//GESTIÓ DEL NICKNAME
//=====================
function openDialog() {
  // NETEGEM L'ERROR ANTERIOR PER NO MOSTRAR MISSATGES VELLS
  error.value = "";
  nicknameInput.value = game.nickname;
  dialog.value = true;
}

function isNicknameValid() {
  return /^[a-zA-Z0-9\_]{3,15}$/.test(game.nickname);
}

async function saveNickname() {
  error.value = "";

  if (!nicknameInput.value.trim()) {
    error.value = "INTRODUEIX UN NICKNAME.";
    return;
  }

  if (game.connected) {
    try {
      await updateNickname(nicknameInput.value.trim());
      dialog.value = false;
    } catch (err) {
      error.value = err;
    }
  } else {
    game.changeNickname(nicknameInput.value);
    dialog.value = false;
  }
}

//=====================
//GESTIÓ DE L'ENTRADA A LA SALA (SALES EXISTENTS)
//=====================
async function handleJoinRoom(room) {
  error.value = "";

  if (!game.connected) {
    error.value = "NO ESTÀS CONNECTAT AL SERVIDOR.";
    return;
  }

  if (!isNicknameValid()) {
    // OBRI-M OBRINT EL DIÀLEG PERQUÈ EL MISSATGE NO SIGUI NETJAT PEL RESET
    openDialog();
    error.value =
      "EL NICKNAME HA DE TENIR ENTRE 3 I 15 CARÀCTERS I NOMÉS LLETRES I NÚMEROS.";
    return;
  }

  joiningRoomId.value = room.id;

  try {
    await joinRoom(room.id, game.nickname);
    router.push("/room");
  } catch (reason) {
    error.value = reason;
  } finally {
    joiningRoomId.value = null;
  }
}

async function handleJoinPrivateRoom() {
  privateError.value = "";

  if (!game.connected) {
    privateError.value = "NO ESTÀS CONNECTAT AL SERVIDOR.";
    return;
  }

  if (!isNicknameValid()) {
    privateError.value = "INTRODUEIX UN ÀLIES VÀLID.";
    openDialog();
    return;
  }

  if (!/^\d{6}$/.test(privateCode.value)) {
    privateError.value = "EL CODI HA DE TENIR 6 DÍGITS.";
    return;
  }

  joiningPrivate.value = true;

  try {
    await joinRoom(null, game.nickname, privateCode.value);
    router.push("/room");
  } catch (reason) {
    privateError.value = reason;
  } finally {
    joiningPrivate.value = false;
  }
}

//=====================
//GESTIÓ DE LA CREACIÓ DE SALA (NOVA: AUTO-JOIN VIA CREATEROOM RESPONSE)
//=====================
async function handleCreateRoom({ maxPlayers, nameRoom }) {
  createError.value = "";
  creating.value = true;

  if (!game.connected) {
    createError.value = "NO ESTÀS CONNECTAT AL SERVIDOR.";
    creating.value = false;
    return;
  }

  if (!game.nickname || !/^[a-zA-Z0-9\_]{3,15}$/.test(game.nickname)) {
    createError.value =
      "EL NICKNAME HA DE TENIR ENTRE 3 I 15 CARÀCTERS I NOMÉS LLETRES I NÚMEROS.";
    creating.value = false;
    return;
  }

  try {
    // CREATEROOM JA AFEGIX EL CREADOR A LA SALA AL BACKEND
    // NO CAL CRIDAR JOINROOM DESPRÉS (CAUSAVA ERROR "JUGADOR JA A LA SALA")
    const data = await createRoom(
      game.nickname,
      maxPlayers,
      isPrivate.value,
      nameRoom
    );

    // GARDEM INFO SALA CREADA PER MOSTRAR AL DIÀLEG (CREATEDROOM AL STORE)
    game.setCreatedRoom(data);

    // AUTO-JOIN: UTILITZEM DADES DE CREATEROOM RESPONSE DIRECTAMENT
    // NETEJEM CREATEDROOM I TANQUEM DIÀLEG
    game.clearCreatedRoom();
    showCreateDialog.value = false;

    // NAVEGUEM A SALA
    router.push("/room");
  } catch (reason) {
    createError.value = reason;
    // DIÀLEG ROMÀ OBERT PER MOSTRAR ERROR
  } finally {
    creating.value = false;
  }
}
</script>

<template>
  <v-container class="mt-6" max-width="1000">
    <v-row align="center" justify="space-between">
      <h1>HowMuch</h1>
      <div class="d-flex ga-2">
        <v-btn color="indigo" variant="tonal" @click="router.push('/stats')">
          <v-icon start>mdi-chart-bar</v-icon>
          ESTADÍSTIQUES
        </v-btn>
        <v-btn color="grey" @click="openDialog">
          <v-icon start>mdi-account</v-icon>
          {{ game.nickname || "EL MEU PERFIL" }}
        </v-btn>
      </div>
    </v-row>

    <v-divider class="my-5" />


    <h2 class="mb-4">PREPARAR PARTIDA</h2>

    <!-- DOS BOTONS AL LOBBY (UN PER TIPUS) -> PASSEN ISPRIVATE AL MODAL -->
    <v-row class="mb-3">
      <v-col cols="12" sm="6">
        <v-btn
          color="success"
          block
          @click="
            isPrivate = false;
            createError = '';
            showCreateDialog = true;
          "
        >
          <v-icon start>mdi-account-group</v-icon>
          CREAR SALA PÚBLICA
        </v-btn>
      </v-col>
      <v-col cols="12" sm="6">
        <v-btn
          color="primary"
          block
          @click="
            isPrivate = true;
            createError = '';
            showCreateDialog = true;
          "
        >
          <v-icon start>mdi-lock</v-icon>
          CREAR SALA PRIVADA
        </v-btn>
      </v-col>
    </v-row>

    <v-card class="pa-4 mb-5">
      <v-card-title>
        UNIR-SE A UNA SALA PRIVADA
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="privateCode"
          label="CONTRASENYA DE LA SALA"
          maxlength="6"
          type="text"
          inputmode="numeric"
        />

        <v-alert v-if="privateError" type="error" class="mb-3">
          {{ privateError }}
        </v-alert>

        <v-btn
          color="primary"
          block
          :loading="joiningPrivate"
          :disabled="!game.connected"
          @click="handleJoinPrivateRoom"
        >
          UNIR-SE
        </v-btn>
      </v-card-text>
    </v-card>

    <v-row>
      <v-col cols="12" md="7">
        <v-alert
          v-if="game.catalogError"
          type="error"
          variant="tonal"
          class="mb-3"
        >
          {{ game.catalogError }}
        </v-alert>
        <RoomList
          :rooms="game.rooms"
          :categories="game.categories"
          :joining-room-id="joiningRoomId"
          :disabled="!game.connected"
          @join="handleJoinRoom"
        />
      </v-col>

      <v-col cols="12" md="5">
        <PlayerProfile @edit-nickname="openDialog" />
      </v-col>
    </v-row>

    <!-- MODAL REP ISPRIVATE COM A PROP -->
    <CreateRoomDialog
      v-model:dialog="showCreateDialog"
      :loading="creating"
      :error="createError"
      :is-private="isPrivate"
      @create="handleCreateRoom"
      @close="showCreateDialog = false"
    />

    <v-dialog v-model="dialog" max-width="400">
      <v-card class="pa-3">
        <v-card-title>MODIFICAR NICKNAME</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="nicknameInput"
            label="NOU NICKNAME"
            maxlength="18"
          />

          <!-- ERROR DEL CANVI DE NICKNAME (EX: NICKNAME JA EXISTEIX) -->
          <v-alert v-if="error" type="error" class="mt-3">
            {{ error }}
          </v-alert>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="dialog = false">CANCEL·LAR</v-btn>
          <v-btn color="grey" @click="saveNickname">GUARDAR</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
