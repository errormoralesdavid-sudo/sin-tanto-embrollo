const CACHE_NAME = 'finance-pro-v15';
const API_CACHE_NAME = 'finance-pro-api-v7';

const CORE_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './logo.png',
  './bcv.png',
  './usdt.png',
  './bs.png',
  './euro.png',
  './cop.png'
];

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
  return num.toLocaleString('es-VE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

async function verificarMercadoYAlertarEnFondo() {
  const cfg = (await leerConfigDB()) || {
    horarios: ['04:00', '09:00', '13:00'],
    tasaBCV: 0,
    tasaUSDT: 0,
    tasaEUR: 0,
    ultimoAvisoHora: ''
  };

  let bcvActual = parseFloat(cfg.tasaBCV) || 0;
  let usdtActual = parseFloat(cfg.tasaUSDT) || 0;
  let eurActual = parseFloat(cfg.tasaEUR) || 0;

  // 1. Verificar Dólar BCV y Euro BCV Oficial
  try {
    const resOficial = await fetch('https://rates.dolarvzla.com/bcv/current.json', { cache: 'no-store' });
    if (resOficial.ok) {
      const dataOficial = await resOficial.json();
      if (dataOficial && dataOficial.current) {
        const nuevoBCV = parseFloat(dataOficial.current.usd);
        const nuevoEUR = parseFloat(dataOficial.current.eur);

        if (nuevoBCV > 0) {
          if (bcvActual > 0 && Math.abs(nuevoBCV - bcvActual) >= 0.01) {
            const diff = Math.abs(nuevoBCV - bcvActual);
            const subio = nuevoBCV > bcvActual;
            const etiqueta = subio ? `[▲ SUBIÓ ${formatNum(diff)} Bs]` : `[▼ BAJÓ ${formatNum(diff)} Bs]`;
            const verbo = subio ? 'avanza' : 'retrocede';
            await self.registration.showNotification('Alerta BCV Oficial • Tasa en movimiento', {
              body: `${etiqueta} El Dólar Oficial ${verbo} a ${formatNum(nuevoBCV)} Bs (Antes: ${formatNum(bcvActual)} Bs). Ajusta tus cuentas.`,
              icon: './logo.png',
              badge: './logo.png',
              vibrate: [250, 120, 250],
              requireInteraction: true,
              renotify: true,
              tag: 'bcv-change-alert'
            });
          }
          bcvActual = nuevoBCV;
        }

        if (nuevoEUR > 0) {
          if (eurActual > 0 && Math.abs(nuevoEUR - eurActual) >= 0.01) {
            const diffEur = Math.abs(nuevoEUR - eurActual);
            const subioEur = nuevoEUR > eurActual;
            const etiquetaEur = subioEur ? `[▲ SUBIÓ ${formatNum(diffEur)} Bs]` : `[▼ BAJÓ ${formatNum(diffEur)} Bs]`;
            const verboEur = subioEur ? 'sube' : 'cede';
            await self.registration.showNotification('Alerta Euro BCV • Nuevo ajuste oficial', {
              body: `${etiquetaEur} El Euro Oficial ${verboEur} a ${formatNum(nuevoEUR)} Bs (Antes: ${formatNum(eurActual)} Bs).`,
              icon: './logo.png',
              badge: './logo.png',
              vibrate: [250, 120, 250],
              requireInteraction: true,
              renotify: true,
              tag: 'eur-change-alert'
            });
          }
          eurActual = nuevoEUR;
        }
      }
    }
  } catch (e) {
    // Respaldo para BCV si falla el primer endpoint
    try {
      const res1 = await fetch('https://ve.dolarapi.com/v1/dolares/oficial', { cache: 'no-store' });
      if (res1.ok) {
        const d1 = await res1.json();
        if (d1 && d1.promedio) {
          const nuevoBCV = parseFloat(d1.promedio);
          if (bcvActual > 0 && Math.abs(nuevoBCV - bcvActual) >= 0.01) {
            const diff = Math.abs(nuevoBCV - bcvActual);
            const subio = nuevoBCV > bcvActual;
            const etiqueta = subio ? `[▲ SUBIÓ ${formatNum(diff)} Bs]` : `[▼ BAJÓ ${formatNum(diff)} Bs]`;
            await self.registration.showNotification('Alerta BCV Oficial • Tasa en movimiento', {
              body: `${etiqueta} El Dólar Oficial se ubica en ${formatNum(nuevoBCV)} Bs (Antes: ${formatNum(bcvActual)} Bs). Ajusta tus cuentas.`,
              icon: './logo.png',
              badge: './logo.png',
              vibrate: [250, 120, 250],
              requireInteraction: true,
              renotify: true,
              tag: 'bcv-change-alert'
            });
          }
          bcvActual = nuevoBCV;
        }
      }
    } catch (err2) {}
  }

  // 2. Verificar Mercado USDT P2P
  try {
    const res2 = await fetch('https://ve.dolarapi.com/v1/dolares/paralelo', { cache: 'no-store' });
    if (res2.ok) {
      const d2 = await res2.json();
      if (d2 && d2.promedio) {
        const nuevoUSDT = parseFloat(d2.promedio);
        if (usdtActual > 0 && Math.abs(nuevoUSDT - usdtActual) >= 0.05) {
          const diffUsdt = Math.abs(nuevoUSDT - usdtActual);
          const subio = nuevoUSDT > usdtActual;
          const etiqueta = subio ? `[▲ SUBIÓ ${formatNum(diffUsdt)} Bs]` : `[▼ BAJÓ ${formatNum(diffUsdt)} Bs]`;
          const accion = subio ? 'toma impulso y sube a' : 'retrocede a';
          const brecha = bcvActual > 0 ? ((nuevoUSDT - bcvActual) / bcvActual) * 100 : 0;
          await self.registration.showNotification('Radar P2P • Movimiento en USDT', {
            body: `${etiqueta} El mercado P2P ${accion} ${formatNum(nuevoUSDT)} Bs (Antes: ${formatNum(usdtActual)} Bs) • Brecha: ${formatNum(brecha)}%.`,
            icon: './logo.png',
            badge: './logo.png',
            vibrate: [250, 120, 250],
            requireInteraction: true,
            renotify: true,
            tag: 'usdt-change-alert'
          });
        }
        usdtActual = nuevoUSDT;
      }
    }
  } catch (e) {}

  // 3. Verificar Reportes Programados por Hora
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
      const textoEur = eurActual > 0 ? ` | EUR: ${formatNum(eurActual)} Bs` : '';
      await self.registration.showNotification(`Resumen de Mercado (${currentHM}) • Finance PRO`, {
        body: `Así cotiza el día — BCV: ${formatNum(bcvActual)} Bs${textoEur} | USDT: ${formatNum(usdtActual)} Bs (Brecha: ${formatNum(brecha)}%).`,
        icon: './logo.png',
        badge: './logo.png',
        vibrate: [300, 120, 300],
        requireInteraction: true,
        renotify: true,
        tag: 'scheduled-report-' + currentHM
      });
      cfg.ultimoAvisoHora = fechaMinuto;
    }
  }

  cfg.tasaBCV = bcvActual;
  cfg.tasaUSDT = usdtActual;
  cfg.tasaEUR = eurActual;
  await guardarConfigEnDB(cfg);
}

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
});

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

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);

  if (url.hostname.includes('dolarapi.com') || url.hostname.includes('dolarvzla.com')) {
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

  if (url.origin !== self.location.origin) {
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', clone));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match('./index.html')) ||
            (await cache.match('./')) ||
            (await caches.match(e.request))
          );
        })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((cachedResponse) => {
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

self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'check-rates-sync' || e.tag === 'check-rates-and-alarms') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }
});

self.addEventListener('sync', (e) => {
  if (e.tag === 'check-rates-sync' || e.tag === 'check-rates-and-alarms') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }
});

self.addEventListener('message', (e) => {
  if (!e.data) return;

  if (e.data.type === 'SYNC_CONFIG') {
    guardarConfigEnDB({
      horarios: e.data.horarios || ['04:00', '09:00', '13:00'],
      tasaBCV: e.data.tasaBCV || 0,
      tasaUSDT: e.data.tasaUSDT || 0,
      tasaEUR: e.data.tasaEUR || 0
    }).then(() => verificarMercadoYAlertarEnFondo());
  }

  if (e.data.type === 'CHECK_NOW') {
    e.waitUntil(verificarMercadoYAlertarEnFondo());
  }

  if (e.data.type === 'SHOW_NOTIFICATION' || e.data.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: './logo.png',
      badge: './logo.png',
      vibrate: [250, 120, 250],
      requireInteraction: true,
      renotify: true,
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
