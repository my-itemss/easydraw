import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import type { CanvasElement, DiagramType, FileContent } from "./types";

export const uid = (n = 10) => {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => (b % 36).toString(36)).join("");
};

export const emptyContent = (title = "Untitled"): FileContent => ({
  doc: `# ${title}\n\n`,
  canvas: { elements: [] },
});

export function diagramElement(diagramType: DiagramType, code: string, title?: string, at = { x: 80, y: 80 }): CanvasElement {
  return { id: uid(), kind: "diagram", diagramType, code, title, x: at.x, y: at.y, w: 640, h: 420 };
}

export function contentWithDiagram(diagramType: DiagramType, code: string, title = "Untitled"): FileContent {
  const el = diagramElement(diagramType, code, title);
  return {
    doc: `# ${title}\n\nDescribe the design here. The diagram below is live – edit its code on the canvas and this view updates.\n\n\`\`\`diagram:${el.id}\n\`\`\`\n`,
    canvas: { elements: [el] },
  };
}

export interface PendingDiagram {
  title: string;
  diagramType: DiagramType;
  code: string;
}

/** Marketing pages (DiagramGPT, generators, examples) call this to hand a diagram to the editor as a new file. */
export function useOpenInEditor() {
  const navigate = useNavigate();
  return useCallback(
    async (p: PendingDiagram) => {
      const file = await api.files.create({ title: p.title, content: contentWithDiagram(p.diagramType, p.code, p.title) });
      navigate(`/app/f/${file.id}`);
    },
    [navigate],
  );
}
