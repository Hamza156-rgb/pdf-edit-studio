import { desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { documents, InsertDocument, InsertUser, users } from "../drizzle/schema";
import { randomUUID } from "node:crypto";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getNativeUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const result = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return result[0];
}

export async function createNativeUser(input: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const email = input.email.toLowerCase();
  const existing = await getNativeUserByEmail(email);
  if (existing) throw new Error("EMAIL_IN_USE");
  const openId = `native_${randomUUID()}`;
  await db.insert(users).values({ openId, name: input.name, email, passwordHash: input.passwordHash, loginMethod: "native", lastSignedIn: new Date() });
  const user = await getUserByOpenId(openId);
  if (!user) throw new Error("Unable to create account");
  return user;
}

export async function listDocumentsByOwner(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(documents).where(eq(documents.ownerId, ownerId)).orderBy(desc(documents.updatedAt));
}

export async function createDocument(input: InsertDocument) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(documents).values(input);
}

export async function renameDocument(ownerId: number, documentId: number, name: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(documents).set({ name }).where(sql`${documents.id} = ${documentId} and ${documents.ownerId} = ${ownerId}`);
}

export async function deleteDocument(ownerId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(documents).where(sql`${documents.id} = ${documentId} and ${documents.ownerId} = ${ownerId}`);
}

export async function getAdminOverview() {
  const db = await getDb();
  if (!db) return { totalUsers: 0, activeUsers: 0, totalDocuments: 0, managedBytes: 0 };
  const [userCounts] = await db.select({
    totalUsers: sql<number>`count(*)`,
    activeUsers: sql<number>`sum(case when ${users.accountStatus} = 'active' then 1 else 0 end)`,
  }).from(users);
  const [documentCounts] = await db.select({
    totalDocuments: sql<number>`count(*)`,
    managedBytes: sql<number>`coalesce(sum(${documents.byteSize}), 0)`,
  }).from(documents);
  return {
    totalUsers: Number(userCounts?.totalUsers ?? 0),
    activeUsers: Number(userCounts?.activeUsers ?? 0),
    totalDocuments: Number(documentCounts?.totalDocuments ?? 0),
    managedBytes: Number(documentCounts?.managedBytes ?? 0),
  };
}

export async function listAdminUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    accountStatus: users.accountStatus,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt)).limit(100);
}

export async function setUserAccountStatus(userId: number, accountStatus: "active" | "disabled") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(users).set({ accountStatus }).where(eq(users.id, userId));
}

export async function deleteUserAccount(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(users).where(eq(users.id, userId));
}
