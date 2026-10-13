<script setup>
defineProps({ name: String, size: { type: Number, default: 18 } });
const paths = {
  upload: "M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5",
  download: "M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5",
  folder: "M3 7h7l2 2h9v11H3ZM3 7V4h7l2 3",
  save: "M5 3h12l4 4v14H3V3ZM7 3v6h10V3M7 21v-8h10v8",
  pen: "m15 4 5 5M4 15 16 3l5 5L9 20l-6 1Z",
  eraser: "m14 3 7 7-11 11H6l-4-4ZM8 11l7 7M10 21h11",
  picker: "m14 3 7 7M17 6l-3 3m-2-2 5 5L7 22H2v-5Z",
  undo: "M8 4 3 9l5 5M3 9h10a7 7 0 0 1 0 14",
  redo: "m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14",
  image: "M3 3h18v18H3ZM3 17l6-6 5 5 3-3 4 4M15 7h.01",
  check: "m5 12 4 4L19 6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  grid: "M3 3h18v18H3ZM3 9h18M3 15h18M9 3v18M15 3v18",
};
</script>
<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.grid" />
  </svg>
</template>
