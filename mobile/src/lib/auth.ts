import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { ApiRequestError, ApiSession, ApiUser, clearToken, getFlag, getToken, restApi, setFlag, storeToken } from "./native";

/**
 * Auth for the app, entirely over the REST API (/api/v1). Replaces the website's tRPC-based
 * `@/_core/hooks/useAuth` in the mobile build (see vite.config.ts aliases), so the shared editor
 * sees the signed-in user the same way on both platforms.
 */

export const ME_QUERY_KEY = ["me"] as const;
export const DOCUMENTS_QUERY_KEY = ["documents"] as const;
const isAuthError = (error: unknown) => error instanceof ApiRequestError && (error.status === 401 || error.status === 403);

async function fetchCurrentUser(): Promise<ApiUser | null> {
  if (!getToken()) return null;
  try {
    return (await restApi<{ user: ApiUser }>("/me")).user;
  } catch (error) {
    // An expired, revoked, or disabled session signs the user out instead of erroring forever.
    if (isAuthError(error)) { await clearToken(); return null; }
    throw error;
  }
}

export function useAuth() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ME_QUERY_KEY, queryFn: fetchCurrentUser, retry: false, staleTime: 60_000 });

  const logout = useCallback(async () => {
    try { await restApi("/auth/logout", { method: "POST" }); } catch { /* Signing out locally is what matters. */ }
    await clearToken();
    queryClient.setQueryData(ME_QUERY_KEY, null);
    queryClient.removeQueries({ queryKey: DOCUMENTS_QUERY_KEY });
  }, [queryClient]);

  return {
    user: me.data ?? null,
    loading: me.isLoading,
    error: me.error ?? null,
    isAuthenticated: Boolean(me.data),
    refresh: () => me.refetch(),
    logout,
  };
}

/** Stores a fresh session from /auth/login or /auth/signup. */
export async function startSession(session: ApiSession) {
  await storeToken(session.token);
  await setFlag("tokenIssuedAt", String(Date.now()));
}

const REFRESH_AFTER_MS = 12 * 60 * 60 * 1000;

/**
 * Tokens last 30 days. Renewing them at launch and on resume (at most every 12 hours) keeps active
 * users signed in indefinitely; a rejected token signs the user out cleanly.
 */
export async function refreshSessionIfStale() {
  if (!getToken()) return;
  const issuedAt = Number(await getFlag("tokenIssuedAt")) || 0;
  if (Date.now() - issuedAt < REFRESH_AFTER_MS) return;
  try {
    await startSession(await restApi<ApiSession>("/auth/refresh", { method: "POST" }));
  } catch (error) {
    if (isAuthError(error)) await clearToken();
    // Offline or server errors: keep the current token and try again next time.
  }
}
