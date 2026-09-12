import { ChatRoom } from "@/components/chat-room";
import { normalizeCode } from "@/lib/room-code-view";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ChatRoom code={normalizeCode(decodeURIComponent(code))} />;
}
