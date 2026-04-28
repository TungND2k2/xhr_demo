import { withPayload } from "@payloadcms/next/withPayload";
import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Heavy native packages — keep them server-only.
  serverExternalPackages: ["mongodb"],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default withPayload(nextConfig, { devBundleServerPackages: false });
