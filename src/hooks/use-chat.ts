"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatMessage, Peer, RelayEvent, RoomInfo } from "@/lib/protocol";
import { DEFAULT_RELAY_URL } from "@/lib/protocol";
import { buildRelayWsUrl, normalizeRelayEvent } from "@/lib/relay";
import { newMid } from "@/lib/identity";

export type TransportStatus =
  | "loading" // fetching room + history
  | "connecting" // dialling the relay
  | "live-ws" // realtime over WebSocket
  | "live-poll" // degraded: HTTP polling fallback
  | "offline" // nothing reachable — queued locally
  | "not-found";

const MAX_WS_ATTEMPTS = 4;
const POLL_MS = 2500;
const HEARTBEAT_MS = 25_000;

type Session = {
  id: string;
  name: string;
  color: string;
};

export function useChat(code: string, session: Session | null) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [typing, setTyping] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<TransportStatus>("loading");
  const [relay, setRelayState] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_RELAY_URL;
    return window.localStorage.getItem("linkline:relay") ?? DEFAULT_RELAY_URL;
  });

  const wsRef = useRef<WebSocket | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const pollCursorRef = useRef(0);
  const attemptsRef = useRef(0);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingClearTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  const relayRef = useRef(relay);
  relayRef.current = relay;
  const stoppedRef = useRef(false);

  const appendMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const next = [...prev];
      let added = 0;
      for (const m of incoming) {
        if (seenRef.current.has(m.mid)) {
          // If this mid exists as pending, confirm it
          const idx = next.findIndex((x) => x.mid === m.mid && x.pending);
          if (idx >= 0) {
            next[idx] = { ...next[idx], pending: false, failed: false, id: m.id, ts: m.ts };
          }
          continue;
        }
        seenRef.current.add(m.mid);
        next.push(m);
        added++;
      }
      if (added === 0) return next;
      next.sort((a, b) => a.ts - b.ts || a.mid.localeCompare(b.mid));
      return next.slice(-500);
    });
  }, []);

  /* ------------------------------ HTTP layer ------------------------------ */

  const fetchHistory = useCallback(async () => {
    const res = await fetch(`/api/rooms/${encodeURIComponent(code)}`, { cache: "no-store" });
    if (res.status === 404) {
      setStatus("not-found");
      return false;
    }
    if (!res.ok) throw new Error(`history ${res.status}`);
    const data = (await res.json()) as RoomInfo & {
      messages: Array<Omit<ChatMessage, "mine">>;
    };
    setRoom({ code: data.code, name: data.name, createdAt: data.createdAt });
    const sess = sessionRef.current;
    appendMessages(
      data.messages.map((m) => ({
        ...m,
        mine: !!sess && m.author === sess.name && m.color === sess.color,
      })),
    );
    for (const m of data.messages) pollCursorRef.current = Math.max(pollCursorRef.current, m.ts);
    return true;
  }, [code, appendMessages]);

  const pollOnce = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/rooms/${encodeURIComponent(code)}/messages?after=${pollCursorRef.current}`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const data = (await res.json()) as { messages: Array<Omit<ChatMessage, "mine">> };
      const sess = sessionRef.current;
      appendMessages(
        data.messages.map((m) => ({
          ...m,
          mine: !!sess && m.author === sess.name && m.color === sess.color,
        })),
      );
      for (const m of data.messages) pollCursorRef.current = Math.max(pollCursorRef.current, m.ts);
    } catch {
      /* transient */
    }
  }, [code, appendMessages]);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    const tick = async () => {
      await pollOnce();
      if (!stoppedRef.current) {
        pollTimerRef.current = setTimeout(tick, POLL_MS);
      } else {
        pollTimerRef.current = null;
      }
    };
    pollTimerRef.current = setTimeout(tick, 300);
  }, [pollOnce]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    pollTimerRef.current = null;
  }, []);

  /* ---------------------------- WebSocket layer --------------------------- */

  const teardownWs = useCallback(() => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {
        /* noop */
      }
      wsRef.current = null;
    }
  }, []);

  const handleRelayEvent = useCallback(
    (evt: RelayEvent) => {
      const sess = sessionRef.current;
      switch (evt.type) {
        case "welcome":
          setPeers(evt.peers.filter((p) => p.id !== evt.selfId));
          break;
        case "peer-join":
          if (!sess || evt.peer.id !== sess.id) {
            setPeers((prev) =>
              prev.some((p) => p.id === evt.peer.id) ? prev : [...prev, evt.peer],
            );
          }
          break;
        case "peer-leave":
          setPeers((prev) => prev.filter((p) => p.id !== evt.id));
          setTyping((prev) => {
            const next = { ...prev };
            delete next[evt.id];
            return next;
          });
          break;
        case "msg": {
          appendMessages([
            {
              id: evt.mid,
              mid: evt.mid,
              author: evt.from.name,
              color: evt.from.color,
              body: evt.text,
              ts: evt.ts,
              mine: !!sess && evt.from.id === sess.id,
            },
          ]);
          setTyping((prev) => {
            const next = { ...prev };
            delete next[evt.from.id];
            return next;
          });
          break;
        }
        case "typing": {
          const peer = evt.from;
          const timers = typingClearTimers.current;
          if (timers.has(peer.id)) clearTimeout(timers.get(peer.id)!);
          if (!evt.on) {
            setTyping((prev) => {
              const next = { ...prev };
              delete next[peer.id];
              return next;
            });
            break;
          }
          setTyping((prev) => ({ ...prev, [peer.id]: peer.name }));
          timers.set(
            peer.id,
            setTimeout(() => {
              setTyping((prev) => {
                const next = { ...prev };
                delete next[peer.id];
                return next;
              });
              timers.delete(peer.id);
            }, 4000),
          );
          break;
        }
        case "pong":
          break;
      }
    },
    [appendMessages],
  );

  const connectWs = useCallback(() => {
    if (stoppedRef.current) return;
    const sess = sessionRef.current;
    if (!sess) return;

    teardownWs();
    setStatus("connecting");

    let url: string;
    try {
      url = buildRelayWsUrl(relayRef.current, {
        room: code,
        name: sess.name,
        color: sess.color,
        id: sess.id,
      });
    } catch {
      setStatus("live-poll");
      startPolling();
      return;
    }

    let settled = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleWsRetry();
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      settled = true;
      attemptsRef.current = 0;
      setStatus("live-ws");
      stopPolling();
      // Also send an explicit join for relays driven by commands rather than query params
      try {
        ws.send(JSON.stringify({ type: "join", room: code, name: sess.name, color: sess.color, id: sess.id }));
      } catch {
        /* noop */
      }
      heartbeatRef.current = setInterval(() => {
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        } catch {
          /* noop */
        }
      }, HEARTBEAT_MS);
    };

    ws.onmessage = (e) => {
      const data = typeof e.data === "string" ? e.data : "";
      if (!data) return;
      const evt = normalizeRelayEvent(data);
      if (evt) handleRelayEvent(evt);
    };

    ws.onclose = () => {
      if (stoppedRef.current) return;
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
      if (!settled) attemptsRef.current += 1;
      else attemptsRef.current += 1;
      scheduleWsRetry();
    };

    ws.onerror = () => {
      try {
        ws.close();
      } catch {
        /* handled by onclose */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, teardownWs, handleRelayEvent, startPolling, stopPolling]);

  const scheduleWsRetry = useCallback(() => {
    if (stoppedRef.current) return;
    if (attemptsRef.current < MAX_WS_ATTEMPTS) {
      const delay = Math.min(1000 * 2 ** attemptsRef.current, 8000);
      setStatus("connecting");
      if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
      wsTimerRef.current = setTimeout(connectWs, delay);
    } else {
      // Give up on the socket — degrade gracefully to HTTP polling
      setStatus("live-poll");
      startPolling();
    }
  }, [connectWs, startPolling]);

  const reconnect = useCallback(() => {
    attemptsRef.current = 0;
    stopPolling();
    connectWs();
  }, [connectWs, stopPolling]);

  const setRelay = useCallback(
    (url: string) => {
      const clean = url.trim() || DEFAULT_RELAY_URL;
      window.localStorage.setItem("linkline:relay", clean);
      setRelayState(clean);
      attemptsRef.current = 0;
      stopPolling();
      // reconnect happens via effect on `relay`
    },
    [stopPolling],
  );

  /* ------------------------------ lifecycle ------------------------------- */

  useEffect(() => {
    stoppedRef.current = false;
    let cancelled = false;

    (async () => {
      setStatus("loading");
      try {
        const ok = await fetchHistory();
        if (cancelled || !ok) return;
      } catch {
        setStatus("offline");
        return;
      }
      connectWs();
    })();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        attemptsRef.current = 0;
        connectWs();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      stoppedRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (wsTimerRef.current) clearTimeout(wsTimerRef.current);
      stopPolling();
      teardownWs();
      for (const t of typingClearTimers.current.values()) clearTimeout(t);
      typingClearTimers.current.clear();
    };
  }, [fetchHistory, connectWs, teardownWs, stopPolling, relay]);

  /* ------------------------------ actions --------------------------------- */

  const send = useCallback(
    (text: string) => {
      const sess = sessionRef.current;
      const body = text.trim().slice(0, 2000);
      if (!sess || !body) return;

      const mid = newMid();
      const optimistic: ChatMessage = {
        id: mid,
        mid,
        author: sess.name,
        color: sess.color,
        body,
        ts: Date.now(),
        mine: true,
        pending: true,
      };
      seenRef.current.add(mid);
      setMessages((prev) => [...prev, optimistic]);

      // 1. Fire over the socket for instant delivery
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "msg", mid, text: body }));
        } catch {
          /* persistence below still lands */
        }
      }

      // 2. Persist (idempotent on mid) — also drives the polling fallback
      fetch(`/api/rooms/${encodeURIComponent(code)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mid, author: sess.name, color: sess.color, body }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const saved = (await res.json()) as Omit<ChatMessage, "mine">;
          pollCursorRef.current = Math.max(pollCursorRef.current, saved.ts);
          setMessages((prev) =>
            prev.map((m) =>
              m.mid === mid ? { ...m, pending: false, failed: false, id: saved.id, ts: saved.ts } : m,
            ),
          );
        })
        .catch(() => {
          setMessages((prev) =>
            prev.map((m) => (m.mid === mid ? { ...m, pending: false, failed: true } : m)),
          );
          setStatus((s) => (s === "live-ws" || s === "live-poll" ? s : "offline"));
        });
    },
    [code],
  );

  const retrySend = useCallback(
    (mid: string) => {
      const msg = messages.find((m) => m.mid === mid);
      const sess = sessionRef.current;
      if (!msg || !sess) return;
      setMessages((prev) => prev.map((m) => (m.mid === mid ? { ...m, pending: true, failed: false } : m)));
      fetch(`/api/rooms/${encodeURIComponent(code)}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mid: msg.mid, author: sess.name, color: sess.color, body: msg.body }),
      })
        .then(async (res) => {
          if (!res.ok) throw new Error(String(res.status));
          const saved = (await res.json()) as Omit<ChatMessage, "mine">;
          pollCursorRef.current = Math.max(pollCursorRef.current, saved.ts);
          setMessages((prev) =>
            prev.map((m) => (m.mid === mid ? { ...m, pending: false, failed: false, id: saved.id } : m)),
          );
        })
        .catch(() => {
          setMessages((prev) => prev.map((m) => (m.mid === mid ? { ...m, pending: false, failed: true } : m)));
        });
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "msg", mid: msg.mid, text: msg.body }));
        } catch {
          /* noop */
        }
      }
    },
    [code, messages],
  );

  const lastTypingSent = useRef(0);
  const sendTyping = useCallback(() => {
    const ws = wsRef.current;
    const now = Date.now();
    if (!ws || ws.readyState !== WebSocket.OPEN || now - lastTypingSent.current < 1500) return;
    lastTypingSent.current = now;
    try {
      ws.send(JSON.stringify({ type: "typing", on: true }));
    } catch {
      /* noop */
    }
  }, []);

  const typingNames = useMemo(() => Object.values(typing), [typing]);

  return {
    room,
    messages,
    peers,
    typingNames,
    status,
    relay,
    setRelay,
    send,
    retrySend,
    sendTyping,
    reconnect,
  };
}
