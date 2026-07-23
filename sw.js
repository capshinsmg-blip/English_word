// PWA 서비스워커 — 오프라인에서도 앱이 동작하도록 캐시
const CACHE = "ew-v27";
const ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/data/words-1.js",
  "./js/data/words-2.js",
  "./js/data/words-3.js",
  "./js/data/words-4.js",
  "./js/data/words-5.js",
  "./js/data.js",
  "./js/srs.js",
  "./js/notifications.js",
  "./js/app.js",
  "./js/cloud.js",
  "./manifest.json",
  "./icons/wordmark.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png",
  "./icons/icon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ===== 푸시 알림 =====
self.addEventListener("push", e => {
  const d = e.data ? e.data.json() : {};
  e.waitUntil(
    self.registration.showNotification(d.title || "하루보카 📚", {
      body: d.body || "오늘의 영단어를 외워볼까요?",
      icon: "./icons/icon-192.png",
      badge: "./icons/icon-32.png",
      tag: "daily-reminder",
      renotify: true,
      vibrate: [200, 100, 200]
    })
  );
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) if ("focus" in c) return c.focus();
      return clients.openWindow("./");
    })
  );
});

// 네트워크 우선, 실패하면 캐시 (업데이트가 바로 반영되도록)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
