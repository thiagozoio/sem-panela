import type { Metadata, Viewport } from "next";
import "./globals.css";

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
    <html lang="pt-BR" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
