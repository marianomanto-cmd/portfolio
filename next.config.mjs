/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['pg'],
  // Los skills se leen del disco en runtime: sin esto el lambda no los lleva.
  outputFileTracingIncludes: {
    '/api/memo': ['./src/skills/**/*.md'],
  },
};

export default nextConfig;
