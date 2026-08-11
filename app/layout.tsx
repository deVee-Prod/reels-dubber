import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { DriftingGridBackground } from './components/DriftingGridBackground';
import { ToolHeader } from './components/ToolHeader';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Reels Dubber",
  description: "Automatically generate subtitles for your Reels & Shorts.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Reels Dubber",
  },
};

// iOS zooms the page in whenever a field smaller than 16px takes focus, and leaves
// the user to pinch back out. maximum-scale holds it at 1 for that automatic zoom;
// pinch-to-zoom is user-initiated and Safari still allows it.
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="relative min-h-full flex flex-col antialiased text-white">
        <DriftingGridBackground />
        <div className="relative z-10 flex flex-col min-h-full">
          <ToolHeader />
          {children}
        </div>
      </body>
    </html>
  );
}
