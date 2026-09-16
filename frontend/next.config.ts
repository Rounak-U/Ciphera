import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  transpilePackages: ['@securechat/crypto', '@securechat/config', '@securechat/types'],
  turbopack: {
    root: path.join(process.cwd(), ".."),
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/login",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
