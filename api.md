# API Token & MCP Login — HTTP API Spec

All endpoints are on the existing Gin HTTP server. Authentication uses Web JWT (cookie-based, same as `/web/**` routes).

---

## 1. Login Endpoints (API Token Page)

These endpoints reuse the existing QR login and passkey flows. The web frontend for API token management needs its own login flow — identical to the existing `/web/auth/**` endpoints but under the `/api/auth/**` path.

### 1.1 QR Code Login

#### POST /api/auth/qr/ticket

Create a QR login ticket for the API token management page.

**Auth:** None (public)

**Request:** (empty body)

**Response:**

```json
{
  "code": "200",
  "data": {
    "ticket": "qr_xxx",
    "expires_in": 300
  }
}
```

**Implementation:** Calls `qrlogin.UseCase.CreateTicket()` — same as the existing `/web/auth/qr/ticket` handler.

---

#### GET /api/auth/qr/ticket/:ticket

Poll QR login ticket status. When confirmed, sets `web_token` + `web_refresh_token` cookies.

**Auth:** None (public)

**Response (pending):**

```json
{
  "code": "200",
  "data": {
    "state": "PENDING"
  }
}
```

**Response (confirmed):**

```json
{
  "code": "200",
  "data": {
    "state": "CONFIRMED"
  }
}
```

On CONFIRMED, the response sets `Set-Cookie` headers for `web_token` and `web_refresh_token` (same as existing web QR login).

**Implementation:** Calls `qrlogin.UseCase.CheckForWeb()` — same as the existing `/web/auth/qr/ticket/:ticket` handler.

---

### 1.2 Passkey Login

#### POST /api/auth/passkey/option

Get WebAuthn PublicKeyCredentialRequestOptions for passkey login.

**Auth:** None (public)

**Request:** (empty body)

**Response:**

```json
{
  "code": "200",
  "data": {
    "option": { "...PublicKeyCredentialRequestOptions..." },
    "session": "handle_xxx"
  }
}
```

**Implementation:** Calls `webauth.UseCase.GetPasskeyLoginOption()` — same as the existing `/web/auth/passkey/option` handler.

---

#### POST /api/auth/passkey/login

Verify passkey assertion and issue tokens. Sets `web_token` + `web_refresh_token` cookies.

**Auth:** None (public)

**Request:**

```json
{
  "assertion_json": "{...}",
  "session": "handle_xxx"
}
```

**Response:**

```json
{
  "code": "200",
  "data": {
    "user_id": "abc123",
    "nickname": "张三",
    "avatar_url": "https://cdn.example.com/avatar.jpg"
  }
}
```

On success, the response sets `Set-Cookie` headers for `web_token` and `web_refresh_token`.

**Implementation:** Calls `webauth.UseCase.LoginWithPasskey()` — same as the existing `/web/auth/passkey/login` handler.

---

### 1.3 Session

#### GET /api/auth/me

Get current user profile. Used by the API token management page to display user info.

**Auth:** WebAuth (cookie)

**Response:**

```json
{
  "code": "200",
  "data": {
    "user_id": "abc123",
    "nickname": "张三",
    "avatar_url": "https://cdn.example.com/avatar.jpg"
  }
}
```

**Implementation:** Calls `webauth.UseCase.GetProfile()` — same as the existing `/web/auth/me` handler.

---

#### POST /api/auth/logout

Revoke current web session and clear cookies.

**Auth:** WebAuth (cookie)

**Response:**

```json
{
  "code": "200",
  "data": null
}
```

Clears `web_token` and `web_refresh_token` cookies.

**Implementation:** Calls `webauth.UseCase.Logout()` — same as the existing `/web/auth/logout` handler.

---

#### POST /api/auth/refresh

Refresh web session using refresh token cookie.

**Auth:** None (uses refresh cookie)

**Response:** Sets new `web_token` + `web_refresh_token` cookies.

**Implementation:** Calls `webauth.UseCase.Refresh()` — same as the existing `/web/auth/refresh` handler.

---

## 2. API Token CRUD

### 2.1 Create Token

#### POST /api/tokens

Create a new API token with specified scopes and TTL.

**Auth:** WebAuth (cookie)

**Request:**

```json
{
  "name": "Cursor IDE",
  "scopes": ["mcp"],
  "ttl_days": 30
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Human-readable label (1–128 chars) |
| `scopes` | []string | yes | Permission scopes, must be a subset of valid scopes |
| `ttl_days` | int | yes | Token lifetime in days (1–30) |

**Validation rules:**
- `name` must not be empty, max 128 chars
- `scopes` must be a non-empty subset of: `mcp`, `mcp:read`, `mcp:write`, `openapi`, `openapi:read`, `openapi:write`
- `ttl_days` must be between 1 and 30 (inclusive)
- User must not exceed max token limit (5 active tokens)

**Response:**

```json
{
  "code": "200",
  "data": {
    "id": "uuid-xxx",
    "name": "Cursor IDE",
    "token": "ham_a1b2c3d4e5f6...",
    "scopes": ["mcp"],
    "expires_at": "2026-06-20T12:00:00Z",
    "created_at": "2026-05-21T12:00:00Z"
  }
}
```

> **Important**: The `token` field contains the raw token and is only returned once. It cannot be retrieved again.

---

### 2.2 List Tokens

#### GET /api/tokens

List all API tokens for the current user. Token values are masked.

**Auth:** WebAuth (cookie)

**Response:**

```json
{
  "code": "200",
  "data": {
    "tokens": [
      {
        "id": "uuid-xxx",
        "name": "Cursor IDE",
        "last4": "f6g7",
        "scopes": ["mcp"],
        "last_used_at": "2026-05-21T10:00:00Z",
        "expires_at": "2026-06-20T12:00:00Z",
        "created_at": "2026-05-21T12:00:00Z"
      }
    ]
  }
}
```

---

### 2.3 Rotate Token

#### POST /api/tokens/:id/rotate

Rotate an API token. The old token is **immediately revoked**. A new token is created with the same name and scopes, but with a fresh TTL counted from now. The new raw token is returned (shown only once).

**Auth:** WebAuth (cookie)

**Request:**

```json
{
  "ttl_days": 30
}
```

|| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `ttl_days` | int | yes | New token lifetime in days (1–30) |

**Response:**

```json
{
  "code": "200",
  "data": {
    "id": "uuid-new",
    "name": "Cursor IDE",
    "token": "ham_x9y8z7w6v5u4...",
    "scopes": ["mcp"],
    "expires_at": "2026-06-20T12:00:00Z",
    "created_at": "2026-05-21T12:00:00Z"
  }
}
```

> **Important**: The old token (`:id`) is revoked immediately. The `token` field of the new token is only returned once.

---

### 2.4 Revoke Token

#### DELETE /api/tokens/:id

Revoke (delete) an API token.

**Auth:** WebAuth (cookie)

**Response:**

```json
{
  "code": "200",
  "data": null
}
```

---

## 3. Route Registration

All routes are registered on the existing Gin HTTP engine under `/api/**`:

| Method | Path | Auth | Middleware | Handler |
|--------|------|------|------------|---------|
| POST | `/api/auth/qr/ticket` | None | Context, RouteAccessControl, GlobalRateLimit(20QPS) | CreateQrLoginTicketHandler |
| GET | `/api/auth/qr/ticket/:ticket` | None | Context, RouteAccessControl, KeyedRateLimit(1QPS) | CheckQrLoginTicketHandler |
| POST | `/api/auth/passkey/option` | None | Context, RouteAccessControl, GlobalRateLimit(10QPS) | PasskeyOptionHandler |
| POST | `/api/auth/passkey/login` | None | Context, RouteAccessControl, GlobalRateLimit(10QPS) | PasskeyLoginHandler |
| POST | `/api/auth/refresh` | None | Context, RouteAccessControl | RefreshHandler |
| GET | `/api/auth/me` | WebAuth | Context, RouteAccessControl, WebAuth | MeHandler |
| POST | `/api/auth/logout` | WebAuth | Context, RouteAccessControl, WebAuth | LogoutHandler |
| POST | `/api/tokens` | WebAuth | Context, RouteAccessControl, WebAuth, UserRateLimit(5QPS) | CreateAPITokenHandler |
| GET | `/api/tokens` | WebAuth | Context, RouteAccessControl, WebAuth, UserRateLimit(10QPS) | ListAPITokensHandler |
| POST | `/api/tokens/:id/rotate` | WebAuth | Context, RouteAccessControl, WebAuth, UserRateLimit(5QPS) | RotateAPITokenHandler |
| DELETE | `/api/tokens/:id` | WebAuth | Context, RouteAccessControl, WebAuth, UserRateLimit(5QPS) | RevokeAPITokenHandler |

> **Note**: The `/api/auth/**` handlers reuse the same use case instances as `/web/auth/**`. They are separate handler functions (different paths, potentially different CORS config) but call the same application-layer logic.

---

## 4. Error Responses

All errors follow the existing `HTTPResponse` format:

```json
{
  "code": "12000",
  "message": "登录信息出错啦…"
}
```

Relevant error codes for API token endpoints:

| errorx Code | HTTP Status | Meaning |
|-------------|-------------|---------|
| `10011` BadRequest | 400 | Invalid request (bad scopes, ttl_days out of range, empty name) |
| `12000` TokenError | 401 | Invalid web auth session |
| `12001` TokenExpired | 401 | Web auth session expired |
| `12002` Forbidden | 403 | Token limit exceeded (5 max) |
| `40400` NotFound | 404 | Token ID not found (on DELETE) |
| `50000` InternalServerError | 500 | Unexpected error |

---

## 5. OpenAPI 3.1 Specification

```yaml
openapi: 3.1.0
info:
  title: HAM API Token & Auth API
  description: HTTP API for API token management and authentication (QR login, Passkey login).
  version: 1.0.0
  contact:
    name: HAM Backend Team

servers:
  - url: https://api.example.com
    description: Production

tags:
  - name: Auth - QR Login
    description: QR code login flow for API token management page
  - name: Auth - Passkey
    description: Passkey (WebAuthn) login flow
  - name: Auth - Session
    description: Session management
  - name: API Tokens
    description: API token CRUD

paths:
  /api/auth/qr/ticket:
    post:
      operationId: createQrTicket
      summary: Create QR login ticket
      tags: [Auth - QR Login]
      security: []
      responses:
        "200":
          description: Ticket created
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          ticket:
                            type: string
                            example: qr_xxx
                          expires_in:
                            type: integer
                            example: 300

  /api/auth/qr/ticket/{ticket}:
    get:
      operationId: checkQrTicket
      summary: Poll QR login ticket status
      tags: [Auth - QR Login]
      security: []
      parameters:
        - name: ticket
          in: path
          required: true
          schema:
            type: string
      responses:
        "200":
          description: Ticket status
          headers:
            Set-Cookie:
              schema:
                type: string
              description: "Sets web_token and web_refresh_token cookies on CONFIRMED"
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          state:
                            type: string
                            enum: [PENDING, CONFIRMED, EXPIRED]

  /api/auth/passkey/option:
    post:
      operationId: getPasskeyOption
      summary: Get WebAuthn login options
      tags: [Auth - Passkey]
      security: []
      responses:
        "200":
          description: Passkey login options
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          option:
                            type: object
                            description: PublicKeyCredentialRequestOptions
                          session:
                            type: string
                            example: handle_xxx

  /api/auth/passkey/login:
    post:
      operationId: passkeyLogin
      summary: Verify passkey assertion and login
      tags: [Auth - Passkey]
      security: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [assertion_json, session]
              properties:
                assertion_json:
                  type: string
                  description: JSON-encoded AuthenticatorAssertionResponse
                session:
                  type: string
                  description: Session handle from /api/auth/passkey/option
      responses:
        "200":
          description: Login successful
          headers:
            Set-Cookie:
              schema:
                type: string
              description: "Sets web_token and web_refresh_token cookies"
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/UserProfile"

  /api/auth/me:
    get:
      operationId: getMe
      summary: Get current user profile
      tags: [Auth - Session]
      responses:
        "200":
          description: User profile
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/UserProfile"

  /api/auth/logout:
    post:
      operationId: logout
      summary: Logout and clear session
      tags: [Auth - Session]
      responses:
        "200":
          description: Logged out
          headers:
            Set-Cookie:
              schema:
                type: string
              description: "Clears web_token and web_refresh_token cookies"
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: "null"

  /api/auth/refresh:
    post:
      operationId: refreshSession
      summary: Refresh web session
      tags: [Auth - Session]
      security: []
      responses:
        "200":
          description: Session refreshed
          headers:
            Set-Cookie:
              schema:
                type: string
              description: "Sets new web_token and web_refresh_token cookies"
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: "null"

  /api/tokens:
    post:
      operationId: createApiToken
      summary: Create a new API token
      tags: [API Tokens]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/CreateTokenRequest"
      responses:
        "200":
          description: Token created
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/CreateTokenResponse"
        "400":
          description: Bad request (invalid scopes, ttl_days out of range, empty name)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"
        "403":
          description: Token limit exceeded (5 max)
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

    get:
      operationId: listApiTokens
      summary: List all API tokens for current user
      tags: [API Tokens]
      responses:
        "200":
          description: Token list
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: object
                        properties:
                          tokens:
                            type: array
                            items:
                              $ref: "#/components/schemas/TokenListItem"

  /api/tokens/{id}:
    delete:
      operationId: revokeApiToken
      summary: Revoke an API token
      tags: [API Tokens]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Token revoked
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        type: "null"
        "404":
          description: Token not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

  /api/tokens/{id}/rotate:
    post:
      operationId: rotateApiToken
      summary: Rotate an API token (revoke old, create new with same name/scopes and fresh TTL)
      tags: [API Tokens]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [ttl_days]
              properties:
                ttl_days:
                  type: integer
                  minimum: 1
                  maximum: 30
                  example: 30
      responses:
        "200":
          description: Token rotated — old token revoked, new token returned
          content:
            application/json:
              schema:
                allOf:
                  - $ref: "#/components/schemas/BaseResponse"
                  - type: object
                    properties:
                      data:
                        $ref: "#/components/schemas/CreateTokenResponse"
        "404":
          description: Token not found
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/ErrorResponse"

components:
  securitySchemes:
    cookieAuth:
      type: apiKey
      in: cookie
      name: web_token

  schemas:
    BaseResponse:
      type: object
      required: [code]
      properties:
        code:
          type: string
          example: "200"
        message:
          type: string

    ErrorResponse:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
          example: "10011"
        message:
          type: string
          example: "bad request"

    UserProfile:
      type: object
      properties:
        user_id:
          type: string
          example: abc123
        nickname:
          type: string
          example: "张三"
        avatar_url:
          type: string
          format: uri
          example: https://cdn.example.com/avatar.jpg

    CreateTokenRequest:
      type: object
      required: [name, scopes, ttl_days]
      properties:
        name:
          type: string
          minLength: 1
          maxLength: 128
          example: "Cursor IDE"
        scopes:
          type: array
          items:
            type: string
            enum: [mcp, "mcp:read", "mcp:write", openapi, "openapi:read", "openapi:write"]
          minItems: 1
          example: [mcp]
        ttl_days:
          type: integer
          minimum: 1
          maximum: 30
          example: 30

    CreateTokenResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        token:
          type: string
          description: "Raw API token — only returned once, cannot be retrieved again"
          example: "ham_a1b2c3d4e5f6..."
        scopes:
          type: array
          items:
            type: string
        expires_at:
          type: string
          format: date-time
        created_at:
          type: string
          format: date-time

    TokenListItem:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        last4:
          type: string
          description: "Last 4 characters of the raw token"
          example: f6g7
        scopes:
          type: array
          items:
            type: string
        last_used_at:
          type: string
          format: date-time
          nullable: true
        expires_at:
          type: string
          format: date-time
        created_at:
          type: string
          format: date-time

security:
  - cookieAuth: []
```
