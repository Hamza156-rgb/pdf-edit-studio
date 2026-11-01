import { App as CapacitorApp } from "@capacitor/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { configurePlatform } from "@/lib/platform";
import { setupIonicReact } from "@ionic/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ME_QUERY_KEY, refreshSessionIfStale } from "./lib/auth";
import { isNative, loadStoredToken, nativePlatform } from "./lib/native";
import "./theme/app.css";

setupIonicReact();
// The shared editor calls these hooks instead of importing Capacitor directly.
configurePlatform(nativePlatform);

// The app talks to the server only through the REST API (/api/v1) with a bearer token.
const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } });

async function bootstrap() {
  document.documentElement.classList.add("app-shell");
  await loadStoredToken();
  // Renew the 30-day token in the background at launch and whenever the app returns to the foreground.
  const renew = () => void refreshSessionIfStale().then(() => queryClient.invalidateQueries({ queryKey: ME_QUERY_KEY }));
  renew();
  if (isNative()) void CapacitorApp.addListener("resume", renew);

  createRoot(document.getElementById("root")!).render(
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster position="top-center" offset="calc(var(--app-safe-top) + 12px)" />
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

void bootstrap();
