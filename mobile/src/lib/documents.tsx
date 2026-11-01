import { exportEditedPdf, getPdfPage, renderPdfPage, triggerPdfDownload, validatePdfFile } from "@/lib/pdf";
import { platform } from "@/lib/platform";
import { deleteLibraryDocument, LibraryDocumentSummary, listLibraryDocuments, loadLibraryDocument, renameLibraryDocument } from "@/lib/session";
import { stageEditorSession, stagePdfFile } from "@/lib/stagedFile";
import { useIonActionSheet, useIonAlert, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { FileText, MoreHorizontal } from "lucide-react";
import { ChangeEvent, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { haptic, isNative } from "./native";

/** Opens the system document picker, then the editor with an optional starting tool or action. */
export function usePdfPicker() {
  const router = useIonRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const intent = useRef("");
  const open = useCallback((query = "") => { haptic("light"); intent.current = query; inputRef.current?.click(); }, []);
  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const problem = validatePdfFile(file);
    if (problem) { haptic("warning"); toast.error(problem); return; }
    stagePdfFile(file);
    router.push(`/editor${intent.current}`);
  };
  const input = <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={onChange} />;
  return { open, input };
}

/** The on-device library. Tabs stay mounted in Ionic, so it reloads whenever the screen is shown. */
export function useLibrary() {
  const [documents, setDocuments] = useState<LibraryDocumentSummary[] | null>(null);
  const refresh = useCallback(async () => {
    try { setDocuments(await listLibraryDocuments()); } catch { setDocuments([]); }
  }, []);
  useIonViewWillEnter(() => { void refresh(); });
  return { documents, refresh };
}

export const documentSize = (document: LibraryDocumentSummary) => document.sources.reduce((total, source) => total + source.bytes.byteLength, 0);
export const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
export const relativeDate = (time: number) => {
  const days = Math.floor((Date.now() - time) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : days < 7 ? `${days} days ago` : new Date(time).toLocaleDateString();
};

export function DocThumb({ document, className = "" }: { document: LibraryDocumentSummary; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const rendered = useRef("");
  const ref = useCallback((canvas: HTMLCanvasElement | null) => {
    canvasRef.current = canvas;
    const page = document.pages[0];
    const source = document.sources.find(item => item.id === page?.sourceId);
    const key = `${document.id}:${document.savedAt}`;
    if (!canvas || rendered.current === key) return;
    if (!page || !source || page.sourceIndex === undefined) { setFailed(true); return; }
    rendered.current = key;
    void getPdfPage(source, page.sourceIndex).then(pdfPage => renderPdfPage(pdfPage, canvas, page.rotation, .3)).catch(() => setFailed(true));
  }, [document]);
  return (
    <span className={`relative block overflow-hidden rounded-lg bg-white shadow-[0_0_0_1px_rgba(23,32,51,.08),0_10px_18px_-10px_rgba(23,32,51,.45)] ${className}`}>
      {failed ? <span className="grid h-full w-full place-items-center bg-[#eef4ff] text-[#326ad8]"><FileText className="h-5 w-5" /></span> : <canvas ref={ref} className="h-full w-full object-cover object-top" />}
    </span>
  );
}

/** Open / share / rename / delete for a library document, using native action sheets and alerts. */
export function useDocumentActions(refresh: () => Promise<void>) {
  const router = useIonRouter();
  const [presentSheet] = useIonActionSheet();
  const [presentAlert] = useIonAlert();

  const openDocument = async (id: string) => {
    haptic("light");
    const document = await loadLibraryDocument(id);
    if (!document) return toast.error("That document is no longer on this device.");
    stageEditorSession(document);
    router.push("/editor");
  };
  const share = async (id: string) => {
    const toastId = toast.loading("Preparing PDF…");
    try {
      const document = await loadLibraryDocument(id);
      if (!document) throw new Error("missing");
      const bytes = await exportEditedPdf(document);
      const name = `${document.fileName || "document"}.pdf`;
      if (platform.savePdf) await platform.savePdf(bytes, name); else triggerPdfDownload(bytes, name);
      toast.dismiss(toastId);
    } catch { toast.error("We couldn't export that document.", { id: toastId }); }
  };
  const rename = (document: LibraryDocumentSummary) => void presentAlert({
    header: "Rename document",
    inputs: [{ name: "name", type: "text", value: document.fileName, attributes: { "aria-label": "Document name", enterkeyhint: "done" } }],
    buttons: [{ text: "Cancel", role: "cancel" }, {
      text: "Save", handler: (data: { name?: string }) => {
        const name = data.name?.trim();
        if (!name) return false;
        void renameLibraryDocument(document.id, name).then(() => { haptic("success"); return refresh(); });
      },
    }],
  });
  const remove = (document: LibraryDocumentSummary) => { haptic("warning"); void presentAlert({
    header: "Delete this document?",
    message: "This removes the document and its edits from this device. It can't be undone.",
    buttons: [{ text: "Cancel", role: "cancel" }, {
      text: "Delete", role: "destructive", handler: () => {
        void deleteLibraryDocument(document.id).then(() => { haptic("medium"); toast.success("Document removed from this device."); return refresh(); });
      },
    }],
  }); };

  // Each choice runs only after the sheet has fully closed. Opening an alert while the sheet is still
  // animating out stacks two overlays, which can leave the app hidden from screen readers.
  const showActions = (document: LibraryDocumentSummary) => {
    haptic("light");
    void presentSheet({
      header: document.fileName,
      buttons: [
        { text: "Open in editor", data: { action: "open" } },
        { text: isNative() ? "Share or save PDF" : "Download PDF", data: { action: "share" } },
        { text: "Rename", data: { action: "rename" } },
        { text: "Delete", role: "destructive", data: { action: "delete" } },
        { text: "Cancel", role: "cancel" },
      ],
      onDidDismiss: ({ detail }) => {
        const action = (detail.data as { action?: string } | undefined)?.action;
        if (action === "open") void openDocument(document.id);
        if (action === "share") void share(document.id);
        if (action === "rename") rename(document);
        if (action === "delete") remove(document);
      },
    });
  };
  return { openDocument, showActions };
}

export function DocumentRow({ document, onOpen, onMore }: { document: LibraryDocumentSummary; onOpen: () => void; onMore: () => void }) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <button type="button" onClick={onOpen} className="app-press flex min-w-0 flex-1 items-center gap-3.5 text-left">
        <DocThumb document={document} className="h-[60px] w-[46px] shrink-0" />
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-[#172033]">{document.fileName}</span>
          <span className="mt-1 block text-[13px] text-slate-500">{document.pages.length} page{document.pages.length === 1 ? "" : "s"} · {formatBytes(documentSize(document))} · {relativeDate(document.savedAt)}</span>
        </span>
      </button>
      <button type="button" onClick={onMore} aria-label={`More actions for ${document.fileName}`} className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-400 active:bg-slate-100"><MoreHorizontal className="h-5 w-5" /></button>
    </div>
  );
}
