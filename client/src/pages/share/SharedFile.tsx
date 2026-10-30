import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { FileFull } from "../../lib/types";
import FileEditor, { EditorLoading } from "../../components/app/editor/FileEditor";
import { useApplyTheme } from "../../lib/theme";

export default function SharedFile() {
  useApplyTheme();
  const { token = "" } = useParams();
  const [file, setFile] = useState<FileFull | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    api.share.open(token).then(setFile).catch(() => setErr("This link is invalid or sharing has been turned off."));
  }, [token]);
  useEffect(() => {
    if (file) document.title = `${file.title} · easydraw`;
  }, [file]);
  if (err) return <div className="ed flex min-h-screen items-center justify-center bg-[var(--bg)] p-10 text-[var(--fg-muted)]">{err}</div>;
  if (!file) return <div className="ed min-h-screen bg-[var(--bg)]"><EditorLoading /></div>;
  return <FileEditor file={file} shareToken={token} canEdit={file.access === "edit"} />;
}
