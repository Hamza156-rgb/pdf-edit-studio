import PdfEditor from "@/pages/PdfEditor";
import { IonPage } from "@ionic/react";
import { useLocation } from "react-router-dom";
import { WouterBridge } from "../lib/wouterBridge";

/**
 * The website's editor, mounted as a full-screen Ionic page. Ionic can reuse this page between
 * visits, so the editor is keyed to each navigation: every open starts fresh with the staged file
 * and the tool/action from the URL.
 */
export default function Editor() {
  const location = useLocation();
  return (
    <IonPage className="app-editor-page">
      <WouterBridge><PdfEditor key={location.key} /></WouterBridge>
    </IonPage>
  );
}
