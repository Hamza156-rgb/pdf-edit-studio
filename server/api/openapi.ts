// OpenAPI 3.1 description of /api/v1, served at /api/v1/openapi.json.
// Keep in sync with ./v1.ts; the contract test in v1.test.ts checks every route is documented.

const error = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
const json = (schema: object, description = "OK") => ({ description, content: { "application/json": { schema } } });
const body = (ref: string) => ({ required: true, content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } } });
const secured = [{ bearerAuth: [] }];
const idParameter = { name: "id", in: "path", required: true, schema: { type: "integer", minimum: 1 } };

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "Editly Mobile API",
    version: "1.0.0",
    description: "REST API for the Editly mobile apps. Authenticate with `Authorization: Bearer <token>` from /auth/login or /auth/signup. Tokens last 30 days; call /auth/refresh to extend. Documents are metadata only — PDF bytes stay on the device.",
  },
  servers: [{ url: "/api/v1" }],
  components: {
    securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
    schemas: {
      Error: {
        type: "object", required: ["error"],
        properties: { error: { type: "object", required: ["code", "message"], properties: {
          code: { type: "string", enum: ["VALIDATION_ERROR", "INVALID_JSON", "UNAUTHORIZED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "RATE_LIMITED", "INTERNAL_ERROR"] },
          message: { type: "string" },
          details: { type: "array", items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } } },
        } } },
      },
      User: {
        type: "object", required: ["id", "name", "email", "role", "createdAt"],
        properties: { id: { type: "integer" }, name: { type: ["string", "null"] }, email: { type: ["string", "null"] }, role: { type: "string", enum: ["user", "admin"] }, createdAt: { type: "string", format: "date-time" } },
      },
      Session: {
        type: "object", required: ["token", "tokenType", "expiresAt", "user"],
        properties: { token: { type: "string" }, tokenType: { const: "Bearer" }, expiresAt: { type: "string", format: "date-time" }, user: { $ref: "#/components/schemas/User" } },
      },
      Document: {
        type: "object", required: ["id", "name", "originalFileName", "pageCount", "byteSize", "createdAt", "updatedAt", "lastOpenedAt"],
        properties: {
          id: { type: "integer" }, name: { type: "string" }, originalFileName: { type: "string" }, pageCount: { type: "integer" }, byteSize: { type: "integer" },
          createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }, lastOpenedAt: { type: ["string", "null"], format: "date-time" },
        },
      },
      SignupRequest: { type: "object", required: ["name", "email", "password"], properties: { name: { type: "string", minLength: 2, maxLength: 120 }, email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 128 } } },
      LoginRequest: { type: "object", required: ["email", "password"], properties: { email: { type: "string", format: "email" }, password: { type: "string", minLength: 8, maxLength: 128 } } },
      CreateDocumentRequest: {
        type: "object", required: ["name", "originalFileName", "pageCount", "byteSize"],
        properties: { name: { type: "string", minLength: 1, maxLength: 255 }, originalFileName: { type: "string", minLength: 1, maxLength: 255 }, pageCount: { type: "integer", minimum: 1, maximum: 5000 }, byteSize: { type: "integer", minimum: 1 } },
      },
      RenameDocumentRequest: { type: "object", required: ["name"], properties: { name: { type: "string", minLength: 1, maxLength: 255 } } },
    },
  },
  paths: {
    "/health": { get: { summary: "Service health", responses: { 200: json({ type: "object", properties: { status: { const: "ok" }, version: { type: "string" }, time: { type: "string", format: "date-time" } } }) } } },
    "/openapi.json": { get: { summary: "This API description", responses: { 200: json({ type: "object" }) } } },
    "/auth/signup": { post: { summary: "Create an account", requestBody: body("SignupRequest"), responses: { 201: json({ $ref: "#/components/schemas/Session" }, "Account created"), 400: error("Invalid input"), 409: error("Email already registered"), 429: error("Too many attempts") } } },
    "/auth/login": { post: { summary: "Log in with email and password", requestBody: body("LoginRequest"), responses: { 200: json({ $ref: "#/components/schemas/Session" }), 400: error("Invalid input"), 401: error("Wrong email or password"), 403: error("Account disabled"), 429: error("Too many attempts") } } },
    "/auth/refresh": { post: { summary: "Exchange a valid token for a fresh 30-day token", security: secured, responses: { 200: json({ $ref: "#/components/schemas/Session" }), 401: error("Missing or expired token"), 403: error("Account disabled") } } },
    "/auth/logout": { post: { summary: "Log out (client discards its token)", responses: { 204: { description: "Logged out" } } } },
    "/me": { get: { summary: "Current user", security: secured, responses: { 200: json({ type: "object", required: ["user"], properties: { user: { $ref: "#/components/schemas/User" } } }), 401: error("Missing or expired token"), 403: error("Account disabled") } } },
    "/documents": {
      get: {
        summary: "List your documents, newest first", security: secured,
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }, { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } }],
        responses: { 200: json({ type: "object", required: ["data", "pagination"], properties: { data: { type: "array", items: { $ref: "#/components/schemas/Document" } }, pagination: { type: "object", properties: { limit: { type: "integer" }, offset: { type: "integer" }, total: { type: "integer" } } } } }), 401: error("Missing or expired token") },
      },
      post: { summary: "Record a document in your library", security: secured, requestBody: body("CreateDocumentRequest"), responses: { 201: json({ type: "object", properties: { data: { $ref: "#/components/schemas/Document" } } }, "Created"), 400: error("Invalid input"), 401: error("Missing or expired token") } },
    },
    "/documents/{id}": {
      parameters: [idParameter],
      get: { summary: "Get one document", security: secured, responses: { 200: json({ type: "object", properties: { data: { $ref: "#/components/schemas/Document" } } }), 401: error("Missing or expired token"), 404: error("Not found or not yours") } },
      patch: { summary: "Rename a document", security: secured, requestBody: body("RenameDocumentRequest"), responses: { 200: json({ type: "object", properties: { data: { $ref: "#/components/schemas/Document" } } }), 400: error("Invalid input"), 401: error("Missing or expired token"), 404: error("Not found or not yours") } },
      delete: { summary: "Delete a document", security: secured, responses: { 204: { description: "Deleted" }, 401: error("Missing or expired token"), 404: error("Not found or not yours") } },
    },
  },
} as const;
