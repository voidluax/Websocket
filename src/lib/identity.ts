export const AVATAR_COLORS = [
  "#c8f04a", // lime
  "#7be3d0", // teal
  "#8fb8ff", // periwinkle
  "#e3a7ff", // orchid
  "#ffb36b", // amber
  "#ff7d9c", // rose
  "#9df0a5", // mint
  "#ffd84d", // sun
];

export function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function randomName(): string {
  const a = ["Neon", "Quiet", "Solar", "Drift", "Echo", "Vapor", "Polar", "Ghost"];
  const b = ["Fox", "Heron", "Comet", "Raven", "Otter", "Wolf", "Moth", "Lynx"];
  return `${a[Math.floor(Math.random() * a.length)]} ${b[Math.floor(Math.random() * b.length)]}`;
}

export function newMid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `mid-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function timeLabel(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
