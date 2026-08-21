import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { createDocument, deleteDocument, deleteUserAccount, getAdminOverview, listAdminUsers, listDocumentsByOwner, renameDocument, setUserAccountStatus } from "./db";

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

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
