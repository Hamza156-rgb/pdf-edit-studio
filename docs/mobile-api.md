# Editly Mobile API (v1)

REST API for the iOS/Android apps (Capacitor or Ionic React). Base path: `/api/v1`.
The machine-readable spec is served at `GET /api/v1/openapi.json` (OpenAPI 3.1) — import it into Postman/Insomnia or generate a typed client from it.

## Authentication

1. `POST /auth/signup` or `POST /auth/login` returns a session:
   ```json
   { "token": "eyJ…", "tokenType": "Bearer", "expiresAt": "2026-11-18T10:00:00.000Z", "user": { "id": 1, "name": "Ayesha", "email": "ayesha@example.com", "role": "user", "createdAt": "…" } }
   ```
2. Send it on every request: `Authorization: Bearer <token>`.
3. Tokens last 30 days. Call `POST /auth/refresh` (with the current token) when the app opens to get a fresh one.
4. Logout = delete the stored token (`POST /auth/logout` is provided for symmetry and returns 204).

Cookies are ignored by this API on purpose: only bearer tokens authenticate, so the endpoints can't be triggered cross-site.
A disabled account gets `403 FORBIDDEN` on login and on any existing token.

## Endpoints

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | – | Liveness check |
| GET | `/openapi.json` | – | API description |
| POST | `/auth/signup` | – | Create account → session (201) |
| POST | `/auth/login` | – | Log in → session |
| POST | `/auth/refresh` | Bearer | New 30-day token |
| POST | `/auth/logout` | – | 204 |
| GET | `/me` | Bearer | Current user |
| GET | `/documents?limit=50&offset=0` | Bearer | Your documents, newest first, `{ data, pagination: { limit, offset, total } }` |
| POST | `/documents` | Bearer | Record a document `{ name, originalFileName, pageCount, byteSize }` → 201 |
| GET | `/documents/:id` | Bearer | One document |
| PATCH | `/documents/:id` | Bearer | Rename `{ name }` |
| DELETE | `/documents/:id` | Bearer | 204 |

Documents are **metadata only** (same as the website): PDF bytes stay on the device. Another user's document always answers `404`.

## Errors

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Use at least 8 characters.", "details": [{ "path": "password", "message": "Use at least 8 characters." }] } }
```

| Status | `code` |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` |
| 401 | `UNAUTHORIZED` (missing/expired token, wrong password) |
| 403 | `FORBIDDEN` (account disabled) |
| 404 | `NOT_FOUND` |
| 409 | `CONFLICT` (email already registered) |
| 429 | `RATE_LIMITED` (10 login/signup attempts per minute per IP; see `Retry-After`) |
| 500 | `INTERNAL_ERROR` |

## Configuration

| Env var | Default | Notes |
| --- | --- | --- |
| `MOBILE_ALLOWED_ORIGINS` | `capacitor://localhost,ionic://localhost,http://localhost,https://localhost` | CORS origins for the app's WebView. Requests through Capacitor's native HTTP plugin don't need CORS. |
| `JWT_SECRET` | – | Signs tokens (shared with the website). |

Production must be served over HTTPS. If it runs behind a proxy/load balancer, enable Express `trust proxy` so rate limiting sees real client IPs. The rate limiter is in-memory, so it is per server instance.

## Capacitor client example

```ts
import { Preferences } from "@capacitor/preferences";

const API = "https://your-domain.com/api/v1";

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { value: token } = await Preferences.get({ key: "token" });
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers },
  });
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401) await Preferences.remove({ key: "token" }); // send the user to login
    throw Object.assign(new Error(body.error.message), body.error);
  }
  return body as T;
}

export async function login(email: string, password: string) {
  const session = await api<{ token: string; user: { id: number; name: string } }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  await Preferences.set({ key: "token", value: session.token });
  return session.user;
}
```

For stronger at-rest protection of the token, swap `@capacitor/preferences` for a secure-storage plugin (iOS Keychain / Android Keystore).
