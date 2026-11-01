import { useAuth } from "../lib/auth";
import { BrandMark } from "@/components/Depth";
import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, RefresherEventDetail, useIonRouter, useIonViewWillEnter } from "@ionic/react";
import { UserRound } from "lucide-react";
import { ReactNode, useState } from "react";
import { haptic, setStatusBar } from "../lib/native";

/**
 * Frame for every tab: Ionic page with a custom header (logo, collapsing title, account button),
 * pull-to-refresh, and a centered content column that stays readable on tablets.
 */
export function TabPage({ title, subtitle, showAccountButton = true, onRefresh, children }: { title: string; subtitle?: string; showAccountButton?: boolean; onRefresh?: () => Promise<unknown>; children: ReactNode }) {
  const router = useIonRouter();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  useIonViewWillEnter(() => setStatusBar("light"));

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    try { await onRefresh?.(); } finally { event.detail.complete(); haptic("light"); }
  };

  return (
    <IonPage>
      <IonHeader className={`app-header ion-no-border transition-[background-color,box-shadow] duration-300 ${scrolled ? "app-header-scrolled" : ""}`}>
        <div className="app-content flex h-14 items-center gap-2.5">
          <BrandMark size="sm" />
          <div className="relative h-full min-w-0 flex-1">
            <span className={`absolute inset-0 flex items-center font-display text-[17px] font-semibold tracking-[-.03em] transition duration-300 ${scrolled ? "-translate-y-2 opacity-0" : "opacity-100"}`}>Editly</span>
            <span aria-hidden={!scrolled} className={`absolute inset-0 flex items-center truncate font-display text-[17px] font-semibold tracking-[-.03em] transition duration-300 ${scrolled ? "opacity-100" : "translate-y-2 opacity-0"}`}>{title}</span>
          </div>
          {showAccountButton && (
            <button type="button" onClick={() => { haptic("light"); router.push("/tabs/account", "none"); }} aria-label="Account" className="app-press grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-[#326ad8] shadow-[0_0_0_1px_rgba(23,32,51,.06),0_8px_18px_-12px_rgba(23,32,51,.5)]">
              {user?.name ? user.name.slice(0, 1).toUpperCase() : <UserRound className="h-[18px] w-[18px]" />}
            </button>
          )}
        </div>
      </IonHeader>
      <IonContent className="app-tab-content" scrollEvents onIonScroll={event => setScrolled(event.detail.scrollTop > 44)}>
        {onRefresh && <IonRefresher slot="fixed" onIonRefresh={event => void refresh(event)}><IonRefresherContent /></IonRefresher>}
        <main className="app-content pb-10">
          <div className="pb-4 pt-1">
            {subtitle && <p className="text-[13px] font-medium text-slate-500">{subtitle}</p>}
            <h1 className="font-display text-[1.85rem] font-semibold leading-tight tracking-[-.05em]">{title}</h1>
          </div>
          {children}
        </main>
      </IonContent>
    </IonPage>
  );
}
