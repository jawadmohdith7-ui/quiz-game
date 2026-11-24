<!--ARXIU QUE PINTA UN GRAFIC DE LINIES AMB EL PERIODE ACTUAL I L'ANTERIOR-->
<script setup>
//=====================
//IMPORTEM
//=====================
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Legend,
} from "chart.js";

//=====================
//REGISTREM NOMES EL QUE FEM SERVIR
//=====================
Chart.register(LineController);
Chart.register(LineElement);
Chart.register(PointElement);
Chart.register(LinearScale);
Chart.register(CategoryScale);
Chart.register(Tooltip);
Chart.register(Legend);

//=====================
//PROPS
//=====================
const props = defineProps({
  titol: {
    type: String,
    required: true,
  },
  etiquetaActual: {
    type: String,
    default: "",
  },
  etiquetaAnterior: {
    type: String,
    default: "",
  },
  actual: {
    type: Array,
    default: function arrayBuit() {
      return [];
    },
  },
  anterior: {
    type: Array,
    default: function arrayBuit() {
      return [];
    },
  },
});

//=====================
//ESTAT
//=====================
const canvas = ref(null);
let grafic = null;

//=====================
//AJUDANTS
//=====================
//24 PUNTS SON HORES; 7 O 30 PUNTS SON DIES
function creaEtiquetes(punts) {
  const etiquetes = [];
  let index = 0;

  while (index < punts) {
    if (punts === 24) {
      etiquetes.push((index + 1) + "h");
    } else {
      etiquetes.push("D" + (index + 1));
    }

    index = index + 1;
  }

  return etiquetes;
}

//LA PRIMERA SERIE ES LA DEL PERIODE ACTUAL (SOLIDA) I LA SEGONA LA DE COMPARACIO (DISCONTINUA)
function creaConjunts() {
  const conjunts = [];

  conjunts.push({
    label: props.etiquetaActual,
    data: props.actual,
    borderColor: "#1867C0",
    backgroundColor: "#1867C0",
    borderWidth: 2,
    borderDash: [],
    pointRadius: 2,
    tension: 0.3,
  });

  conjunts.push({
    label: props.etiquetaAnterior,
    data: props.anterior,
    borderColor: "#9E9E9E",
    backgroundColor: "#9E9E9E",
    borderWidth: 2,
    borderDash: [6, 4],
    pointRadius: 2,
    tension: 0.3,
  });

  return conjunts;
}

//=====================
//GRAFIC
//=====================
function construeix() {
  const element = canvas.value;

  if (element === null) {
    return;
  }

  if (grafic !== null) {
    grafic.destroy();
    grafic = null;
  }

  const dades = {
    labels: creaEtiquetes(props.actual.length),
    datasets: creaConjunts(),
  };

  const opcions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        position: "bottom",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0,
        },
      },
    },
  };

  grafic = new Chart(element, {
    type: "line",
    data: dades,
    options: opcions,
  });
}

//=====================
//CICLE DE VIDA
//=====================
onMounted(construeix);

watch(
  [function llegeixActual() { return props.actual; }, function llegeixAnterior() { return props.anterior; }],
  function actualitza() {
    construeix();
  }
);

onBeforeUnmount(function destrueix() {
  if (grafic !== null) {
    grafic.destroy();
    grafic = null;
  }
});
</script>

<template>
  <div>
    <div class="text-subtitle-2 mb-2">{{ props.titol }}</div>
    <div class="grafic-contenidor">
      <canvas ref="canvas"></canvas>
    </div>
  </div>
</template>

<style scoped>
.grafic-contenidor {
  height: 260px;
}
</style>
