import { useEffect } from "react";
import { useApp } from "./store";
import Canvas from "./components/Canvas";
import TextEditor from "./components/TextEditor";
import Toolbar from "./components/Toolbar";
import PropertiesPanel from "./components/PropertiesPanel";
import Dialogs from "./components/Dialogs";
import { MainMenu, ZoomControls, TopRight, Toast, Tooltip, Welcome } from "./components/Chrome";
import { roomFromHash, startCollab } from "./lib/collab";
import { refreshText } from "./lib/elements";
import { FONTS } from "./lib/text";

export default function App() {
  const theme = useApp((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#121212" : "#ffffff");
  }, [theme]);

  // fonts must be ready before text is measured
  useEffect(() => {
    Promise.all(Object.values(FONTS).map((f) => document.fonts.load(`20px ${f}`))).then(() => {
      const s = useApp.getState();
      s.setElements(s.elements.map((e) => (e.type === "text" && !e.isDeleted ? refreshText(e) : e)));
    });
  }, []);

  // join a session from the URL (#room=…)
  useEffect(() => {
    const r = roomFromHash();
    if (r) startCollab(r);
    const onHash = () => { const n = roomFromHash(); if (n && n !== useApp.getState().collab.room) startCollab(n); };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return (
    <div className="app">
      <div className="stage">
        <Canvas />
        <TextEditor />
      </div>
      <Welcome />
      <MainMenu />
      <Toolbar />
      <TopRight />
      <PropertiesPanel />
      <ZoomControls />
      <Dialogs />
      <Toast />
      <Tooltip />
    </div>
  );
}
