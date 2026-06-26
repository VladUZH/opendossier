/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The research engine reads/writes the file-based corpus at runtime via Node APIs.
  serverExternalPackages: ['node-html-parser'],
};

export default nextConfig;
