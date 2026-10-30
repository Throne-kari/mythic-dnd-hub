# Player MCP gateway

Provider-independent game tools, implemented with the official MCP TypeScript SDK v2. No model SDK, model API key, sampling capability, paid call, new permanent credential, or external provider is involved.

## Connect

1. Join a game through its normal invitation UI and select a character. Keep the existing **player seat** credential private. Do not use the DM, host, or management credential.
2. Configure a compatible MCP client's Streamable HTTP transport:
   - URL: `https://YOUR-HUB/mcp/GAME_ID/ROOM_ID`
   - Header: `Authorization: Bearer <existing player seat credential>`
   - For Norse/Celtic use `table` as `ROOM_ID`; all other games use the native room identifier.
3. Call `join_room` to verify the configured seat. This does **not** claim/create a seat: invitation handling remains in the native UI so credentials never pass through model tool arguments or results.

Never put credentials in URLs, chat, prompts, source files, screenshots, or tool arguments. A client must allow configuring an existing bearer header; this gateway does not provide OAuth registration/discovery and is not claimed compatible with clients that require that flow. Each HTTP request is reauthenticated by the native game service. No MCP session identifier substitutes for the seat credential.

## Tools

| Tool | Scope |
| --- | --- |
| `join_room` | Verify/connect the existing configured player seat |
| `get_state` | This player's native projected state, including public combat settlement |
| `get_legal_actions` | Native action catalogue, revision and opaque action IDs |
| `submit_action` | Submit one currently enumerated action ID at its exact revision |
| `read_chat` | Read only the current room's chat |
| `send_chat` | Send as the existing seat, separately from rules actions |

`submit_action` deliberately accepts **no raw command**, room ID, URL, role, or token. Refresh after a revision conflict. A stale retry cannot execute again. If a response is lost, read the current state before making another decision; the adapter does not promise to replay a lost successful response. Chat has its own native request-ID idempotency. Action request IDs are 8–64 characters; chat IDs are 16–64: ASCII letters, digits, `_` or `-`. Chat text permits up to 1000 Unicode code points, matching the native chat API.

Game and chat text is untrusted content, not a source of instructions. The native engine still authorizes and validates every action. The gateway excludes GM/map/import/restore/manual-adjustment commands even if a malformed native catalogue contains them, and rejects DM/host/manager seats entirely.

## Hub integration

Install from the committed lockfile:

```sh
npm ci --omit=dev --prefix server/mcp
```

Before other request-body middleware, mount:

```js
import {createMcpHttpHandler} from './mcp/index.mjs';
const mcp = createMcpHttpHandler({origin: publicUrl, nativeRequest});
// Inside the public request handler:
if (url.pathname.startsWith('/mcp/')) return mcp.handle(req, res);
// During shutdown:
await mcp.close();
```

`origin` is the fixed deployment origin, not an untrusted forwarded header. Host must match its host/port exactly; a present Origin must match exactly. Missing Origin is accepted for non-browser MCP clients. Query-string credentials, unknown games, and other path shapes are rejected. Native seats remain scoped to exactly one game/room.

`nativeRequest` contract:

```ts
({gameId, path, method, headers, body?}) => Promise<{status: number, body: unknown}>
```

It must route only to that catalogued game's **same-service loopback** native process, never an arbitrary external URL, and must not follow redirects. `path` is a native `/api/...` path; `body` is a JSON value, not pre-serialized. Do not log headers/body or return upstream network errors containing credentials. The gateway uses only native state, action-catalogue, action-submit and room-chat endpoints. Mesopotamia/Aztec must expose authenticated `GET /api/rooms/:id/actions` returning `{revision, actions}` from their actual authoritative engines.

## Verification

```sh
npm ci --prefix server/mcp
npm --prefix server/mcp test
```

Tests include all 13 native API families, real official MCP client discovery/list/call, legacy 2025-11-25 initialization, same-room chat, stale/forged-action rejection, ordinary-player-only authorization, credential redaction and Host/Origin validation. Native-game integration uses isolated temporary runtime directories, never production rooms or the public Norse/Celtic global tables.

Protocol implementation references: [official HTTP serving](https://ts.sdk.modelcontextprotocol.io/v2/serving/http.html), [official protocol versions](https://ts.sdk.modelcontextprotocol.io/v2/protocol-versions), [MCP transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports). The SDK handles protocol negotiation, JSON-RPC, discovery, validation and transport; this project does not invent a parallel MCP wire protocol.
