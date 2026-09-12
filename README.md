# Linkline

Rendezvous chat over a WebSocket relay. Create a room, get a six-character code and a
shareable link, and talk in real time. Built for **Render's free tier**: no accounts, no
websockets-in-serverless gymnastics — the app degrades to HTTP polling automatically when a
socket can't get through.

- **App**: Next.js (App Router) + PostgreSQL (Drizzle) — rooms & message history
- **Live transport**: any WebSocket relay (`relay/server.mjs` is ours; the default is the
  community relay at `wss://getlinkbycode.onrender.com`)
- **Fallback transport**: `POST /api/rooms/[code]/messages` + polling `GET …?after=<ts>`

## How a message travels

1. The browser opens `wss://<relay>/?room=CODE&name=NAME&color=HEX&id=CLIENTID`.
2. On send, the message fires down the socket **and** `POST`s to the API (idempotent on a
   client-generated `mid`), so history persists and polling clients still receive it.
3. If the relay is unreachable after a few reconnect attempts, the UI flips to
   `live · polling` and keeps delivering — click the status pill to retry the socket.

## Run the app

```bash
npm install
npx drizzle-kit push   # create tables (needs DATABASE_URL in .env)
npm run dev
```

| Env var | Purpose | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection | required |
| `NEXT_PUBLIC_RELAY_URL` | Default WS relay | `wss://getlinkbycode.onrender.com` |

The relay used by the browser can also be changed at runtime (relay icon in the chat header),
and is stored per-browser.

## Deploy your own relay (Render free tier)

`relay/server.mjs` is a zero-config WebSocket rendezvous server (~250 lines):

- `wss://HOST/?room=CODE&name=NAME&color=HEX&id=CLIENTID` joins a room channel
- broadcasts `peer-join` / `peer-leave` / `msg` / `typing`, answers app-level `ping`
- `GET /health` for Render health checks; heartbeat reaps dead sockets
- per-client token bucket (12 msg/s), payload caps, backpressure guard

**Option A — Blueprint**: Render Dashboard → *New + → Blueprint* → pick this repo; it reads
`relay/render.yaml` and provisions a free Node web service.

**Option B — Manual**: *New + → Web Service* → Node → build command `npm install ws`, start
command `node relay/server.mjs`, health check path `/health`, plan **free**.

Then paste your `wss://<name>.onrender.com` URL into the app's relay dialog — or bake it in
via `NEXT_PUBLIC_RELAY_URL`. Free instances sleep when idle; the client redials on focus,
and polling covers the wake-up gap.

## Wire protocol

```
client → relay  { "type": "msg",    "mid": "uuid", "text": "hello" }
client → relay  { "type": "typing", "on": true }
client → relay  { "type": "ping" }
relay  → client { "type": "welcome", "selfId": "…", "room": "K7Q2X9", "peers": [Peer] }
relay  → client { "type": "peer-join" | "peer-leave", … }
relay  → client { "type": "msg", "mid": "uuid", "from": Peer, "text": "hello", "ts": 1700000000000 }
relay  → client { "type": "typing", "from": Peer, "on": true }
```

`Peer = { id, name, color }`. The client normaliser is tolerant of shape drift on third-party
relays (`message`/`chat`/`broadcast`, wrapper `data` keys, etc.).

## HTTP API

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/rooms` | POST | create room → `{ code, name, url }` |
| `/api/rooms/[code]` | GET | room info + last 100 messages |
| `/api/rooms/[code]/messages` | POST | persist message (idempotent on `mid`) |
| `/api/rooms/[code]/messages?after=<ms>` | GET | polling catch-up |
| `/api/health` | GET | liveness |

## Project layout

```
relay/server.mjs          standalone WS relay (your own Render free-tier box)
relay/render.yaml         Render blueprint
src/hooks/use-chat.ts     transport engine: WS ⟷ polling, presence, typing
src/lib/relay.ts          URL builder + tolerant event normaliser
src/lib/protocol.ts       shared wire types
src/app/r/[code]/         room page — visit /r/K7Q2X9 after creating a room
```
