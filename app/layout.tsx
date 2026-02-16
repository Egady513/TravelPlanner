import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TripProvider } from "@/lib/store";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Road Trip Planner",
  description: "Plan your perfect adventure with your dog - combining trails, camping, weather, and pet-friendly stops",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TripProvider>
          {children}
        </TripProvider>
      </body>
    </html>
  );
}
