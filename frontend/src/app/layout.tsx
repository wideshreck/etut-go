import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "sonner";
import { KVKKModal } from "@/components/kvkk-modal";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Etüt Pro",
  description: "Etüt Pro Eğitim Yönetim Platformu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${inter.variable} h-full`}>
      <body suppressHydrationWarning className="flex min-h-full flex-col">
        <AuthProvider>
          {children}
          <KVKKModal />
        </AuthProvider>
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
