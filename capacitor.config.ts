import type { CapacitorConfig } from "@capacitor/cli";

// Live reload during development: CAP_SERVER_URL=http://<your-computer-ip>:3000 pnpm cap run android
const liveReloadUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.editly.app",
  appName: "Editly",
  webDir: "dist/public",
  backgroundColor: "#0f172a",
  ...(liveReloadUrl ? { server: { url: liveReloadUrl, cleartext: true } } : {}),
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: "#0f172a",
      showSpinner: false,
      androidScaleType: "CENTER_CROP",
    },
    StatusBar: { overlaysWebView: true, style: "DARK", backgroundColor: "#00000000" },
  },
};

export default config;
