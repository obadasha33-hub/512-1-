import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: 'com.521.sanctuary',
    name: '521',
    short_name: '521',
    description: "A private couple's sanctuary for love, memories, and connection",
    start_url: '/',
    display: 'standalone',
    background_color: '#1a0a10',
    theme_color: '#FF4D94',
    orientation: 'portrait',
    scope: '/',
    lang: 'en',
    dir: 'ltr',
    categories: ['lifestyle', 'social'],
    icons: [
      { src: '/icon-72x72.png', sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: '/icon-96x96.png', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/icon-128x128.png', sizes: '128x128', type: 'image/png', purpose: 'any' },
      { src: '/icon-144x144.png', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/icon-152x152.png', sizes: '152x152', type: 'image/png', purpose: 'any' },
      { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-384x384.png', sizes: '384x384', type: 'image/png', purpose: 'any' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', form_factor: 'narrow' },
      { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png', form_factor: 'wide' },
    ],
    shortcuts: [
      { name: 'Chat', short_name: 'Chat', url: '/?tab=chat', icons: [{ src: '/icon-96x96.png', sizes: '96x96' }] },
      { name: 'Sanctuary', short_name: 'Sanctuary', url: '/?tab=sanctuary', icons: [{ src: '/icon-96x96.png', sizes: '96x96' }] },
    ],
  };
}
