const CACHE_NAME = 'kemankes-v6'; // Versiyon kontrolü
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './logo.png'
  // Hedef resimlerin varsa (puta_kafa_18.png vb.) buraya ekleyebilirsin
];

// Kurulum
self.addEventListener('install', (e) => {
  self.skipWaiting(); // Beklemeden aktif ol
});

// Temizlik (Eski versiyonları sil)
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    })
  );
  return self.clients.claim();
});

// İstek Yakalama (Network First Stratejisi)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        // İnternet varsa yanıtı al ve önbelleği güncelle
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, resClone);
        });
        return res;
      })
      .catch(() => {
        // İnternet yoksa önbellekten ver
        return caches.match(e.request);
      })
  );
});