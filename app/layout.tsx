import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FH Electrical Ops | Live Logs",
  description: "Live event monitoring for your Roblox electrical systems.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
