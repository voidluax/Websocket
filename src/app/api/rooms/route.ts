import { db } from "@/db";
import { rooms } from "@/db/schema";
import { generateRoomCode } from "@/lib/room-code";
import { DEFAULT_RELAY_URL } from "@/lib/protocol";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let payload: { name?: string } = {};
  try {
    payload = await req.json();
  } catch {
    /* empty body is fine */
  }

  const name = (payload.name ?? "").trim().slice(0, 80) || "Untitled room";

  // Retry a handful of times in the unlikely event of a code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateRoomCode(6);
    try {
      const [room] = await db
        .insert(rooms)
        .values({ code, name, relayUrl: DEFAULT_RELAY_URL })
        .returning();
      return NextResponse.json({
        code: room.code,
        name: room.name,
        createdAt: room.createdAt.toISOString(),
        url: `/r/${room.code}`,
      });
    } catch {
      /* collision — loop */
    }
  }
  return NextResponse.json({ error: "Could not allocate a room code" }, { status: 500 });
}
