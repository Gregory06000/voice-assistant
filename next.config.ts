/** @type {import('next').NextConfig} */
const nextConfig = {
  // 1) Ne bloque pas le build si ESLint trouve des erreurs
  eslint: {
    ignoreDuringBuilds: true,
  },
  // 2) Ne bloque pas le build si TypeScript trouve des erreurs
  typescript: {
    ignoreBuildErrors: true,
  },
  // 3) On garde <img> pour l’instant (sinon use next/image)
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
