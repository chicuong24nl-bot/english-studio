import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";

import { ExitModal } from "@/components/modals/exit-modal";
import { HeartsModal } from "@/components/modals/hearts-modal";
import { PracticeModal } from "@/components/modals/practice-modal";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config";

import "./globals.css";

const clerkConfigured = Boolean(
  process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);

export const viewport: Viewport = {
  themeColor: "#22C55E",
};

export const metadata: Metadata = siteConfig;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans">
        {clerkConfigured ? (
          <ClerkProvider
            appearance={{
              options: { logoImageUrl: "/favicon.ico" },
              variables: { colorPrimary: "#22C55E" },
            }}
            telemetry={false}
            afterSignOutUrl="/"
          >
          <Toaster theme="light" richColors closeButton />
          <ExitModal />
          <HeartsModal />
          <PracticeModal />
          {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
