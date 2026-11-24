//ARXIU QUE GESTIONA UN CONTADOR D'EXEMPLE (PINIA STORE)

//=====================
//IMPORTEM
//=====================
import { ref, computed } from 'vue';
import { defineStore } from 'pinia';

//=====================
//DECLAREM EL STORE
//=====================
export const useCounterStore = defineStore('counter', () => {
  //=====================
  //ESTAT
  //=====================
  const count = ref(0);

  //=====================
  //GETTERS
  //=====================
  const doubleCount = computed(() => count.value * 2);

  //=====================
  //ACCIONS
  //=====================
  function increment() {
    count.value++;
  }

  //=====================
  //RETORNEM L'ESTAT I FUNCIONS
  //=====================
  return { count, doubleCount, increment };
});