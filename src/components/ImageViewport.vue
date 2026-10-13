<script setup>
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
const props = defineProps({
  width: Number,
  height: Number,
  disabled: Boolean,
  modelValue: { type: Number, default: 1 },
});
const emit = defineEmits(["update:modelValue"]);
const stage = ref(null),
  fit = ref(1),
  space = ref(false),
  dragging = ref(false);
const offset = ref({ x: 0, y: 0 });
let observer,
  pointer = null;
const editing = ref(false);
const style = computed(() => ({
  width: `${props.width}px`,
  height: `${props.height}px`,
  transform: `translate(-50%, -50%) translate(${offset.value.x}px, ${offset.value.y}px) scale(${fit.value * props.modelValue})`,
}));
function editable(target) {
  return target?.closest('input,textarea,select,[contenteditable="true"]');
}
function keydown(event) {
  if (event.code === "Space" && !editable(event.target)) {
    event.preventDefault();
    space.value = true;
  }
}
function keyup(event) {
  if (event.code === "Space") {
    event.preventDefault();
    space.value = false;
  }
}
function resetKeys() {
  space.value = false;
  dragging.value = false;
  pointer = null;
  editing.value = false;
}
function wheel(event) {
  if (!event.ctrlKey) return;
  event.preventDefault();
  event.stopPropagation();
  if (props.disabled || editing.value || dragging.value) return;
  const delta =
    event.deltaY *
    (event.deltaMode === 1
      ? 16
      : event.deltaMode === 2
        ? stage.value.clientHeight
        : 1);
  const next = Math.max(
    0.25,
    Math.min(
      8,
      props.modelValue *
        Math.exp(-Math.max(-240, Math.min(240, delta)) * 0.002),
    ),
  );
  const rect = stage.value.getBoundingClientRect();
  const x = event.clientX - rect.left - rect.width / 2,
    y = event.clientY - rect.top - rect.height / 2;
  const ratio = next / props.modelValue;
  offset.value = {
    x: x - (x - offset.value.x) * ratio,
    y: y - (y - offset.value.y) * ratio,
  };
  emit("update:modelValue", next);
}
function down(event) {
  if (event.button !== 0) return;
  if (!space.value) {
    editing.value = true;
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  if (props.disabled) return;
  pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    offset: { ...offset.value },
  };
  dragging.value = true;
  stage.value.setPointerCapture(event.pointerId);
}
function move(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  event.preventDefault();
  event.stopPropagation();
  offset.value = {
    x: pointer.offset.x + event.clientX - pointer.x,
    y: pointer.offset.y + event.clientY - pointer.y,
  };
}
function end(event) {
  editing.value = false;
  if (pointer?.id !== event.pointerId) return;
  const id = pointer.id;
  pointer = null;
  dragging.value = false;
  if (stage.value?.hasPointerCapture(id)) stage.value.releasePointerCapture(id);
}
function reset() {
  offset.value = { x: 0, y: 0 };
  emit("update:modelValue", 1);
}
onMounted(() => {
  observer = new ResizeObserver(() => {
    fit.value = Math.min(
      1,
      Math.max(1, stage.value.clientWidth - 28) / props.width,
      Math.max(1, stage.value.clientHeight - 28) / props.height,
    );
  });
  observer.observe(stage.value);
  stage.value.addEventListener("wheel", wheel, { passive: false });
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("blur", resetKeys);
  window.addEventListener("pointerup", end);
  window.addEventListener("pointercancel", end);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  stage.value?.removeEventListener("wheel", wheel);
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("keyup", keyup);
  window.removeEventListener("blur", resetKeys);
  window.removeEventListener("pointerup", end);
  window.removeEventListener("pointercancel", end);
});
</script>
<template>
  <div class="viewport-toolbar">
    <span>Ctrl＋滚轮缩放 · 按住空格拖动平移</span
    ><span>{{ Math.round(modelValue * 100) }}%</span
    ><button
      type="button"
      class="button"
      :disabled="disabled || dragging || editing"
      @click="reset"
    >
      适应窗口
    </button>
  </div>
  <div
    ref="stage"
    class="image-viewport"
    :class="{ 'hand-ready': space, 'hand-dragging': dragging }"
    @pointerdown.capture="down"
    @pointermove.capture="move"
    @pointerup.capture="end"
    @pointercancel.capture="end"
    @lostpointercapture="end"
  >
    <div class="viewport-content" :style="style"><slot /></div>
  </div>
</template>
<style scoped>
.viewport-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  color: #6e8161;
  margin: 8px 0;
  flex-wrap: wrap;
}
.viewport-toolbar > span:first-child {
  flex: 1;
}
.viewport-toolbar .button {
  padding: 5px 10px;
  font-size: 12px;
}
.image-viewport {
  position: relative;
  height: min(520px, 52vh);
  min-height: 150px;
  overflow: hidden;
  background: #e8ece2;
  border-radius: 9px;
  touch-action: none;
  user-select: none;
  overscroll-behavior: contain;
}
.viewport-content {
  position: absolute;
  left: 50%;
  top: 50%;
  transform-origin: center;
}
.hand-ready,
.hand-ready :deep(*) {
  cursor: grab !important;
}
.hand-dragging,
.hand-dragging :deep(*) {
  cursor: grabbing !important;
}
.hand-ready :deep(.background-brush-cursor) {
  display: none;
}
</style>
