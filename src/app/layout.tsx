import type { Metadata, Viewport } from "next";
import "./globals.css";
import { themeScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: { default: "Sem Panela", template: "%s · Sem Panela" },
  description: "Lista de presença, sorteio de times equilibrados e controle de pagamentos da sua pelada.",
  applicationName: "Sem Panela",
  appleWebApp: { capable: true, title: "Sem Panela", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#13693a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
