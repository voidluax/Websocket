/**
 * Linkline wire protocol — shared by the browser client, the HTTP API and
 * the standalone WebSocket relay (relay/server.mjs).
 *
 * Relay connection:  wss://HOST/ws?room=CODE&name=NAME&color=HEX
 * (the leading "/ws" segment is optional; query params carry the session)
 */

export type Peer = {
  id: string;
  name: string;
  color: string;
};

/** Messages the relay sends down to clients */
export type RelayEvent =
  | { type: "welcome"; selfId: string; room: string; peers: Peer[] }
  | { type: "peer-join"; peer: Peer }
  | { type: "peer-leave"; id: string }
  | { type: "msg"; mid: string; from: Peer; text: string; ts: number }
  | { type: "typing"; from: Peer; on: boolean }
  | { type: "pong"; ts: number };

/** Messages clients send up to the relay */
export type RelayCommand =
  | { type: "msg"; mid: string; text: string }
  | { type: "typing"; on: boolean }
  | { type: "ping" };

/** Shape returned by the HTTP API (history + fallback transport) */
export type ChatMessage = {
  id: string;
  mid: string;
  author: string;
  color: string;
  body: string;
  mine: boolean;
  ts: number; // epoch ms
  pending?: boolean;
  failed?: boolean;
};

export type RoomInfo = {
  code: string;
  name: string;
  createdAt: string;
};

export const DEFAULT_RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL ?? "wss://getlinkbycode.onrender.com";

export const MAX_MESSAGE_LENGTH = 2000;
export const MAX_NAME_LENGTH = 40;
