"use client";

import type { TransportStatus } from "@/hooks/use-chat";
import { ArrowLeftRight, Loader2, Radio, RefreshCw, Satellite, WifiOff } from "lucide-react";

const MAP: Record<
  TransportStatus,
  { label: string; cls: string; dot: string; Icon: typeof Radio }
> = {
  loading: { label: "syncing", cls: "text-mist border-edge", dot: "bg-mist", Icon: Loader2 },
  connecting: { label: "dialling relay", cls: "text-[#ffd84d] border-[#ffd84d]/30", dot: "bg-[#ffd84d]", Icon: Radio },
  "live-ws": { label: "live · websocket", cls: "text-lime border-lime/30", dot: "bg-lime", Icon: Satellite },
  "live-poll": { label: "live · polling", cls: "text-teal border-teal/30", dot: "bg-teal", Icon: ArrowLeftRight },
  offline: { label: "offline", cls: "text-danger border-danger/30", dot: "bg-danger", Icon: WifiOff },
  "not-found": { label: "no signal", cls: "text-mist border-edge", dot: "bg-mist", Icon: WifiOff },
};

export function StatusPill({
  status,
  onReconnect,
}: {
  status: TransportStatus;
  onReconnect?: () => void;
}) {
  const { label, cls, dot, Icon } = MAP[status];
  return (
    <button
      type="button"
      onClick={onReconnect}
      title={status === "live-poll" ? "Polling fallback — click to retry WebSocket" : "Click to reconnect"}
      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border bg-panel-2/50 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-all hover:bg-panel-2 ${cls}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} [animation:pulse-dot_2s_ease-in-out_infinite]`} />
      <Icon className={`h-3 w-3 ${status === "loading" ? "animate-spin" : ""}`} strokeWidth={2.2} />
      <span className="hidden sm:inline">{label}</span>
      {status === "live-poll" && <RefreshCw className="h-3 w-3 opacity-60" strokeWidth={2.2} />}
    </button>
  );
}
