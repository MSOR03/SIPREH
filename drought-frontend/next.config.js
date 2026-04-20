/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',

  // 👇 MUY IMPORTANTE: cambia esto por el nombre de tu repo
  basePath: '/SIPREH',
  assetPrefix: '/SIPREH/',

  images: {
    unoptimized: true, // necesario para export estático
  },
};

export default nextConfig;
