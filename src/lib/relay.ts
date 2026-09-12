import type { Peer, RelayEvent } from "@/lib/protocol";

/**
 * Merge session params into the relay URL *without* rewriting its path,
 * so it works against `wss://host`, `wss://host/ws`, `wss://host/socket`, etc.
 */
export function buildRelayWsUrl(
  relayBase: string,
  session: { room: string; name: string; color: string; id: string },
): string {
  const base = relayBase.trim().replace(/^http/i, "ws").replace(/\/+$/, "");
  const url = new URL(base);
  url.searchParams.set("room", session.room);
  url.searchParams.set("name", session.name);
  url.searchParams.set("color", session.color);
  url.searchParams.set("id", session.id);
  return url.toString();
}

/** Some relays frame messages with a `data`/`payload` wrapper — unwrap it */
function unwrap(raw: Record<string, unknown>): Record<string, unknown> {
  for (const key of ["data", "payload", "body"]) {
    const inner = raw[key];
    if (inner && typeof inner === "object" && !Array.isArray(inner) && ("type" in inner || "text" in inner)) {
      return inner as Record<string, unknown>;
    }
  }
  return raw;
}

function asPeer(raw: unknown, fallbackName = "anon", fallbackColor = "#c8f04a"): Peer | null {
  if (typeof raw === "string" && raw.trim()) {
    return { id: raw, name: raw.slice(0, 40), color: fallbackColor };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const name = String(o.name ?? o.author ?? o.username ?? fallbackName).slice(0, 40);
    return {
      id: String(o.id ?? o.clientId ?? name),
      name,
      color: String(o.color ?? fallbackColor).slice(0, 16),
    };
  }
  return null;
}

/**
 * Normalise whatever a WebSocket relay hands us into Linkline's canonical
 * RelayEvent. Tolerant of shape drift on community relays (getlinkbycode et al.).
 */
export function normalizeRelayEvent(rawText: string): RelayEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // A bare string from a very loose relay — render it as a relay note
    const text = rawText.trim();
    if (!text || text.length > 500) return null;
    return {
      type: "msg",
      mid: `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      from: { id: "relay", name: "relay", color: "#8fb8ff" },
      text,
      ts: Date.now(),
    };
  }
  if (!parsed || typeof parsed !== "object") return null;
  const raw = unwrap(parsed as Record<string, unknown>);
  const type = String(raw.type ?? raw.event ?? "").toLowerCase();

  switch (type) {
    case "welcome": {
      const peers = Array.isArray(raw.peers)
        ? (raw.peers as unknown[]).map((p) => asPeer(p)).filter(Boolean) as Peer[]
        : [];
      return {
        type: "welcome",
        selfId: String(raw.selfId ?? raw.id ?? ""),
        room: String(raw.room ?? ""),
        peers,
      };
    }
    case "peer-join":
    case "join":
    case "user-joined": {
      const peer = asPeer(raw.peer ?? raw.user ?? raw.from ?? raw.name);
      return peer ? { type: "peer-join", peer } : null;
    }
    case "peer-leave":
    case "leave":
    case "user-left": {
      const id = String(raw.id ?? raw.clientId ?? (raw.peer as Record<string, unknown> | undefined)?.id ?? "");
      return id ? { type: "peer-leave", id } : null;
    }
    case "typing": {
      const peer = asPeer(raw.from ?? raw.user ?? raw.peer ?? raw.name);
      if (!peer) return null;
      const on = raw.on !== false && raw.value !== false;
      return { type: "typing", from: peer, on };
    }
    case "pong":
    case "ping":
      return { type: "pong", ts: Number(raw.ts ?? Date.now()) };
    case "msg":
    case "message":
    case "chat":
    case "broadcast": {
      const text = String(raw.text ?? raw.message ?? raw.body ?? "").slice(0, 2000);
      if (!text) return null;
      const from =
        asPeer(raw.from ?? raw.user ?? raw.peer) ??
        asPeer(raw.name ?? raw.author);
      return {
        type: "msg",
        mid: String(raw.mid ?? raw.id ?? `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
        from: from ?? { id: "anon", name: "anon", color: "#8fb8ff" },
        text,
        ts: Number(raw.ts ?? raw.timestamp ?? Date.now()),
      };
    }
    default:
      // Untyped payload that carries text — treat as a message
      if (typeof raw.text === "string" || typeof raw.message === "string") {
        const text = String(raw.text ?? raw.message).slice(0, 2000);
        if (!text) return null;
        return {
          type: "msg",
          mid: String(raw.mid ?? `relay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
          from: asPeer(raw.from ?? raw.name) ?? { id: "anon", name: "anon", color: "#8fb8ff" },
          text,
          ts: Number(raw.ts ?? Date.now()),
        };
      }
      return null;
  }
}
