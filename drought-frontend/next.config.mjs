// GITHUB_ACTIONS=true is set automatically by GitHub Actions in every run.
// Locally this env var is not set, so basePath is empty → app works at localhost:3000 unchanged.
const isGithubPages = process.env.GITHUB_ACTIONS === 'true';
const repoName = 'DroughtMonitor';

const nextConfig = {
  // Required for GitHub Pages: generates a fully static `out/` folder.
  output: 'export',

  // Apply basePath/assetPrefix only when building for GitHub Pages.
  // This fixes broken images and navigation under https://<user>.github.io/DroughtMonitor/
  ...(isGithubPages && {
    basePath: `/${repoName}`,
    assetPrefix: `/${repoName}/`,
  }),

  images: {
    // next/image optimisation is incompatible with static export.
    unoptimized: true,
  },
};

export default nextConfig;