import type { MetadataRoute } from "next";
import { APP_NAME, SLOGAN } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: SLOGAN,
    id: "/",
    start_url: "/grupos",
    scope: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#13693a",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
