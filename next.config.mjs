/** @type {import('next').NextConfig} */
const isStatic = process.env.STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(isStatic
    ? {
        output: 'export',
        basePath: '/Gaokao-Academic-Resources',
        images: { unoptimized: true },
      }
    : {}),
};

export default nextConfig;