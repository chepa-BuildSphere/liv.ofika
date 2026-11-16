import type { MetadataRoute } from "next";
import { PWA_MANIFEST } from "@/lib/pwa/pwa-config";

export default function manifest(): MetadataRoute.Manifest {
  return PWA_MANIFEST;
}
