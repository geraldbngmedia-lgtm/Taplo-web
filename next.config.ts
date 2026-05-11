import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevents React double-invoking effects in dev, which can interfere with
  // MediaRecorder state and the audio recording lifecycle.
  reactStrictMode: false,

  // Next.js image optimisation requires a running server; skip it so the
  // <Image> component works without a dedicated optimisation endpoint.
  images: { unoptimized: true },

  // Standalone output is only needed for Electron packaging, not Vercel.
  ...(process.env.BUILD_TARGET === "electron" && { output: "standalone" }),
};

export default nextConfig;
