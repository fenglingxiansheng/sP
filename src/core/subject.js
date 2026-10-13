// One worker per editor; terminating it cancels downloads and inference immediately.
export function createSubjectRemover() {
  let worker, rejectPending;
  function cancel() {
    worker?.terminate();
    worker = null;
    rejectPending?.(new Error("已取消自动抠图，原有修改已保留。"));
    rejectPending = null;
  }
  return {
    cancel,
    run(source, progress) {
      worker ??= new Worker(new URL("./subject.worker.js", import.meta.url), {
        type: "module",
      });
      return new Promise((resolve, reject) => {
        rejectPending = reject;
        worker.onmessage = ({ data }) => {
          if (data.status) {
            progress(data.status);
            return;
          }
          rejectPending = null;
          if (data.error) {
            cancel();
            reject(new Error(data.error));
          } else resolve(data.mask);
        };
        worker.onerror = () => {
          rejectPending = null;
          cancel();
          reject(new Error("推理引擎加载失败，请刷新重试或使用手动工具。"));
        };
        worker.postMessage({
          source: {
            width: source.width,
            height: source.height,
            data: source.data,
          },
          modelUrl: new URL(
            `${import.meta.env.BASE_URL}models/isnetis.onnx`,
            document.baseURI,
          ).href,
        });
      });
    },
  };
}
