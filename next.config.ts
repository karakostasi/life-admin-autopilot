import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // upload εγγράφων (εικόνες μικραίνουν στον client, τα PDF περιορίζονται στα 4MB)
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
