import { db } from "@/db";
import { messages, rooms } from "@/db/schema";
import { normalizeCode } from "@/lib/room-code";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code: raw } = await params;
  const code = normalizeCode(decodeURIComponent(raw));

  const [room] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, room.id))
    .orderBy(desc(messages.createdAt))
    .limit(100);

  return NextResponse.json({
    code: room.code,
    name: room.name,
    createdAt: room.createdAt.toISOString(),
    messages: rows
      .reverse()
      .map((m) => ({
        id: m.id,
        mid: m.mid,
        author: m.author,
        color: m.color,
        body: m.body,
        ts: m.createdAt.getTime(),
      })),
  });
}
