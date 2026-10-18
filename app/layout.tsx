import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hillcrest Electrics | Live Operations Console",
  description: "Live monitoring dashboard for electrical systems and infrastructure events.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
