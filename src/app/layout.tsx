import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description =
  "RyzenDesk is a free, open-source, token-based helpdesk & support ticketing system: live chat, Telegram notifications, escalation workflows, super-admin CRM and GitHub-synced storage. Self-host it for your business or freelance project in minutes.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
  title: {
    default: "RyzenDesk — Free Open-Source Helpdesk & Ticketing System",
    template: "%s · RyzenDesk",
  },
  description,
  keywords: [
    "RyzenDesk", "helpdesk", "open source helpdesk", "ticketing system", "support desk",
    "customer support software", "live chat support", "self-hosted helpdesk", "free helpdesk",
    "token based authentication", "support ticket system", "Telegram notifications",
    "Next.js helpdesk", "ITSM", "customer service", "freelance support tool",
  ],
  authors: [{ name: "RyzenDesk Contributors" }],
  applicationName: "RyzenDesk",
  icons: { icon: "/logo.svg" },
  openGraph: {
    type: "website",
    siteName: "RyzenDesk",
    title: "RyzenDesk — Free Open-Source Helpdesk & Ticketing System",
    description,
    images: [{ url: "/logo.svg", alt: "RyzenDesk logo" }],
  },
  twitter: {
    card: "summary",
    title: "RyzenDesk — Free Open-Source Helpdesk & Ticketing System",
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
