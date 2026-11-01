# Editly mobile (Ionic React + Capacitor)

The iOS and Android apps. Built with **Ionic React 9** on **Capacitor 8**, React 19 and Vite. It runs inside a native
WebView. It shares the PDF editor, UI kit, and API client with the website in `../client`, and talks to the same
Express + MySQL server.

```
mobile/
├── android/  ios/          native projects (Android Studio / Xcode)
├── assets/                 icon + splash source art
├── src/
│   ├── App.tsx             Ionic router: onboarding, sign in/up, tabs, editor, admin
│   ├── main.tsx            bootstrap: Ionic, token-auth tRPC client, native platform hooks
│   ├── pages/              Onboarding, AuthScreen, Home, Library, Tools, Account, Editor, Admin
│   ├── components/         TabPage (header + content frame), onboarding 3D scenes
│   ├── lib/                native.ts (Capacitor), documents.tsx (library helpers), wouterBridge.tsx
│   └── theme/app.css       Tailwind + shared design tokens + Ionic overrides
├── capacitor.config.ts
└── vite.config.ts          aliases `@` → ../client/src, proxies /api in dev
```

## API: REST only

The app talks to the server **only through the REST API** (`/api/v1`, documented in `../docs/mobile-api.md`) with a
bearer token stored by `@capacitor/preferences`. It does not use tRPC or cookies.

| Feature | Endpoint |
| --- | --- |
| Sign up / log in / log out | `POST /auth/signup`, `/auth/login`, `/auth/logout` |
| Stay signed in | `POST /auth/refresh` at launch and on resume when the token is older than 12 h |
| Current user | `GET /me` |
| Save to account, account activity | `POST /documents`, `GET /documents` |
| Admin console | `GET /admin/overview`, `GET /admin/users`, `PATCH`/`DELETE /admin/users/:id` |

## How it shares code with the website

- `@/…` imports resolve to `../client/src`, so the app uses the **same editor** (`@/pages/PdfEditor`) and libraries.
- The website's tRPC-based modules are swapped for REST versions in the mobile build (aliases in `vite.config.ts`
  and `tsconfig.json`): `@/_core/hooks/useAuth` → `src/lib/auth.ts`, `@/lib/accountDocuments` → `src/lib/accountDocuments.ts`.
- Shared code never imports Capacitor. It calls the small `platform` interface in `client/src/lib/platform.ts`;
  `src/main.tsx` plugs in the native implementation (`src/lib/native.ts`): share sheet for exports, haptics, status bar,
  token clean-up on sign-out.
- The editor navigates with wouter (website router); `src/lib/wouterBridge.tsx` runs it on Ionic's router.

## Run it

```bash
cd mobile
pnpm install

# Browser preview (needs the website server: `pnpm dev` in the repo root on :3000)
pnpm dev                      # → http://localhost:5180  (/api is proxied to :3000)

# Android (Android Studio)
VITE_API_BASE_URL=http://localhost:3000 pnpm android   # then ▶ in Android Studio
adb reverse tcp:3000 tcp:3000                          # lets the emulator reach your server

# iOS (needs full Xcode)
pnpm ios
```

From the repo root the same commands are available as `pnpm mobile:dev`, `pnpm mobile:android`, `pnpm mobile:ios`.

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server on :5180 with live reload |
| `pnpm build` | Production web bundle → `dist/`, then `cap sync` |
| `pnpm android` / `pnpm ios` | Build, sync, open the native IDE |
| `pnpm apk` | Debug APK in `android/app/build/outputs/apk/debug/` |
| `pnpm typecheck` | TypeScript check (includes the shared website code it imports) |
| `pnpm assets` | Regenerate app icons and splash screens from `assets/` |

## Configuration

- `.env.production` → `VITE_API_BASE_URL` for release builds. **Replace the placeholder with your HTTPS server.**
- `API_PROXY_TARGET` (dev only) → where `pnpm dev` proxies `/api` (default `http://localhost:3000`).
- Debug Android builds allow plain HTTP to `localhost`/`10.0.2.2` only (`android/app/src/debug`); release builds are HTTPS-only.
- App id `com.editly.app` lives in `capacitor.config.ts`; change it before the first store upload.

## Notes

- Shared dependencies (`react`, React Query, tRPC, wouter…) are pinned to the website's exact versions and deduped in
  `vite.config.ts`, so both code trees use one copy at runtime.
- Ionic's CSS is loaded into a low cascade layer (`theme/app.css`) so the app's Tailwind design takes precedence.
- Document actions run after the action sheet closes, so Ionic overlays never stack (stacked overlays can leave the
  app hidden from screen readers).
