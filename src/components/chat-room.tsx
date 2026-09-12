"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  Clock3,
  CornerDownRight,
  Dice5,
  Link2,
  Radio,
  RotateCcw,
  Satellite,
  SendHorizontal,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Backdrop } from "@/components/backdrop";
import { CopyButton } from "@/components/copy-button";
import { RelayDialog } from "@/components/relay-dialog";
import { StatusPill } from "@/components/status-pill";
import { useChat } from "@/hooks/use-chat";
import { initials, randomName, timeLabel } from "@/lib/identity";
import type { ChatMessage } from "@/lib/protocol";
import { MAX_MESSAGE_LENGTH } from "@/lib/protocol";
import { formatCode, normalizeCode } from "@/lib/room-code-view";
import { loadSession, pushRecent, saveSession, type StoredSession } from "@/lib/session-store";

const GROUP_WINDOW = 5 * 60 * 1000;

export function ChatRoom({ code: rawCode }: { code: string }) {
  const code = normalizeCode(rawCode);
  const router = useRouter();
  const [session, setSession] = useState<StoredSession | null>(null);
  const [gateChecked, setGateChecked] = useState(false);
  const [relayOpen, setRelayOpen] = useState(false);

  useEffect(() => {
    setSession(loadSession());
    setGateChecked(true);
  }, []);

  const chat = useChat(code, session);
  const { room, messages, peers, typingNames, status, relay, setRelay, send, retrySend, sendTyping, reconnect } = chat;

  // Remember the room in "previously dialled"
  useEffect(() => {
    if (room) {
      pushRecent({ code: room.code, name: room.name });
    }
  }, [room]);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const nearBottomRef = useRef(true);
  const hydratedRef = useRef(false);
  const [showJump, setShowJump] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      hydratedRef.current = true;
    }, 120);
    return () => clearTimeout(t);
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  useEffect(() => {
    if (nearBottomRef.current) scrollToBottom(messages.length < 30 ? false : true);
  }, [messages, typingNames, scrollToBottom]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = dist < 180;
    setShowJump(dist >= 320);
  }, []);

  /* ------------------------------ name gate ------------------------------ */

  if (gateChecked && !session) {
    return <NameGate onDone={setSession} roomName={room?.name} />;
  }

  /* ------------------------------ not found ------------------------------ */

  if (status === "not-found") {
    return (
      <main className="grain relative grid min-h-dvh place-items-center">
        <Backdrop />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass edge-glow relative mx-4 max-w-md rounded-3xl p-8 text-center"
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-danger">404 / no signal</p>
          <h1 className="display-tight mt-3 text-4xl font-bold">
            This code leads
            <br />
            <span className="text-stroke">nowhere.</span>
          </h1>
          <p className="mt-3 text-[13px] leading-relaxed text-mist">
            <span className="font-mono text-teal">{formatCode(code)}</span> isn&apos;t a live room.
            Check the code, or mint a fresh one.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-lime px-4 py-2.5 text-[13px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98]"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2.4} /> Back to base
            </button>
          </div>
        </motion.div>
      </main>
    );
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/r/${code}` : `/r/${code}`;

  return (
    <main className="grain relative flex h-dvh flex-col overflow-hidden">
      <Backdrop />

      {/* -------------------------------- header ------------------------------- */}
      <header className="glass relative z-20 flex items-center gap-3 border-x-0 border-t-0 px-3 py-3 sm:px-5">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-edge bg-panel-2/60 text-mist transition-colors hover:border-lime/40 hover:text-ink"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2.2} />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="display-tight truncate text-[15px] font-bold sm:text-[17px]">
              {room?.name ?? "…"}
            </h1>
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <CopyButton value={shareUrl} label={formatCode(code)} className="!text-teal" />
            <CopyButton value={shareUrl} iconOnly className="hidden sm:inline-flex" />
          </div>
        </div>

        {/* presence */}
        <div className="hidden items-center md:flex" title={peers.map((p) => p.name).join(", ")}>
          <div className="flex -space-x-2">
            {peers.slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-panel text-[9px] font-bold text-void"
                style={{ backgroundColor: p.color }}
              >
                {initials(p.name)}
              </span>
            ))}
            {session && (
              <span
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-lime text-[9px] font-bold text-void ring-1 ring-lime"
                style={{ backgroundColor: session.color }}
                title={`${session.name} (you)`}
              >
                {initials(session.name)}
              </span>
            )}
          </div>
          <span className="ml-2.5 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
            <Users className="h-3.5 w-3.5" strokeWidth={2} />
            {peers.length + 1}
          </span>
        </div>

        <StatusPill status={status} onReconnect={reconnect} />

        <button
          type="button"
          onClick={() => setRelayOpen(true)}
          className="grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-xl border border-edge bg-panel-2/60 text-mist transition-colors hover:border-teal/40 hover:text-teal"
          title={`Relay: ${relay}`}
        >
          <Radio className="h-4 w-4" strokeWidth={2} />
        </button>
      </header>

      {/* ------------------------------- messages ------------------------------ */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="slim-scroll relative z-10 flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6"
      >
        <div className="mx-auto w-full max-w-3xl py-6">
          {/* channel header */}
          <div className="mb-8 text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-dim">
              channel opened · {room ? new Date(room.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "…"}
            </p>
            <p className="mt-1.5 font-mono text-[11px] text-teal/70">
              anyone holding <span className="text-teal">{formatCode(code)}</span> can hear this frequency
            </p>
          </div>

          {messages.length === 0 && status !== "loading" ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-16 text-center"
            >
              <p className="display-tight text-[clamp(2rem,6vw,3.4rem)] font-bold text-stroke">
                DEAD AIR<span className="text-lime [animation:caret_1.1s_steps(1)_infinite]">_</span>
              </p>
              <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-mist">
                Nobody has said anything on this frequency yet. Break the silence — the wire is hot.
              </p>
            </motion.div>
          ) : (
            <ul className="space-y-1">
              {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped =
                  !!prev &&
                  prev.author === m.author &&
                  prev.mine === m.mine &&
                  m.ts - prev.ts < GROUP_WINDOW;
                return (
                  <MessageRow
                    key={m.mid}
                    msg={m}
                    grouped={grouped}
                    animate={hydratedRef.current}
                    onRetry={() => retrySend(m.mid)}
                  />
                );
              })}
            </ul>
          )}

          {/* typing indicator */}
          <AnimatePresence>
            {typingNames.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="mt-3 flex items-center gap-2 text-[12px] text-mist"
              >
                <span className="flex gap-1">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-teal"
                      animate={{ opacity: [0.25, 1, 0.25] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                    />
                  ))}
                </span>
                <span className="font-mono text-[11px]">
                  {typingNames.slice(0, 2).join(" & ")}
                  {typingNames.length > 2 ? ` +${typingNames.length - 2}` : ""} typing
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* jump to bottom */}
      <AnimatePresence>
        {showJump && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 cursor-pointer rounded-full border border-edge bg-panel-2/90 px-3.5 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-mist backdrop-blur transition-colors hover:border-lime/40 hover:text-ink"
          >
            <ArrowDown className="mr-1.5 inline h-3 w-3" /> latest
          </motion.button>
        )}
      </AnimatePresence>

      {/* -------------------------------- composer ------------------------------ */}
      {session && <Composer session={session} onSend={send} onTyping={sendTyping} />}

      <RelayDialog open={relayOpen} onClose={() => setRelayOpen(false)} relay={relay} onSave={setRelay} />
    </main>
  );
}

/* --------------------------------- message row --------------------------------- */

function MessageRow({
  msg,
  grouped,
  animate,
  onRetry,
}: {
  msg: ChatMessage;
  grouped: boolean;
  animate: boolean;
  onRetry: () => void;
}) {
  const own = msg.mine;
  return (
    <motion.li
      initial={animate ? { opacity: 0, y: 8, scale: 0.99 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${own ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-4"}`}
    >
      <div className={`flex max-w-[85%] gap-2.5 sm:max-w-[72%] ${own ? "flex-row-reverse" : ""}`}>
        {/* avatar column */}
        <div className="w-7 shrink-0">
          {!grouped && !own && (
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[9px] font-bold text-void"
              style={{ backgroundColor: msg.color }}
              title={msg.author}
            >
              {initials(msg.author)}
            </span>
          )}
        </div>

        <div className={`min-w-0 ${own ? "text-right" : ""}`}>
          {!grouped && (
            <p className={`mb-1 flex items-baseline gap-2 text-[11px] ${own ? "flex-row-reverse" : ""}`}>
              <span className="font-semibold" style={{ color: own ? "var(--color-lime)" : msg.color }}>
                {own ? "you" : msg.author}
              </span>
              <span className="font-mono text-[10px] text-dim">{timeLabel(msg.ts)}</span>
            </p>
          )}
          <div
            className={`inline-block rounded-2xl px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed break-words whitespace-pre-wrap ${
              own
                ? "bubble-own rounded-br-md"
                : "rounded-bl-md border border-edge bg-panel-2/80 text-ink"
            }`}
          >
            {msg.body}
          </div>
          {(msg.pending || msg.failed) && (
            <p className={`mt-1 flex items-center gap-1.5 text-[11px] ${own ? "flex-row-reverse" : ""}`}>
              {msg.pending ? (
                <span className="inline-flex items-center gap-1 text-dim">
                  <Clock3 className="h-3 w-3" /> sending…
                </span>
              ) : (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex cursor-pointer items-center gap-1 text-danger hover:underline"
                >
                  <AlertTriangle className="h-3 w-3" /> dropped — <RotateCcw className="h-3 w-3" /> retry
                </button>
              )}
            </p>
          )}
        </div>
      </div>
    </motion.li>
  );
}

/* ---------------------------------- composer ---------------------------------- */

function Composer({
  session,
  onSend,
  onTyping,
}: {
  session: StoredSession;
  onSend: (text: string) => void;
  onTyping: () => void;
}) {
  const [text, setText] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  const remaining = MAX_MESSAGE_LENGTH - text.length;

  function fire() {
    const v = text.trim();
    if (!v) return;
    onSend(v);
    setText("");
    requestAnimationFrame(() => taRef.current?.focus());
  }

  return (
    <div className="relative z-20 px-3 pb-4 sm:px-6 sm:pb-5">
      <div className="glass edge-glow mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl p-2">
        <span
          className="mb-1 ml-1 grid h-8 w-8 shrink-0 place-items-center self-end rounded-full text-[10px] font-bold text-void"
          style={{ backgroundColor: session.color }}
          title={session.name}
        >
          {initials(session.name)}
        </span>
        <div className="min-w-0 flex-1">
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                fire();
              }
            }}
            rows={1}
            maxLength={MAX_MESSAGE_LENGTH}
            placeholder={`Transmit as ${session.name}…`}
            className="composer-input slim-scroll max-h-40 w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-relaxed outline-none placeholder:text-dim"
          />
          {remaining <= 200 && (
            <p className={`px-2 pb-1 text-right font-mono text-[10px] ${remaining <= 0 ? "text-danger" : "text-dim"}`}>
              {remaining}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={fire}
          disabled={!text.trim()}
          className="mb-1 grid h-10 w-10 shrink-0 cursor-pointer place-items-center self-end rounded-xl bg-lime text-void transition-all hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Send"
        >
          <SendHorizontal className="h-4.5 w-4.5" strokeWidth={2.2} />
        </button>
      </div>
      <p className="mx-auto mt-2 flex w-full max-w-3xl items-center justify-between px-2 font-mono text-[9.5px] uppercase tracking-[0.14em] text-dim">
        <span className="inline-flex items-center gap-1.5">
          <CornerDownRight className="h-3 w-3" /> enter to send · shift+enter for newline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Satellite className="h-3 w-3 text-teal/70" /> relay-delivered
        </span>
      </p>
    </div>
  );
}

/* ---------------------------------- name gate --------------------------------- */

function NameGate({
  onDone,
  roomName,
}: {
  onDone: (s: StoredSession) => void;
  roomName?: string;
}) {
  const [name, setName] = useState("");

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onDone(saveSession(trimmed));
  }

  return (
    <main className="grain relative grid min-h-dvh place-items-center px-4">
      <Backdrop />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="glass edge-glow relative w-full max-w-sm rounded-3xl p-7"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-lime text-void shadow-[0_0_28px_rgba(200,240,74,0.35)]">
          <Link2 className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <h1 className="display-tight mt-4 text-3xl font-bold">Identify.</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-mist">
          You followed a link into <span className="text-ink">{roomName ?? "a room"}</span>. Pick a
          callsign and you&apos;re on the wire — no password, no account.
        </p>
        <div className="mt-5 flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={40}
            placeholder="callsign"
            className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-2/70 px-3.5 py-3 text-[14px] outline-none transition-colors placeholder:text-dim focus:border-lime/50"
          />
          <button
            type="button"
            title="Random callsign"
            onClick={() => setName(randomName())}
            className="grid w-12 cursor-pointer place-items-center rounded-xl border border-edge bg-panel-2/70 text-mist transition-colors hover:border-lime/40 hover:text-lime"
          >
            <Dice5 className="h-5 w-5" strokeWidth={1.8} />
          </button>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="mt-4 w-full cursor-pointer rounded-xl bg-lime px-4 py-3 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join the frequency
        </button>
      </motion.div>
    </main>
  );
}
