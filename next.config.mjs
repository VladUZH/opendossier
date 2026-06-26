/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The research engine reads/writes the file-based corpus at runtime via Node APIs.
  serverExternalPackages: ['node-html-parser'],
  webpack: (config) => {
    // The TypeScript sources use ESM-style ".js" import specifiers that resolve to
    // ".ts" files (so the CLI/tests run under tsx/vitest). Teach webpack the same.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.mjs': ['.mts', '.mjs'],
    };
    return config;
  },
};

export default nextConfig;
