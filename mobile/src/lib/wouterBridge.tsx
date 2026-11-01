import { useIonRouter } from "@ionic/react";
import { ReactNode, useCallback } from "react";
import { useLocation as useRouterLocation } from "react-router-dom";
import { Router as WouterRouter } from "wouter";

/**
 * The editor and admin screens are shared with the website, which navigates with wouter.
 * This bridge runs them on Ionic's router instead, and maps website paths to app screens.
 */
function useIonicLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const location = useRouterLocation();
  const ionRouter = useIonRouter();
  const navigate = useCallback((to: string) => {
    const path = to.split("?")[0];
    if (path === "/" || path === "/dashboard") return ionRouter.canGoBack() ? ionRouter.goBack() : ionRouter.navigateRoot("/tabs/home");
    if (path === "/profile") return ionRouter.push("/tabs/account", "back");
    if (path === "/account") return ionRouter.push(to.includes("login") ? "/signin" : "/signup");
    ionRouter.push(to);
  }, [ionRouter]);
  return [location.pathname, navigate];
}

export function WouterBridge({ children }: { children: ReactNode }) {
  return <WouterRouter hook={useIonicLocation}>{children}</WouterRouter>;
}
