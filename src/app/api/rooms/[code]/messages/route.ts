import { db } from "@/db";
import { messages, rooms } from "@/db/schema";
import { normalizeCode } from "@/lib/room-code";
import { MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH } from "@/lib/protocol";
import { and, asc, eq, gt } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function findRoom(rawCode: string) {
  const code = normalizeCode(decodeURIComponent(rawCode));
  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return room ?? null;
}

/**
 * Poll-ish fallback transport + history catch-up.
 * GET /api/rooms/CODE/messages?after=<epoch ms>  -> messages newer than `after`
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const url = new URL(req.url);
  const afterRaw = Number(url.searchParams.get("after") ?? "0");
  const after = Number.isFinite(afterRaw) && afterRaw > 0 ? new Date(afterRaw) : new Date(0);

  const rows = await db
    .select()
    .from(messages)
    .where(and(eq(messages.roomId, room.id), gt(messages.createdAt, after)))
    .orderBy(asc(messages.createdAt))
    .limit(200);

  return NextResponse.json({
    messages: rows.map((m) => ({
      id: m.id,
      mid: m.mid,
      author: m.author,
      color: m.color,
      body: m.body,
      ts: m.createdAt.getTime(),
    })),
  });
}

/** Persist a message. Dedupes on the client-generated `mid`. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const room = await findRoom(code);
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  let payload: { mid?: string; author?: string; color?: string; body?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mid = (payload.mid ?? "").toString().slice(0, 64);
  const author = (payload.author ?? "").toString().trim().slice(0, MAX_NAME_LENGTH);
  const color = (payload.color ?? "#c8f04a").toString().slice(0, 16);
  const body = (payload.body ?? "").toString().slice(0, MAX_MESSAGE_LENGTH).trim();

  if (!mid || !author || !body) {
    return NextResponse.json({ error: "mid, author and body are required" }, { status: 422 });
  }

  // onConflictDoNothing makes the WS echo + persist race idempotent
  await db
    .insert(messages)
    .values({ mid, roomId: room.id, author, color, body })
    .onConflictDoNothing();

  await db
    .update(rooms)
    .set({ lastActivityAt: new Date() })
    .where(eq(rooms.id, room.id));

  const [saved] = await db.select().from(messages).where(eq(messages.mid, mid)).limit(1);
  return NextResponse.json({
    id: saved?.id ?? mid,
    mid,
    author,
    color,
    body,
    ts: saved ? saved.createdAt.getTime() : Date.now(),
  });
}
