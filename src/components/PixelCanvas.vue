<script setup>
import { ref, watch, onMounted, onBeforeUnmount } from "vue";
import { drawPreview } from "../core/render.js";

const props = defineProps({
  pattern: Object,
  palette: Object,
  cell: Number,
  labels: Boolean,
  grid: Boolean,
  tool: String,
  disabled: Boolean,
});
const emit = defineEmits(["start", "move", "end", "hover"]);
const canvas = ref(null);
let active = false;
let frame = 0;
function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (canvas.value && props.pattern)
      drawPreview(canvas.value, props.pattern, props.palette, {
        cell: props.cell,
        labels: props.labels,
        grid: props.grid,
      });
  });
}
watch(
  () => [props.pattern, props.palette, props.cell, props.labels, props.grid],
  render,
);
onMounted(render);
onBeforeUnmount(() => cancelAnimationFrame(frame));
function point(event) {
  const rect = canvas.value.getBoundingClientRect();
  return [
    Math.floor(
      ((event.clientX - rect.left) / rect.width) * props.pattern.width,
    ),
    Math.floor(
      ((event.clientY - rect.top) / rect.height) * props.pattern.height,
    ),
  ];
}
function inside(p) {
  return (
    p[0] >= 0 &&
    p[1] >= 0 &&
    p[0] < props.pattern.width &&
    p[1] < props.pattern.height
  );
}
function start(event) {
  if (props.disabled || active || event.button !== 0) return;
  const p = point(event);
  if (!inside(p)) return;
  active = true;
  canvas.value.setPointerCapture(event.pointerId);
  emit("start", p);
}
function move(event) {
  const p = point(event);
  emit("hover", inside(p) ? p : null);
  if (active && inside(p)) emit("move", p);
}
function end() {
  if (active) {
    active = false;
    emit("end");
  }
}
</script>

<template>
  <canvas
    ref="canvas"
    class="pixel-canvas"
    :class="{ picking: tool === 'picker' }"
    :aria-label="`${pattern.width} 列 ${pattern.height} 行的拼豆编辑画布`"
    @pointerdown.prevent="start"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @lostpointercapture="end"
    @pointerleave="emit('hover', null)"
    @contextmenu.prevent
  />
</template>
