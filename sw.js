const CACHE_NAME = 'finance-pro-v7';
const LOGO_URL = 'https://files.catbox.moe/gdnebi.png';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  LOGO_URL,
  'https://files.catbox.moe/0iqhgt.png',
  'https://files.catbox.moe/5my5ck.png',
  'https://files.catbox.moe/1nq9fx.png',
  'https://files.catbox.moe/6zt6p1.png',
  'https://files.catbox.moe/kj6rft.png',
  'https://d3js.org/d3.v7.min.js'
];

// BASE DE DATOS INDEXEDDB EN SERVICE WORKER PARA GUARDAR HORARIOS Y TASAS EN SEGUNDO PLANO
function abrirDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('FinanceProSWDB', 1);
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

async function guardarConfigSW(data) {
  try {
    const db = await abrirDB();
    const tx = db.transaction('config', 'readwrite');
    tx.objectStore('config').put({ id: 'main', ...data });
  } catch (e) {}
}

async function leerConfigSW() {
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

function formatoSW(num) {
  const val = Number(num) || 0;
  return val.toFixed(2).replace('.', ',');
}

// VERIFICACIÓN AUTÓNOMA DE TASAS Y HORARIOS AUNQUE LA APP ESTÉ CERRADA O PANTALLA APAGADA
async function verificarMercadoYHorariosEnFondo() {
  const cfg = (await leerConfigSW()) || {
    horarios: ['04:00', '09:00', '13:00'],
    tasaBCV: 0,
    tasaUSDT: 0,
    ultimaHora: ''
  };

  let bcvActual = cfg.tasaBCV || 0;
  let usdtActual = cfg.tasaUSDT || 0;
  let cambioDetectado = false;

  // 1. Consultar BCV Oficial en segundo plano
  try {
    const rBcv = await fetch('https://rates.dolarvzla.com/bcv/current.json', { cache: 'no-store' });
    const dBcv = await rBcv.json();
    if (dBcv && dBcv.current && dBcv.current.usd) {
      const nuevoBcv = parseFloat(dBcv.current.usd);
      if (bcvActual > 0 && Math.abs(nuevoBcv - bcvActual) >= 0.01) {
        cambioDetectado = true;
        await self.registration.showNotification('Actualización Dólar BCV Oficial', {
          body: `Nueva tasa BCV: ${formatoSW(nuevoBcv)} Bs (Anterior: ${formatoSW(bcvActual)} Bs)`,
          icon: LOGO_URL,
          badge: LOGO_URL,
          vibrate: [300, 150, 300],
          renotify: true,
          requireInteraction: true,
          tag: 'bcv-change-alert'
        });
      }
      bcvActual = nuevoBcv;
    }
  } catch (e) {}

  // 2. Consultar USDT P2P en segundo plano
  try {
    const rP2p = await fetch('https://ve.dolarapi.com/v1/dolares', { cache: 'no-store' });
    const dP2p = await rP2p.json();
    const binObj = dP2p.find(i => i.fuente === 'paralelo' || i.fuente === 'cripto') || dP2p[1];
    if (binObj && binObj.promedio) {
      const nuevoUsdt = parseFloat(binObj.promedio);
      if (usdtActual > 0 && Math.abs(nuevoUsdt - usdtActual) >= 0.01) {
        cambioDetectado = true;
        await self.registration.showNotification('Movimiento en USDT P2P', {
          body: `Nueva tasa P2P: ${formatoSW(nuevoUsdt)} Bs | BCV: ${formatoSW(bcvActual)} Bs`,
          icon: LOGO_URL,
          badge: LOGO_URL,
          vibrate: [300, 150, 300],
          renotify: true,
          requireInteraction: true,
          tag: 'usdt-change-alert'
        });
      }
      usdtActual = nuevoUsdt;
    }
  } catch (e) {}

  // 3. Revisar si la hora actual coincide con los horarios programados del usuario
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;
  const keyHoy = `${now.toDateString()}_${currentTime}`;

  if (Array.isArray(cfg.horarios) && cfg.horarios.includes(currentTime) && cfg.ultimaHora !== keyHoy) {
    cfg.ultimaHora = keyHoy;
    await self.registration.showNotification(`Reporte Financiero (${currentTime})`, {
      body: `BCV Oficial: ${formatoSW(bcvActual)} Bs | USDT P2P: ${formatoSW(usdtActual)} Bs`,
      icon: LOGO_URL,
      badge: LOGO_URL,
      vibrate: [250, 120, 250],
      renotify: true,
      requireInteraction: true,
      tag: 'scheduled-rate-alert'
    });
  }

  cfg.tasaBCV = bcvActual;
  cfg.tasaUSDT = usdtActual;
  await guardarConfigSW(cfg);
}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      return cachedResponse || fetch(e.request).catch(() => caches.match('./index.html'));
    })
  );
});

// EVENTOS DE BACKGROUND SYNC Y PERIODIC SYNC (PANTALLA APAGADA / APP CERRADA)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-rates-and-alarms') {
    e.waitUntil(verificarMercadoYHorariosEnFondo());
  }
});

self.addEventListener('sync', (e) => {
  e.waitUntil(verificarMercadoYHorariosEnFondo());
});

self.addEventListener('message', (e) => {
  if (!e.data) return;

  if (e.data.type === 'SYNC_CONFIG') {
    guardarConfigSW({
      horarios: e.data.horarios || ['04:00', '09:00', '13:00'],
      tasaBCV: e.data.tasaBCV || 0,
      tasaUSDT: e.data.tasaUSDT || 0
    });
  }

  if (e.data.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: LOGO_URL,
      badge: LOGO_URL,
      vibrate: [250, 120, 250],
      renotify: true,
      requireInteraction: true,
      tag: 'finance-pro-direct'
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('./index.html');
    })
  );
});

// Timer interno de respaldo mientras el Service Worker permanezca despierto
setInterval(() => {
  verificarMercadoYHorariosEnFondo();
}, 30000);
