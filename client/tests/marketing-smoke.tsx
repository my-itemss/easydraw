// Run with: cd client && bun tests/marketing-smoke.tsx
import { renderToString } from "react-dom/server";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const g = globalThis as any;
g.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
g.sessionStorage ??= g.localStorage;
g.window ??= { matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), localStorage: g.localStorage };

const { ThemeProvider } = await import("../src/lib/theme");
const { AuthProvider } = await import("../src/lib/auth");
const { default: MarketingLayout } = await import("../src/components/marketing/MarketingLayout");
const pages: Record<string, any> = {
  "/product": (await import("../src/pages/marketing/ProductPage")).default,
  "/product/ai-diagrams": (await import("../src/pages/marketing/AiDiagramsPage")).default,
  "/product/diagram-as-code": (await import("../src/pages/marketing/DiagramAsCodePage")).default,
  "/product/api": (await import("../src/pages/marketing/ApiPage")).default,
  "/product/integrations": (await import("../src/pages/marketing/IntegrationsPage")).default,
  "/pricing": (await import("../src/pages/marketing/PricingPage")).default,
  "/enterprise": (await import("../src/pages/marketing/EnterprisePage")).default,
  "/examples": (await import("../src/pages/marketing/ExamplesPage")).default,
};

let failed = 0;
for (const [path, Page] of Object.entries(pages)) {
  try {
    const html = renderToString(
      <MemoryRouter initialEntries={[path]}>
        <ThemeProvider>
          <AuthProvider>
            <Routes>
              <Route element={<MarketingLayout />}>
                <Route path={path} element={<Page />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ThemeProvider>
      </MemoryRouter>,
    );
    if (!html.includes("<h1")) throw new Error("no h1");
    console.log("ok  ", path, html.length);
  } catch (e) {
    failed++;
    console.error("FAIL", path, e);
  }
}
process.exit(failed ? 1 : 0);
