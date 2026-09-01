import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use default output for Netlify (OpenNext adapter). Do not use "standalone" on Netlify.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-c34decbe8eba4a2fa17498e94b1d07b5.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pub-48a60a3633b2416d8d515c0e0574569c.r2.dev",
      },
    ],
  },
};

export default nextConfig;
