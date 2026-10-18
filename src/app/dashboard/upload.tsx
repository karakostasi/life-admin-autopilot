"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import el from "@/messages/el.json";
import {
  discardUpload,
  extractUpload,
  saveDocument,
  type SaveState,
  type UploadResult,
} from "./upload-actions";

const field = "input";
const flagged = "border-orange-400 bg-orange-50";

// Μικραίνει τις φωτογραφίες (κινητό: 5-10MB) πριν ανέβουν. Τα PDF περνάνε ως έχουν.
async function prepare(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
    return blob ? new File([blob], "scan.jpg", { type: "image/jpeg" }) : file;
  } catch {
    return file;
  }
}

export function Upload() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("file", await prepare(file));
      const res = await extractUpload(fd);
      if (!res.ok && !res.path) setError(res.error);
      else setResult(res);
    });
  }

  function close(discard: boolean) {
    if (discard && result?.path) void discardUpload(result.path);
    setResult(null);
  }

  return (
    <section className="rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/60 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">{el.upload.title}</h2>
          <p className="text-sm text-slate-600">{el.upload.hint}</p>
        </div>
        <button
          type="button"
          disabled={pending || result !== null}
          onClick={() => inputRef.current?.click()}
          className="btn-primary"
        >
          {pending ? el.upload.reading : el.upload.choose}
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={onPick} className="hidden" />
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {result && <ReviewForm result={result} onClose={close} />}
    </section>
  );
}

function ReviewForm({ result, onClose }: { result: UploadResult; onClose: (discard: boolean) => void }) {
  const [state, action, saving] = useActionState<SaveState, FormData>(async (prev, fd) => {
    const res = await saveDocument(prev, fd);
    if (res.status === "ok") onClose(false);
    return res;
  }, { status: "idle" });

  const x = result.ok ? result.extraction : null;
  const lowDate = !x || !x.expires_on || x.confidence.expires_on < 0.8;
  const lowType = !!x && x.confidence.type < 0.6;
  const lowAmount = !!x && x.amount !== null && x.confidence.amount < 0.6;

  return (
    <form action={action} className="mt-5 flex flex-col gap-4 border-t border-indigo-200 pt-5">
      <div>
        <h3 className="font-semibold">{el.upload.reviewTitle}</h3>
        <p className="text-sm text-slate-600">{result.ok ? el.upload.reviewHint : `${result.error} ${el.upload.manualHint}`}</p>
        {result.ok && result.reasons.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-sm text-orange-700">
            {result.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
      </div>

      <input type="hidden" name="file_path" value={result.path ?? ""} />
      <input type="hidden" name="currency" value={x?.currency ?? "EUR"} />
      <input type="hidden" name="extraction" value={x ? JSON.stringify(x) : ""} />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          {el.upload.fields.title}
          <input name="title" required maxLength={120} defaultValue={x?.title ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.type}
          <select name="type" defaultValue={x?.type ?? "other"} className={`${field} ${lowType ? flagged : ""}`}>
            {Object.entries(el.types).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.expires_on}
          <input type="date" name="expires_on" defaultValue={x?.expires_on ?? ""} className={`${field} ${lowDate ? flagged : ""}`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.provider}
          <input name="provider" maxLength={120} defaultValue={x?.provider ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.identifier}
          <input name="identifier" maxLength={60} defaultValue={x?.identifier ?? ""} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.amount}
          <input name="amount" inputMode="decimal" defaultValue={x?.amount ?? ""} className={`${field} ${lowAmount ? flagged : ""}`} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          {el.upload.fields.recurrence}
          <select name="recurrence" defaultValue={x?.recurrence ?? "none"} className={field}>
            {Object.entries(el.upload.recurrence).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.status === "error" && <p className="text-sm text-red-600">{state.message}</p>}
      <div className="flex gap-3">
        <button disabled={saving} className="btn-dark">
          {saving ? el.upload.saving : el.upload.confirm}
        </button>
        <button type="button" onClick={() => onClose(true)} className="btn-secondary">
          {el.upload.cancel}
        </button>
      </div>
    </form>
  );
}
