<script setup>
//AVATAR D'UN JUGADOR: IMATGE DE L'USUARI REGISTRAT O INICIAL SOBRE EL SEU COLOR
import { computed, ref, watch } from "vue";

const AUTH_BASE_URL =
  import.meta.env.VITE_AUTH_BASE_URL ||
  (import.meta.env.DEV ? "http://localhost:3011" : "/auth-api");

const props = defineProps({
  nickname: { type: String, default: "?" },
  userId: { type: Number, default: null },
  color: { type: String, default: null },
  size: { type: Number, default: 32 },
});

const imageFailed = ref(false);
watch(() => props.userId, () => (imageFailed.value = false));

const imageUrl = computed(() =>
  props.userId && !imageFailed.value ? `${AUTH_BASE_URL}/avatar/${props.userId}` : ""
);
const initial = computed(() => (String(props.nickname || "?").trim().charAt(0) || "?").toUpperCase());
</script>

<template>
  <span
    class="player-avatar"
    :style="{
      width: size + 'px',
      height: size + 'px',
      fontSize: size * 0.45 + 'px',
      backgroundColor: color || '#7c4dff',
    }"
  >
    <img v-if="imageUrl" :src="imageUrl" alt="" @error="imageFailed = true" />
    <template v-else>{{ initial }}</template>
  </span>
</template>

<style scoped>
.player-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  overflow: hidden;
  color: #fff;
  font-weight: 700;
}

.player-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
