import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";

/**
 * Platform layer for the Capacitor apps. The website and the apps share one codebase; this module
 * holds the few things that differ: token auth instead of cookies, absolute API URLs, native file
 * sharing instead of browser downloads, haptics, and the status bar.
 */

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform() as "ios" | "android" | "web";

const PREVIEW_KEY = "editly:app-preview";
let appShellCache: boolean | null = null;

/** True inside the native apps, or in a browser opened with `?app=1` (app preview for development). */
export function isAppShell() {
  if (appShellCache !== null) return appShellCache;
  if (isNative()) return (appShellCache = true);
  try {
    const flag = new URLSearchParams(window.location.search).get("app");
    if (flag === "1") localStorage.setItem(PREVIEW_KEY, "1");
    if (flag === "0") localStorage.removeItem(PREVIEW_KEY);
    appShellCache = localStorage.getItem(PREVIEW_KEY) === "1";
  } catch { appShellCache = false; }
  return appShellCache;
}

/** Native builds talk to the deployed server; the website (and app preview) use relative URLs. */
export const API_BASE = isNative() ? String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "") : "";

// ---- Session token --------------------------------------------------------
const TOKEN_KEY = "editly.token";
let token: string | null = null;

export async function loadStoredToken() {
  try { token = (await Preferences.get({ key: TOKEN_KEY })).value; } catch { token = null; }
  return token;
}
export const getToken = () => token;
export async function storeToken(next: string) { token = next; await Preferences.set({ key: TOKEN_KEY, value: next }); }
export async function clearToken() { token = null; await Preferences.remove({ key: TOKEN_KEY }); }

// ---- Small persisted flags (onboarding, guest choice) -----------------------
export async function getFlag(key: string) { try { return (await Preferences.get({ key: `editly.${key}` })).value; } catch { return null; } }
export async function setFlag(key: string, value: string | null) {
  if (value === null) await Preferences.remove({ key: `editly.${key}` });
  else await Preferences.set({ key: `editly.${key}`, value });
}

// ---- REST API (/api/v1) -------------------------------------------------------
export type ApiUser = { id: number; name: string | null; email: string | null; role: "user" | "admin"; createdAt: string };
export type ApiSession = { token: string; tokenType: "Bearer"; expiresAt: string; user: ApiUser };
export class ApiRequestError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { path: string; message: string }[]) { super(message); }
}

export async function restApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/v1${path}`, {
      ...init,
      credentials: "omit",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiRequestError(0, "NETWORK", "Can't reach Editly. Check your connection and try again.");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiRequestError(response.status, body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Something went wrong.", body?.error?.details);
  return body as T;
}

// ---- Files ---------------------------------------------------------------------
function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(binary);
}

/** Saves an exported PDF: a browser download on the web, the native share sheet (Save to Files, Drive, Mail…) in the apps. */
export async function deliverPdf(bytes: Uint8Array, fileName: string, browserDownload: (bytes: Uint8Array, name: string) => void) {
  if (!isNative()) return browserDownload(bytes, fileName);
  const safeName = fileName.replace(/[^\w.-]+/g, "-") || "document.pdf";
  const written = await Filesystem.writeFile({ path: safeName, data: toBase64(bytes), directory: Directory.Cache });
  try {
    await Share.share({ title: safeName, files: [written.uri], dialogTitle: "Save or share your PDF" });
  } catch (error) {
    // Dismissing the share sheet is not an error worth surfacing.
    if (!(error instanceof Error && /cancel/i.test(error.message))) throw error;
  }
}

// ---- Feel ------------------------------------------------------------------------
export function haptic(kind: "light" | "medium" | "success" | "warning" = "light") {
  if (!isNative()) return;
  const run = kind === "success" ? Haptics.notification({ type: NotificationType.Success })
    : kind === "warning" ? Haptics.notification({ type: NotificationType.Warning })
      : Haptics.impact({ style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
  void run.catch(() => undefined);
}

// Android-only helper registered in MainActivity (see AppChromePlugin.java).
const AppChrome = registerPlugin<{ setBackground(options: { color: string }): Promise<void> }>("AppChrome");

/** `dark` = light status-bar text on a dark screen. `background` matches the screen behind the system bars. */
export function setStatusBar(tone: "dark" | "light", background = tone === "dark" ? "#0f172a" : "#f5f7fb") {
  if (!isNative()) return;
  void StatusBar.setStyle({ style: tone === "dark" ? Style.Dark : Style.Light }).catch(() => undefined);
  if (platform() === "android") void AppChrome.setBackground({ color: background }).catch(() => undefined);
}
