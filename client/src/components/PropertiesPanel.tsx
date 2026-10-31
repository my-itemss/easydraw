import { useMemo, useState, type ReactNode } from "react";
import {
  LuAlignCenter, LuAlignCenterHorizontal, LuAlignCenterVertical, LuAlignEndHorizontal, LuAlignEndVertical, LuAlignHorizontalSpaceAround,
  LuAlignLeft, LuAlignRight, LuAlignStartHorizontal, LuAlignStartVertical, LuAlignVerticalSpaceAround, LuArrowDownToLine, LuArrowUpToLine,
  LuBringToFront, LuChevronDown, LuCopyPlus, LuGroup, LuLock, LuLockOpen, LuSendToBack, LuTrash2, LuUngroup,
} from "react-icons/lu";
import { getSelected, useApp } from "../store";
import { BG_COLORS, BG_MORE, STROKE_COLORS, STROKE_MORE } from "../lib/colors";
import type { Arrowhead, El, FillStyle, FontFamily, Style, TextAlign, ToolType } from "../types";

const toolTypes = (t: ToolType): Set<string> => (["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "text"].includes(t) ? new Set([t]) : new Set());

/* ---------- tiny inline icons ---------- */
const Svg = ({ children }: { children: ReactNode }) => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const WidthIcon = ({ w }: { w: number }) => <Svg><path d="M4 11h14" strokeWidth={w} /></Svg>;
const DashIcon = ({ d }: { d?: string }) => <Svg><path d="M3 11h16" strokeWidth={2} strokeDasharray={d} /></Svg>;
const RoughIcon = ({ n }: { n: number }) => (
  <Svg>
    <path strokeWidth={1.7} d={n === 0 ? "M3 13 L19 9" : n === 1 ? "M3 13 C7 8 10 15 14 10 S18 10 19 9" : "M3 14 C5 6 8 17 11 8 S14 15 16 7 S19 11 19 9"} />
  </Svg>
);
const EdgeIcon = ({ round }: { round: boolean }) => <Svg><path strokeWidth={1.8} d={round ? "M5 17V11a6 6 0 0 1 6-6h6" : "M5 17V5h12"} /></Svg>;
const FillIcon = ({ k }: { k: FillStyle }) => (
  <Svg>
    <rect x="4" y="4" width="14" height="14" rx="2" strokeWidth={1.4} />
    {k === "hachure" && <path strokeWidth={1.3} d="M7 18 L18 7 M4 13 L13 4 M10 18 L18 10" />}
    {k === "cross-hatch" && <path strokeWidth={1.1} d="M7 18 L18 7 M4 13 L13 4 M10 18 L18 10 M4 9 L9 14 M9 4 L18 13 M4 16 L8 20 M12 4 L18 10" />}
    {k === "solid" && <rect x="5" y="5" width="12" height="12" rx="1" fill="currentColor" stroke="none" />}
  </Svg>
);
export const HeadIcon = ({ k, flip }: { k: Arrowhead; flip?: boolean }) => (
  <svg width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={flip ? { transform: "scaleX(-1)" } : undefined}>
    <path d="M3 11h16" />
    {k === "arrow" && <path d="M14 5l7 6-7 6" />}
    {k === "triangle" && <path d="M22 11l-9-5.5v11z" fill="currentColor" />}
    {k === "dot" && <circle cx="20" cy="11" r="3.2" fill="currentColor" />}
    {k === "bar" && <path d="M21 5v12" />}
    {k === "none" && <path d="M19 6l3 10" strokeWidth="0" />}
  </svg>
);

/* ---------- building blocks ---------- */
function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><div className="field-label">{label}</div>{children}</div>;
}

function Options<T extends string | number | boolean>({ value, items, onChange }: { value: T; items: { v: T; icon: ReactNode; tip: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button key={String(it.v)} className={`seg-btn ${value === it.v ? "on" : ""}`} data-tip={it.tip} aria-label={it.tip} aria-pressed={value === it.v} onClick={() => onChange(it.v)}>{it.icon}</button>
      ))}
    </div>
  );
}

function Swatch({ c, active, onClick }: { c: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`swatch ${active ? "on" : ""} ${c === "transparent" ? "none" : ""}`} style={{ background: c === "transparent" ? undefined : c }} onClick={onClick} aria-label={c} data-tip={c === "transparent" ? "Transparent" : c} />
  );
}

function ColorField({ label, value, quick, more, onChange }: { label: string; value: string; quick: string[]; more: string[]; onChange: (c: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(value);
  const commitHex = (v: string) => { setHex(v); if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v); };
  return (
    <Field label={label}>
      <div className="swatch-row">
        {quick.map((c) => <Swatch key={c} c={c} active={value === c} onClick={() => { onChange(c); setHex(c); }} />)}
        <span className="vsep" />
        <button className={`swatch current ${open ? "open" : ""} ${value === "transparent" ? "none" : ""}`} style={{ background: value === "transparent" ? undefined : value }} onClick={() => setOpen(!open)} aria-label="More colors" data-tip="More colors"><LuChevronDown /></button>
      </div>
      {open && (
        <div className="more-colors">
          <div className="swatch-grid">
            {more.map((c) => <Swatch key={c} c={c} active={value === c} onClick={() => { onChange(c); setHex(c); }} />)}
          </div>
          <div className="hex-row">
            <input className="hex" value={hex === "transparent" ? "" : hex} placeholder="#hex" maxLength={7} onChange={(e) => commitHex(e.target.value)} spellCheck={false} />
            <label className="native-color" data-tip="Pick any color">
              <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#000000"} onChange={(e) => commitHex(e.target.value)} />
            </label>
          </div>
        </div>
      )}
    </Field>
  );
}

const IconBtn = ({ tip, onClick, children, danger, on }: { tip: string; onClick: () => void; children: ReactNode; danger?: boolean; on?: boolean }) => (
  <button className={`seg-btn solo ${danger ? "danger" : ""} ${on ? "on" : ""}`} data-tip={tip} aria-label={tip} onClick={onClick}>{children}</button>
);

/* ---------- panel ---------- */
export default function PropertiesPanel() {
  const style = useApp((s) => s.style);
  const tool = useApp((s) => s.tool);
  const elements = useApp((s) => s.elements);
  const selected = useApp((s) => s.selected);
  const editing = useApp((s) => s.editing);
  const apply = useApp((s) => s.applyStyle);
  const st = useApp.getState;
  const sel = useMemo(() => getSelected({ elements, selected }), [elements, selected]);
  const first: El | undefined = sel[0];

  const types = sel.length ? new Set(sel.map((e) => e.type)) : toolTypes(tool);
  if (!types.size || editing) return null;
  const has = (...t: string[]) => t.some((x) => types.has(x));
  const shapes = has("rectangle", "diamond", "ellipse");
  const linear = has("arrow", "line");
  const v = <K extends keyof Style>(k: K): Style[K] => (first && (first as unknown as Style)[k] !== undefined ? ((first as unknown as Style)[k] as Style[K]) : style[k]);
  const hasText = has("text");
  const multi = sel.length > 1;
  const allLocked = sel.length > 0 && sel.every((e) => e.locked);

  return (
    <aside className="island panel" aria-label="Properties">
      {!has("image") && <ColorField label="Stroke" value={v("strokeColor")} quick={STROKE_COLORS} more={STROKE_MORE} onChange={(c) => apply({ strokeColor: c })} />}
      {shapes && <ColorField label="Background" value={v("backgroundColor")} quick={BG_COLORS} more={BG_MORE} onChange={(c) => apply({ backgroundColor: c })} />}
      {shapes && v("backgroundColor") !== "transparent" && (
        <Field label="Fill">
          <Options value={v("fillStyle")} onChange={(x) => apply({ fillStyle: x })} items={[
            { v: "hachure", icon: <FillIcon k="hachure" />, tip: "Hachure" },
            { v: "cross-hatch", icon: <FillIcon k="cross-hatch" />, tip: "Cross-hatch" },
            { v: "solid", icon: <FillIcon k="solid" />, tip: "Solid" },
          ]} />
        </Field>
      )}
      {(shapes || linear || has("freedraw")) && (
        <Field label="Stroke width">
          <Options value={v("strokeWidth")} onChange={(x) => apply({ strokeWidth: x })} items={[
            { v: 1, icon: <WidthIcon w={1.2} />, tip: "Thin" }, { v: 2, icon: <WidthIcon w={2.6} />, tip: "Bold" }, { v: 4, icon: <WidthIcon w={4.6} />, tip: "Extra bold" },
          ]} />
        </Field>
      )}
      {(shapes || linear) && (
        <>
          <Field label="Stroke style">
            <Options value={v("strokeStyle")} onChange={(x) => apply({ strokeStyle: x })} items={[
              { v: "solid", icon: <DashIcon />, tip: "Solid" }, { v: "dashed", icon: <DashIcon d="4 4" />, tip: "Dashed" }, { v: "dotted", icon: <DashIcon d="0.1 4.5" />, tip: "Dotted" },
            ]} />
          </Field>
          <Field label="Sloppiness">
            <Options value={v("roughness")} onChange={(x) => apply({ roughness: x })} items={[
              { v: 0, icon: <RoughIcon n={0} />, tip: "Architect" }, { v: 1, icon: <RoughIcon n={1} />, tip: "Artist" }, { v: 2, icon: <RoughIcon n={2} />, tip: "Cartoonist" },
            ]} />
          </Field>
          <Field label="Edges">
            <Options value={v("rounded")} onChange={(x) => apply({ rounded: x })} items={[
              { v: false, icon: <EdgeIcon round={false} />, tip: "Sharp" }, { v: true, icon: <EdgeIcon round />, tip: "Round" },
            ]} />
          </Field>
        </>
      )}
      {has("arrow") && (
        <Field label="Arrowheads">
          <div className="heads">
            <HeadPicker value={v("startArrowhead")} flip onChange={(x) => apply({ startArrowhead: x })} />
            <HeadPicker value={v("endArrowhead")} onChange={(x) => apply({ endArrowhead: x })} />
          </div>
        </Field>
      )}
      {hasText && (
        <>
          <Field label="Font family">
            <Options value={v("fontFamily")} onChange={(x: FontFamily) => apply({ fontFamily: x })} items={[
              { v: "hand", icon: <span className="ff hand">Aa</span>, tip: "Hand-drawn" }, { v: "normal", icon: <span className="ff normal">Aa</span>, tip: "Normal" }, { v: "code", icon: <span className="ff code">{"</>"}</span>, tip: "Code" },
            ]} />
          </Field>
          <Field label="Font size">
            <Options value={v("fontSize")} onChange={(x) => apply({ fontSize: x })} items={[
              { v: 18, icon: <b className="fs">S</b>, tip: "Small" }, { v: 24, icon: <b className="fs">M</b>, tip: "Medium" }, { v: 32, icon: <b className="fs">L</b>, tip: "Large" }, { v: 44, icon: <b className="fs">XL</b>, tip: "Very large" },
            ]} />
          </Field>
          <Field label="Text align">
            <Options value={v("textAlign")} onChange={(x: TextAlign) => apply({ textAlign: x })} items={[
              { v: "left", icon: <LuAlignLeft />, tip: "Left" }, { v: "center", icon: <LuAlignCenter />, tip: "Center" }, { v: "right", icon: <LuAlignRight />, tip: "Right" },
            ]} />
          </Field>
        </>
      )}
      <Field label={`Opacity · ${v("opacity")}`}>
        <input
          className="range" type="range" min={0} max={100} step={5} value={v("opacity")}
          onPointerDown={(e) => { (e.currentTarget as HTMLInputElement & { _b?: unknown })._b = st().snapshot(); }}
          onChange={(e) => apply({ opacity: +e.target.value }, true)}
          onPointerUp={(e) => { const b = (e.currentTarget as HTMLInputElement & { _b?: ReturnType<typeof st>["past"][number] })._b; if (b) st().commit(b); }}
        />
      </Field>

      {sel.length > 0 && (
        <>
          <Field label="Layers">
            <div className="seg wrap">
              <IconBtn tip="Send to back" onClick={() => st().order("back")}><LuSendToBack /></IconBtn>
              <IconBtn tip="Send backward" onClick={() => st().order("backward")}><LuArrowDownToLine /></IconBtn>
              <IconBtn tip="Bring forward" onClick={() => st().order("forward")}><LuArrowUpToLine /></IconBtn>
              <IconBtn tip="Bring to front" onClick={() => st().order("front")}><LuBringToFront /></IconBtn>
            </div>
          </Field>
          {multi && (
            <Field label="Align">
              <div className="seg wrap">
                <IconBtn tip="Align left" onClick={() => st().align("left")}><LuAlignStartVertical /></IconBtn>
                <IconBtn tip="Center horizontally" onClick={() => st().align("centerH")}><LuAlignCenterVertical /></IconBtn>
                <IconBtn tip="Align right" onClick={() => st().align("right")}><LuAlignEndVertical /></IconBtn>
                <IconBtn tip="Align top" onClick={() => st().align("top")}><LuAlignStartHorizontal /></IconBtn>
                <IconBtn tip="Center vertically" onClick={() => st().align("centerV")}><LuAlignCenterHorizontal /></IconBtn>
                <IconBtn tip="Align bottom" onClick={() => st().align("bottom")}><LuAlignEndHorizontal /></IconBtn>
                {sel.length > 2 && <IconBtn tip="Distribute horizontally" onClick={() => st().distribute("h")}><LuAlignHorizontalSpaceAround /></IconBtn>}
                {sel.length > 2 && <IconBtn tip="Distribute vertically" onClick={() => st().distribute("v")}><LuAlignVerticalSpaceAround /></IconBtn>}
              </div>
            </Field>
          )}
          <Field label="Actions">
            <div className="seg wrap">
              <IconBtn tip="Duplicate — Ctrl+D" onClick={() => st().duplicate()}><LuCopyPlus /></IconBtn>
              {multi && <IconBtn tip="Group — Ctrl+G" onClick={() => st().group()}><LuGroup /></IconBtn>}
              {sel.some((e) => e.groupIds.length > 0) && <IconBtn tip="Ungroup — Ctrl+Shift+G" onClick={() => st().ungroup()}><LuUngroup /></IconBtn>}
              <IconBtn tip={allLocked ? "Unlock" : "Lock"} on={allLocked} onClick={() => st().toggleLock()}>{allLocked ? <LuLockOpen /> : <LuLock />}</IconBtn>
              <IconBtn tip="Delete — Del" danger onClick={() => st().removeSelected()}><LuTrash2 /></IconBtn>
            </div>
          </Field>
        </>
      )}
    </aside>
  );
}

function HeadPicker({ value, onChange, flip }: { value: Arrowhead; onChange: (v: Arrowhead) => void; flip?: boolean }) {
  const [open, setOpen] = useState(false);
  const kinds: Arrowhead[] = ["none", "arrow", "triangle", "dot", "bar"];
  return (
    <div className="head-picker">
      <button className="seg-btn solo wide" onClick={() => setOpen(!open)} data-tip={flip ? "Start arrowhead" : "End arrowhead"}>
        <HeadIcon k={value} flip={flip} /><LuChevronDown size={12} />
      </button>
      {open && (
        <div className="island head-menu">
          {kinds.map((k) => (
            <button key={k} className={`seg-btn ${value === k ? "on" : ""}`} onClick={() => { onChange(k); setOpen(false); }} data-tip={k}>
              {k === "none" ? <span className="none-lbl">none</span> : <HeadIcon k={k} flip={flip} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
