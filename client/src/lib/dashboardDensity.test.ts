import { describe, expect, it } from "vitest";
import { DASHBOARD_DENSITY_KEY, loadDashboardDensity, saveDashboardDensity, toggleDashboardDensity } from "./dashboardDensity";

describe("dashboard density preference", () => {
  it("defaults to comfortable and preserves a compact choice", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };

    expect(loadDashboardDensity(storage)).toBe("comfortable");
    saveDashboardDensity(storage, "compact");
    expect(values.get(DASHBOARD_DENSITY_KEY)).toBe("compact");
    expect(loadDashboardDensity(storage)).toBe("compact");
  });

  it("toggles between compact and comfortable", () => {
    expect(toggleDashboardDensity("comfortable")).toBe("compact");
    expect(toggleDashboardDensity("compact")).toBe("comfortable");
  });

  it("falls back safely when storage contains an unknown value", () => {
    const storage = { getItem: () => "dense" };
    expect(loadDashboardDensity(storage)).toBe("comfortable");
  });
});
