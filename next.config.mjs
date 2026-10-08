/** @type {import('next').NextConfig} */
const nextConfig = {
  // exceljs y el SDK de Anthropic corren en Node (no Edge).
  serverExternalPackages: ['exceljs'],
  experimental: {
    // Las capturas y el Excel viajan en Server Actions (límite por defecto: 1 MB).
    serverActions: { bodySizeLimit: '8mb' },
  },
};

export default nextConfig;
