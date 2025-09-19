/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Help Next/Webpack interop with certain ESM packages in dev
    esmExternals: 'loose',
  },
  // Ensure lucide-react is transpiled by Next to avoid runtime interop issues
  transpilePackages: ['lucide-react'],
  // Vercel optimizations - remove standalone output to fix manifest file issue
  // output: 'standalone',
  // Enable SWC minification for better performance
  swcMinify: true,
  // Optimize images for Vercel
  images: {
    unoptimized: false,
  },
};

export default nextConfig;
