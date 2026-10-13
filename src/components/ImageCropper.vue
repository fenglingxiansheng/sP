<script setup>
import { computed, onMounted, ref } from "vue";
import ImageViewport from "./ImageViewport.vue";
import { cropFromPoints, validateCrop } from "../core/crop.js";
const props = defineProps({ source: Object, url: String, crop: Object });
const emit = defineEmits(["apply", "close"]);
const dialog = ref(null),
  surface = ref(null);
const draft = ref(validateCrop(props.source, props.crop));
const selecting = ref(!props.crop);
const zoom = ref(1);
const previewScale = Math.min(
  1,
  820 / props.source.width,
  520 / props.source.height,
);
let gesture = null;
const selectionStyle = computed(() => ({
  left: `${(draft.value.x / props.source.width) * 100}%`,
  top: `${(draft.value.y / props.source.height) * 100}%`,
  width: `${(draft.value.width / props.source.width) * 100}%`,
  height: `${(draft.value.height / props.source.height) * 100}%`,
}));
onMounted(() => dialog.value.showModal());
function point(event) {
  const bounds = surface.value.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        props.source.width,
        Math.round(
          ((event.clientX - bounds.left) / bounds.width) * props.source.width,
        ),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        props.source.height,
        Math.round(
          ((event.clientY - bounds.top) / bounds.height) * props.source.height,
        ),
      ),
    ),
  };
}
function start(event, mode = "draw") {
  if (event.button !== 0 || gesture) return;
  const origin = point(event),
    r = { ...draft.value };
  const anchors = {
    nw: { x: r.x + r.width, y: r.y + r.height },
    ne: { x: r.x, y: r.y + r.height },
    sw: { x: r.x + r.width, y: r.y },
    se: { x: r.x, y: r.y },
  };
  gesture = {
    mode,
    origin,
    rect: r,
    anchor: anchors[mode] ?? origin,
    id: event.pointerId,
  };
  surface.value.setPointerCapture(event.pointerId);
  if (mode === "draw")
    draft.value = cropFromPoints(origin, origin, props.source);
}
function move(event) {
  if (!gesture || event.pointerId !== gesture.id) return;
  const p = point(event);
  if (gesture.mode === "move") {
    const r = gesture.rect;
    draft.value = {
      ...r,
      x: Math.max(
        0,
        Math.min(props.source.width - r.width, r.x + p.x - gesture.origin.x),
      ),
      y: Math.max(
        0,
        Math.min(props.source.height - r.height, r.y + p.y - gesture.origin.y),
      ),
    };
  } else draft.value = cropFromPoints(gesture.anchor, p, props.source);
}
function end(event) {
  if (gesture?.id === event.pointerId) {
    gesture = null;
    selecting.value = false;
  }
}
function reset() {
  draft.value = validateCrop(props.source);
  selecting.value = true;
}
function numberChange(key, value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return;
  const next = { ...draft.value, [key]: Math.round(n) };
  next.x = Math.max(0, Math.min(props.source.width - 1, next.x));
  next.y = Math.max(0, Math.min(props.source.height - 1, next.y));
  next.width = Math.max(1, Math.min(props.source.width - next.x, next.width));
  next.height = Math.max(
    1,
    Math.min(props.source.height - next.y, next.height),
  );
  draft.value = next;
}
</script>
<template>
  <dialog
    ref="dialog"
    class="crop-dialog"
    aria-labelledby="crop-title"
    @cancel.prevent="emit('close')"
  >
    <header class="crop-heading">
      <div>
        <h2 id="crop-title">截取要拼豆的区域</h2>
        <p>拖动四角调整范围，拖动选框移动；也可以在框外重新框选。</p>
      </div>
      <button class="icon-button" aria-label="关闭裁剪" @click="emit('close')">
        ×
      </button>
    </header>
    <ImageViewport
      v-model="zoom"
      :width="source.width * previewScale"
      :height="source.height * previewScale"
    >
      <div
        ref="surface"
        class="crop-surface checker"
        :style="{
          aspectRatio: `${source.width} / ${source.height}`,
          width: '100%',
          height: '100%',
        }"
        @pointerdown.prevent="start($event)"
        @pointermove="move"
        @pointerup="end"
        @pointercancel="end"
        @lostpointercapture="end"
      >
        <img :src="url" alt="待裁剪的原始图片" draggable="false" />
        <div
          class="crop-selection"
          :style="{
            ...selectionStyle,
            cursor: selecting ? 'crosshair' : 'move',
          }"
          @pointerdown.stop.prevent="start($event, selecting ? 'draw' : 'move')"
        >
          <span class="crop-thirds"></span
          ><span
            v-for="corner in ['nw', 'ne', 'sw', 'se']"
            :key="corner"
            :class="['crop-handle', corner]"
            @pointerdown.stop.prevent="start($event, corner)"
          ></span>
        </div>
      </div>
    </ImageViewport>
    <div class="crop-inputs">
      <label
        v-for="field in [
          { key: 'x', text: '左侧 X' },
          { key: 'y', text: '顶部 Y' },
          { key: 'width', text: '裁剪宽度' },
          { key: 'height', text: '裁剪高度' },
        ]"
        :key="field.key"
        >{{ field.text
        }}<input
          type="number"
          :aria-label="field.text"
          :value="draft[field.key]"
          :min="field.key === 'x' || field.key === 'y' ? 0 : 1"
          step="1"
          @change="numberChange(field.key, $event.target.value)" /></label
      ><span>原图像素 · {{ draft.width }} × {{ draft.height }} px</span>
    </div>
    <footer class="crop-actions">
      <button class="button" @click="reset">恢复整图</button
      ><button
        class="button"
        :aria-pressed="selecting"
        @click="selecting = true"
      >
        重新框选</button
      ><span>{{
        selecting
          ? "在图上拖动，框选需要的主体。"
          : "保留原图，确认后再生成图案。"
      }}</span
      ><button class="button" @click="emit('close')">取消</button
      ><button
        class="button primary"
        @click="emit('apply', validateCrop(source, draft))"
      >
        确认裁剪
      </button>
    </footer>
  </dialog>
</template>
<style scoped>
.crop-dialog {
  border: 1px solid #dfe5d9;
  border-radius: 16px;
  padding: 24px;
  width: min(900px, 94vw);
  max-height: 94vh;
  color: #344339;
  box-shadow: 0 20px 90px #14241c40;
  overflow: auto;
}
.crop-dialog::backdrop {
  background: #1c302d80;
  backdrop-filter: blur(3px);
}
.crop-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.crop-heading h2 {
  margin: 0;
  font-size: 19px;
}
.crop-heading p {
  font-size: 12px;
  color: #7a8874;
  margin: 10px 0 18px;
}
.crop-heading button {
  font-size: 25px;
  padding: 0 8px;
}
.crop-preview {
  display: flex;
  justify-content: center;
  align-items: center;
  background: #e9ede4;
  border-radius: 9px;
  padding: 14px;
  overflow: hidden;
}
.crop-surface {
  position: relative;
  touch-action: none;
  cursor: crosshair;
  overflow: hidden;
  user-select: none;
  flex-shrink: 0;
}
.crop-surface > img {
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
  image-rendering: pixelated;
}
.crop-selection {
  position: absolute;
  border: 2px solid #fff;
  outline: 1px solid #50765b;
  box-shadow: 0 0 0 4000px #14241c85;
  cursor: move;
}
.crop-thirds {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      to right,
      transparent 33%,
      #ffffff80 33%,
      #ffffff80 33.3%,
      transparent 33.3%,
      transparent 66.6%,
      #ffffff80 66.6%,
      #ffffff80 67%,
      transparent 67%
    ),
    linear-gradient(
      to bottom,
      transparent 33%,
      #ffffff80 33%,
      #ffffff80 33.3%,
      transparent 33.3%,
      transparent 66.6%,
      #ffffff80 66.6%,
      #ffffff80 67%,
      transparent 67%
    );
  pointer-events: none;
}
.crop-handle {
  position: absolute;
  width: 14px;
  height: 14px;
  background: #fff;
  border: 2px solid #50765b;
  border-radius: 3px;
}
.nw {
  left: -2px;
  top: -2px;
  cursor: nwse-resize;
}
.ne {
  right: -2px;
  top: -2px;
  cursor: nesw-resize;
}
.sw {
  left: -2px;
  bottom: -2px;
  cursor: nesw-resize;
}
.se {
  right: -2px;
  bottom: -2px;
  cursor: nwse-resize;
}
.crop-inputs {
  display: flex;
  gap: 12px;
  align-items: end;
  margin: 16px 0;
}
.crop-inputs label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  max-width: 115px;
  font-size: 11px;
  color: #6d7c63;
}
.crop-inputs input {
  width: 100%;
  padding: 8px;
  border: 1px solid #dfe5d9;
  border-radius: 6px;
  background: #fafcf7;
  color: #344339;
}
.crop-inputs > span {
  margin-left: auto;
  font-size: 11px;
  color: #8e9b85;
  padding-bottom: 10px;
}
.crop-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  border-top: 1px solid #e6e9df;
  padding-top: 16px;
}
.crop-actions > span {
  flex: 1;
  font-size: 11px;
  color: #9aa18f;
}
@media (max-width: 600px) {
  .crop-dialog {
    padding: 16px;
  }
  .crop-inputs {
    flex-wrap: wrap;
    gap: 8px;
  }
  .crop-inputs label {
    max-width: none;
    flex: 1 1 40%;
  }
  .crop-inputs > span {
    width: 100%;
    padding: 0;
  }
  .crop-actions {
    flex-wrap: wrap;
  }
  .crop-actions > span {
    display: none;
  }
  .crop-actions button {
    flex: 1;
    padding: 10px 6px;
  }
}
</style>
