import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MultiGrizz",
  description: "Multiplayer agent dens, one carousel per bear team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&family=Pixelify+Sans:wght@400..700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
