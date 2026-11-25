import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { themeScript } from "@/lib/theme";
import { installCaptureScript } from "@/lib/install";
import { RefreshOnReturn } from "@/components/refresh-on-return";
import { APP_NAME, DESCRIPTION, SITE_URL, SLOGAN } from "@/lib/brand";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} · ${SLOGAN}`, template: `%s · ${APP_NAME}` },
  description: DESCRIPTION,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  openGraph: { type: "website", locale: "pt_BR", siteName: APP_NAME, title: APP_NAME, description: SLOGAN },
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
        <script dangerouslySetInnerHTML={{ __html: themeScript + installCaptureScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <RefreshOnReturn />
        <Analytics />
      </body>
    </html>
  );
}
