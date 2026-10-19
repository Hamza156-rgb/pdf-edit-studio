import express, { type NextFunction, type Request, type Response } from "express";
import { z, ZodError } from "zod";
import type { Document, User } from "../../drizzle/schema";
import { countDocumentsByOwner, createDocument, createNativeUser, getDocumentByOwner, getNativeUserByEmail, getUserByOpenId, listDocumentsByOwner, renameDocument, deleteDocument } from "../db";
import { hashPassword, verifyPassword } from "../nativeAuth";
import { sdk } from "../_core/sdk";
import { openApiDocument } from "./openapi";

/**
 * REST API for the mobile apps, mounted at /api/v1.
 *
 * - Auth is Bearer-token only (`Authorization: Bearer <token>`). Cookies are ignored on purpose,
 *   so these endpoints cannot be driven cross-site by a logged-in browser (no CSRF surface).
 * - Every response is JSON. Errors use `{ "error": { "code", "message", "details"? } }`.
 * - Tokens are the same signed session JWTs the website uses, valid for 30 days.
 */

export const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 30;

const DEFAULT_ALLOWED_ORIGINS = ["capacitor://localhost", "ionic://localhost", "http://localhost", "https://localhost"];

type ErrorCode = "VALIDATION_ERROR" | "INVALID_JSON" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(public status: number, public code: ErrorCode, message: string, public details?: unknown) {
    super(message);
  }
}

type AuthedRequest = Request & { user: User };

const credentials = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(320),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});
const signupBody = credentials.extend({ name: z.string().trim().min(2, "Enter your name.").max(120) });
const documentBody = z.object({
  name: z.string().trim().min(1).max(255),
  originalFileName: z.string().trim().min(1).max(255),
  pageCount: z.number().int().min(1).max(5000),
  byteSize: z.number().int().min(1).max(1024 * 1024 * 1024),
});
const renameBody = z.object({ name: z.string().trim().min(1).max(255) });
const idParam = z.coerce.number().int().positive();
const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

function publicUser(user: User) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt.toISOString() };
}

function publicDocument(document: Document) {
  return {
    id: document.id,
    name: document.name,
    originalFileName: document.originalFileName,
    pageCount: document.pageCount,
    byteSize: document.byteSize,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    lastOpenedAt: document.lastOpenedAt?.toISOString() ?? null,
  };
}

async function issueToken(user: User) {
  const token = await sdk.createSessionToken(user.openId, { name: user.name || "Member", expiresInMs: TOKEN_TTL_MS });
  return { token, tokenType: "Bearer" as const, expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(), user: publicUser(user) };
}

/** Wraps async handlers so rejected promises reach the error middleware (Express 4). */
const handle = (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) => { fn(req, res).catch(next); };

async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = typeof header === "string" && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Missing bearer token.");
    const session = await sdk.verifySession(token);
    if (!session) throw new ApiError(401, "UNAUTHORIZED", "Your session has expired. Log in again.");
    const user = await getUserByOpenId(session.openId);
    if (!user) throw new ApiError(401, "UNAUTHORIZED", "This account no longer exists.");
    if (user.accountStatus === "disabled") throw new ApiError(403, "FORBIDDEN", "This account is disabled.");
    (req as AuthedRequest).user = user;
    next();
  } catch (error) { next(error); }
}

/** Small fixed-window limiter for credential endpoints. In-memory, so it applies per server instance. */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = `${req.ip}:${req.path}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) { entry = { count: 0, resetAt: now + windowMs }; hits.set(key, entry); }
    entry.count += 1;
    if (hits.size > 10_000) hits.forEach((value, mapKey) => { if (value.resetAt <= now) hits.delete(mapKey); });
    if (entry.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new ApiError(429, "RATE_LIMITED", "Too many attempts. Try again in a minute."));
    }
    next();
  };
}

function cors(allowedOrigins: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "600");
    }
    if (req.method === "OPTIONS") return void res.sendStatus(204);
    next();
  };
}

export function createMobileApiRouter(options: { allowedOrigins?: string[]; authRateLimit?: { windowMs: number; max: number } } = {}) {
  const allowedOrigins = options.allowedOrigins
    ?? (process.env.MOBILE_ALLOWED_ORIGINS ? process.env.MOBILE_ALLOWED_ORIGINS.split(",").map(origin => origin.trim()).filter(Boolean) : DEFAULT_ALLOWED_ORIGINS);
  const authLimiter = rateLimit(options.authRateLimit ?? { windowMs: 60_000, max: 10 });
  const api = express.Router();

  api.use(cors(allowedOrigins));
  api.use(express.json({ limit: "1mb" }));
  api.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

  api.get("/health", (_req, res) => { res.json({ status: "ok", version: "v1", time: new Date().toISOString() }); });
  api.get("/openapi.json", (_req, res) => { res.json(openApiDocument); });

  // ---- Auth -------------------------------------------------------------
  api.post("/auth/signup", authLimiter, handle(async (req, res) => {
    const body = signupBody.parse(req.body);
    let user: User;
    try {
      user = await createNativeUser({ name: body.name, email: body.email, passwordHash: await hashPassword(body.password) });
    } catch (error) {
      if (error instanceof Error && error.message === "EMAIL_IN_USE") throw new ApiError(409, "CONFLICT", "An account already exists for this email. Log in instead.");
      throw error;
    }
    res.status(201).json(await issueToken(user));
  }));

  api.post("/auth/login", authLimiter, handle(async (req, res) => {
    const body = credentials.parse(req.body);
    const user = await getNativeUserByEmail(body.email);
    if (!user || user.loginMethod !== "native" || !(await verifyPassword(body.password, user.passwordHash))) throw new ApiError(401, "UNAUTHORIZED", "Incorrect email or password.");
    if (user.accountStatus === "disabled") throw new ApiError(403, "FORBIDDEN", "This account is disabled.");
    res.json(await issueToken(user));
  }));

  api.post("/auth/refresh", requireAuth, handle(async (req, res) => { res.json(await issueToken((req as AuthedRequest).user)); }));

  // Tokens are stateless JWTs: logging out means the app deletes its stored token.
  api.post("/auth/logout", (_req, res) => { res.status(204).end(); });

  api.get("/me", requireAuth, (req, res) => { res.json({ user: publicUser((req as AuthedRequest).user) }); });

  // ---- Documents (metadata only; PDF bytes stay on the device) ------------
  api.get("/documents", requireAuth, handle(async (req, res) => {
    const { limit, offset } = pageQuery.parse(req.query);
    const owner = (req as AuthedRequest).user.id;
    const [items, total] = await Promise.all([listDocumentsByOwner(owner, { limit, offset }), countDocumentsByOwner(owner)]);
    res.json({ data: items.map(publicDocument), pagination: { limit, offset, total } });
  }));

  api.post("/documents", requireAuth, handle(async (req, res) => {
    const body = documentBody.parse(req.body);
    const owner = (req as AuthedRequest).user.id;
    const id = await createDocument({ ...body, ownerId: owner });
    const created = await getDocumentByOwner(owner, id);
    if (!created) throw new ApiError(500, "INTERNAL_ERROR", "The document was saved but could not be read back.");
    res.status(201).location(`${req.baseUrl}/documents/${id}`).json({ data: publicDocument(created) });
  }));

  api.get("/documents/:id", requireAuth, handle(async (req, res) => {
    const document = await getDocumentByOwner((req as AuthedRequest).user.id, idParam.parse(req.params.id));
    if (!document) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    res.json({ data: publicDocument(document) });
  }));

  api.patch("/documents/:id", requireAuth, handle(async (req, res) => {
    const id = idParam.parse(req.params.id);
    const { name } = renameBody.parse(req.body);
    const owner = (req as AuthedRequest).user.id;
    if (!(await renameDocument(owner, id, name))) {
      // MySQL reports 0 affected rows when the name is unchanged, so confirm ownership before 404ing.
      if (!(await getDocumentByOwner(owner, id))) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    }
    res.json({ data: publicDocument((await getDocumentByOwner(owner, id))!) });
  }));

  api.delete("/documents/:id", requireAuth, handle(async (req, res) => {
    if (!(await deleteDocument((req as AuthedRequest).user.id, idParam.parse(req.params.id)))) throw new ApiError(404, "NOT_FOUND", "Document not found.");
    res.status(204).end();
  }));

  // ---- Fallbacks ----------------------------------------------------------
  api.use((req, _res, next) => next(new ApiError(404, "NOT_FOUND", `No endpoint for ${req.method} ${req.baseUrl}${req.path}.`)));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  api.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ApiError) return void res.status(error.status).json({ error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } });
    if (error instanceof ZodError) return void res.status(400).json({ error: { code: "VALIDATION_ERROR", message: error.issues[0]?.message ?? "Invalid request.", details: error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) } });
    if (error instanceof SyntaxError && "body" in error) return void res.status(400).json({ error: { code: "INVALID_JSON", message: "The request body is not valid JSON." } });
    console.error("[API v1]", error);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." } });
  });

  return api;
}
