import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sem Panela",
    short_name: "Sem Panela",
    description: "A pelada organizada e paga em dia.",
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
