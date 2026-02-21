const CACHE_NAME = 'aviator-game-v2.0.0';
const STATIC_CACHE_NAME = 'aviator-static-v2.0.0';
const DYNAMIC_CACHE_NAME = 'aviator-dynamic-v2.0.0';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/App.jsx',
  '/main.jsx',
  '/styles.css',
  '/manifest.json',
];

const DYNAMIC_ASSETS = [
  '/components/',
  '/src/',
];

self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('Static assets cached');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Failed to cache static assets:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE_NAME && 
                cacheName !== DYNAMIC_CACHE_NAME &&
                cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  if (request.method !== 'GET' || url.protocol === 'ws:' || url.protocol === 'wss:') {
    return;
  }
  
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }
  
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Serving from cache:', request.url);
          return cachedResponse;
        }
        
        return fetch(request)
          .then((response) => {
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            const responseToCache = response.clone();
            
            const cacheName = STATIC_ASSETS.some(asset => 
              request.url.includes(asset)) ? STATIC_CACHE_NAME : DYNAMIC_CACHE_NAME;
            
            caches.open(cacheName)
              .then((cache) => {
                console.log('Caching new resource:', request.url);
                cache.put(request, responseToCache);
              });
            
            return response;
          })
          .catch((error) => {
            console.error('Network request failed:', error);
            
            if (request.headers.get('accept').includes('text/html')) {
              return caches.match('/index.html');
            }
            
            throw error;
          });
      })
  );
});

async function handleApiRequest(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok && !request.url.includes('/auth/')) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('API request failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-bet-sync') {
    event.waitUntil(syncOfflineBets());
  }
});

async function syncOfflineBets() {
  try {
    const offlineBets = await getOfflineBets();
    
    for (const bet of offlineBets) {
      try {
        await fetch('/api/bets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bet)
        });
        
        await removeOfflineBet(bet.id);
      } catch (error) {
        console.error('Failed to sync bet:', error);
      }
    }
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

async function getOfflineBets() {
  return [];
}

async function removeOfflineBet(betId) {
  console.log('Removing synced bet:', betId);
}

self.addEventListener('push', (event) => {
  console.log('Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New game round starting!',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'play',
        title: 'Play Now',
        icon: '/icons/icon-96x96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Aviator Game', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'play') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});
