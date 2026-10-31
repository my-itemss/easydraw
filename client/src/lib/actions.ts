import { getSelected, useApp } from "../store";
import { canvasToBlob, download, exportToCanvas, exportToSvg, parseScene, sceneToJson } from "./export";

const S = () => useApp.getState();

export function saveFile() {
  const s = S();
  if (!s.elements.some((e) => !e.isDeleted)) return s.showToast("Nothing to save yet");
  download(new Blob([sceneToJson(s.elements, s.canvasBg, s.grid)], { type: "application/json" }), "drawing.easydraw");
  s.showToast("Saved drawing.easydraw");
}

export async function openFile(file: File) {
  const sc = parseScene(await file.text());
  if (!sc) return S().showToast("That file isn't an Easydraw scene");
  S().loadScene(sc.elements, sc.appState.canvasBg, sc.appState.grid);
}

const target = () => {
  const s = S();
  const sel = getSelected(s);
  return sel.length ? sel : s.elements;
};

export async function copyPng() {
  const s = S();
  const c = await exportToCanvas(target(), { scale: 2, dark: s.theme === "dark", background: true, canvasBg: s.canvasBg });
  if (!c) return s.showToast("Nothing to copy");
  try {
    await navigator.clipboard.write([new ClipboardItem({ "image/png": await canvasToBlob(c) })]);
    s.showToast("Copied to clipboard as PNG");
  } catch { s.showToast("Clipboard access was blocked"); }
}

export async function exportPng(scale: number, background: boolean, dark: boolean, onlySelection = false) {
  const s = S();
  const els = onlySelection ? target() : s.elements;
  const c = await exportToCanvas(els, { scale, dark, background, canvasBg: s.canvasBg });
  if (!c) return s.showToast("Nothing to export");
  download(await canvasToBlob(c), "drawing.png");
}

export function exportSvg(scale: number, background: boolean, dark: boolean, onlySelection = false) {
  const s = S();
  const svg = exportToSvg(onlySelection ? target() : s.elements, { scale, dark, background, canvasBg: s.canvasBg });
  if (!svg) return s.showToast("Nothing to export");
  download(new Blob([svg], { type: "image/svg+xml" }), "drawing.svg");
}

export const hasContent = () => S().elements.some((e) => !e.isDeleted);
