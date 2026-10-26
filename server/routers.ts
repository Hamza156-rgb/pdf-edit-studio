import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createDocument, createNativeUser, deleteDocument, deleteUserAccount, getAdminOverview, getNativeUserByEmail, listAdminUsers, listDocumentsByOwner, renameDocument, setUserAccountStatus } from "./db";
import { hashPassword, verifyPassword } from "./nativeAuth";
import { sdk } from "./_core/sdk";

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "Administrator access required." });
  return next();
});

const documentInput = z.object({
  name: z.string().trim().min(1).max(255),
  originalFileName: z.string().trim().min(1).max(255),
  pageCount: z.number().int().min(1).max(5000),
  byteSize: z.number().int().min(1).max(1024 * 1024 * 1024),
  storageKey: z.string().max(512).optional(),
});

const nativeAccountInput = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(8, "Use at least 8 characters.").max(128),
});

const sessionCookieMaxAge = 1000 * 60 * 60 * 24 * 30;

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => {
      if (!opts.ctx.user) return null;
      // Never send the password hash to the browser or apps.
      const { passwordHash: _passwordHash, ...user } = opts.ctx.user;
      return user;
    }),
    nativeSignup: publicProcedure.input(nativeAccountInput.extend({ name: z.string().trim().min(2, "Enter your name.").max(120) })).mutation(async ({ ctx, input }) => {
      try {
        const user = await createNativeUser({ name: input.name, email: input.email, passwordHash: await hashPassword(input.password) });
        const token = await sdk.createSessionToken(user.openId, { name: user.name || input.name, expiresInMs: sessionCookieMaxAge });
        ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: sessionCookieMaxAge });
        return { id: user.id, name: user.name, email: user.email };
      } catch (error) {
        if (error instanceof Error && error.message === "EMAIL_IN_USE") throw new TRPCError({ code: "CONFLICT", message: "An account already exists for this email. Log in instead." });
        throw error;
      }
    }),
    nativeLogin: publicProcedure.input(nativeAccountInput).mutation(async ({ ctx, input }) => {
      const user = await getNativeUserByEmail(input.email);
      if (!user || user.loginMethod !== "native" || !(await verifyPassword(input.password, user.passwordHash))) throw new TRPCError({ code: "UNAUTHORIZED", message: "Incorrect email or password." });
      if (user.accountStatus === "disabled") throw new TRPCError({ code: "FORBIDDEN", message: "This account is disabled." });
      const token = await sdk.createSessionToken(user.openId, { name: user.name || "Member", expiresInMs: sessionCookieMaxAge });
      ctx.res.cookie(COOKIE_NAME, token, { ...getSessionCookieOptions(ctx.req), maxAge: sessionCookieMaxAge });
      return { id: user.id, name: user.name, email: user.email };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  documents: router({
    list: protectedProcedure.query(({ ctx }) => listDocumentsByOwner(ctx.user.id)),
    create: protectedProcedure.input(documentInput).mutation(({ ctx, input }) => createDocument({ ...input, ownerId: ctx.user.id })),
    rename: protectedProcedure.input(z.object({ id: z.number().int().positive(), name: z.string().trim().min(1).max(255) })).mutation(({ ctx, input }) => renameDocument(ctx.user.id, input.id, input.name)),
    delete: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteDocument(ctx.user.id, input.id)),
  }),
  admin: router({
    overview: adminProcedure.query(() => getAdminOverview()),
    users: adminProcedure.query(() => listAdminUsers()),
    setUserStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), accountStatus: z.enum(["active", "disabled"]) })).mutation(({ ctx, input }) => {
      if (ctx.user.id === input.id && input.accountStatus === "disabled") throw new TRPCError({ code: "BAD_REQUEST", message: "Administrators cannot disable their active session." });
      return setUserAccountStatus(input.id, input.accountStatus);
    }),
    deleteUser: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => {
      if (ctx.user.id === input.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Administrators cannot delete their own active account." });
      return deleteUserAccount(input.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
