"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Database,
  Dice5,
  Hash,
  Radio,
  Satellite,
  Shield,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Backdrop } from "@/components/backdrop";
import { RelayDialog } from "@/components/relay-dialog";
import { randomName } from "@/lib/identity";
import { DEFAULT_RELAY_URL } from "@/lib/protocol";
import { formatCode, normalizeCode } from "@/lib/room-code-view";
import { loadRecents, loadSession, pushRecent, saveSession, type RecentRoom } from "@/lib/session-store";

const EASE = [0.22, 1, 0.36, 1] as const;

const FEATURES = [
  { Icon: Zap, title: "Socket-speed", body: "Messages ride a raw WebSocket relay — no accounts, no SDK ceremony." },
  { Icon: Hash, title: "Six-char codes", body: "Every room answers to an unambiguous code and a shareable link." },
  { Icon: Database, title: "Postgres history", body: "The last hundred messages wait for whoever joins next." },
  { Icon: Shield, title: "Bring your relay", body: "Community relay by default; point at your own Render free-tier box anytime." },
];

export function Landing() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recents, setRecents] = useState<RecentRoom[]>([]);
  const [relayOpen, setRelayOpen] = useState(false);
  const [relay, setRelay] = useState(DEFAULT_RELAY_URL);

  useEffect(() => {
    const sess = loadSession();
    if (sess) setName(sess.name);
    setRecents(loadRecents());
    setRelay(window.localStorage.getItem("linkline:relay") ?? DEFAULT_RELAY_URL);
  }, []);

  const codeOk = useMemo(() => normalizeCode(joinCode).length >= 4, [joinCode]);

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a callsign first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: roomName.trim() || `${trimmed}'s room` }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const room = (await res.json()) as { code: string; name: string };
      saveSession(trimmed);
      pushRecent({ code: room.code, name: room.name });
      router.push(`/r/${room.code}`);
    } catch {
      setError("Could not mint a room — the database might be waking up. Try again.");
      setBusy(false);
    }
  }

  function handleJoin() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Pick a callsign first.");
      return;
    }
    const code = normalizeCode(joinCode);
    if (code.length < 4) {
      setError("That code looks too short.");
      return;
    }
    saveSession(trimmed);
    router.push(`/r/${code}`);
  }

  return (
    <main className="grain relative min-h-dvh overflow-x-clip">
      <Backdrop />

      {/* ------------------------------- top bar ------------------------------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime text-void shadow-[0_0_24px_rgba(200,240,74,0.35)]">
            <Satellite className="h-4.5 w-4.5" strokeWidth={2.2} />
          </span>
          <span className="display-tight text-[15px] font-bold tracking-tight">
            LINKLINE<span className="text-lime">.</span>
          </span>
          <span className="ml-1 hidden rounded-full border border-edge px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-mist sm:inline-block">
            free tier
          </span>
        </div>
        <button
          type="button"
          onClick={() => setRelayOpen(true)}
          className="group flex max-w-[46vw] cursor-pointer items-center gap-2 rounded-full border border-edge bg-panel-2/50 px-3 py-1.5 font-mono text-[10px] text-mist transition-colors hover:border-teal/40 hover:text-ink"
        >
          <Radio className="h-3 w-3 shrink-0 text-teal" strokeWidth={2.2} />
          <span className="truncate">{relay}</span>
          <ArrowUpRight className="h-3 w-3 shrink-0 opacity-50 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
        </button>
      </header>

      {/* -------------------------------- hero --------------------------------- */}
      <section className="relative z-10 mx-auto grid w-full max-w-6xl gap-14 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:pt-20">
        <div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE }}
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-teal"
          >
            {`// realtime rendezvous over websocket`}
          </motion.p>

          <h1 className="display-tight mt-5 text-[clamp(2.9rem,7.2vw,5.6rem)] font-bold">
            {["Get a link.", "Share a code.", "Own the wire."].map((line, i) => (
              <span key={line} className="block overflow-hidden pb-1">
                <motion.span
                  className={`block ${i === 2 ? "text-lime" : i === 1 ? "text-stroke" : ""}`}
                  initial={{ y: "110%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.08 * i + 0.1 }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: EASE, delay: 0.42 }}
            className="mt-6 max-w-md text-[14.5px] leading-relaxed text-mist"
          >
            Linkline spins up a room, hands you a six-character code, and pipes the conversation
            through a WebSocket relay{" "}
            <span className="whitespace-nowrap font-mono text-[12.5px] text-teal">
              wss://getlinkbycode.onrender.com
            </span>{" "}
            — or one you host yourself. History persists in Postgres; if a socket can&apos;t get
            through, it degrades to polling without dropping a word.
          </motion.p>

          <motion.ul
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-10 grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2"
          >
            {FEATURES.map(({ Icon, title, body }, i) => (
              <motion.li
                key={title}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: EASE, delay: 0.6 + i * 0.07 }}
                className="flex gap-3"
              >
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md border border-edge bg-panel-2/60 text-lime">
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-mist">{body}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>

        {/* ------------------------------ console ------------------------------ */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.3 }}
          className="lg:pt-2"
        >
          <div className="glass edge-glow rounded-3xl p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-mist">
                session console
              </p>
              <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-lime">
                <span className="h-1.5 w-1.5 rounded-full bg-lime [animation:pulse-dot_2s_ease-in-out_infinite]" />
                armed
              </span>
            </div>

            <label className="mt-5 block">
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                your callsign
              </span>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={40}
                  placeholder="e.g. Neon Heron"
                  className="min-w-0 flex-1 rounded-xl border border-edge bg-panel-2/70 px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-dim focus:border-lime/50"
                />
                <button
                  type="button"
                  title="Random callsign"
                  onClick={() => setName(randomName())}
                  className="grid w-11 cursor-pointer place-items-center rounded-xl border border-edge bg-panel-2/70 text-mist transition-colors hover:border-lime/40 hover:text-lime"
                >
                  <Dice5 className="h-4.5 w-4.5" strokeWidth={1.8} />
                </button>
              </div>
            </label>

            {/* tabs */}
            <div className="mt-6 grid grid-cols-2 rounded-xl border border-edge bg-void/40 p-1">
              {(["create", "join"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setError(null);
                  }}
                  className={`relative cursor-pointer rounded-lg py-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
                    tab === t ? "text-void" : "text-mist hover:text-ink"
                  }`}
                >
                  {tab === t && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 rounded-lg bg-lime"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                    />
                  )}
                  <span className="relative z-10">{t === "create" ? "new room" : "join by code"}</span>
                </button>
              ))}
            </div>

            {tab === "create" ? (
              <div className="mt-5">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                    room name <span className="text-dim">(optional)</span>
                  </span>
                  <input
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    maxLength={80}
                    placeholder="midnight union"
                    className="w-full rounded-xl border border-edge bg-panel-2/70 px-3.5 py-2.5 text-[14px] outline-none transition-colors placeholder:text-dim focus:border-lime/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={busy}
                  className="group mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
                >
                  {busy ? "minting code…" : "Generate room code"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
                </button>
              </div>
            ) : (
              <div className="mt-5">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                    six-character code
                  </span>
                  <input
                    value={joinCode}
                    onChange={(e) => setJoinCode(formatCode(e.target.value))}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    placeholder="K7Q2-X9"
                    spellCheck={false}
                    autoCapitalize="characters"
                    className="w-full rounded-xl border border-edge bg-panel-2/70 px-3.5 py-3 text-center font-mono text-[20px] font-semibold uppercase tracking-[0.3em] text-lime outline-none transition-colors placeholder:text-dim focus:border-lime/50"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleJoin}
                  disabled={!codeOk}
                  className="group mt-4 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-lime px-4 py-3 text-[14px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Enter room
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.4} />
                </button>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[12px] text-danger">
                {error}
              </p>
            )}

            {recents.length > 0 && (
              <div className="mt-6 border-t border-edge/70 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-dim">
                  previously dialled
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {recents.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => router.push(`/r/${r.code}`)}
                      className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-edge bg-panel-2/50 py-1.5 pl-3 pr-2.5 text-[11.5px] text-mist transition-colors hover:border-lime/40 hover:text-ink"
                    >
                      <span className="max-w-[120px] truncate">{r.name}</span>
                      <span className="font-mono text-[10px] text-teal">{formatCode(r.code)}</span>
                      <ArrowUpRight className="h-3 w-3 opacity-40 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="mt-4 px-2 text-center font-mono text-[10px] leading-relaxed tracking-[0.08em] text-dim">
            nothing here needs a signup. close the tab and the code keeps burning
            <br className="hidden sm:block" /> for as long as the database remembers it.
          </p>
        </motion.div>
      </section>

      {/* ------------------------------- footer -------------------------------- */}
      <footer className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 border-t border-edge/60 px-5 py-5 font-mono text-[10px] uppercase tracking-[0.16em] text-dim sm:px-8">
        <span>transport: websocket + http fallback</span>
        <span className="hidden sm:inline text-edge">/</span>
        <span>stores: postgres</span>
        <span className="hidden sm:inline text-edge">/</span>
        <span>runs on render free tier</span>
        <span className="ml-auto text-lime/60 normal-case tracking-normal">ws:getlinkbycode.onrender.com</span>
      </footer>

      <RelayDialog
        open={relayOpen}
        onClose={() => setRelayOpen(false)}
        relay={relay}
        onSave={(url) => setRelay(url.trim() || DEFAULT_RELAY_URL)}
      />
    </main>
  );
}
