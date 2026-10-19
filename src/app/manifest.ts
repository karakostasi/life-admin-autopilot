import type { MetadataRoute } from "next";
import el from "@/messages/el.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Θύμισέ μου",
    short_name: "Θύμισέ μου",
    description: el.meta.description,
    lang: "el",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f1f5f9",
    theme_color: "#4f46e5",
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
