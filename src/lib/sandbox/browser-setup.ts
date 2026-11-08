/** What a browser sandbox needs on top of the node24 image. Shared by
 *  the snapshot builder and the cold-boot fallback in `browser.ts`. */
export const AGENT_BROWSER_VERSION = '0.41.2'

/** Chromium's shared libraries on Amazon Linux 2023. */
export const BROWSER_DNF_PACKAGES = [
  'nss', 'nspr', 'libxkbcommon', 'atk', 'at-spi2-atk', 'at-spi2-core', 'libXcomposite', 'libXdamage',
  'libXrandr', 'libXfixes', 'libXcursor', 'libXi', 'libXtst', 'libXScrnSaver', 'libXext', 'mesa-libgbm',
  'libdrm', 'mesa-libGL', 'mesa-libEGL', 'cups-libs', 'alsa-lib', 'pango', 'cairo', 'gtk3', 'dbus-libs',
  'google-noto-sans-fonts', 'google-noto-serif-fonts', 'google-noto-emoji-color-fonts',
]
