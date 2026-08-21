import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = {
  user: {
    id: 99,
    openId: "document-test-user",
    name: "Document Test",
    email: "test@example.com",
    loginMethod: "test",
    role: "user",
    accountStatus: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  },
  req: {} as TrpcContext["req"],
  res: {} as TrpcContext["res"],
} as TrpcContext;

describe("documents.create", () => {
  it("rejects impossible document metadata before persistence", async () => {
    const caller = appRouter.createCaller(context);
    await expect(caller.documents.create({
      name: "Broken",
      originalFileName: "broken.pdf",
      pageCount: 0,
      byteSize: 10,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects empty user-facing document names", async () => {
    const caller = appRouter.createCaller(context);
    await expect(caller.documents.create({
      name: "  ",
      originalFileName: "blank-name.pdf",
      pageCount: 1,
      byteSize: 10,
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
