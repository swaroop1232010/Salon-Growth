import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Swasthik Salon & Boutique — First Visit Special",
  description:
    "Claim your Rs.200 OFF on your first visit at Swasthik Salon & Boutique. Premium haircut, hair spa, facial, hair color and beard grooming services.",
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

