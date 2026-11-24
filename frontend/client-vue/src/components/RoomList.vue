
<script setup>
//ARXIU QUE MOSTRA EL LLISTAT DE SALES DISPONIBLES

//=====================
//IMPORTEM
//=====================
import { ref, computed } from "vue";

//=====================
//PROPIETATS DEL COMPONENT
//=====================
const props = defineProps({
  rooms: {
    type: Array,
    required: true,
  },
  joiningRoomId: {
    type: String,
    default: null,
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  categories: {
    type: Array,
    default: () => [],
  },
});

//=====================
//ESDEVENIMENTS DEL COMPONENT
//=====================
const emit = defineEmits(["join"]);

//=====================
//FILTRES DE SALES
//=====================
const searchName = ref("");
const selectedCategory = ref("Totes");

const appliedName = ref("");
const appliedCategory = ref("Totes");

const categories = computed(() => [
  "Totes",
  ...new Set([...props.categories, "Mix"]),
]);

const filteredRooms = computed(() => {
  return props.rooms.filter((room) => {
    const matchesName = room.name
      .toLowerCase()
      .includes(appliedName.value.toLowerCase());

    const matchesCategory =
      appliedCategory.value === "Totes" ||
      room.category === appliedCategory.value;

    return matchesName && matchesCategory;
  });
});

//=====================
//APLICAR FILTRES
//=====================
function applyFilters() {
  appliedName.value = searchName.value;
  appliedCategory.value = selectedCategory.value;
}

//=====================
//ESTAT I AFORAMENT DE LA SALA
//=====================
function isRoomFull(room) {
  return Number(room.players) >= Number(room.maxPlayers);
}

function stateLabel(room) {
  if (room.state === "lobby") {
    return "ESPERANT";
  }

  if (room.state === "playing") {
    return "EN JOC";
  }

  if (room.state === "finished") {
    return "FINALITZADA";
  }

  return "";
}

function stateColor(room) {
  if (room.state === "playing") {
    return "warning";
  }

  if (room.state === "finished") {
    return "error";
  }

  return "info";
}

function joinDisabled(room) {
  if (props.disabled) {
    return true;
  }

  return isRoomFull(room);
}
</script>

<template>
  <v-card class="pa-4">
    <v-card-title>SALES DISPONIBLES</v-card-title>

    <v-card-text>
      <v-row align="center">
        <v-col cols="12" sm="5">
          <v-text-field
            v-model="searchName"
            label="BUSCAR SALA"
            placeholder="NOMBRE DE LA SALA"
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
            clearable
            hide-details
          />
        </v-col>

        <v-col cols="12" sm="5">
          <v-select
            v-model="selectedCategory"
            :items="categories"
            label="FILTRAR POR CATEGORIA"
            variant="outlined"
            hide-details
          />
        </v-col>

        <v-col cols="12" sm="2">
          <v-btn
            color="grey"
            block
            @click="applyFilters"
          >
            APLICAR
          </v-btn>
        </v-col>
      </v-row>

      <v-divider class="my-4" />

      <v-row
        v-for="room in filteredRooms"
        :key="room.id"
        align="center"
        class="mb-2"
      >
        <v-col cols="12" sm="8">
          <p class="text-h6 mb-0">{{ room.name }}</p>
          <p class="text-body-2 mb-0">
            JUGADORS EN SALA: {{ room.players }}/{{ room.maxPlayers }}
          </p>
          <p class="text-body-2 mb-0">
            CATEGORIA: {{ room.category }}
          </p>

          <v-chip
            size="small"
            class="mt-2"
            :color="stateColor(room)"
          >
            {{ stateLabel(room) }}
          </v-chip>
        </v-col>

        <v-col cols="12" sm="4">
          <v-btn
            color="grey"
            block
            :disabled="joinDisabled(room)"
            :loading="props.joiningRoomId === room.id"
            @click="emit('join', room)"
          >
            <span v-if="isRoomFull(room)">PLENA</span>
            <span v-else-if="room.state === 'lobby'">ENTRAR A SALA</span>
            <span v-else>ENTRAR COM A ESPECTADOR</span>
          </v-btn>
        </v-col>
      </v-row>

      <v-alert
        v-if="filteredRooms.length === 0"
        type="info"
        variant="tonal"
        class="mt-2"
      >
        NO S'HAN TROBAT SALES AMB AQUESTS FILTRES.
      </v-alert>
    </v-card-text>
  </v-card>
</template>
