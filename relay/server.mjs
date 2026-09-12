/**
 * Linkline relay — a tiny standalone WebSocket rendezvous server.
 *
 * Deploy on Render free tier:
 *   - New > Web Service > Node
 *   - Build command:  npm install ws        (or use the bundled render.yaml)
 *   - Start command:  node relay/server.mjs
 *   - Health path:    /health
 *
 * Protocol (query-string session, JSON frames):
 *   connect:   wss://HOST/?room=CODE&name=NAME&color=%23c8f04a&id=CLIENTID
 *   server ->  { type:"welcome", selfId, room, peers:[{id,name,color}] }
 *   server ->  { type:"peer-join" | "peer-leave", ... }
 *   server ->  { type:"msg", mid, from:{id,name,color}, text, ts }
 *   server ->  { type:"typing", from, on }
 *   client ->  { type:"msg", mid, text } | { type:"typing", on } | { type:"ping" }
 */

import http from "node:http";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT || 8787);
const HEARTBEAT_MS = 30_000;
const MAX_FRAME = 8 * 1024;
const MAX_TEXT = 2000;
const MAX_NAME = 40;
const RATE_PER_SEC = 12;
const MAX_BUFFERED = 512 * 1024;

/** @type {Map<string, Map<string, import("ws").WebSocket & {meta: ClientMeta}>>} */
const rooms = new Map();

/**
 * @typedef {{ id: string, name: string, color: string, room: string, alive: boolean, tokens: number, lastRefill: number }} ClientMeta
 */

// eslint-disable-next-line no-control-regex
const clean = (v, max) => String(v ?? "").replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, max);

function peerOf(meta) {
  return { id: meta.id, name: meta.name, color: meta.color };
}

function send(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  if (ws.bufferedAmount > MAX_BUFFERED) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
    /* socket is dying; cleanup runs on close */
  }
}

function broadcast(roomCode, obj, exceptId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  const payload = JSON.stringify(obj);
  for (const [id, ws] of room) {
    if (id === exceptId) continue;
    if (ws.readyState !== ws.OPEN || ws.bufferedAmount > MAX_BUFFERED) continue;
    try {
      ws.send(payload);
    } catch {
      /* noop */
    }
  }
}

function leaveRoom(ws) {
  const meta = ws.meta;
  if (!meta || !meta.room) return;
  const room = rooms.get(meta.room);
  if (room) {
    room.delete(meta.id);
    broadcast(meta.room, { type: "peer-leave", id: meta.id });
    if (room.size === 0) rooms.delete(meta.room);
    console.log(`[relay] - ${meta.name}#${meta.id.slice(0, 6)} left ${meta.room} (${room.size} inside)`);
  }
  meta.room = "";
}

function joinRoom(ws, { room, name, color, id }) {
  const meta = ws.meta;
  leaveRoom(ws);
  meta.room = clean(room, 24).toUpperCase();
  meta.name = clean(name, MAX_NAME) || "anon";
  meta.color = clean(color, 16) || "#c8f04a";
  if (id) meta.id = clean(id, 64);
  if (!meta.room) return;

  let bucket = rooms.get(meta.room);
  if (!bucket) {
    bucket = new Map();
    rooms.set(meta.room, bucket);
  }
  // If the same client id reconnects, drop the stale socket
  const stale = bucket.get(meta.id);
  if (stale && stale !== ws) {
    try {
      stale.terminate();
    } catch {
      /* noop */
    }
    bucket.delete(meta.id);
  }
  bucket.set(meta.id, ws);

  const peers = [...bucket.values()]
    .filter((peer) => peer.meta.id !== meta.id)
    .map((peer) => peerOf(peer.meta));

  send(ws, { type: "welcome", selfId: meta.id, room: meta.room, peers });
  broadcast(meta.room, { type: "peer-join", peer: peerOf(meta) }, meta.id);
  console.log(`[relay] + ${meta.name}#${meta.id.slice(0, 6)} joined ${meta.room} (${bucket.size} inside, ${rooms.size} rooms)`);
}

function allowThrough(meta) {
  const now = Date.now();
  meta.tokens = Math.min(RATE_PER_SEC, meta.tokens + ((now - meta.lastRefill) / 1000) * RATE_PER_SEC);
  meta.lastRefill = now;
  if (meta.tokens < 1) return false;
  meta.tokens -= 1;
  return true;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/health") {
    const clients = [...rooms.values()].reduce((n, r) => n + r.size, 0);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, rooms: rooms.size, clients, uptime: process.uptime() }));
    return;
  }
  if (url.pathname === "/" && req.method === "GET") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        service: "linkline-relay",
        docs: "connect via wss://HOST/?room=CODE&name=NAME&color=HEX&id=CLIENTID",
      }),
    );
    return;
  }
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const wss = new WebSocketServer({ server, maxPayload: MAX_FRAME });

wss.on("connection", (ws, req) => {
  ws.meta = {
    id: `c-${Math.random().toString(36).slice(2, 10)}`,
    name: "anon",
    color: "#c8f04a",
    room: "",
    alive: true,
    tokens: RATE_PER_SEC,
    lastRefill: Date.now(),
  };

  // Session can arrive via query string…
  try {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.searchParams.get("room")) {
      joinRoom(ws, {
        room: url.searchParams.get("room"),
        name: url.searchParams.get("name"),
        color: url.searchParams.get("color"),
        id: url.searchParams.get("id"),
      });
    }
  } catch {
    /* malformed upgrade url — wait for explicit join */
  }

  ws.on("pong", () => {
    ws.meta.alive = true;
  });

  ws.on("message", (data) => {
    const meta = ws.meta;
    if (!allowThrough(meta)) return;

    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (!msg || typeof msg !== "object") return;

    switch (msg.type) {
      // …or via an explicit join frame from relays/clients that prefer it
      case "join":
        joinRoom(ws, { room: msg.room, name: msg.name, color: msg.color, id: msg.id });
        break;
      case "msg": {
        if (!meta.room) return;
        const text = clean(msg.text, MAX_TEXT);
        const mid = clean(msg.mid, 64) || `m-${Date.now()}`;
        if (!text) return;
        broadcast(meta.room, { type: "msg", mid, from: peerOf(meta), text, ts: Date.now() }, meta.id);
        break;
      }
      case "typing": {
        if (!meta.room) return;
        broadcast(meta.room, { type: "typing", from: peerOf(meta), on: msg.on !== false }, meta.id);
        break;
      }
      case "ping":
        send(ws, { type: "pong", ts: Date.now() });
        break;
      default:
        break;
    }
  });

  ws.on("close", () => leaveRoom(ws));
  ws.on("error", () => {
    try {
      ws.terminate();
    } catch {
      /* noop */
    }
  });
});

// Heartbeat — Render/proxies drop idle sockets; this keeps them warm and reaps ghosts
setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.meta?.alive) {
      try {
        ws.terminate();
      } catch {
        /* noop */
      }
      continue;
    }
    ws.meta.alive = false;
    try {
      ws.ping();
    } catch {
      /* noop */
    }
  }
}, HEARTBEAT_MS);

server.listen(PORT, () => {
  console.log(`[relay] linkline relay listening on :${PORT}`);
});
