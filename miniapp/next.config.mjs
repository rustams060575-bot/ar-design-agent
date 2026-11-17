/** Static export: plain HTML/JS/CSS on a CDN, so the Mini App opens instantly. No server runtime is needed. */
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  poweredByHeader: false,
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
