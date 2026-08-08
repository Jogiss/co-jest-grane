import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // Enable for Netlify deployment
  
  // Wyłącz strict mode żeby uniknąć podwójnego renderowania w dev
  reactStrictMode: false,
  
  // Zezwól na zewnętrzne obrazki (YouTube thumbnails, Supabase storage)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'i.scdn.co' },
    ],
  },
};

export default nextConfig;
