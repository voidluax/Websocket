import { randomInt } from "crypto";

export { normalizeCode, formatCode } from "@/lib/room-code-view";

/** Unambiguous alphabet — no 0/O, 1/I/L */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}
