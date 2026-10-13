<script setup>
import { computed, ref } from "vue";
import PixelCanvas from "./components/PixelCanvas.vue";
import ImageCropper from "./components/ImageCropper.vue";
import BackgroundEditor from "./components/BackgroundEditor.vue";
import AppIcon from "./components/AppIcon.vue";
import { useStudio } from "./composables/useStudio.js";

const s = useStudio();
const {
  palette,
  pattern,
  source,
  sourceMask,
  backgroundOpen,
  backgroundPixels,
  height,
  pixelStyle,
  sizeBudget,
  boardEstimate,
  crop,
  cropOpen,
  sourceUrl,
  sourceName,
  name,
  width,
  cell,
  tool,
  selected,
  labels,
  grid,
  busy,
  dirty,
  drawing,
  canUndo,
  canRedo,
  hover,
  notice,
  error,
  stats,
  colorMap,
  selectedColor,
  dimensions,
  pending,
} = s;
const imageInput = ref(null),
  projectInput = ref(null),
  search = ref(""),
  paletteTab = ref("all"),
  replaceFrom = ref("");
const visibleColors = computed(() =>
  palette.value.colors.filter(
    (c) =>
      c.code.toLowerCase().includes(search.value.toLowerCase()) &&
      (paletteTab.value === "all" ||
        stats.value.items.some((i) => i.code === c.code)),
  ),
);
const locked = computed(
  () => busy.value || drawing.value || cropOpen.value || backgroundOpen.value,
);
const styles = [
  {
    id: "nearest",
    name: "复古像素风",
    description: "最近邻采样，保留原色和硬边缘，适合像素画。",
  },
  {
    id: "smooth",
    name: "色块平滑",
    description: "区域平均颜色，减少细碎变化，适合柔和色块。",
  },
  {
    id: "edge",
    name: "轮廓优先",
    description: "区域主色采样，减少边缘混色，适合线稿与卡通。",
  },
];
const hoverText = computed(() => {
  if (!hover.value || !pattern.value) return "移动鼠标查看格子";
  const [x, y] = hover.value;
  return `第 ${x + 1} 列 · 第 ${y + 1} 行 · ${pattern.value.cells[y * pattern.value.width + x] || "空白"}`;
});
function fileChange(event, action) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (file) action(file);
}
function drop(event) {
  if (!locked.value && event.dataTransfer.files[0])
    s.upload(event.dataTransfer.files[0]);
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="brand-mark"><i></i><i></i><i></i><i></i></span>
        <div>
          <strong>豆绘<span>BEAD STUDIO</span></strong>
          <p>让每一颗颜色，都有位置。</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="local-badge"><span></span>图片仅在本地处理</span>
        <button class="button" :disabled="locked" @click="projectInput.click()">
          <AppIcon name="folder" />载入项目
        </button>
        <button class="button" :disabled="!pattern || locked" @click="s.save">
          <AppIcon name="save" />保存项目
        </button>
        <button
          class="button primary"
          :disabled="!pattern || locked"
          @click="s.exportImage"
        >
          <AppIcon name="download" />导出图纸
        </button>
      </div>
      <input
        ref="projectInput"
        class="visually-hidden"
        type="file"
        accept=".json,.beads.json"
        aria-label="载入项目文件"
        @change="fileChange($event, s.openProject)"
      />
    </header>

    <div class="workspace-heading">
      <div>
        <span class="eyebrow">YOUR LITTLE CREATIVE SPACE</span>
        <h1>拼出一点小美好<span class="heading-dot">.</span></h1>
      </div>
      <p>从像素到拼豆，创作就在这一格一格之间。</p>
    </div>

    <main class="workspace">
      <aside class="panel input-panel">
        <div class="panel-title">
          <h2>开始创作</h2>
          <span class="step-label">01 / INPUT</span>
        </div>
        <div class="input-controls">
          <div
            class="upload-zone"
            :class="{ compact: source }"
            @dragover.prevent
            @drop.prevent="drop"
          >
            <input
              ref="imageInput"
              class="visually-hidden"
              type="file"
              accept="image/png,image/jpeg"
              aria-label="上传像素图片"
              @change="fileChange($event, s.upload)"
            />
            <button
              class="upload-trigger"
              :disabled="locked"
              @click="imageInput.click()"
            >
              <span class="upload-icon"
                ><AppIcon name="upload" :size="25"
              /></span>
              <strong>{{ source ? "更换图片" : "上传你的像素画" }}</strong
              ><span>点击选择，或将图片拖到这里</span
              ><small>PNG / JPG · 最大 10 MB</small>
            </button>
          </div>
          <div v-if="source" class="source-card">
            <div class="source-thumb checker">
              <img :src="sourceUrl" alt="上传的原图缩略图" />
            </div>
            <div>
              <strong :title="sourceName">{{ sourceName }}</strong
              ><span>{{ source.width }} × {{ source.height }} px</span>
            </div>
            <span class="source-check"
              ><AppIcon name="check" :size="15"
            /></span>
          </div>
          <div v-if="source" class="source-crop-actions">
            <button class="button" :disabled="locked" @click="cropOpen = true">
              {{ crop ? "调整裁剪" : "裁剪图片" }}
            </button>
            <button
              class="button"
              :disabled="locked"
              @click="backgroundOpen = true"
            >
              去除背景
            </button>
            <span>{{
              crop
                ? `${crop.width} × ${crop.height} px 已选取`
                : "当前使用完整原图"
            }}</span>
            <span v-if="backgroundPixels" class="background-applied"
              >已擦除
              {{ backgroundPixels.toLocaleString() }} 像素，原图保留</span
            >
          </div>
          <button
            class="sample-link"
            :disabled="locked"
            @click="s.loadSample(false)"
          >
            <AppIcon name="image" :size="16" />试试内置像素画 <span>↗</span>
          </button>

          <div class="divider"></div>
          <div class="section-label">图案设置<span>每格 = 1 颗豆</span></div>
          <label class="field-label">底板组合 <span>每块 29 × 29</span></label>
          <div class="board-presets">
            <button
              v-for="board in [
                { count: 1, side: 29 },
                { count: 4, side: 58 },
                { count: 9, side: 87 },
              ]"
              :key="board.count"
              :disabled="locked || !source"
              :class="{ active: width === board.side && height === board.side }"
              :aria-label="`${board.count} 块底板`"
              @click="s.setBoard(board.count)"
            >
              <strong>{{ board.count }} 块</strong
              ><small>{{ board.side }} × {{ board.side }}</small>
            </button>
          </div>
          <label class="field-label" for="grid-width"
            >宽度上限 <span>颗豆</span></label
          >
          <div class="number-field">
            <input
              id="grid-width"
              v-model.number="width"
              type="number"
              min="1"
              max="128"
              step="1"
              :disabled="locked || !source"
            /><span>最大 128</span>
          </div>
          <input
            v-model.number="width"
            class="size-slider"
            type="range"
            min="1"
            max="128"
            step="1"
            aria-label="宽度滑块"
            :disabled="locked || !source"
          />
          <label class="field-label" for="grid-height"
            >高度上限 <span>颗豆</span></label
          >
          <div class="number-field">
            <input
              id="grid-height"
              v-model.number="height"
              type="number"
              min="1"
              max="128"
              step="1"
              :disabled="locked || !source"
            /><span>最大 128</span>
          </div>
          <input
            v-model.number="height"
            class="size-slider"
            type="range"
            min="1"
            max="128"
            step="1"
            aria-label="高度滑块"
            :disabled="locked || !source"
          />
          <div class="preset-row">
            <button
              v-for="n in [16, 32, 48, 64, 128]"
              :key="n"
              :class="{ active: width === n && height === n }"
              :disabled="locked || !source"
              @click="s.setSquareSize(n)"
            >
              {{ n }}
            </button>
          </div>
          <p class="field-help">
            以上为尺寸上限，图案保持比例放入，不拉伸。快捷数字同时设置宽高。
          </p>
          <label class="field-label" for="pixel-style">像素化风格</label>
          <select
            id="pixel-style"
            v-model="pixelStyle"
            class="pixel-style-select"
            :disabled="locked || !source"
          >
            <option v-for="style in styles" :key="style.id" :value="style.id">
              {{ style.name }}
            </option>
          </select>
          <p class="field-help">
            {{ styles.find((style) => style.id === pixelStyle)?.description }}
          </p>
          <div class="setting-summary">
            <span>实际输出尺寸</span
            ><strong>{{ dimensions || "请先上传图片" }}</strong>
          </div>
          <div class="setting-summary">
            <span>最多豆子数</span
            ><strong>{{ sizeBudget.toLocaleString() }} 颗</strong>
          </div>
          <div class="setting-summary">
            <span>底板布局估计</span><strong>{{ boardEstimate }} 块</strong>
          </div>
          <p class="field-help">
            透明 / 擦除区域不放豆；生成后的实际用量见右侧。
          </p>
          <div class="setting-summary">
            <span>颜色匹配</span><strong>Artkal S · 156 色</strong>
          </div>
          <div class="setting-summary">
            <span>透明区域</span><strong>留空，不放豆</strong>
          </div>
        </div>
        <div class="input-output">
          <strong>{{ dimensions || "请先上传图片" }}</strong
          ><span>最多 {{ sizeBudget.toLocaleString() }} 颗</span>
        </div>
        <button
          class="button primary generate"
          :disabled="!source || locked"
          @click="s.generate"
        >
          {{ busy ? "处理中…" : "生成图案" }}<AppIcon name="arrow" />
        </button>
        <p v-if="pending" class="pending-note">
          参数或原图已改变，点击生成以更新画布。
        </p>
      </aside>

      <section class="editor-panel" aria-label="图案编辑区">
        <div class="editor-heading">
          <div class="document-title">
            <input
              aria-label="图案名称"
              :value="name"
              maxlength="80"
              :disabled="locked"
              @input="s.rename($event.target.value)"
            /><span :class="{ unsaved: dirty }">{{
              dirty ? "未保存" : "本地项目"
            }}</span>
          </div>
          <span class="dimension-badge" v-if="pattern"
            >{{ pattern.width }} × {{ pattern.height }}</span
          >
        </div>
        <div class="toolbar">
          <div class="tool-group">
            <button
              v-for="item in [
                { id: 'pen', icon: 'pen', title: '画笔', key: 'B' },
                { id: 'eraser', icon: 'eraser', title: '橡皮', key: 'E' },
                { id: 'picker', icon: 'picker', title: '吸色', key: 'I' },
              ]"
              :key="item.id"
              :class="['tool-button', { active: tool === item.id }]"
              :aria-label="item.title"
              :aria-pressed="tool === item.id"
              :title="`${item.title} (${item.key})`"
              :disabled="!pattern || locked"
              @click="tool = item.id"
            >
              <AppIcon :name="item.icon" /><span>{{ item.title }}</span>
            </button>
          </div>
          <span class="toolbar-separator"></span>
          <button
            class="icon-button"
            title="撤销 (Ctrl+Z)"
            aria-label="撤销"
            :disabled="!canUndo || locked"
            @click="s.undo"
          >
            <AppIcon name="undo" />
          </button>
          <button
            class="icon-button"
            title="重做 (Ctrl+Shift+Z)"
            aria-label="重做"
            :disabled="!canRedo || locked"
            @click="s.redo"
          >
            <AppIcon name="redo" />
          </button>
          <div class="display-options">
            <label
              ><input
                v-model="grid"
                type="checkbox"
                :disabled="locked"
              />网格</label
            ><label
              ><input
                v-model="labels"
                type="checkbox"
                :disabled="locked"
              />色号</label
            >
          </div>
        </div>
        <div class="canvas-stage" :aria-busy="busy">
          <div v-if="pattern" class="canvas-paper">
            <PixelCanvas
              :pattern="pattern"
              :palette="palette"
              :cell="cell"
              :labels="labels"
              :grid="grid"
              :tool="tool"
              :disabled="busy"
              @start="s.start"
              @move="s.paint"
              @end="s.end"
              @hover="hover = $event"
            />
          </div>
          <div v-else class="empty-canvas">
            <AppIcon name="grid" :size="48" />
            <h3>你的创作，从一张图片开始</h3>
            <p>上传像素画，或试试左侧的内置示例。</p>
          </div>
        </div>
        <div class="canvas-footer">
          <span>{{ hoverText }}</span>
          <div class="zoom-control">
            <button
              aria-label="缩小"
              :disabled="cell <= 4 || locked"
              @click="cell = Math.max(4, cell - 4)"
            >
              −</button
            ><span>{{ Math.round((cell / 16) * 100) }}%</span
            ><button
              aria-label="放大"
              :disabled="cell >= 48 || locked"
              @click="cell = Math.min(48, cell + 4)"
            >
              +</button
            ><button class="reset-zoom" :disabled="locked" @click="cell = 16">
              重置
            </button>
          </div>
        </div>
        <div class="editor-tip">
          <span class="tip-dot"></span
          >{{
            cell < 24 && labels
              ? "放大至 150% 或更高可查看格内色号；导出图纸始终包含色号。"
              : "拖动画笔连续绘制，一次落笔算一步撤销。"
          }}
        </div>
      </section>

      <aside class="panel palette-panel">
        <div class="panel-title">
          <h2>颜色与用量</h2>
          <span class="step-label">02 / PALETTE</span>
        </div>
        <div class="palette-brand">
          <span>ARTKAL</span>
          <div>
            <strong>{{ palette.series }}</strong
            ><small>{{ palette.colors.length }} 个可用色号</small>
          </div>
          <span class="brand-status">●</span>
        </div>
        <div class="selected-color" v-if="selectedColor">
          <span
            class="large-swatch"
            :style="{ background: selectedColor.hex }"
          ></span>
          <div>
            <small>当前画笔颜色</small
            ><strong
              >{{ selectedColor.code
              }}<span>{{ selectedColor.hex }}</span></strong
            >
          </div>
        </div>
        <div class="palette-tabs">
          <button
            :class="{ active: paletteTab === 'all' }"
            @click="paletteTab = 'all'"
          >
            全部颜色</button
          ><button
            :class="{ active: paletteTab === 'used' }"
            @click="paletteTab = 'used'"
          >
            已用 {{ stats.colors }}
          </button>
        </div>
        <input
          v-model="search"
          class="search-field"
          aria-label="搜索色号"
          placeholder="搜索色号，例如 S20"
        />
        <div class="swatch-grid" aria-label="品牌色表">
          <button
            v-for="c in visibleColors"
            :key="c.code"
            :class="['swatch-button', { selected: selected === c.code }]"
            :disabled="locked"
            :aria-label="`选择 ${c.code}`"
            :aria-pressed="selected === c.code"
            :title="`${c.code} ${c.hex}`"
            @click="selected = c.code"
          >
            <span :style="{ background: c.hex }"></span
            ><small>{{ c.code }}</small>
          </button>
          <p v-if="!visibleColors.length" class="no-colors">没有匹配的色号</p>
        </div>
        <div class="replace-box">
          <label for="replace-source">全局替换颜色</label>
          <div>
            <select
              id="replace-source"
              v-model="replaceFrom"
              :disabled="!pattern || locked"
            >
              <option value="">选择原色号</option>
              <option
                v-for="item in stats.items"
                :key="item.code"
                :value="item.code"
              >
                {{ item.code }} · {{ item.count }} 颗
              </option></select
            ><span>→</span><strong>{{ selected }}</strong>
          </div>
          <button
            class="button"
            :disabled="
              !pattern ||
              locked ||
              !replaceFrom ||
              replaceFrom === selected ||
              !stats.items.some((i) => i.code === replaceFrom)
            "
            @click="
              s.replace(replaceFrom);
              replaceFrom = '';
            "
          >
            全部替换为当前色
          </button>
        </div>
        <div class="materials-heading">
          <h3>材料清单</h3>
          <span
            >{{ stats.total.toLocaleString() }} 颗 / {{ stats.colors }} 色</span
          >
        </div>
        <div class="material-list">
          <button
            v-for="item in stats.items"
            :key="item.code"
            :disabled="locked"
            @click="selected = item.code"
          >
            <span
              class="tiny-swatch"
              :style="{ background: colorMap.get(item.code)?.hex }"
            ></span
            ><span>{{ item.code }}</span
            ><span class="count-track"
              ><i
                :style="{
                  width: `${(item.count / Math.max(1, stats.total)) * 100}%`,
                }"
              ></i></span
            ><strong>{{ item.count }}<small> 颗</small></strong>
          </button>
          <p v-if="!stats.total" class="field-help">
            有效格子会自动计入材料清单。
          </p>
        </div>
        <p class="palette-footnote">数字颜色仅供参考，实物可能存在色差。</p>
      </aside>
    </main>
    <div
      class="status-bar"
      :class="{ error }"
      :role="error ? 'alert' : 'status'"
      aria-live="polite"
    >
      <span>{{ error ? "!" : "✓" }}</span
      >{{ error || notice || "准备就绪" }}
    </div>
    <ImageCropper
      v-if="cropOpen && source"
      :source="source"
      :url="sourceUrl"
      :crop="crop"
      @apply="s.applyCrop"
      @close="cropOpen = false"
    />
    <BackgroundEditor
      v-if="backgroundOpen && source"
      :source="source"
      :mask="sourceMask"
      @apply="s.applyBackground"
      @close="backgroundOpen = false"
    />
    <footer class="page-footer">
      <span>豆绘 · 把灵感变成手里的小作品</span
      ><span>本地处理 · 无需登录 · 支持项目恢复</span>
    </footer>
  </div>
</template>
