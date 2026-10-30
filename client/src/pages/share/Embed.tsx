import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { FileFull } from "../../lib/types";
import FileEditor, { EditorLoading } from "../../components/app/editor/FileEditor";
import { useTheme } from "../../lib/theme";

export default function Embed() {
  const { token = "" } = useParams();
  const [sp] = useSearchParams();
  const { setPref } = useTheme();
  const [file, setFile] = useState<FileFull | null>(null);
  const [err, setErr] = useState(false);
  const t = sp.get("theme");
  useEffect(() => {
    if (t === "dark" || t === "light") setPref(t);
  }, [t, setPref]);
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", t === "dark");
    return () => root.classList.remove("dark");
  }, [t]);
  useEffect(() => {
    api.share.open(token).then(setFile).catch(() => setErr(true));
  }, [token]);
  if (err) return <div className="ed flex h-screen items-center justify-center bg-[var(--bg)] text-sm text-[var(--fg-muted)]">Not available</div>;
  if (!file) return <div className="ed h-screen bg-[var(--bg)]"><EditorLoading /></div>;
  return <FileEditor file={file} shareToken={token} canEdit={false} embed />;
}
