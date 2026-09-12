import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@fontsource/space-grotesk/400.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Linkline — rendezvous chat over your own relay",
  description:
    "Spin up a room, share a six-character code, and chat in real time over a WebSocket relay. Runs on Render's free tier — bring the community relay or your own.",
};

export const viewport: Viewport = {
  themeColor: "#04060b",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-void text-ink antialiased">{children}</body>
    </html>
  );
}
