import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Slides — BirdsAtFive",
  description: "AI decks & presentations",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
