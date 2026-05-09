/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
    ],
  },
  /**
   * Webpack tweaks for the artifact toolbar's lazy office-doc exports.
   *
   * `pptxgenjs` (and a couple of other office-doc libraries) ship a
   * single bundle that conditionally pulls in Node built-ins like
   * `node:fs` / `node:https` to support a CLI / server entry point.
   * Even when we only call them via `await import('pptxgenjs')` inside
   * a click handler — i.e. browser-only code paths — webpack still
   * needs to be able to *resolve* every static `import` that appears
   * anywhere in the dependency graph during build. Without help it
   * trips on the `node:` scheme and the production build fails with:
   *
   *     UnhandledSchemeError: Reading from "node:fs" is not handled
   *     by plugins (Unhandled scheme).
   *
   * The fix has two halves:
   *
   *   1. `resolve.fallback` — tell webpack that when something asks
   *      for a Node built-in (`fs`, `https`, `path`, `crypto`, …) on
   *      the client, hand it `false` instead. The library's runtime
   *      branch checks `typeof window` before reaching into them, so
   *      the stubs are never actually called.
   *   2. A custom NormalModuleReplacementPlugin to rewrite the
   *      `node:fs` / `node:https` URI form (added in webpack 5) into
   *      the bare specifier — the fallback above only matches bare
   *      names, not the prefixed scheme.
   *
   * We only apply this on the client compile (`!isServer`); the
   * server bundle has access to the real built-ins and shouldn't be
   * stubbed.
   */
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve = config.resolve || {}
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        fs: false,
        'fs/promises': false,
        path: false,
        os: false,
        https: false,
        http: false,
        crypto: false,
        stream: false,
        zlib: false,
        url: false,
        util: false,
        net: false,
        tls: false,
        child_process: false,
      }

      // Rewrite `node:foo` → `foo` so the fallbacks above kick in.
      config.plugins = config.plugins || []
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /^node:/,
          (resource) => {
            resource.request = resource.request.replace(/^node:/, '')
          },
        ),
      )
    }
    return config
  },
};

export default nextConfig;
