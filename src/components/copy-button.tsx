"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useRef, useState } from "react";

export function CopyButton({
  value,
  label,
  className = "",
  iconOnly = false,
}: {
  value: string;
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = value;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  }, [value]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-edge bg-panel-2/60 px-2.5 py-1.5 font-mono text-[11px] tracking-wide text-mist transition-all hover:border-lime/40 hover:text-ink active:scale-95 ${className}`}
      title={`Copy ${value}`}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-lime" strokeWidth={2.5} />
      ) : (
        <Copy className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-px" strokeWidth={2} />
      )}
      {!iconOnly && (copied ? "copied" : (label ?? "copy"))}
    </button>
  );
}
