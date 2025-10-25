// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css"; // Переконайтеся, що ваші стилі тут
import Providers from "./providers"; // 1. Імпортуйте ваш провайдер

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Simple Banking App",
  description: "Adaptive Auth Demo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className={inter.className}>
        {/* 2. Оберніть children у Providers */}
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
