# Editly mobile apps (iOS & Android)

The apps are this same React codebase packaged with **Capacitor 8**. Inside the apps, `client/src/main.tsx`
switches to the mobile shell in `client/src/mobile/` (onboarding → sign in/up or guest → Home / Library / Account
tabs) and reuses the website's editor, so every editing feature is shared: edit existing text, add text, whiteout,
redact, draw, highlight, eraser, shapes, images, signatures, remove watermark, merge, extract, page organizing,
undo/redo, local library, and account activity.

What differs in the apps (see `client/src/lib/native.ts`):

| Area | Website | Apps |
| --- | --- | --- |
| Sign in | Cookie session | Bearer token from `/api/v1/auth/*`, stored with `@capacitor/preferences` |
| Open PDF | Browser file picker | System document picker (Files / Drive / iCloud) |
| Export | Browser download | Native share sheet (Save to Files, Drive, Mail, Print…) |
| Feel | Mouse-hover 3D tilt | Touch-press 3D tilt, haptics, status bar styling, Android back button, splash screen |

## Prerequisites

- Node 22 (`nvm use`), pnpm
- Android: Android Studio (bundled JDK 21) + an emulator or device
- iOS: macOS with **Xcode 16+** (not just the Command Line Tools)

## Point the app at your API

The API URL is baked in at build time:

```bash
# Production
VITE_API_BASE_URL=https://api.your-domain.com pnpm mobile:build

# Android emulator against your local server (debug builds allow plain HTTP to localhost only)
pnpm dev                                   # API on :3000
adb reverse tcp:3000 tcp:3000
VITE_API_BASE_URL=http://localhost:3000 pnpm mobile:apk
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

The server must allow the app origins via CORS. The defaults cover Capacitor
(`capacitor://localhost`, `https://localhost`, …); override with `MOBILE_ALLOWED_ORIGINS` if needed.

## Everyday commands

| Command | What it does |
| --- | --- |
| `pnpm mobile:build` | Build the web bundle and copy it into both native projects |
| `pnpm mobile:android` | Build, sync, and open Android Studio |
| `pnpm mobile:ios` | Build, sync, and open Xcode |
| `pnpm mobile:apk` | Build a debug APK (`android/app/build/outputs/apk/debug/`) |

Live reload while developing: `CAP_SERVER_URL=http://<your-computer-ip>:3000 pnpm exec cap run android`.

Preview the app UI in a desktop browser without a device: open `http://localhost:3000/?app=1` (and `?app=0` to leave).

## Icons and splash

Source art lives in `assets/` (`icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`).
Regenerate all native sizes after changing it:

```bash
npx @capacitor/assets generate --ios --android --iconBackgroundColor '#0f172a' --splashBackgroundColor '#0f172a'
```

## Releasing

- **App id:** `com.editly.app` (set in `capacitor.config.ts`; change it before your first store upload — it can't change afterwards).
- **Android:** in Android Studio, *Build → Generate Signed Bundle* to produce an `.aab` for Google Play. Keep the keystore safe.
- **iOS:** open in Xcode, set your Team under *Signing & Capabilities*, then *Product → Archive* and upload to App Store Connect.
- Bump versions in `android/app/build.gradle` (`versionCode`/`versionName`) and in Xcode (*Version*/*Build*) for each release.

## Notes

- `pdfjs-dist` is imported from its **legacy** build on purpose: the modern build calls APIs (e.g. `Map.getOrInsertComputed`)
  that Android System WebView < ~145 and older iOS Safari don't have, which made every PDF fail to open there.
- Android WebView < 140 can't draw edge-to-edge; Capacitor then pads the WebView and `AppChromePlugin.java` tints the
  area behind the system bars to match the current screen.
