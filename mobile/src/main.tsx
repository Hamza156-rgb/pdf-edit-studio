import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { configurePlatform } from "@/lib/platform";
import { trpc } from "@/lib/trpc";
import { setupIonicReact } from "@ionic/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { API_BASE, getToken, loadStoredToken, nativePlatform } from "./lib/native";

import "./theme/app.css";

setupIonicReact();
// The shared editor and auth code call these hooks instead of importing Capacitor directly.
configurePlatform(nativePlatform);

const queryClient = new QueryClient();
const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_BASE}/api/trpc`,
      transformer: superjson,
      // The app authenticates with its stored bearer token only, never cookies.
      headers() {
        const token = getToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        return globalThis.fetch(input, { ...(init ?? {}), credentials: "omit" });
      },
    }),
  ],
});

async function bootstrap() {
  document.documentElement.classList.add("app-shell");
  await loadStoredToken();
  createRoot(document.getElementById("root")!).render(
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster position="top-center" offset="calc(var(--app-safe-top) + 12px)" />
          <App />
        </TooltipProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

void bootstrap();
