import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../lib/api";
import type { FileFull } from "../../lib/types";
import FileEditor, { EditorLoading } from "../../components/app/editor/FileEditor";
import { Button } from "../../components/ui";

export default function Editor() {
  const { id } = useParams();
  const [file, setFile] = useState<FileFull | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setFile(null);
    setErr(null);
    if (!id) return;
    api.files.get(id).then(setFile).catch((e) => setErr((e as Error).message));
  }, [id]);
  useEffect(() => {
    if (file) document.title = `${file.title} · easydraw`;
  }, [file]);
  if (err)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-semibold">Can't open this file</h1>
        <p className="mt-2 text-sm text-[var(--fg-muted)]">{err}</p>
        <Link to="/app"><Button className="mt-4">Back to files</Button></Link>
      </div>
    );
  if (!file) return <EditorLoading />;
  return <FileEditor key={file.id} file={file} canEdit={file.access !== "view" && !file.trashed} />;
}
