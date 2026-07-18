/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The share route reads TTFs off disk at runtime; make sure they're
    // traced into its serverless bundle.
    outputFileTracingIncludes: {
      "/api/share/[code]": ["./assets/fonts/*.ttf"],
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "*.replicate.delivery" },
    ],
  },
};

export default nextConfig;
