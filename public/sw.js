// Service Worker for Our Sanctuary - Push Notifications

self.addEventListener('install', (event) => {
  console.log('[SW] Installed');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activated');
  event.waitUntil(self.clients.claim());
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const payload = event.data.payload || {};
    self.registration.showNotification(payload.title || 'Our Sanctuary', {
      body: payload.body || 'You have a new message!',
      icon: '/logo.svg',
      badge: '/logo.svg',
      vibrate: [100, 50, 100],
      tag: payload.tag || 'sanctuary-message',
      renotify: true,
      data: {
        ...payload.data,
        openTab: payload.data?.openTab || 'chat',
      },
    });
  }
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  let data = { title: 'Our Sanctuary', body: 'You have a new message!', icon: '/logo.svg' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text() || data.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/logo.svg',
      badge: '/logo.svg',
      vibrate: [100, 50, 100],
      data: {
        ...data.data,
        openTab: data.data?.openTab || 'chat',
      },
      tag: data.tag || 'sanctuary-message',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const openTab = event.notification.data?.openTab || 'chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If there's already a window open, focus it and navigate to chat
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          // Send a message to the client to navigate to the chat tab
          client.postMessage({ type: 'NAVIGATE_TAB', tab: openTab });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
