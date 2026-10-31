export type ToolType =
  | "hand"
  | "selection"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "eraser";

export type Pt = [number, number];
export type ElType = "rectangle" | "diamond" | "ellipse" | "arrow" | "line" | "freedraw" | "text" | "image";
export type FillStyle = "hachure" | "cross-hatch" | "solid";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Arrowhead = "none" | "arrow" | "triangle" | "dot" | "bar";
export type FontFamily = "hand" | "normal" | "code";
export type TextAlign = "left" | "center" | "right";

export interface El {
  id: string;
  type: ElType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string; // "transparent" = no fill
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number; // 0 architect, 1 artist, 2 cartoonist
  opacity: number; // 0-100
  rounded: boolean;
  seed: number;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  groupIds: string[];
  locked: boolean;
  // linear + freedraw: points are relative to (x, y) which is the bbox top-left
  points?: Pt[];
  startArrowhead?: Arrowhead;
  endArrowhead?: Arrowhead;
  startBinding?: string | null;
  endBinding?: string | null;
  // text, and labels on shapes
  text?: string;
  fontSize?: number;
  fontFamily?: FontFamily;
  textAlign?: TextAlign;
  // image
  src?: string;
}

export interface Style {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  opacity: number;
  rounded: boolean;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
}

export interface Peer {
  id: string;
  name: string;
  color: string;
  x?: number;
  y?: number;
  selected?: string[];
}

export interface SceneFile {
  type: "easydraw";
  version: 1;
  elements: El[];
  appState: { canvasBg: string; grid: boolean };
}
