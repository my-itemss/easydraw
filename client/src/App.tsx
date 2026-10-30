import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Canvas from "./pages/Canvas";
import { Home } from "./pages/Home";
import { ThemeProvider } from "./lib/theme";
import { AuthProvider } from "./lib/auth";
import MarketingLayout from "./components/marketing/MarketingLayout";
import AppLayout from "./components/app/AppLayout";
import ProductPage from "./pages/marketing/ProductPage";
import AiDiagramsPage from "./pages/marketing/AiDiagramsPage";
import DiagramAsCodePage from "./pages/marketing/DiagramAsCodePage";
import ApiPage from "./pages/marketing/ApiPage";
import IntegrationsPage from "./pages/marketing/IntegrationsPage";
import PricingPage from "./pages/marketing/PricingPage";
import EnterprisePage from "./pages/marketing/EnterprisePage";
import ExamplesPage from "./pages/marketing/ExamplesPage";
import DiagramGptPage from "./pages/marketing/DiagramGptPage";
import GeneratorPage from "./pages/marketing/GeneratorPage";
import DocsPage from "./pages/marketing/DocsPage";
import NotFoundPage from "./pages/marketing/NotFoundPage";
import Dashboard from "./pages/app/Dashboard";
import Editor from "./pages/app/Editor";
import Settings from "./pages/app/Settings";
import Team from "./pages/app/Team";
import SharedFile from "./pages/share/SharedFile";
import Embed from "./pages/share/Embed";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* original pages – untouched */}
            <Route path="/" element={<Home />} />
            <Route path="/canvas/:id" element={<Canvas />} />

            {/* marketing site */}
            <Route element={<MarketingLayout />}>
              <Route path="/product" element={<ProductPage />} />
              <Route path="/product/ai-diagrams" element={<AiDiagramsPage />} />
              <Route path="/product/diagram-as-code" element={<DiagramAsCodePage />} />
              <Route path="/product/api" element={<ApiPage />} />
              <Route path="/product/integrations" element={<IntegrationsPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/enterprise" element={<EnterprisePage />} />
              <Route path="/examples" element={<ExamplesPage />} />
              <Route path="/diagramgpt" element={<DiagramGptPage />} />
              <Route path="/ai/:slug" element={<GeneratorPage />} />
              <Route path="/docs" element={<DocsPage />} />
              <Route path="/docs/:slug" element={<DocsPage />} />
            </Route>

            {/* signed-in app */}
            <Route element={<AppLayout />}>
              <Route path="/app" element={<Dashboard />} />
              <Route path="/app/f/:id" element={<Editor />} />
              <Route path="/app/settings" element={<Settings />} />
              <Route path="/app/team" element={<Team />} />
            </Route>

            {/* public share + embed */}
            <Route path="/s/:token" element={<SharedFile />} />
            <Route path="/embed/:token" element={<Embed />} />

            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="/login" element={<Navigate to="/app" replace />} />
            <Route path="/signup" element={<Navigate to="/app" replace />} />
            <Route element={<MarketingLayout />}>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
export default App;
