<script setup>
//ARXIU QUE MOSTRA EL DIÀLEG PER CREAR SALA PÚBLICA O PRIVADA

//=====================
//IMPORTEM
//=====================
import { ref, computed, watch } from "vue";
import { useGameStore } from "../stores/game";

//=====================
//DECLAREM L'ESTAT DEL COMPONENT
//=====================
const game = useGameStore();

// PROPS: CONTROLATS PER EL PARE (V-MODEL:DIALOG, LOADING, ERROR, ISPRIVATE)
const props = defineProps({
  dialog: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  error: { type: String, default: "" },
  isPrivate: { type: Boolean, default: false }, // NOU: TIPUS DE SALA DECIDIT AL LOBBY
});

const emit = defineEmits(["create", "close", "update:dialog"]);

const maxPlayers = ref(8);
const roomName = ref("");

//QUAN S'OBRE EL DIÀLEG, EL NOM PER DEFECTE ÉS EL NICKNAME DEL GUEST
watch(
  () => props.dialog,
  (isOpen) => {
    if (isOpen) {
      roomName.value = game.nickname;
    }
  },
  { immediate: true }
);

const isMaxPlayersValid = computed(() => {
  return (
    Number.isInteger(maxPlayers.value) &&
    maxPlayers.value >= 2 &&
    maxPlayers.value <= 20
  );
});

const isRoomNameValid = computed(() => {
  const value = roomName.value.trim();
  if (value.length < 3) {
    return false;
  }
  if (value.length > 20) {
    return false;
  }
  return /^[\p{L}\p{N}_ ]+$/u.test(value);
});

const roomNameError = computed(() => {
  if (isRoomNameValid.value) {
    return "";
  }
  if (roomName.value.trim() === "") {
    return "";
  }
  return "ENTRE 3 I 20 CARÀCTERS: LLETRES, NÚMEROS, ESPAIS I _";
});

//=====================
//FUNCIONS
//=====================
function close() {
  emit("update:dialog", false);
  emit("close");
  // RESET LOCAL AL TANCAR
  maxPlayers.value = 8;
  roomName.value = "";
}

function handleCreate() {
  // VALIDACIONS LOCALS (SENSE ERROR STATE PROPI, EL PARE GESTIONA ERROR)
  if (!game.connected) {
    return;
  }

  if (!isMaxPlayersValid.value) {
    return;
  }

  if (!isRoomNameValid.value) {
    return;
  }

  if (!game.nickname || !/^[a-zA-Z0-9_]{3,15}$/.test(game.nickname)) {
    return;
  }

  // EMITEM AL PARE - ÉL GESTIONA LOADING/ERROR/ASYNC
  // ISPRIVATE VE DE LA PROP, NO DEL BOTÓ
  emit("create", {
    maxPlayers: maxPlayers.value,
    isPrivate: props.isPrivate,
    nameRoom: roomName.value.trim(),
  });
}
</script>

<template>
  <v-dialog
    :model-value="dialog"
    @update:model-value="(v) => emit('update:dialog', v)"
    max-width="500"
    persistent
  >
    <v-card class="pa-4">
      <!-- TÍTOL DINÀMIC SEGON ISPRIVATE -->
      <v-card-title>
        {{ isPrivate ? "CREAR NOVA SALA PRIVADA" : "CREAR NOVA SALA PÚBLICA" }}
      </v-card-title>

      <v-card-text>
        <v-text-field
          v-model="roomName"
          label="NOM DE LA SALA"
          maxlength="20"
          :error-messages="roomNameError"
        />

        <v-text-field
          v-model.number="maxPlayers"
          label="MÀXIM DE JUGADORS"
          type="number"
          min="2"
          max="20"
          :error-messages="
            !isMaxPlayersValid && maxPlayers ? 'ENTRE 2 I 20' : ''
          "
        />

        <!-- ERROR DEL PARE (ASYNC) -->
        <v-alert v-if="error" type="error" class="mt-3">
          {{ error }}
        </v-alert>

        <!-- INFO SALA CREADA (MOSTRA DESPRÉS DE CREAR) -->
        <v-alert v-if="game.createdRoom" type="info" class="mt-3">
          <div class="text-h6 mb-2">¡SALA CREADA!</div>
          <p class="mb-1">
            <strong>NOM DE LA SALA:</strong> {{ game.createdRoom.nameRoom }}
          </p>
          <p class="mb-1">
            <strong>ID DE SALA:</strong> {{ game.createdRoom.roomId }}
          </p>
          <p class="mb-1">
            <strong>MÀX. JUGADORS:</strong> {{ game.createdRoom.maxPlayers }}
          </p>
          <p class="mb-1">
            <strong>TIPUS:</strong>
            {{ game.createdRoom.isPrivate ? "PRIVADA" : "PÚBLICA" }}
          </p>
          <p
            v-if="game.createdRoom.isPrivate && game.createdRoom.password"
            class="mb-1"
          >
            <strong>CONTRASENYA:</strong> {{ game.createdRoom.password }}
          </p>
          <p class="text-caption text-grey">
            COMPARTEIX L'ID DE SALA (I LA CONTRASENYA SI ÉS PRIVADA) PERQUÈ
            ALTRES S'UNIXIN.
          </p>
        </v-alert>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="outlined" @click="close" :disabled="loading">
          CANCEL·LAR
        </v-btn>

        <!-- BOTÓ ÚNIC DINÀMIC SEGON ISPRIVATE -->
        <v-btn
          :color="isPrivate ? 'primary' : 'success'"
          @click="handleCreate"
          :disabled="loading || !isMaxPlayersValid || !isRoomNameValid"
          :loading="loading"
        >
          <v-icon start>{{
            isPrivate ? "mdi-lock" : "mdi-account-group"
          }}</v-icon>
          {{ isPrivate ? "CREAR SALA PRIVADA" : "CREAR SALA PÚBLICA" }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
