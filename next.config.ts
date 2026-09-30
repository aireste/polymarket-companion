import { networkInterfaces } from "node:os";
import type { NextConfig } from "next";

/**
 * Let phones on the same Wi-Fi use the dev server (http://<this Mac's IP>:3000).
 * Next blocks dev assets from other hostnames by default; this allows only this
 * machine's own LAN addresses, and it has no effect on production builds.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n!.address);

const nextConfig: NextConfig = {
  allowedDevOrigins: lanAddresses,
};

export default nextConfig;
