import type { MetadataRoute } from "next";

// Installable on the phone; opens on the Coach tab.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Life Dashboard",
    short_name: "Apex",
    description: "Today's session, the week, check-ins.",
    start_url: "/coach",
    display: "standalone",
    background_color: "#14161D",
    theme_color: "#14161D",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
