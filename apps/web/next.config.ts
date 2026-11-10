import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo : tracer les dépendances depuis la racine (node_modules hissés).
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  transpilePackages: ['@imf/shared'],
};

export default nextConfig;