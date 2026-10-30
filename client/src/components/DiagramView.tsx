import { useMemo } from "react";
import { renderDiagram } from "../lib/engine";
import type { DiagramType } from "../lib/types";
import { useTheme } from "../lib/theme";

/**
 * Renders diagram-as-code to inline SVG (client side, via the engine).
 * The SVG scales to the container width; set `maxHeight` to cap it.
 */
export default function DiagramView({
  code,
  type,
  theme,
  className,
  maxHeight,
  showErrors = false,
}: {
  code: string;
  type: DiagramType;
  theme?: "light" | "dark";
  className?: string;
  maxHeight?: number | string;
  showErrors?: boolean;
}) {
  const ctx = useTheme();
  const t = theme ?? ctx.theme;
  const result = useMemo(() => renderDiagram(code, type, { theme: t }), [code, type, t]);
  const errors = result.diagnostics.filter((d) => d.severity === "error");
  return (
    <div className={className}>
      <div
        className="[&>svg]:h-auto [&>svg]:w-full [&>svg]:max-w-full"
        style={{ maxHeight, overflow: maxHeight ? "hidden" : undefined }}
        dangerouslySetInnerHTML={{ __html: result.svg }}
      />
      {showErrors && errors.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-red-500">
          {errors.slice(0, 4).map((e, i) => (
            <li key={i}>
              Line {e.line}: {e.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
