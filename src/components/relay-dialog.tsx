"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Radio, RotateCcw, Server, X } from "lucide-react";
import { useEffect, useState } from "react";
import { CopyButton } from "@/components/copy-button";
import { DEFAULT_RELAY_URL } from "@/lib/protocol";

export function RelayDialog({
  open,
  onClose,
  relay,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  relay: string;
  onSave: (url: string) => void;
}) {
  const [value, setValue] = useState(relay);

  useEffect(() => {
    if (open) setValue(relay);
  }, [open, relay]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const isDefault = value.trim() === DEFAULT_RELAY_URL;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-void/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Relay settings"
            className="glass edge-glow relative w-full max-w-lg rounded-2xl p-6"
            initial={{ y: 24, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-lime">transport</p>
                <h3 className="display-tight mt-1 text-2xl font-bold">Relay endpoint</h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="cursor-pointer rounded-lg border border-edge p-1.5 text-mist transition-colors hover:border-lime/40 hover:text-ink"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-mist">
              Linkline pushes live traffic through any WebSocket relay. Point it at the community
              relay, or at one you self-host — every room code creates its own isolated channel.
            </p>

            <label className="mt-5 block">
              <span className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mist">
                <Radio className="h-3 w-3" /> websocket url
              </span>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                spellCheck={false}
                className="w-full rounded-xl border border-edge bg-panel-2/70 px-3.5 py-2.5 font-mono text-[13px] text-ink outline-none transition-colors placeholder:text-dim focus:border-lime/50"
                placeholder="wss://your-relay.onrender.com"
              />
            </label>

            <div className="mt-4 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onSave(value);
                  onClose();
                }}
                className="flex-1 cursor-pointer rounded-xl bg-lime px-4 py-2.5 text-[13px] font-semibold text-void transition-all hover:brightness-110 active:scale-[0.98]"
              >
                Save &amp; reconnect
              </button>
              <button
                type="button"
                disabled={isDefault}
                onClick={() => setValue(DEFAULT_RELAY_URL)}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-edge px-3.5 py-2.5 text-[12px] font-medium text-mist transition-colors hover:border-lime/40 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" /> default
              </button>
            </div>

            <div className="mt-6 rounded-xl border border-edge bg-panel-2/40 p-4">
              <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-teal">
                <Server className="h-3.5 w-3.5" /> run your own — render free tier
              </p>
              <ol className="mt-3 space-y-2 text-[12.5px] leading-relaxed text-mist">
                <li className="flex gap-2.5">
                  <span className="font-mono text-lime">01</span>
                  <span>Deploy <code className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[11px] text-ink">relay/server.mjs</code> from this repo as a Render <em>Web Service</em> (Node, free instance).</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-lime">02</span>
                  <span>Start command <code className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[11px] text-ink">node relay/server.mjs</code> — the included <code className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[11px] text-ink">render.yaml</code> blueprint wires it for you.</span>
                </li>
                <li className="flex gap-2.5">
                  <span className="font-mono text-lime">03</span>
                  <span>Paste your <code className="rounded bg-void/70 px-1.5 py-0.5 font-mono text-[11px] text-ink">wss://…onrender.com</code> URL above. Free instances sleep when idle — Linkline auto-dials again on focus.</span>
                </li>
              </ol>
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-void/60 px-3 py-2">
                <code className="truncate font-mono text-[11px] text-mist">node relay/server.mjs # PORT from env</code>
                <CopyButton value="node relay/server.mjs" iconOnly />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
