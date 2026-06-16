import type { Metadata } from "next";
import { IBM_Plex_Mono, Oswald } from "next/font/google";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import "./globals.css";

const displayFont = Oswald({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const boardFont = IBM_Plex_Mono({
  variable: "--font-board",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Train Ticker",
  description:
    "Personal live departure board for saved National Rail journeys.",
  icons: {
    icon: [{ url: "/train_ticker_color.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${boardFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
