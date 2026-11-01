import { App as CapacitorApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { IonApp, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, useIonRouter } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { FolderOpen, Home as HomeIcon, LayoutGrid, Plus, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, Route } from "react-router-dom";
import { usePdfPicker } from "./lib/documents";
import { getFlag, isNative } from "./lib/native";
import Account from "./pages/Account";
import Admin from "./pages/Admin";
import AuthScreen from "./pages/AuthScreen";
import Editor from "./pages/Editor";
import Home from "./pages/Home";
import Library from "./pages/Library";
import Onboarding from "./pages/Onboarding";
import Tools from "./pages/Tools";

/**
 * Home · Library · [ + ] · Tools · Account. Ionic's tab bar only renders tab buttons, so the bar
 * reserves an empty center slot (see app.css) and the + floats over it.
 */
function Tabs() {
  const picker = usePdfPicker();
  const tab = (name: string, label: string, Icon: typeof HomeIcon) => (
    <IonTabButton tab={name} href={`/tabs/${name}`} className="app-tab-button">
      <span className="app-tab-pill"><Icon className="h-[21px] w-[21px]" /></span>
      <IonLabel>{label}</IonLabel>
    </IonTabButton>
  );
  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route path="/tabs/home" element={<Home />} />
        <Route path="/tabs/library" element={<Library />} />
        <Route path="/tabs/tools" element={<Tools />} />
        <Route path="/tabs/account" element={<Account />} />
        <Route path="/tabs" element={<Navigate to="/tabs/home" replace />} />
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="app-tabbar">
        {tab("home", "Home", HomeIcon)}
        {tab("library", "Library", FolderOpen)}
        {tab("tools", "Tools", LayoutGrid)}
        {tab("account", "Account", UserRound)}
      </IonTabBar>
      {/* Lives inside IonTabs so it shares the tab bar's stacking context and floats above it. */}
      <div slot="bottom" className="app-tab-fab">
        {picker.input}
        <button type="button" onClick={() => picker.open()} aria-label="Open a PDF" className="app-fab grid h-[56px] w-[56px] place-items-center rounded-[20px] text-white"><Plus className="h-7 w-7" strokeWidth={2.5} /></button>
        <span className="mt-1 text-[10.5px] font-semibold text-[#326ad8]">Open</span>
      </div>
    </IonTabs>
  );
}

/** Android back: Ionic pops pages itself; on a root screen we minimise instead of closing. */
function HardwareBack() {
  const router = useIonRouter();
  useEffect(() => {
    const onBack = (event: Event) => (event as CustomEvent<{ register: (priority: number, handler: () => void) => void }>).detail.register(-1, () => {
      if (!router.canGoBack()) void CapacitorApp.minimizeApp();
    });
    document.addEventListener("ionBackButton", onBack);
    return () => document.removeEventListener("ionBackButton", onBack);
  }, [router]);
  return null;
}

export default function App() {
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  useEffect(() => { void getFlag("onboarded").then(value => setOnboarded(value === "1")); }, []);
  useEffect(() => { if (onboarded !== null && isNative()) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined); }, [onboarded]);
  if (onboarded === null) return <div className="h-full bg-[#0f172a]" />;

  return (
    <IonApp>
      <IonReactRouter>
        <HardwareBack />
        <IonRouterOutlet>
          <Route path="/welcome" element={<Onboarding />} />
          <Route path="/signin" element={<AuthScreen mode="signin" />} />
          <Route path="/signup" element={<AuthScreen mode="signup" />} />
          <Route path="/tabs/*" element={<Tabs />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/" element={<Navigate to={onboarded ? "/tabs/home" : "/welcome"} replace />} />
          <Route path="*" element={<Navigate to="/tabs/home" replace />} />
        </IonRouterOutlet>
      </IonReactRouter>
    </IonApp>
  );
}
