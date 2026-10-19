import type { MetadataRoute } from "next";
import el from "@/messages/el.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Admin Autopilot",
    short_name: "Autopilot",
    description: el.meta.description,
    lang: "el",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
