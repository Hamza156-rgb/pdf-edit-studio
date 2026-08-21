import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const db = vi.hoisted(() => ({
  createDocument: vi.fn().mockResolvedValue(undefined),
  deleteDocument: vi.fn().mockResolvedValue(undefined),
  deleteUserAccount: vi.fn().mockResolvedValue(undefined),
  getAdminOverview: vi.fn().mockResolvedValue({ totalUsers: 0, activeUsers: 0, totalDocuments: 0, managedBytes: 0 }),
  listAdminUsers: vi.fn().mockResolvedValue([]),
  listDocumentsByOwner: vi.fn().mockResolvedValue([]),
  renameDocument: vi.fn().mockResolvedValue(undefined),
  setUserAccountStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./db", () => db);

const { appRouter } = await import("./routers");

function contextFor(userId: number): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `document-test-user-${userId}`,
      name: "Document Test",
      email: `test-${userId}@example.com`,
      loginMethod: "test",
      role: "user",
      accountStatus: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("documents.create", () => {
  it("rejects impossible document metadata before persistence", async () => {
    const caller = appRouter.createCaller(contextFor(99));
    await expect(caller.documents.create({ name: "Broken", originalFileName: "broken.pdf", pageCount: 0, byteSize: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects empty user-facing document names", async () => {
    const caller = appRouter.createCaller(contextFor(99));
    await expect(caller.documents.create({ name: "  ", originalFileName: "blank-name.pdf", pageCount: 1, byteSize: 10 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("documents account protection", () => {
  it("does not expose document metadata without an authenticated account", async () => {
    const caller = appRouter.createCaller({ ...contextFor(99), user: null });
    await expect(caller.documents.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("scopes list, rename, and delete operations to the authenticated owner", async () => {
    const firstUser = appRouter.createCaller(contextFor(99));
    const secondUser = appRouter.createCaller(contextFor(100));

    await firstUser.documents.list();
    await secondUser.documents.list();
    await firstUser.documents.rename({ id: 771, name: "First user document" });
    await secondUser.documents.delete({ id: 771 });

    expect(db.listDocumentsByOwner).toHaveBeenNthCalledWith(1, 99);
    expect(db.listDocumentsByOwner).toHaveBeenNthCalledWith(2, 100);
    expect(db.renameDocument).toHaveBeenCalledWith(99, 771, "First user document");
    expect(db.deleteDocument).toHaveBeenCalledWith(100, 771);
  });
});
