const CACHE_NAME = 'finance-pro-v9';
const API_CACHE_NAME = 'finance-pro-api-v1';

const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  'https://files.catbox.moe/ww1gm2.png',
  'https://files.catbox.moe/b9c6p4.png',
  'https://files.catbox.moe/jqe1g1.png',
  'https://files.catbox.moe/p4z1h1.png',
  'https://files.catbox.moe/t7m6z1.png'
];

// Base de datos interna (IndexedDB) compartida entre la App y el Service Worker
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FinanceProDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('config')) {
        db.createObjectStore('config', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e);
  });
}

async function guardarConfigEnDB(data) {
  try {
    const db = await abrirDB();
    const current = (await leerConfigDB()) || {};
    const tx = db.transaction('config', 'readwrite');
    tx.objectStore('config').put({ id: 'main', ...current, ...data });
  } catch (e) {}
}

async function leerConfigDB() {
  try {
    const db = await abrirDB();
    return new Promise((resolve) => {
      const tx = db.transaction('config', 'readonly');
      const req = tx.objectStore('config').get('main');
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    return null;
  }
}

function formatNum(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '0,00';
  return num.toFixed(2).replace('.', ',');
}

// Motor de verificación de tasas y horarios
async function verificarMercadoYAlertarEnFondo() {
  const cfg = (await leerConfigDB()) || {
    horarios: ['09:00', '13:00', '18:00'],
    tasaBCV: 0,
    tasaUSDT: 0,
    ultimoAvisoHora: ''
  };

  let bcvActual = parseFloat(cfg.tasaBCV) || 0;
  let usdtActual = parseFloat(cfg.tasaUSDT) || 0;

  // 1. Consultar BCV (si hay internet)
  try {
    const res1 = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
    if (res1.ok) {
      const d1 = await res1.json();
      if (d1 && d1.promedio) {
        const nuevoBCV = parseFloat(d1.promedio);
        if (bcvActual > 0 && Math.abs(nuevoBCV - bcvActual) >= 0.01) {
          const subio = nuevoBCV > bcvActual;
          await self.registration.showNotification('Actualización Dólar BCV Oficial', {
            body: `Nueva tasa BCV: ${formatNum(nuevoBCV)} Bs (anterior: ${formatNum(bcvActual)} Bs) ${subio ? '📈' : '📉'}`,
            icon: 'https://files.catbox.moe/ww1gm2.png',
            badge: 'https://files.catbox.moe/ww1gm2.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: 'bcv-change-alert'
          });
        }
        bcvActual = nuevoBCV;
      }
    }
  } catch (e) {}

  // 2. Consultar Paralelo / USDT (si hay internet)
  try {
    const res2 = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', { cache: 'no-store' });
    if (res2.ok) {
      const d2 = await res2.json();
      if (d2 && d2.promedio) {
        const nuevoUSDT = parseFloat(d2.promedio);
        if (usdtActual > 0 && Math.abs(nuevoUSDT - usdtActual) >= 0.05) {
          const subio = nuevoUSDT > usdtActual;
          await self.registration.showNotification('Movimiento en USDT P2P', {
            body: `USDT se ubica en ${formatNum(nuevoUSDT)} Bs (antes: ${formatNum(usdtActual)} Bs) ${subio ? '🚀' : '🔻'}`,
            icon: 'https://files.catbox.moe/ww1gm2.png',
            badge: 'https://files.catbox.moe/ww1gm2.png',
            vibrate: [200, 100, 200],
            requireInteraction: true,
            tag: 'usdt-change-alert'
          });
        }
        usdtActual = nuevoUSDT;
      }
    }
  } catch (e) {}

  // 3. Revisar alertas por horario programado
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentHM = `${hh}:${mm}`;
  const fechaMinuto = `${now.toDateString()}_${currentHM}`;

  if (Array.isArray(cfg.horarios) && cfg.horarios.includes(currentHM)) {
    if (cfg.ultimoAvisoHora !== fechaMinuto) {
      let brecha = 0;
      if (bcvActual > 0 && usdtActual > 0) {
        brecha = ((usdtActual - bcvActual) / bcvActual) * 100;
      }
      await self.registration.showNotification(`Reporte Financiero (${currentHM})`, {
        body: `BCV: ${formatNum(bcvActual)} Bs | USDT P2P: ${formatNum(usdtActual)} Bs | Brecha: ${formatNum(brecha)}%`,
        icon: 'https://files.catbox.moe/ww1gm2.png',
        badge: 'https://files.catbox.moe/ww1gm2.png',
        vibrate: [300, 100, 300],
        requireInteraction: true,
        tag: 'scheduled-report-' + currentHM
      });
      cfg.ultimoAvisoHora = fechaMinuto;
    }
  }

  cfg.tasaBCV = bcvActual;
  cfg.tasaUSDT = usdtActual;
  await guardarConfigEnDB(cfg);
}

// Instalación y guardado de archivos para modo Offline
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Limpieza de cachés antiguas
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== API_CACHE_NAME) return caches.delete(k);
        })
      )
    )
  );
  self.clients.claim();
});

// Interceptor de red (Permite que la app funcione sin internet)
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  // Si es la API del dólar: busca en internet, guarda copia, y si no hay señal usa la copia
  if (url.hostname.includes('dolarapi.com')) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(API_CACHE_NAME).then((cache) => cache.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Para los archivos de tu aplicación: carga instantánea desde caché y actualiza en fondo
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      const fetchPromise = fetch(e.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(e.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

// Eventos de sincronización en segundo plano
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-rates-sync') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'check-rates-sync') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }
});

// Comunicación directa con app.js
self.addEventListener('message', (e) => {
  if (!e.data) return;

  if (e.data.type === 'SYNC_CONFIG') {
    guardarConfigEnDB({
      horarios: e.data.horarios || ['09:00', '13:00', '18:00'],
      tasaBCV: e.data.tasaBCV || 0,
      tasaUSDT: e.data.tasaUSDT || 0
    }).then(() => verificarMercadoYAlertarEnFondo());
  }

  if (e.data.type === 'CHECK_NOW') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }

  if (e.data.type === 'SHOW_NOTIFICATION') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: 'https://files.catbox.moe/ww1gm2.png',
      badge: 'https://files.catbox.moe/ww1gm2.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      tag: e.data.tag || 'finance-pro-direct'
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cl) => {
      if (cl.length > 0) return cl[0].focus();
      return clients.openWindow('./');
    })
  );
});
