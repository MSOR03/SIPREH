// See https://nextjs.org/docs/app/api-reference/config/next-config-js/output#outputfiletracingroot
// This silences the workspace root warning for monorepos or multi-lockfile setups.

/** @type {import('next').NextConfig} */
import nextConfig from './next.config.mjs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  ...nextConfig,
  outputFileTracingRoot: __dirname,
};
