import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createDocument: vi.fn(), createNativeUser: vi.fn(), deleteDocument: vi.fn(), deleteUserAccount: vi.fn(), getAdminOverview: vi.fn(), getNativeUserByEmail: vi.fn(), listAdminUsers: vi.fn(), listDocumentsByOwner: vi.fn(), renameDocument: vi.fn(), setUserAccountStatus: vi.fn(),
}));
const passwords = vi.hoisted(() => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }));
const sessions = vi.hoisted(() => ({ createSessionToken: vi.fn() }));

vi.mock("./db", () => db);
vi.mock("./nativeAuth", () => passwords);
vi.mock("./_core/sdk", () => ({ sdk: sessions }));

const { appRouter } = await import("./routers");

function context() {
  const cookies: unknown[][] = [];
  const ctx = { user: null, req: { protocol: "https", headers: {} }, res: { cookie: (...args: unknown[]) => cookies.push(args), clearCookie: vi.fn() } } as unknown as TrpcContext;
  return { ctx, cookies };
}

const nativeUser = { id: 44, openId: "native_test", name: "Taylor", email: "taylor@example.com", loginMethod: "native", passwordHash: "hash", role: "user" as const, accountStatus: "active" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };

describe("native account auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    passwords.hashPassword.mockResolvedValue("hash");
    passwords.verifyPassword.mockResolvedValue(true);
    db.createNativeUser.mockResolvedValue(nativeUser);
    db.getNativeUserByEmail.mockResolvedValue(nativeUser);
    sessions.createSessionToken.mockResolvedValue("native-session-token");
  });

  it("creates a native account and sets a secure signed session", async () => {
    const { ctx, cookies } = context();
    const result = await appRouter.createCaller(ctx).auth.nativeSignup({ name: "Taylor", email: "TAYLOR@example.com", password: "safe-password" });
    expect(result).toEqual({ id: 44, name: "Taylor", email: "taylor@example.com" });
    expect(db.createNativeUser).toHaveBeenCalledWith({ name: "Taylor", email: "taylor@example.com", passwordHash: "hash" });
    expect(cookies[0]?.[1]).toBe("native-session-token");
  });

  it("rejects an incorrect native password without setting a session", async () => {
    passwords.verifyPassword.mockResolvedValue(false);
    const { ctx, cookies } = context();
    await expect(appRouter.createCaller(ctx).auth.nativeLogin({ email: "taylor@example.com", password: "wrong-password" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(cookies).toHaveLength(0);
  });
});
