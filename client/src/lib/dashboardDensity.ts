export type DashboardDensity = "comfortable" | "compact";

export const DASHBOARD_DENSITY_KEY = "editly-dashboard-density";

export function loadDashboardDensity(storage: Pick<Storage, "getItem">): DashboardDensity {
  return storage.getItem(DASHBOARD_DENSITY_KEY) === "compact" ? "compact" : "comfortable";
}

export function saveDashboardDensity(storage: Pick<Storage, "setItem">, density: DashboardDensity) {
  storage.setItem(DASHBOARD_DENSITY_KEY, density);
}

export function toggleDashboardDensity(density: DashboardDensity): DashboardDensity {
  return density === "compact" ? "comfortable" : "compact";
}
