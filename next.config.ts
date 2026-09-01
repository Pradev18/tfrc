import type { NextConfig } from "next";

const isDocker = process.env.DOCKER_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isDocker ? { output: "standalone" as const } : {}),
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
