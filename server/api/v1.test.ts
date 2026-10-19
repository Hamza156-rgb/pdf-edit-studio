import express from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Document, User } from "../../drizzle/schema";

process.env.JWT_SECRET = "test-secret-for-mobile-api-0123456789";
process.env.VITE_APP_ID = "test-app";

// In-memory stand-in for ../db so the HTTP layer is tested end to end without MySQL.
const store = vi.hoisted(() => ({ users: [] as User[], documents: [] as Document[], nextUser: 1, nextDocument: 1 }));
vi.mock("../db", () => ({
  getUserByOpenId: async (openId: string) => store.users.find(user => user.openId === openId),
  getNativeUserByEmail: async (email: string) => store.users.find(user => user.email === email.toLowerCase()),
  createNativeUser: async (input: { name: string; email: string; passwordHash: string }) => {
    if (store.users.some(user => user.email === input.email)) throw new Error("EMAIL_IN_USE");
    const now = new Date();
    const user: User = { id: store.nextUser++, openId: `native_${store.nextUser}`, name: input.name, email: input.email, passwordHash: input.passwordHash, loginMethod: "native", role: "user", accountStatus: "active", createdAt: now, updatedAt: now, lastSignedIn: now };
    store.users.push(user);
    return user;
  },
  listDocumentsByOwner: async (ownerId: number, page: { limit: number; offset: number }) => store.documents.filter(doc => doc.ownerId === ownerId).sort((a, b) => b.id - a.id).slice(page.offset, page.offset + page.limit),
  countDocumentsByOwner: async (ownerId: number) => store.documents.filter(doc => doc.ownerId === ownerId).length,
  getDocumentByOwner: async (ownerId: number, id: number) => store.documents.find(doc => doc.id === id && doc.ownerId === ownerId),
  createDocument: async (input: Omit<Document, "id" | "createdAt" | "updatedAt" | "lastOpenedAt" | "storageKey">) => {
    const now = new Date();
    const doc: Document = { ...input, id: store.nextDocument++, storageKey: null, createdAt: now, updatedAt: now, lastOpenedAt: null };
    store.documents.push(doc);
    return doc.id;
  },
  renameDocument: async (ownerId: number, id: number, name: string) => {
    const doc = store.documents.find(item => item.id === id && item.ownerId === ownerId);
    if (!doc || doc.name === name) return false;
    doc.name = name;
    return true;
  },
  deleteDocument: async (ownerId: number, id: number) => {
    const index = store.documents.findIndex(item => item.id === id && item.ownerId === ownerId);
    if (index === -1) return false;
    store.documents.splice(index, 1);
    return true;
  },
  upsertUser: async () => undefined,
}));

const { createMobileApiRouter } = await import("./v1");
const { openApiDocument } = await import("./openapi");

let server: Server;
let base = "";

function startApp(router: express.Router) {
  const app = express();
  app.use("/api/v1", router);
  return new Promise<Server>(resolve => { const instance = app.listen(0, () => resolve(instance)); });
}

async function call(method: string, path: string, options: { token?: string; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { ...(options.body !== undefined || options.raw ? { "Content-Type": "application/json" } : {}), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...options.headers },
    body: options.raw ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
  });
  const text = await response.text();
  return { status: response.status, headers: response.headers, json: text ? JSON.parse(text) : null };
}

async function signup(email: string) {
  const result = await call("POST", "/api/v1/auth/signup", { body: { name: "Mobile User", email, password: "password1234" } });
  expect(result.status).toBe(201);
  return result.json.token as string;
}

beforeAll(async () => {
  server = await startApp(createMobileApiRouter({ allowedOrigins: ["capacitor://localhost"], authRateLimit: { windowMs: 60_000, max: 1000 } }));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())));

describe("mobile API: auth", () => {
  it("signs up, returns a bearer session, and rejects duplicate emails", async () => {
    const created = await call("POST", "/api/v1/auth/signup", { body: { name: "Ayesha", email: "Ayesha@Example.com", password: "password1234" } });
    expect(created.status).toBe(201);
    expect(created.json).toMatchObject({ tokenType: "Bearer", user: { name: "Ayesha", email: "ayesha@example.com", role: "user" } });
    expect(created.json.user).not.toHaveProperty("passwordHash");
    expect(new Date(created.json.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 3600 * 1000);

    const duplicate = await call("POST", "/api/v1/auth/signup", { body: { name: "Ayesha", email: "ayesha@example.com", password: "password1234" } });
    expect(duplicate.status).toBe(409);
    expect(duplicate.json.error.code).toBe("CONFLICT");
  });

  it("validates input with field-level details", async () => {
    const result = await call("POST", "/api/v1/auth/signup", { body: { name: "A", email: "not-an-email", password: "short" } });
    expect(result.status).toBe(400);
    expect(result.json.error.code).toBe("VALIDATION_ERROR");
    expect(result.json.error.details.map((detail: { path: string }) => detail.path).sort()).toEqual(["email", "name", "password"]);
  });

  it("logs in, rejects wrong passwords, and refreshes tokens", async () => {
    await signup("login@example.com");
    expect((await call("POST", "/api/v1/auth/login", { body: { email: "login@example.com", password: "wrong-password" } })).status).toBe(401);
    const login = await call("POST", "/api/v1/auth/login", { body: { email: "LOGIN@example.com", password: "password1234" } });
    expect(login.status).toBe(200);
    const refreshed = await call("POST", "/api/v1/auth/refresh", { token: login.json.token });
    expect(refreshed.status).toBe(200);
    expect(refreshed.json.token).toEqual(expect.any(String));
  });

  it("requires a bearer token and ignores session cookies", async () => {
    const token = await signup("me@example.com");
    expect((await call("GET", "/api/v1/me", { token })).json.user.email).toBe("me@example.com");
    const noToken = await call("GET", "/api/v1/me");
    expect(noToken.status).toBe(401);
    expect(noToken.json.error.code).toBe("UNAUTHORIZED");
    expect((await call("GET", "/api/v1/me", { headers: { Cookie: `app_session_id=${token}` } })).status).toBe(401);
    expect((await call("GET", "/api/v1/me", { token: `${token}tampered` })).status).toBe(401);
  });

  it("blocks disabled accounts at login and on existing tokens", async () => {
    const token = await signup("disabled@example.com");
    store.users.find(user => user.email === "disabled@example.com")!.accountStatus = "disabled";
    expect((await call("GET", "/api/v1/me", { token })).status).toBe(403);
    expect((await call("POST", "/api/v1/auth/login", { body: { email: "disabled@example.com", password: "password1234" } })).status).toBe(403);
  });
});

describe("mobile API: documents", () => {
  it("supports create, read, rename, list with pagination, and delete", async () => {
    const token = await signup("docs@example.com");
    const created = await call("POST", "/api/v1/documents", { token, body: { name: "Contract", originalFileName: "contract.pdf", pageCount: 3, byteSize: 52_000 } });
    expect(created.status).toBe(201);
    expect(created.headers.get("location")).toBe(`/api/v1/documents/${created.json.data.id}`);
    const id = created.json.data.id;

    expect((await call("GET", `/api/v1/documents/${id}`, { token })).json.data).toMatchObject({ name: "Contract", pageCount: 3, lastOpenedAt: null });
    expect((await call("PATCH", `/api/v1/documents/${id}`, { token, body: { name: "Signed contract" } })).json.data.name).toBe("Signed contract");
    expect((await call("PATCH", `/api/v1/documents/${id}`, { token, body: { name: "Signed contract" } })).status).toBe(200);

    await call("POST", "/api/v1/documents", { token, body: { name: "Invoice", originalFileName: "invoice.pdf", pageCount: 1, byteSize: 9_000 } });
    const page = await call("GET", "/api/v1/documents?limit=1&offset=0", { token });
    expect(page.json.pagination).toEqual({ limit: 1, offset: 0, total: 2 });
    expect(page.json.data).toHaveLength(1);
    expect((await call("GET", "/api/v1/documents?limit=500", { token })).status).toBe(400);

    expect((await call("DELETE", `/api/v1/documents/${id}`, { token })).status).toBe(204);
    expect((await call("GET", `/api/v1/documents/${id}`, { token })).status).toBe(404);
  });

  it("never exposes or changes another user's documents", async () => {
    const owner = await signup("owner@example.com");
    const intruder = await signup("intruder@example.com");
    const { json } = await call("POST", "/api/v1/documents", { token: owner, body: { name: "Private", originalFileName: "private.pdf", pageCount: 1, byteSize: 100 } });
    const path = `/api/v1/documents/${json.data.id}`;
    expect((await call("GET", path, { token: intruder })).status).toBe(404);
    expect((await call("PATCH", path, { token: intruder, body: { name: "Stolen" } })).status).toBe(404);
    expect((await call("DELETE", path, { token: intruder })).status).toBe(404);
    expect((await call("GET", "/api/v1/documents", { token: intruder })).json.data).toEqual([]);
    expect((await call("GET", path, { token: owner })).json.data.name).toBe("Private");
  });

  it("rejects invalid metadata and ids", async () => {
    const token = await signup("invalid-docs@example.com");
    expect((await call("POST", "/api/v1/documents", { token, body: { name: " ", originalFileName: "x.pdf", pageCount: 0, byteSize: 1 } })).status).toBe(400);
    expect((await call("GET", "/api/v1/documents/abc", { token })).status).toBe(400);
  });
});

describe("mobile API: protocol", () => {
  it("answers malformed JSON and unknown routes with JSON errors", async () => {
    const bad = await call("POST", "/api/v1/auth/login", { raw: "{not json" });
    expect(bad.status).toBe(400);
    expect(bad.json.error.code).toBe("INVALID_JSON");
    const missing = await call("GET", "/api/v1/nothing-here");
    expect(missing.status).toBe(404);
    expect(missing.json.error.code).toBe("NOT_FOUND");
  });

  it("allows CORS only for configured app origins", async () => {
    const allowed = await fetch(`${base}/api/v1/me`, { method: "OPTIONS", headers: { Origin: "capacitor://localhost", "Access-Control-Request-Method": "GET" } });
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe("capacitor://localhost");
    const blocked = await fetch(`${base}/api/v1/me`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } });
    expect(blocked.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("rate-limits credential endpoints", async () => {
    const limited = await startApp(createMobileApiRouter({ authRateLimit: { windowMs: 60_000, max: 2 } }));
    const url = `http://127.0.0.1:${(limited.address() as AddressInfo).port}/api/v1/auth/login`;
    const attempt = () => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "nobody@example.com", password: "password1234" }) });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    await new Promise<void>(resolve => limited.close(() => resolve()));
  });

  it("documents every route in the OpenAPI spec", async () => {
    const router = createMobileApiRouter();
    const routes = (router.stack as { route?: { path: string; methods: Record<string, boolean> } }[])
      .filter(layer => layer.route)
      .flatMap(layer => Object.keys(layer.route!.methods).map(method => `${method} ${layer.route!.path.replace(/:(\w+)/g, "{$1}")}`));
    const documented = Object.entries(openApiDocument.paths).flatMap(([path, item]) => Object.keys(item).filter(key => key !== "parameters").map(method => `${method} ${path}`));
    expect(routes.sort()).toEqual(documented.sort());
    expect((await call("GET", "/api/v1/openapi.json")).json.openapi).toBe("3.1.0");
  });
});
