/**
 * Hooks the shared UI (editor, auth) calls for things that differ by platform. The website uses
 * these web defaults; the mobile app (mobile/) swaps in Capacitor implementations at startup via
 * `configurePlatform`, so shared code never imports Capacitor directly.
 */
export type Platform = {
  /** True inside the mobile app. */
  isApp: boolean;
  haptic: (kind?: "light" | "medium" | "success" | "warning") => void;
  /** `dark` = light status-bar text on a dark screen; `background` paints behind the system bars. */
  setStatusBar: (tone: "dark" | "light", background?: string) => void;
  /** Delivers an exported PDF. Undefined on the web, where the editor triggers a browser download. */
  savePdf?: (bytes: Uint8Array, fileName: string) => Promise<void>;
  /** Called after sign-out so the app can drop its stored token. */
  onSignedOut: () => void | Promise<void>;
};

export const platform: Platform = {
  isApp: false,
  haptic: () => undefined,
  setStatusBar: () => undefined,
  onSignedOut: () => undefined,
};

export function configurePlatform(overrides: Partial<Platform>) {
  Object.assign(platform, overrides);
}
