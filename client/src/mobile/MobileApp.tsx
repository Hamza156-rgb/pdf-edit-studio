import { App as CapacitorApp } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";
import { useEffect, useState } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { getFlag, isNative } from "@/lib/native";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/NotFound";
import PdfEditor from "@/pages/PdfEditor";
import AuthScreen from "./AuthScreen";
import Onboarding from "./Onboarding";
import { AccountTab, HomeTab, LibraryTab } from "./Tabs";

const ROOT_PATHS = new Set(["/", "/welcome"]);

/** The Capacitor app: onboarding → sign in/up (or guest) → tabbed workspace, sharing the website's editor. */
export default function MobileApp() {
  const [location, setLocation] = useLocation();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => { void getFlag("onboarded").then(value => setOnboarded(value === "1")); }, []);
  useEffect(() => { if (onboarded !== null && isNative()) void SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => undefined); }, [onboarded]);

  // Android hardware back: go back inside the app, leave it from a root screen.
  useEffect(() => {
    if (!isNative()) return;
    const listener = CapacitorApp.addListener("backButton", () => {
      if (ROOT_PATHS.has(window.location.pathname)) void CapacitorApp.minimizeApp();
      else window.history.back();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, []);

  if (onboarded === null) return <div className="min-h-[100dvh] bg-[#111827]" />;
  const publicPath = location === "/welcome" || location === "/signin" || location === "/signup";
  if (!onboarded && !publicPath) return <Redirect to="/welcome" />;

  return (
    <Switch>
      <Route path="/welcome"><Onboarding onDone={() => setOnboarded(true)} /></Route>
      <Route path="/signin"><AuthScreen mode="signin" onDone={() => { setOnboarded(true); setLocation("/"); }} /></Route>
      <Route path="/signup"><AuthScreen mode="signup" onDone={() => { setOnboarded(true); setLocation("/"); }} /></Route>
      <Route path="/" component={HomeTab} />
      <Route path="/library" component={LibraryTab} />
      <Route path="/account" component={AccountTab} />
      <Route path="/editor" component={PdfEditor} />
      <Route path="/admin" component={Admin} />
      {/* Website paths that shared pages link to. */}
      <Route path="/dashboard"><Redirect to="/" /></Route>
      <Route path="/profile"><Redirect to="/account" /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}
