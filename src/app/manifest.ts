import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/text',
    name: 'Omma',
    short_name: 'Omma',
    description: 'Gaia’s AI workspace: chat, research, files, images, video and audio in one place.',
    start_url: '/text',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#14171C',
    theme_color: '#14171C',
    categories: ['productivity', 'business'],
    icons: [
      { src: '/icons/icon-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-192.png?v=2', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/maskable-512.png?v=2', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Chats', url: '/text', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
      { name: 'Files', url: '/files', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
      { name: 'Projects', url: '/projects', icons: [{ src: '/icons/icon-192.png?v=2', sizes: '192x192' }] },
    ],
  }
}
