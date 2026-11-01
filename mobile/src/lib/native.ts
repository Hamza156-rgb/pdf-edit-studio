import { Capacitor, registerPlugin } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Preferences } from "@capacitor/preferences";
import { Share } from "@capacitor/share";
import { StatusBar, Style } from "@capacitor/status-bar";
import type { Platform } from "@/lib/platform";

/**
 * Native layer for the app: token storage, the REST API client, and the Capacitor implementations
 * of the shared `Platform` hooks (registered in main.tsx via `configurePlatform`).
 */

export const isNative = () => Capacitor.isNativePlatform();
export const platformName = () => Capacitor.getPlatform() as "ios" | "android" | "web";

/** Native builds call the deployed server; `vite` dev in a browser goes through the dev proxy. */
export const API_BASE = isNative() || !import.meta.env.DEV ? String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "") : "";

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

// ---- Small persisted flags (onboarding) -------------------------------------
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

// ---- Platform hooks for the shared editor ---------------------------------------
function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(binary);
}

/** Saves an exported PDF through the native share sheet (Save to Files, Drive, Mail, Print…). */
async function savePdf(bytes: Uint8Array, fileName: string) {
  const safeName = fileName.replace(/[^\w.-]+/g, "-") || "document.pdf";
  const written = await Filesystem.writeFile({ path: safeName, data: toBase64(bytes), directory: Directory.Cache });
  try {
    await Share.share({ title: safeName, files: [written.uri], dialogTitle: "Save or share your PDF" });
  } catch (error) {
    // Dismissing the share sheet is not an error worth surfacing.
    if (!(error instanceof Error && /cancel/i.test(error.message))) throw error;
  }
}

function haptic(kind: "light" | "medium" | "success" | "warning" = "light") {
  if (!isNative()) return;
  const run = kind === "success" ? Haptics.notification({ type: NotificationType.Success })
    : kind === "warning" ? Haptics.notification({ type: NotificationType.Warning })
      : Haptics.impact({ style: kind === "medium" ? ImpactStyle.Medium : ImpactStyle.Light });
  void run.catch(() => undefined);
}

// Android-only helper registered in MainActivity (see android/.../AppChromePlugin.java).
const AppChrome = registerPlugin<{ setBackground(options: { color: string }): Promise<void> }>("AppChrome");

function setStatusBar(tone: "dark" | "light", background = tone === "dark" ? "#0f172a" : "#f5f7fb") {
  if (!isNative()) return;
  void StatusBar.setStyle({ style: tone === "dark" ? Style.Dark : Style.Light }).catch(() => undefined);
  if (platformName() === "android") void AppChrome.setBackground({ color: background }).catch(() => undefined);
}

export const nativePlatform: Partial<Platform> = {
  isApp: true,
  haptic,
  setStatusBar,
  savePdf: isNative() ? savePdf : undefined,
  onSignedOut: clearToken,
};
export { haptic, setStatusBar };
