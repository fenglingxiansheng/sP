<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { createSubjectRemover } from "../core/subject.js";
import ImageViewport from "./ImageViewport.vue";
import {
  createMask,
  paintMask,
  removeConnectedColor,
  restoreConnectedColor,
  cornerSeeds,
  maskCount,
} from "../core/background.js";

const props = defineProps({ source: Object, mask: Uint8Array });
const emit = defineEmits(["apply", "close"]);
const dialog = ref(null),
  canvas = ref(null),
  tool = ref("erase");
const brush = ref(3),
  tolerance = ref(24),
  zoom = ref(1),
  busy = ref(false),
  drawing = ref(false);
const message = ref("点击一键抠图自动保留主体，再用擦除和恢复笔刷修整边缘。");
const aiBusy = ref(false);
const showReference = ref(false);
const remover = createSubjectRemover();
async function removeSubject() {
  if (busy.value || drawing.value) return;
  if (
    mask.some(Boolean) &&
    !window.confirm("重新自动识别会替换当前背景修改；完成后可撤销。继续吗？")
  )
    return;
  busy.value = aiBusy.value = true;
  try {
    const result = await remover.run(
      props.source,
      (text) => (message.value = text),
    );
    const snapshot = mask;
    mask = result;
    commit(
      snapshot,
      mask.some((value, index) => value !== snapshot[index]),
    );
    message.value =
      "自动抠图完成。未去净处用擦除笔刷补涂，误删处用恢复原图修补。";
  } catch (error) {
    message.value = error.message;
  } finally {
    busy.value = aiBusy.value = false;
  }
}
const count = ref(0),
  canUndo = ref(false),
  canRedo = ref(false),
  cursor = ref(null);
const longest = Math.max(props.source.width, props.source.height);
const scale = Math.min(960 / props.source.width, 520 / props.source.height);
const previewWidth = Math.max(1, Math.round(props.source.width * scale));
const previewHeight = Math.max(1, Math.round(props.source.height * scale));
const historyLimit = Math.max(
  1,
  Math.min(
    12,
    Math.floor((32 * 1024 * 1024) / (props.source.width * props.source.height)),
  ),
);
const radius = computed(() => Math.max(0.5, (longest * brush.value) / 200));
const pointerStyle = computed(() =>
  cursor.value && !["wand", "keep"].includes(tool.value)
    ? {
        width: `${((radius.value * 2) / props.source.width) * previewWidth}px`,
        height: `${((radius.value * 2) / props.source.height) * previewHeight}px`,
        left: `${(cursor.value.x / props.source.width) * previewWidth}px`,
        top: `${(cursor.value.y / props.source.height) * previewHeight}px`,
      }
    : null,
);
let mask = props.mask?.slice() ?? createMask(props.source);
let before = null,
  previous = null,
  activePointer = null,
  strokeChanged = false,
  frame = 0;
const past = [],
  future = [];

function render() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    if (!canvas.value) return;
    const ctx = canvas.value.getContext("2d");
    const pixels = ctx.createImageData(previewWidth, previewHeight);
    for (let y = 0; y < previewHeight; y++)
      for (let x = 0; x < previewWidth; x++) {
        const sx = Math.min(
          props.source.width - 1,
          Math.floor(((x + 0.5) * props.source.width) / previewWidth),
        );
        const sy = Math.min(
          props.source.height - 1,
          Math.floor(((y + 0.5) * props.source.height) / previewHeight),
        );
        const i = sy * props.source.width + sx,
          target = (y * previewWidth + x) * 4;
        for (let c = 0; c < 3; c++)
          pixels.data[target + c] = props.source.data[i * 4 + c];
        pixels.data[target + 3] = mask[i]
          ? showReference.value
            ? Math.round(props.source.data[i * 4 + 3] * 0.3)
            : 0
          : props.source.data[i * 4 + 3];
      }
    ctx.putImageData(pixels, 0, 0);
  });
}
function sync() {
  count.value = maskCount(mask, props.source);
  canUndo.value = past.length > 0;
  canRedo.value = future.length > 0;
  render();
}
function commit(snapshot, changed) {
  if (changed) {
    past.push(snapshot);
    if (past.length > historyLimit) past.shift();
    future.length = 0;
  }
  sync();
}
function point(event) {
  const rect = canvas.value.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        props.source.width,
        ((event.clientX - rect.left) / rect.width) * props.source.width,
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        props.source.height,
        ((event.clientY - rect.top) / rect.height) * props.source.height,
      ),
    ),
  };
}
async function operation(work) {
  if (busy.value || drawing.value) return;
  busy.value = true;
  try {
    await new Promise((resolve) =>
      requestAnimationFrame(() => setTimeout(resolve, 0)),
    );
    const snapshot = mask.slice();
    const changed = work();
    commit(snapshot, changed);
    message.value = changed
      ? "预览已更新；不满意可撤销，或用恢复笔刷找回误删部分。"
      : "没有像素发生变化，可调整颜色容差后再试。";
  } catch (error) {
    message.value = error.message || "操作失败，请重试。";
  } finally {
    busy.value = false;
  }
}
function autoRemove() {
  operation(() =>
    removeConnectedColor(
      props.source,
      mask,
      cornerSeeds(props.source, tolerance.value),
      tolerance.value,
    ),
  );
}
function start(event) {
  if (event.button !== 0 || busy.value || drawing.value) return;
  const p = point(event);
  if (tool.value === "wand" || tool.value === "keep") {
    const index =
      Math.min(props.source.height - 1, Math.floor(p.y)) * props.source.width +
      Math.min(props.source.width - 1, Math.floor(p.x));
    operation(() =>
      (tool.value === "keep" ? restoreConnectedColor : removeConnectedColor)(
        props.source,
        mask,
        [index],
        tolerance.value,
      ),
    );
    return;
  }
  canvas.value.setPointerCapture(event.pointerId);
  activePointer = event.pointerId;
  drawing.value = true;
  before = mask.slice();
  previous = p;
  strokeChanged = paintMask(
    mask,
    props.source,
    p,
    p,
    radius.value,
    tool.value === "restore",
  );
  render();
}
function move(event) {
  cursor.value = point(event);
  if (!drawing.value || event.pointerId !== activePointer) return;
  strokeChanged =
    paintMask(
      mask,
      props.source,
      previous,
      cursor.value,
      radius.value,
      tool.value === "restore",
    ) || strokeChanged;
  previous = cursor.value;
  render();
}
function end(event) {
  if (!drawing.value || event.pointerId !== activePointer) return;
  drawing.value = false;
  commit(before, strokeChanged);
  before = null;
  previous = null;
  activePointer = null;
}
function undo() {
  if (!past.length || busy.value || drawing.value) return;
  future.push(mask);
  mask = past.pop();
  sync();
}
function redo() {
  if (!future.length || busy.value || drawing.value) return;
  past.push(mask);
  mask = future.pop();
  sync();
}
function reset() {
  operation(() => {
    const changed = mask.some(Boolean);
    mask = createMask(props.source);
    return changed;
  });
}
function apply() {
  emit("apply", { mask, count: count.value });
}
function close() {
  if (!busy.value && !drawing.value) emit("close");
}
onMounted(() => {
  dialog.value.showModal();
  sync();
});
watch(showReference, render);
function selectTool(id) {
  tool.value = id;
  if (id === "keep" || id === "restore") showReference.value = true;
}
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  remover.cancel();
});
</script>

<template>
  <dialog
    ref="dialog"
    class="background-dialog"
    aria-labelledby="background-title"
    @cancel.prevent="close"
  >
    <header class="background-heading">
      <div>
        <h2 id="background-title">去掉背景，留下主体</h2>
        <p>
          Anime Segmentation 动漫主体抠图 · 本地处理，原图保留，可手动修补。
        </p>
      </div>
      <button
        class="icon-button"
        aria-label="关闭背景处理"
        :disabled="busy || drawing"
        @click="close"
      >
        ×
      </button>
    </header>
    <div class="background-tools">
      <button
        class="button primary"
        :disabled="busy || drawing"
        @click="removeSubject"
      >
        {{ aiBusy ? "自动识别中…" : "一键抠图" }}
      </button>
      <button v-if="aiBusy" class="button" @click="remover.cancel()">
        取消自动抠图
      </button>
      <button class="button" :disabled="busy || drawing" @click="autoRemove">
        去除纯色背景
      </button>
      <div class="background-tool-tabs">
        <button
          v-for="item in [
            { id: 'erase', label: '擦除背景' },
            { id: 'restore', label: '恢复原图' },
            { id: 'wand', label: '点选背景' },
            { id: 'keep', label: '点选保留' },
          ]"
          :key="item.id"
          class="button"
          :class="{ active: tool === item.id }"
          :aria-pressed="tool === item.id"
          :disabled="busy || drawing"
          @click="selectTool(item.id)"
        >
          {{ item.label }}
        </button>
      </div>
      <button
        class="button"
        :disabled="!canUndo || busy || drawing"
        @click="undo"
      >
        撤销背景修改</button
      ><button
        class="button"
        :disabled="!canRedo || busy || drawing"
        @click="redo"
      >
        重做
      </button>
    </div>
    <div class="background-controls">
      <label
        ><input
          v-model="showReference"
          type="checkbox"
          :disabled="busy || drawing"
        />显示原图参考</label
      >
      <label
        >笔刷大小
        <input
          v-model.number="brush"
          type="range"
          min="0.2"
          max="20"
          step="0.2"
          aria-label="背景笔刷大小"
          :disabled="busy || drawing"
        /><strong>{{ Math.round(radius * 2) }} px</strong></label
      ><label
        >颜色容差
        <input
          v-model.number="tolerance"
          type="range"
          min="0"
          max="100"
          step="1"
          aria-label="背景颜色容差"
          :disabled="busy || drawing"
        /><strong>{{ tolerance }}</strong></label
      ><label
        >放大
        <select
          v-model.number="zoom"
          aria-label="背景预览缩放"
          :disabled="busy || drawing"
        >
          <option v-if="![1, 2, 3].includes(zoom)" :value="zoom">
            {{ Math.round(zoom * 100) }}%
          </option>
          <option :value="1">100%</option>
          <option :value="2">200%</option>
          <option :value="3">300%</option>
        </select></label
      >
    </div>
    <p class="background-instruction">
      {{
        tool === "keep"
          ? "点击误删的手臂或衣服，恢复与点击处颜色相近的连通区域。没补全可调高容差再次点击；多恢复了可撤销。"
          : tool === "wand"
            ? "点击一处背景，仅去掉颜色接近、彼此连通的区域。"
            : tool === "restore"
              ? "涂抹误删区域，恢复原来的颜色和透明度。"
              : "在不需要的背景上涂抹；可调小笔刷并放大以精修边缘。"
      }}
    </p>
    <p v-if="showReference" class="background-instruction">
      淡色区域仅为原图参考，仍属于已删除背景；取消勾选可查看真实透明结果，参考层不参与导出。
    </p>
    <ImageViewport
      v-model="zoom"
      :width="previewWidth"
      :height="previewHeight"
      :disabled="busy || drawing"
    >
      <div
        class="background-canvas-wrap checker"
        :style="{
          width: `${previewWidth}px`,
          height: `${previewHeight}px`,
        }"
      >
        <canvas
          ref="canvas"
          :width="previewWidth"
          :height="previewHeight"
          :style="{
            width: `${previewWidth}px`,
            height: `${previewHeight}px`,
          }"
          aria-label="背景擦除画布"
          @pointerdown.prevent="start"
          @pointermove="move"
          @pointerup="end"
          @pointercancel="end"
          @lostpointercapture="end"
          @pointerleave="cursor = null"
          @contextmenu.prevent
        /><span
          v-if="pointerStyle"
          class="background-brush-cursor"
          :style="pointerStyle"
        ></span>
      </div>
    </ImageViewport>
    <div class="background-feedback" role="status">
      {{ message }}
      <strong>已移除 {{ count.toLocaleString() }} 个可见像素</strong>
    </div>
    <p class="background-note">
      动漫模型约 176
      MB，首次加载和识别较慢，图片不上传。适合动漫角色，像素画或复杂背景可能识别不准，请用擦除
      / 恢复修补。纯色去除仅按颜色处理。可撤销最近
      {{ historyLimit }} 步。
    </p>
    <footer class="background-actions">
      <button class="button" :disabled="busy || drawing" @click="reset">
        恢复全部原图</button
      ><span>确认后点击“生成图案”，移除的背景不计豆数。</span
      ><button class="button" :disabled="busy || drawing" @click="close">
        取消</button
      ><button
        class="button primary"
        :disabled="busy || drawing"
        @click="apply"
      >
        应用背景处理
      </button>
    </footer>
  </dialog>
</template>

<style scoped>
.background-dialog {
  border: 1px solid #dfe5d9;
  border-radius: 16px;
  padding: 24px;
  width: min(1060px, 96vw);
  max-height: 94vh;
  color: #344339;
  box-shadow: 0 20px 90px #14241c40;
  overflow: auto;
}
.background-dialog::backdrop {
  background: #1c302d80;
  backdrop-filter: blur(3px);
}
.background-heading {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.background-heading h2 {
  font-size: 20px;
  margin: 0;
}
.background-heading p {
  font-size: 12px;
  color: #7a8874;
  margin: 8px 0 20px;
}
.background-heading button {
  font-size: 25px;
  align-self: flex-start;
}
.background-tools {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.background-tool-tabs {
  display: flex;
  gap: 4px;
}
.background-tool-tabs .active {
  background: #e7efdf;
  border-color: #829c6c;
  color: #466437;
}
.background-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 18px;
  margin: 18px 0 10px;
}
.background-controls label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}
.background-controls input[type="range"] {
  width: 110px;
  accent-color: #50765b;
}
.background-controls input[type="checkbox"] {
  accent-color: #50765b;
}
.background-controls strong {
  font-size: 10px;
  color: #839476;
  min-width: 40px;
}
.background-controls select {
  padding: 5px;
  border: 1px solid #dfe5d9;
  border-radius: 5px;
}
.background-instruction {
  font-size: 12px;
  color: #6e8161;
}
.background-stage {
  max-height: 52vh;
  min-height: 150px;
  overflow: auto;
  background: #e8ece2;
  padding: 16px;
  display: flex;
  align-items: safe center;
  justify-content: safe center;
  border-radius: 9px;
}
.background-canvas-wrap {
  position: relative;
  flex-shrink: 0;
  margin: auto;
  overflow: hidden;
}
.background-canvas-wrap canvas {
  display: block;
  touch-action: none;
  cursor: crosshair;
}
.background-brush-cursor {
  position: absolute;
  pointer-events: none;
  transform: translate(-50%, -50%);
  border: 1px solid white;
  outline: 1px solid #33452e;
  border-radius: 50%;
}
.background-feedback {
  font-size: 12px;
  color: #6c805e;
  margin-top: 14px;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
}
.background-feedback strong {
  font-weight: 500;
}
.background-note {
  font-size: 11px;
  line-height: 1.7;
  color: #8a9481;
}
.background-actions {
  border-top: 1px solid #e3e8da;
  padding-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.background-actions > span {
  flex: 1;
  font-size: 11px;
  color: #8a9481;
}
@media (max-width: 600px) {
  .background-dialog {
    padding: 16px;
  }
  .background-tools .button {
    font-size: 10px;
    padding: 8px;
  }
  .background-controls {
    gap: 12px;
  }
  .background-controls input[type="range"] {
    width: 85px;
  }
  .background-actions {
    flex-wrap: wrap;
  }
  .background-actions > span {
    flex-basis: 100%;
    order: 1;
  }
  .background-actions button {
    flex: 1;
    font-size: 11px;
  }
  .background-stage {
    max-height: 40vh;
  }
}
</style>
