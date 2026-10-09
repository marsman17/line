import { Preferences } from "../components/preferences";
import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "TableQ · A better wait",
  description:
    "A calmer welcome. Restaurant waitlists, guest updates, and service insights.",
  manifest: "/manifest.json",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#237b63",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <body>
        <Preferences>{children}</Preferences>
      </body>
    </html>
  );
}
