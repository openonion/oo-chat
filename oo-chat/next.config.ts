/**
 * @purpose Next.js configuration file - defines build and runtime settings
 * @llm-note
 *   Dependencies: imports from [next] | imported by Next.js build system | no test files found
 *   Data flow: exports NextConfig object → consumed by Next.js during build and runtime
 *   State/Effects: no runtime state, build-time configuration only
 *   Integration: used by Next.js framework automatically | defines compiler, bundler, feature flags
 *   Performance: default config (no custom optimizations) | Next.js auto-optimizes React, images, fonts
 *   Errors: build-time validation by Next.js, invalid config prevents build
 *
 * Configuration Status:
 *   - Currently empty (all defaults)
 *   - Next.js 16 defaults are used
 *   - App Router enabled (uses app/ directory)
 *   - Turbopack NOT enabled (uses Webpack)
 *
 * Common Options (not currently used):
 *   - reactStrictMode: true - Enable strict mode warnings
 *   - images: { domains: [...] } - Allow external image domains
 *   - experimental: { ... } - Beta features
 *   - webpack: (config) => config - Custom webpack config
 *   - env: { ... } - Expose environment variables to browser
 *
 * File Relationships:
 *     /
 *     ├── next.config.ts    # THIS FILE - Next.js config
 *     ├── app/              # App router pages
 *     ├── components/       # React components
 *     └── package.json      # Next.js dependency
 */

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Transpile local connectonion package (symlinked from file:../connectonion-ts)
  transpilePackages: ['connectonion'],
};

export default nextConfig;
