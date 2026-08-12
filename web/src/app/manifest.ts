import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CoachODDO",
    short_name: "CoachODDO",
    description: "Oddo, your AI garage-gym coach: personalized programming, training plans, and workout tracking",
    start_url: "/weekly",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#7c3aed",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
