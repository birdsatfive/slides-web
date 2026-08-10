import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Share — BirdsAtFive",
  description: "Share files behind a link",
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
