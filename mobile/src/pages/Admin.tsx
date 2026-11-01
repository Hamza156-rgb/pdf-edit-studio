import AdminConsole from "@/pages/Admin";
import { IonContent, IonPage } from "@ionic/react";
import { WouterBridge } from "../lib/wouterBridge";

/** The website's admin console (admins only), shown as a pushed Ionic page. */
export default function Admin() {
  return (
    <IonPage>
      <IonContent className="app-admin-content">
        <div className="app-safe-top bg-white" />
        <WouterBridge><AdminConsole /></WouterBridge>
      </IonContent>
    </IonPage>
  );
}
