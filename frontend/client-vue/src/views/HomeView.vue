<script setup>
//PANTALLA PRINCIPAL D'ACCÉS: REGISTRE I INICI DE SESSIÓ

//=====================
//IMPORTEM
//=====================
import { onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useGameStore } from "../stores/game";
import {
  getAvatarColorOptions,
  loginUser,
  registerUser,
  resendVerificationCode,
  verifyEmailCode,
} from "../services/authApi";

//=====================
//ESTAT
//=====================
const router = useRouter();
const game = useGameStore();

const tab = ref("login");
const avatarColors = ref(["#22c55e", "#0ea5e9", "#f97316", "#a855f7"]);

const loginEmail = ref("");
const loginPassword = ref("");
const loginLoading = ref(false);
const loginError = ref("");
const guestLoading = ref(false);

const registerName = ref("");
const registerEmail = ref("");
const registerPassword = ref("");
const registerAvatarColor = ref("#22c55e");
const registerAvatarImage = ref("");
const registerLoading = ref(false);
const registerError = ref("");
const registerInfo = ref("");

const verificationCode = ref("");
const verificationLoading = ref(false);
const verificationError = ref("");
const verificationInfo = ref("");
const pendingVerificationEmail = ref("");

function getInitialFromName() {
  const base = String(registerName.value || "?").trim();
  if (base.length === 0) {
    return "?";
  }

  return base.charAt(0).toUpperCase();
}

function onRegisterAvatarFileChange(event) {
  const file = event?.target?.files?.[0];
  if (!file) {
    return;
  }

  if (file.size > 1_500_000) {
    registerError.value = "La imatge és massa gran (màxim 1.5 MB)";
    return;
  }

  const reader = new FileReader();
  reader.onload = function onLoad() {
    registerAvatarImage.value = String(reader.result || "");
    registerError.value = "";
  };
  reader.readAsDataURL(file);
}

function removeRegisterAvatarImage() {
  registerAvatarImage.value = "";
}

onMounted(async () => {
  try {
    const available = await getAvatarColorOptions();
    if (available.length > 0) {
      avatarColors.value = available;
      if (!available.includes(registerAvatarColor.value)) {
        registerAvatarColor.value = available[0];
      }
    }
  } catch {
    avatarColors.value = ["#22c55e", "#0ea5e9", "#f97316", "#a855f7"];
  }

  const previewMode = router.currentRoute.value.query.preview === "1";

  if (game.authUserId && previewMode === false) {
    router.push("/lobby");
  }
});

async function handleLogin() {
  loginError.value = "";
  loginLoading.value = true;

  try {
    const user = await loginUser({
      email: loginEmail.value,
      password: loginPassword.value,
    });

    game.setAuthUser(user);

    //UN ADMIN VA DIRECTE AL PANELL
    if (user.rol === "admin") {
      router.push("/admin");
      return;
    }

    router.push("/lobby");
  } catch (error) {
    loginError.value = error.message;
  } finally {
    loginLoading.value = false;
  }
}

async function handleRegister() {
  registerError.value = "";
  registerInfo.value = "";
  verificationError.value = "";
  verificationInfo.value = "";
  registerLoading.value = true;

  try {
    const response = await registerUser({
      name: registerName.value,
      email: registerEmail.value,
      password: registerPassword.value,
      avatarImage: registerAvatarImage.value || null,
      avatarColor: registerAvatarColor.value,
    });

    if (response.requiresVerification) {
      pendingVerificationEmail.value = response.email || registerEmail.value.trim().toLowerCase();
      registerInfo.value = response.message || "T'hem enviat un codi de verificació al correu.";
      verificationInfo.value = "Revisa el teu correu i introdueix el codi de 6 dígits.";
      return;
    }

    registerInfo.value = "Compte creat correctament.";
  } catch (error) {
    registerError.value = error.message;
  } finally {
    registerLoading.value = false;
  }
}

async function handleVerifyCode() {
  verificationError.value = "";
  verificationInfo.value = "";
  verificationLoading.value = true;

  try {
    const user = await verifyEmailCode({
      email: pendingVerificationEmail.value,
      code: verificationCode.value,
    });

    game.setAuthUser({
      ...user,
      avatarImage: registerAvatarImage.value,
      avatarColor: registerAvatarColor.value,
    });
    router.push("/lobby");
  } catch (error) {
    verificationError.value = error.message;
  } finally {
    verificationLoading.value = false;
  }
}

async function handleResendCode() {
  verificationError.value = "";
  verificationInfo.value = "";

  try {
    const response = await resendVerificationCode({
      email: pendingVerificationEmail.value,
    });
    verificationInfo.value = response.message || "Hem reenviat el codi de verificació.";
  } catch (error) {
    verificationError.value = error.message;
  }
}

async function handleGuestAccess() {
  loginError.value = "";
  registerError.value = "";
  guestLoading.value = true;

  try {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const guestName = `Convidat${suffix}`;

    game.setAuthUser({
      id: `guest-${Date.now()}-${suffix}`,
      email: "",
      name: guestName,
      avatarImage: "",
      avatarColor: avatarColors.value[0] || "#22c55e",
    });

    router.push("/lobby");
  } finally {
    guestLoading.value = false;
  }
}
</script>

<template>
  <div class="home-background">
    <div class="home-content">
      <div class="image-side">
        <v-card rounded="xl" class="image-card" elevation="10">
          <div class="image-card-media" role="img" aria-label="Imatge portada HowMuch"></div>
        </v-card>
      </div>

      <div class="auth-side">
        <p class="auth-intro">Mesura quant en saps. Juga ara.</p>

        <v-card rounded="xl" class="access-card">
          <div class="auth-switch">
            <v-btn
              :variant="tab === 'login' ? 'flat' : 'tonal'"
              :color="tab === 'login' ? 'deep-purple-accent-2' : 'grey-darken-1'"
              size="large"
              @click="tab = 'login'"
            >
              INICIAR SESSIÓ
            </v-btn>

            <v-btn
              :variant="tab === 'register' ? 'flat' : 'tonal'"
              :color="tab === 'register' ? 'deep-purple-accent-2' : 'grey-darken-1'"
              size="large"
              @click="tab = 'register'"
            >
              CREAR USUARI
            </v-btn>
          </div>

          <v-window v-model="tab">
            <v-window-item value="login">
              <v-card-text class="pa-6">
                <v-text-field
                  v-model="loginEmail"
                  label="Correu electrònic"
                  type="email"
                  variant="outlined"
                  class="mb-2"
                />

                <v-text-field
                  v-model="loginPassword"
                  label="Contrasenya"
                  type="password"
                  variant="outlined"
                  class="mb-4"
                />

                <v-alert v-if="loginError" type="error" class="mb-4">
                  {{ loginError }}
                </v-alert>

                <v-btn
                  color="deep-purple-accent-2"
                  block
                  size="large"
                  :loading="loginLoading"
                  @click="handleLogin"
                >
                  ENTRAR
                </v-btn>

                <v-divider class="my-4" />

                <v-btn
                  color="blue-grey-darken-1"
                  variant="tonal"
                  block
                  size="large"
                  :loading="guestLoading"
                  @click="handleGuestAccess"
                >
                  ENTRAR COM A CONVIDAT
                </v-btn>
              </v-card-text>
            </v-window-item>

            <v-window-item value="register">
              <v-card-text class="pa-6">
                <v-text-field
                  v-model="registerName"
                  label="Nom d'usuari"
                  variant="outlined"
                  class="mb-2"
                />

                <v-text-field
                  v-model="registerEmail"
                  label="Correu electrònic"
                  type="email"
                  variant="outlined"
                  class="mb-2"
                />

                <v-text-field
                  v-model="registerPassword"
                  label="Contrasenya"
                  type="password"
                  variant="outlined"
                  class="mb-3"
                />

                <div
                  class="avatar-preview mb-3"
                  :style="{ backgroundColor: registerAvatarColor }"
                >
                  <img
                    v-if="registerAvatarImage"
                    :src="registerAvatarImage"
                    alt="avatar"
                    class="avatar-image"
                  />
                  <span v-else class="avatar-fallback">{{ getInitialFromName() }}</span>
                </div>

                <v-file-input
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  label="Puja imatge d'avatar (opcional, màx 1.5 MB)"
                  variant="outlined"
                  density="comfortable"
                  prepend-icon="mdi-image"
                  class="mb-2"
                  @change="onRegisterAvatarFileChange"
                />

                <v-btn
                  v-if="registerAvatarImage"
                  color="warning"
                  variant="tonal"
                  class="mb-3"
                  @click="removeRegisterAvatarImage"
                >
                  TREURE IMATGE
                </v-btn>

                <p class="text-subtitle-2 mb-2">Color de fons de l'avatar</p>
                <div class="avatar-color-grid mb-4">
                  <v-btn
                    v-for="color in avatarColors"
                    :key="color"
                    variant="tonal"
                    size="small"
                    :class="registerAvatarColor === color ? 'avatar-color-btn selected' : 'avatar-color-btn'"
                    :style="{ backgroundColor: color }"
                    @click="registerAvatarColor = color"
                  />
                </div>

                <v-alert v-if="registerError" type="error" class="mb-4">
                  {{ registerError }}
                </v-alert>

                <v-btn
                  color="deep-purple-accent-2"
                  block
                  size="large"
                  :loading="registerLoading"
                  @click="handleRegister"
                >
                  CREAR COMPTE
                </v-btn>

                <v-alert v-if="registerInfo" type="success" class="mt-4 mb-2">
                  {{ registerInfo }}
                </v-alert>

                <div v-if="pendingVerificationEmail" class="verification-box mt-3">
                  <p class="text-body-2 mb-2">
                    Verifica el compte de <strong>{{ pendingVerificationEmail }}</strong>
                  </p>

                  <v-text-field
                    v-model="verificationCode"
                    label="Codi de verificació"
                    variant="outlined"
                    density="comfortable"
                    maxlength="6"
                    class="mb-2"
                  />

                  <v-btn
                    color="deep-purple-accent-2"
                    block
                    :loading="verificationLoading"
                    class="mb-2"
                    @click="handleVerifyCode"
                  >
                    VERIFICAR I ENTRAR
                  </v-btn>

                  <v-btn
                    color="grey-darken-1"
                    variant="tonal"
                    block
                    @click="handleResendCode"
                  >
                    REENVIAR CODI
                  </v-btn>

                  <v-alert v-if="verificationError" type="error" class="mt-3">
                    {{ verificationError }}
                  </v-alert>

                  <v-alert v-if="verificationInfo" type="info" class="mt-3">
                    {{ verificationInfo }}
                  </v-alert>
                </div>
              </v-card-text>
            </v-window-item>
          </v-window>
        </v-card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-side :deep(.v-field),
.auth-side :deep(.v-field__input),
.auth-side :deep(.v-label),
.auth-side :deep(.v-field-label),
.auth-side :deep(.v-field__prepend-inner .v-icon),
.auth-side :deep(input) {
  color: #fff !important;
}

.auth-side :deep(input[type="file"]) {
  opacity: 0;
}

.auth-side :deep(input::placeholder) {
  color: rgba(255, 255, 255, 0.7);
}

.access-card,
.access-card :deep(.v-card-text),
.access-card :deep(p),
.access-card :deep(.v-btn--variant-tonal) {
  color: #fff;
}

.access-card :deep(.v-field--variant-outlined .v-field__outline) {
  color: rgba(255, 255, 255, 0.55);
}

.access-card :deep(.v-field--focused .v-field__outline) {
  color: #b388ff;
}

.home-background {
  min-height: 100vh;
  position: relative;
  background: #0f172a;
}

.home-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(5, 10, 25, 0.15) 0%,
    rgba(7, 16, 34, 0.54) 60%,
    rgba(5, 12, 24, 0.84) 100%
  );
}

.home-content {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: stretch;
}

.image-side {
  width: 53%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1.2rem, 2.4vw, 2.2rem);
}

.image-card {
  width: min(100%, clamp(360px, 44vw, 620px));
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(15, 23, 42, 0.55);
  overflow: hidden;
}

.image-card-media {
  width: 100%;
  aspect-ratio: 3 / 4;
  background-image: url("/howmuch-cover.jpg");
  background-size: cover;
  background-position: center;
}

.auth-side {
  width: 47%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.auth-intro {
  color: #e2e8f0;
  font-size: 1.05rem;
  width: min(100%, 640px);
  margin-bottom: 0.9rem;
  text-align: left;
}

.access-card {
  width: min(100%, 640px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(7px);
  background: rgba(30, 20, 60, 0.85);
}

.auth-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
  padding: 1rem 1rem 0;
}

.avatar-preview {
  width: 78px;
  height: 78px;
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
  font-size: 1.4rem;
  font-weight: 700;
}

.avatar-color-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.45rem;
}

.avatar-color-btn {
  min-height: 38px;
  border: 2px solid transparent;
}

.avatar-color-btn.selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px #111827;
}

.verification-box {
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 12px;
  padding: 0.9rem;
  background: rgba(15, 23, 42, 0.35);
}

@media (max-width: 640px) {
  .home-content {
    flex-direction: column;
  }

  .image-side {
    width: 100%;
    min-height: 34vh;
    padding: 1.2rem;
    align-items: center;
    justify-content: center;
  }

  .image-card {
    width: min(100%, 320px);
  }

  .image-card-media {
    aspect-ratio: 4 / 5;
  }

  .auth-side {
    width: 100%;
    min-height: 66vh;
    padding: 1rem;
    align-items: flex-start;
    justify-content: flex-start;
  }

  .home-content {
    min-height: 100vh;
  }

  .auth-switch {
    gap: 0.5rem;
    padding: 0.8rem 0.8rem 0;
  }

  .auth-intro {
    font-size: 0.95rem;
    margin-bottom: 0.7rem;
  }

  .avatar-color-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (min-width: 641px) and (max-width: 1040px) {
  .image-side {
    width: 50%;
  }

  .auth-side {
    width: 50%;
  }

  .image-card {
    width: min(100%, 430px);
  }
}
</style>
