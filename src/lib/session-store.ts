"use client";

import { newMid, pickColor } from "@/lib/identity";

export type StoredSession = {
  id: string;
  name: string;
  color: string;
};

export type RecentRoom = {
  code: string;
  name: string;
  ts: number;
};

const K_ID = "linkline:id";
const K_NAME = "linkline:name";
const K_COLOR = "linkline:color";
const K_RECENT = "linkline:recent-rooms";

export function loadSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  const name = window.localStorage.getItem(K_NAME);
  if (!name) return null;
  return {
    id: window.localStorage.getItem(K_ID) ?? newMid(),
    name,
    color: window.localStorage.getItem(K_COLOR) ?? "#c8f04a",
  };
}

export function saveSession(name: string): StoredSession {
  const trimmed = name.trim().slice(0, 40);
  const existing = loadSession();
  const sess: StoredSession = {
    id: existing?.id ?? newMid(),
    name: trimmed,
    color: existing && existing.name === trimmed ? existing.color : pickColor(trimmed + Date.now().toString(36)),
  };
  window.localStorage.setItem(K_ID, sess.id);
  window.localStorage.setItem(K_NAME, sess.name);
  window.localStorage.setItem(K_COLOR, sess.color);
  return sess;
}

export function loadRecents(): RecentRoom[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(K_RECENT);
    const arr = raw ? (JSON.parse(raw) as RecentRoom[]) : [];
    return Array.isArray(arr) ? arr.slice(0, 6) : [];
  } catch {
    return [];
  }
}

export function pushRecent(room: Omit<RecentRoom, "ts">) {
  if (typeof window === "undefined") return;
  const list = loadRecents().filter((r) => r.code !== room.code);
  list.unshift({ ...room, ts: Date.now() });
  window.localStorage.setItem(K_RECENT, JSON.stringify(list.slice(0, 6)));
}
