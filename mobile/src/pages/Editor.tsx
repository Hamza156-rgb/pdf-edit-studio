import { IonPage } from "@ionic/react";
import { Loader2 } from "lucide-react";
import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { WouterBridge } from "../lib/wouterBridge";

// The editor (with pdf.js and pdf-lib) is a separate chunk; main.tsx preloads it right after launch.
export const loadPdfEditor = () => import("@/pages/PdfEditor");
const PdfEditor = lazy(loadPdfEditor);

/**
 * The website's editor, mounted as a full-screen Ionic page. Ionic can reuse this page between
 * visits, so the editor is keyed to each navigation: every open starts fresh with the staged file
 * and the tool/action from the URL.
 */
export default function Editor() {
  const location = useLocation();
  return (
    <IonPage className="app-editor-page">
      <WouterBridge><Suspense fallback={<div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-[#326ad8]" /></div>}><PdfEditor key={location.key} /></Suspense></WouterBridge>
    </IonPage>
  );
}
