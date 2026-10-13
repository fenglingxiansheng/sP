import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import builtinPalette from "../data/artkal-s.json";
import { decodeImage } from "../core/image.js";
import { validateCrop } from "../core/crop.js";
import { fitGrid, boardCapacity } from "../core/sizing.js";
import {
  countBeads,
  matchGrid,
  MAX_FILE_BYTES,
  sampleGrid,
} from "../core/pattern.js";
import { createEditor, lineCells } from "../core/editor.js";
import { parseProject, serializeProject } from "../core/project.js";
import { downloadBlob, exportPng } from "../core/render.js";

export function useStudio() {
  const palette = shallowRef(builtinPalette),
    pattern = shallowRef(null),
    source = shallowRef(null);
  const crop = ref(null),
    cropOpen = ref(false);
  const sourceMask = shallowRef(null),
    backgroundOpen = ref(false),
    backgroundPixels = ref(0);
  const height = ref(32),
    pixelStyle = ref("nearest");
  const sourceUrl = ref(""),
    sourceName = ref(""),
    name = ref("一盆小小的春天");
  const width = ref(32),
    cell = ref(16),
    tool = ref("pen"),
    selected = ref("S20");
  const labels = ref(true),
    grid = ref(true),
    busy = ref(false),
    dirty = ref(false),
    edited = ref(false),
    drawing = ref(false);
  const canUndo = ref(false),
    canRedo = ref(false),
    hover = ref(null),
    notice = ref(""),
    error = ref("");
  let editor = null,
    previous = null;
  const stats = computed(() => countBeads(pattern.value));
  const colorMap = computed(
    () => new Map(palette.value.colors.map((c) => [c.code, c])),
  );
  const selectedColor = computed(() => colorMap.value.get(selected.value));
  const targetSize = computed(() => {
    if (!source.value) return null;
    try {
      return fitGrid(
        crop.value?.width ?? source.value.width,
        crop.value?.height ?? source.value.height,
        Number(width.value),
        Number(height.value),
      );
    } catch {
      return null;
    }
  });
  const dimensions = computed(() =>
    targetSize.value
      ? `${targetSize.value.width} × ${targetSize.value.height}`
      : source.value
        ? "尺寸超出范围"
        : "",
  );
  const sizeBudget = computed(() =>
    targetSize.value ? targetSize.value.width * targetSize.value.height : 0,
  );
  const boardEstimate = computed(() =>
    targetSize.value
      ? Math.ceil(targetSize.value.width / 29) *
        Math.ceil(targetSize.value.height / 29)
      : 0,
  );
  const configurationKey = computed(() =>
    JSON.stringify({
      width: Number(width.value),
      height: Number(height.value),
      crop: crop.value,
      style: pixelStyle.value,
    }),
  );
  const pending = computed(
    () =>
      !!pattern.value &&
      !!source.value &&
      (source.value !== lastSource ||
        configurationKey.value !== lastConfiguration ||
        sourceMask.value !== lastMask),
  );
  let lastSource = null;
  let lastConfiguration = "",
    lastMask = null;

  function sync() {
    pattern.value = editor.pattern;
    canUndo.value = editor.canUndo;
    canRedo.value = editor.canRedo;
  }
  function install(next) {
    editor = createEditor(next);
    sync();
    edited.value = false;
    drawing.value = false;
  }
  function confirmOverwrite(
    message = "当前有未保存的修改，继续会覆盖这些修改。是否继续？",
  ) {
    return !dirty.value || window.confirm(message);
  }
  function announce(message) {
    notice.value = message;
    error.value = "";
  }
  async function run(work) {
    if (busy.value || drawing.value) return;
    busy.value = true;
    error.value = "";
    notice.value = "";
    try {
      await work();
    } catch (e) {
      error.value = e.message || "操作失败，请重试。";
    } finally {
      busy.value = false;
    }
  }
  function setSource(file, pixels) {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    sourceUrl.value = URL.createObjectURL(file);
    source.value = pixels;
    sourceName.value = file.name;
    crop.value = null;
    sourceMask.value = null;
    backgroundPixels.value = 0;
  }
  async function upload(file) {
    if (!file) return;
    await run(async () => {
      const pixels = await decodeImage(file);
      setSource(file, pixels);
      width.value = Math.max(1, Math.min(64, pixels.width));
      height.value = Math.max(1, Math.min(64, pixels.height));
      announce("图片已读取。设置格数后点击「生成图案」，当前画布暂不改变。");
      cropOpen.value = true;
    });
  }
  async function loadSample(initial = false) {
    if (!initial && !confirmOverwrite()) return;
    await run(async () => {
      const response = await fetch(
        `${import.meta.env.BASE_URL}samples/flower.png`,
      );
      if (!response.ok) throw new Error("示例图片读取失败。");
      const file = new File([await response.blob()], "flower.png", {
        type: "image/png",
      });
      const pixels = await decodeImage(file);
      const next = matchGrid(
        sampleGrid(pixels, 32, null, { height: 32, style: "nearest" }),
        builtinPalette,
      );
      setSource(file, pixels);
      width.value = 32;
      height.value = 32;
      pixelStyle.value = "nearest";
      palette.value = builtinPalette;
      selected.value = "S20";
      install(next);
      lastSource = pixels;
      lastConfiguration = configurationKey.value;
      lastMask = null;
      name.value = "一盆小小的春天";
      cell.value = 16;
      dirty.value = false;
      announce("已载入示例。可以直接编辑，也可以上传自己的像素画。");
    });
  }
  async function generate() {
    if (!source.value) return;
    if (
      (edited.value || dirty.value) &&
      !window.confirm(
        "重新生成将覆盖当前图案和手工修改，并清空撤销记录。是否继续？",
      )
    )
      return;
    await run(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      );
      const next = matchGrid(
        sampleGrid(source.value, Number(width.value), crop.value, {
          height: Number(height.value),
          style: pixelStyle.value,
          mask: sourceMask.value,
          backgroundRemoved: backgroundPixels.value > 0,
        }),
        builtinPalette,
      );
      palette.value = builtinPalette;
      if (!palette.value.colors.some((c) => c.code === selected.value))
        selected.value = "S20";
      install(next);
      lastSource = source.value;
      lastConfiguration = configurationKey.value;
      lastMask = sourceMask.value;
      dirty.value = true;
      name.value =
        sourceName.value.replace(/\.[^.]+$/, "").slice(0, 80) || "我的拼豆图案";
      cell.value = Math.max(
        4,
        Math.min(24, Math.floor(512 / Math.max(next.width, next.height))),
      );
      announce("图案已生成，可以开始编辑。");
    });
  }
  function start(point) {
    if (!editor || busy.value) return;
    if (tool.value === "picker") {
      const code =
        pattern.value.cells[point[1] * pattern.value.width + point[0]];
      if (code) {
        selected.value = code;
        announce(`已吸取 ${code}`);
      } else announce("这是空白格，没有豆色。");
      return;
    }
    drawing.value = true;
    editor.begin();
    previous = point;
    paint(point);
  }
  function paint(point) {
    if (!drawing.value || !previous) return;
    editor.paint(
      lineCells(previous, point, pattern.value.width, pattern.value.height),
      tool.value === "eraser" ? null : selected.value,
    );
    previous = point;
    sync();
  }
  function end() {
    if (!drawing.value) return;
    if (editor.commit()) {
      dirty.value = true;
      edited.value = true;
    }
    drawing.value = false;
    previous = null;
    sync();
  }
  function undo() {
    if (!editor || drawing.value || busy.value || !canUndo.value) return;
    editor.undo();
    sync();
    dirty.value = true;
    edited.value = true;
  }
  function redo() {
    if (!editor || drawing.value || busy.value || !canRedo.value) return;
    editor.redo();
    sync();
    dirty.value = true;
    edited.value = true;
  }
  function replace(from) {
    if (
      !editor ||
      drawing.value ||
      busy.value ||
      !from ||
      from === selected.value
    )
      return;
    editor.begin();
    editor.replace(from, selected.value);
    if (editor.commit()) {
      dirty.value = true;
      edited.value = true;
      announce(`已将 ${from} 全部替换为 ${selected.value}，可撤销。`);
    }
    sync();
  }
  const filename = () =>
    (name.value || "我的拼豆图案")
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .slice(0, 80);
  async function save() {
    if (!pattern.value) return;
    await run(async () => {
      const json = serializeProject(name.value, pattern.value, palette.value);
      downloadBlob(
        new Blob([json], { type: "application/json" }),
        `${filename()}.beads.json`,
      );
      dirty.value = false;
      announce("项目文件已开始下载，可用于恢复和继续编辑。");
    });
  }
  async function openProject(file) {
    if (!file) return;
    await run(async () => {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("项目文件不能超过 10 MB。");
      const project = parseProject(await file.text());
      if (!confirmOverwrite()) return;
      palette.value = project.palette;
      install(project.pattern);
      name.value = project.name;
      width.value =
        project.pattern.settings.bounds?.width ?? project.pattern.width;
      height.value =
        project.pattern.settings.bounds?.height ?? project.pattern.height;
      pixelStyle.value = project.pattern.settings.sampling;
      selected.value = project.palette.colors[0].code;
      source.value = null;
      sourceMask.value = null;
      backgroundPixels.value = 0;
      backgroundOpen.value = false;
      crop.value = null;
      cropOpen.value = false;
      lastSource = null;
      sourceName.value = "";
      if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
      sourceUrl.value = "";
      dirty.value = false;
      cell.value = Math.max(
        4,
        Math.min(
          24,
          Math.floor(
            512 / Math.max(project.pattern.width, project.pattern.height),
          ),
        ),
      );
      announce("项目已恢复。可继续编辑；重新转换需再次上传原图。");
    });
  }
  async function exportImage() {
    if (!pattern.value) return;
    await run(async () => {
      await new Promise((resolve) =>
        requestAnimationFrame(() => setTimeout(resolve, 0)),
      );
      downloadBlob(
        await exportPng(pattern.value, palette.value, name.value),
        `${filename()}-图纸.png`,
      );
      announce("PNG 图纸已开始下载，包含完整网格、色号和材料清单。");
    });
  }
  function rename(value) {
    name.value = value.slice(0, 80);
    if (pattern.value) dirty.value = true;
  }
  function shortcut(event) {
    if (
      event.target instanceof HTMLElement &&
      (event.target.matches("input, textarea, select") ||
        event.target.isContentEditable)
    )
      return;
    if (busy.value || drawing.value || cropOpen.value || backgroundOpen.value)
      return;
    if (event.ctrlKey || event.metaKey) {
      if (event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      }
      if (event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    } else if (!event.altKey) {
      const tools = { b: "pen", e: "eraser", i: "picker" };
      if (tools[event.key.toLowerCase()])
        tool.value = tools[event.key.toLowerCase()];
    }
  }
  function beforeUnload(event) {
    if (dirty.value) {
      event.preventDefault();
      event.returnValue = "";
    }
  }
  function applyCrop(rect) {
    if (!source.value) return;
    const next = validateCrop(source.value, rect);
    const isFull =
      next.x === 0 &&
      next.y === 0 &&
      next.width === source.value.width &&
      next.height === source.value.height;
    crop.value = isFull ? null : next;
    cropOpen.value = false;
    announce(
      isFull
        ? "已选择完整原图，点击「生成图案」应用。"
        : `已选取 ${next.width} × ${next.height} 像素区域，点击「生成图案」应用。`,
    );
  }
  function setBoard(count) {
    const capacity = boardCapacity(count);
    width.value = capacity.width;
    height.value = capacity.height;
  }
  function setSquareSize(size) {
    width.value = size;
    height.value = size;
  }
  function applyBackground(result) {
    sourceMask.value = result.count ? result.mask : null;
    backgroundPixels.value = result.count;
    backgroundOpen.value = false;
    announce(
      result.count
        ? "背景处理已应用到原图蒙版。点击「生成图案」更新图案及用量。"
        : "已恢复原图背景。点击「生成图案」更新图案。",
    );
  }
  onMounted(() => {
    loadSample(true);
    window.addEventListener("keydown", shortcut);
    window.addEventListener("beforeunload", beforeUnload);
  });
  onBeforeUnmount(() => {
    if (sourceUrl.value) URL.revokeObjectURL(sourceUrl.value);
    window.removeEventListener("keydown", shortcut);
    window.removeEventListener("beforeunload", beforeUnload);
  });
  return {
    palette,
    pattern,
    source,
    sourceMask,
    backgroundOpen,
    backgroundPixels,
    height,
    pixelStyle,
    targetSize,
    sizeBudget,
    boardEstimate,
    setBoard,
    setSquareSize,
    applyBackground,
    crop,
    cropOpen,
    applyCrop,
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
    upload,
    loadSample,
    generate,
    start,
    paint,
    end,
    undo,
    redo,
    replace,
    save,
    openProject,
    exportImage,
    rename,
  };
}
