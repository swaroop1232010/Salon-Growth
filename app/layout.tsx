import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://swasthikleads.netlify.app"
  ),
  title: "Swasthik Salon & Boutique — First Visit Special",
  description:
    "Claim your Rs.200 OFF on your first visit at Swasthik Salon & Boutique. Premium haircut, hair spa, facial, hair color and beard grooming services.",
  icons: {
    icon: [
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/icon.png",
  },
  openGraph: {
    title: "Swasthik Salon & Boutique — First Visit Special",
    description:
      "Claim your Rs.200 OFF on your first visit. Premium haircut, hair spa, facial, hair color and beard grooming.",
    images: [{ url: "/icon-512.png", width: 512, height: 512, alt: "Swasthik Salon Logo" }],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

