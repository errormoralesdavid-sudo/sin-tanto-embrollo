// === ESTADO GLOBAL DE TASAS Y CONFIGURACIÓN ===
let tasaBCV = 879.12;
let tasaUSDT = 1006.73;
let tasaEUR = 955.40;
let tasaCOP = 4200;

let monedaSeleccionada = 'bcv';
let horariosAlerta = ['09:00', '13:00', '18:00'];
let historial = [];
let itemSeleccionadoModal = null;
let ultimaHoraNotificada = '';

const CAMPOS_TASAS = ['tasa-bcv', 'tasa-usdt', 'tasa-euro', 'tasa-cop'];

// === FORMATO NUMÉRICO VENEZOLANO ===
function formato(num, decimales = 2) {
  const n = parseFloat(num);
  if (isNaN(n)) return '0,00';
  return n.toLocaleString('es-VE', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  });
}

// === BANNER SUPERIOR DE AVISO (MODO OFFLINE / COPIADO / SINCRONIZADO) ===
function mostrarBannerFlotante(texto, tipo = 'green', duracion = 2800) {
  let banner = document.getElementById('offline-toast-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-toast-banner';
    banner.style.cssText =
      'position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:99999; padding:10px 18px; border-radius:30px; font-size:12px; font-weight:bold; color:#fff; box-shadow:0 4px 15px rgba(0,0,0,0.65); transition:opacity 0.3s ease; text-align:center; width:max-content; max-width:92%; pointer-events:none;';
    document.body.appendChild(banner);
  }

  if (tipo === 'offline') {
    banner.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
    banner.style.border = '1px solid #fbbf24';
  } else {
    banner.style.background = 'linear-gradient(135deg, #059669, #047857)';
    banner.style.border = '1px solid #34d399';
  }

  banner.textContent = texto;
  banner.style.opacity = '1';

  if (duracion > 0) {
    setTimeout(() => {
      if (banner && navigator.onLine) {
        banner.style.opacity = '0';
      } else if (banner && !navigator.onLine) {
        mostrarAvisoEstadoRed(true);
      }
    }, duracion);
  }
}

function mostrarAvisoEstadoRed(esOffline) {
  if (esOffline) {
    mostrarBannerFlotante('⚡ Modo Offline Activo • Usando últimas tasas guardadas', 'offline', 0);
  } else {
    mostrarBannerFlotante('✅ Conexión restaurada • Tasas sincronizadas', 'green', 3200);
  }
}

// === COPIAR MONTO AL PORTAPAPELES ===
function copiarTextoAlPortapapeles(textoLimpio) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(textoLimpio).then(() => {
      mostrarBannerFlotante(`📋 Monto copiado: ${textoLimpio}`, 'green', 2000);
    }).catch(() => fallbackCopiar(textoLimpio));
  } else {
    fallbackCopiar(textoLimpio);
  }
}

function fallbackCopiar(texto) {
  const temp = document.createElement('textarea');
  temp.value = texto;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  mostrarBannerFlotante(`📋 Monto copiado: ${texto}`, 'green', 2000);
}

// Extrae solo el número (ej: "1.006,73 Bs" -> "1006,73") para pegarlo fácil en bancos
function limpiarMontoParaCopiar(textoConMoneda) {
  if (!textoConMoneda) return '0,00';
  const limpio = textoConMoneda
    .replace(/[^\d.,]/g, '')
    .replace(/\./g, '')
    .trim();
  return limpio || textoConMoneda;
}

// === RESPALDO LOCAL EN MEMORIA DEL TELÉFONO ===
function guardarRespaldoLocal() {
  const respaldo = {
    'tasa-bcv': tasaBCV,
    'tasa-usdt': tasaUSDT,
    'tasa-euro': tasaEUR,
    'tasa-cop': tasaCOP,
    horarios: horariosAlerta
  };
  localStorage.setItem('finance_pro_tasas_offline', JSON.stringify(respaldo));
  sincronizarConServiceWorker();
}

function cargarRespaldoLocal() {
  try {
    const guardado = JSON.parse(localStorage.getItem('finance_pro_tasas_offline') || '{}');
    if (parseFloat(guardado['tasa-bcv']) > 0) tasaBCV = parseFloat(guardado['tasa-bcv']);
    if (parseFloat(guardado['tasa-usdt']) > 0) tasaUSDT = parseFloat(guardado['tasa-usdt']);
    if (parseFloat(guardado['tasa-euro']) > 0) tasaEUR = parseFloat(guardado['tasa-euro']);
    if (parseFloat(guardado['tasa-cop']) > 0) tasaCOP = parseFloat(guardado['tasa-cop']);
    if (Array.isArray(guardado.horarios) && guardado.horarios.length > 0) {
      horariosAlerta = guardado.horarios;
    }
  } catch (e) {}

  volcarTasasEnInputs();
  actualizarCabeceraTasas();
  calcularConversionDivisas();
}

function volcarTasasEnInputs() {
  const elBcv = document.getElementById('tasa-bcv');
  const elUsdt = document.getElementById('tasa-usdt');
  const elEur = document.getElementById('tasa-euro');
  const elCop = document.getElementById('tasa-cop');

  if (elBcv) elBcv.value = tasaBCV;
  if (elUsdt) elUsdt.value = tasaUSDT;
  if (elEur) elEur.value = tasaEUR;
  if (elCop) elCop.value = tasaCOP;

  const arbCompra = document.getElementById('arb-tasa-compra');
  const arbVenta = document.getElementById('arb-tasa-venta');
  if (arbCompra && !arbCompra.value) arbCompra.value = tasaBCV;
  if (arbVenta && !arbVenta.value) arbVenta.value = tasaUSDT;
}

// === ACTUALIZAR TARJETAS SUPERIORES ===
function actualizarCabeceraTasas() {
  const hBcv = document.getElementById('header-val-bcv');
  const hUsdt = document.getElementById('header-val-usdt');
  const hEur = document.getElementById('header-val-euro');
  const hCop = document.getElementById('header-val-cop');
  const hBrecha = document.getElementById('header-brecha');

  if (hBcv) hBcv.textContent = `${formato(tasaBCV)} Bs`;
  if (hUsdt) hUsdt.textContent = `${formato(tasaUSDT)} Bs`;
  if (hEur) hEur.textContent = `${formato(tasaEUR)} Bs`;
  if (hCop) hCop.textContent = `${formato(tasaCOP, 0)} COP`;

  let brechaPct = 0;
  let brechaBs = 0;
  if (tasaBCV > 0 && tasaUSDT > 0) {
    brechaBs = tasaUSDT - tasaBCV;
    brechaPct = (brechaBs / tasaBCV) * 100;
  }

  if (hBrecha) hBrecha.textContent = `+${formato(brechaPct)}%`;

  const infoBrechaBs = document.getElementById('info-brecha-bs');
  const infoBrechaPct = document.getElementById('info-brecha-pct');
  if (infoBrechaBs) infoBrechaBs.textContent = `${formato(brechaBs)} Bs`;
  if (infoBrechaPct) infoBrechaPct.textContent = `${formato(brechaPct)}%`;
}

// === SINCRONIZAR TASAS EN VIVO DESDE DOLARAPI ===
async function sincronizarTasasAPI(mostrarMensaje = false) {
  try {
    const [resBcv, resUsdt] = await Promise.all([
      fetch('https://ve.dolarapi.com/v1/dolares/oficial'),
      fetch('https://ve.dolarapi.com/v1/dolares/paralelo')
    ]);

    if (resBcv.ok) {
      const dataBcv = await resBcv.json();
      if (dataBcv && parseFloat(dataBcv.promedio) > 0) {
        tasaBCV = parseFloat(dataBcv.promedio);
        tasaEUR = +(tasaBCV * 1.085).toFixed(2);
      }
    }

    if (resUsdt.ok) {
      const dataUsdt = await resUsdt.json();
      if (dataUsdt && parseFloat(dataUsdt.promedio) > 0) {
        tasaUSDT = parseFloat(dataUsdt.promedio);
      }
    }

    volcarTasasEnInputs();
    actualizarCabeceraTasas();
    calcularConversionDivisas();
    calcularArbitraje();
    guardarRespaldoLocal();

    if (mostrarMensaje) {
      mostrarBannerFlotante('🔄 Tasas actualizadas en tiempo real', 'green', 2400);
    }
  } catch (err) {
    if (!navigator.onLine) {
      mostrarAvisoEstadoRed(true);
    }
  }
}

// === CONVERTIDOR MULTIMONEDA ===
function calcularConversionDivisas() {
  const inputEl = document.getElementById('monto-divisa-entrada');
  const monto = parseFloat(inputEl ? inputEl.value : 0) || 0;

  let totalBolivares = 0;

  if (monedaSeleccionada === 'bcv') {
    totalBolivares = monto * tasaBCV;
  } else if (monedaSeleccionada === 'usdt') {
    totalBolivares = monto * tasaUSDT;
  } else if (monedaSeleccionada === 'bs') {
    totalBolivares = monto;
  } else if (monedaSeleccionada === 'euro') {
    totalBolivares = monto * tasaEUR;
  } else if (monedaSeleccionada === 'cop') {
    const usdEquiv = tasaCOP > 0 ? monto / tasaCOP : 0;
    totalBolivares = usdEquiv * tasaBCV;
  }

  const eqUsdBcv = tasaBCV > 0 ? totalBolivares / tasaBCV : 0;
  const eqUsdt = tasaUSDT > 0 ? totalBolivares / tasaUSDT : 0;
  const eqEuro = tasaEUR > 0 ? totalBolivares / tasaEUR : 0;
  const eqCop = eqUsdBcv * tasaCOP;

  document.getElementById('res-val-bs').textContent = `${formato(totalBolivares)} Bs`;
  document.getElementById('res-val-bcv').textContent = `${formato(eqUsdBcv)} $`;
  document.getElementById('res-val-usdt').textContent = `${formato(eqUsdt)} USDT`;
  document.getElementById('res-val-euro').textContent = `${formato(eqEuro)} €`;
  document.getElementById('res-val-cop').textContent = `${formato(eqCop, 0)} COP`;
}

// === CALCULADORA DE COMISIONES ===
function calcularComisiones() {
  const monto = parseFloat(document.getElementById('com-monto')?.value) || 0;
  const pct = parseFloat(document.getElementById('com-pct')?.value) || 0;
  const fijo = parseFloat(document.getElementById('com-fijo')?.value) || 0;

  const descuento = monto * (pct / 100) + fijo;
  const neto = Math.max(0, monto - descuento);
  const enviarExacto = pct < 100 ? (monto + fijo) / (1 - pct / 100) : 0;

  document.getElementById('com-res-descuento').textContent = formato(descuento);
  document.getElementById('com-res-neto').textContent = formato(neto);
  document.getElementById('com-res-enviar').textContent = formato(enviarExacto);
}

// === SIMULADOR DE ARBITRAJE E HISTORIAL ===
function calcularArbitraje() {
  const capBs = parseFloat(document.getElementById('arb-capital-bs')?.value) || 0;
  const tCompra = parseFloat(document.getElementById('arb-tasa-compra')?.value) || tasaBCV;
  const tVenta = parseFloat(document.getElementById('arb-tasa-venta')?.value) || tasaUSDT;
  const comPct = parseFloat(document.getElementById('arb-comision-pct')?.value) || 0;

  const divisasCompradas = tCompra > 0 ? capBs / tCompra : 0;
  const retornoBrutoBs = divisasCompradas * tVenta;
  const comisionBs = retornoBrutoBs * (comPct / 100);
  const retornoNetoBs = retornoBrutoBs - comisionBs;
  const gananciaNetaBs = retornoNetoBs - capBs;
  const gananciaNetaUsdt = tVenta > 0 ? gananciaNetaBs / tVenta : 0;
  const roi = capBs > 0 ? (gananciaNetaBs / capBs) * 100 : 0;
  const equilibrio = tCompra * (1 + comPct / 100);

  document.getElementById('arb-res-equilibrio').textContent = `${formato(equilibrio)} Bs`;
  document.getElementById('arb-res-retorno').textContent = `${formato(retornoBrutoBs)} Bs`;
  document.getElementById('arb-res-comision').textContent = `${formato(comisionBs)} Bs`;
  document.getElementById('arb-res-ganancia-bs').textContent = `${formato(gananciaNetaBs)} Bs`;
  document.getElementById('arb-res-ganancia-usdt').textContent = `${formato(gananciaNetaUsdt)} USDT`;
  document.getElementById('arb-res-roi').textContent = `${formato(roi)}%`;
}

function cargarHistorial() {
  try {
    historial = JSON.parse(localStorage.getItem('finance_pro_historial') || '[]');
  } catch (e) {
    historial = [];
  }
  renderizarHistorial();
}

function renderizarHistorial() {
  const container = document.getElementById('historial-lista');
  if (!container) return;
  container.innerHTML = '';

  if (historial.length === 0) {
    container.innerHTML = '<p style="font-size:12px; color:#94a3b8; text-align:center;">No hay operaciones guardadas aún.</p>';
    return;
  }

  historial.forEach((h) => {
    const card = document.createElement('div');
    card.className = 'conv-row';
    card.style.cursor = 'pointer';
    card.onclick = () => abrirModalDetalle(h.id);

    const left = document.createElement('div');
    left.innerHTML = `<div style="font-size:12px; font-weight:bold; color:#fff;">${h.canal}</div>
                      <div style="font-size:10px; color:#94a3b8;">${h.fechaHora} • Cap: ${formato(h.inversionBs)} Bs</div>`;

    const right = document.createElement('div');
    right.style.textAlign = 'right';
    right.innerHTML = `<div style="font-size:13px; font-weight:bold; color:var(--neon-green);">${h.gananciaUsdtFinal}</div>
                       <div style="font-size:10px; color:var(--text-muted);">${h.gananciaBsBruta}</div>`;

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
  });
}

function crearLineaDetalle(label, valor, colorDestacado) {
  const row = document.createElement('div');
  row.className = 'result-line';
  const sp = document.createElement('span');
  sp.textContent = label;
  const st = document.createElement('strong');
  st.textContent = valor;
  if (colorDestacado) st.style.color = colorDestacado;
  row.appendChild(sp);
  row.appendChild(st);
  return row;
}

function abrirModalDetalle(id) {
  const item = historial.find((h) => h.id === id);
  if (!item) return;
  itemSeleccionadoModal = item;

  const body = document.getElementById('modal-body-content');
  body.innerHTML = '';
  body.appendChild(crearLineaDetalle('Fecha y Hora:', item.fechaHora));
  body.appendChild(crearLineaDetalle('Canal Operativo:', item.canal));
  body.appendChild(crearLineaDetalle('Capital Inicial:', `${formato(item.inversionBs)} Bs`));
  body.appendChild(crearLineaDetalle('Tasas (Compra / Venta):', `${item.tasaCompra} / ${item.tasaVenta}`));
  body.appendChild(crearLineaDetalle('Punto de Equilibrio:', item.puntoEquilibrio));
  body.appendChild(crearLineaDetalle('Retorno Bruto en Bs:', item.montoFinalVenta));
  body.appendChild(crearLineaDetalle('Deducible Comisiones:', item.comisionesBs, 'var(--danger-color)'));
  body.appendChild(crearLineaDetalle('Ganancia Neta (Bs):', item.gananciaBsBruta, 'var(--neon-green)'));
  body.appendChild(crearLineaDetalle('Ganancia Neta (USDT):', item.gananciaUsdtFinal, 'var(--neon-green)'));

  document.getElementById('modal-detalle').style.display = 'flex';
}

// === HORARIOS Y NOTIFICACIONES PUSH ===
function renderizarHorariosChips() {
  const cont = document.getElementById('lista-horarios-chips');
  if (!cont) return;
  cont.innerHTML = '';

  horariosAlerta.forEach((hora) => {
    const chip = document.createElement('span');
    chip.className = 'time-chip';
    chip.innerHTML = `⏰ ${hora} <button type="button" data-del-hora="${hora}">&times;</button>`;
    cont.appendChild(chip);
  });

  cont.querySelectorAll('button[data-del-hora]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const h = btn.getAttribute('data-del-hora');
      horariosAlerta = horariosAlerta.filter((item) => item !== h);
      guardarRespaldoLocal();
      renderizarHorariosChips();
    });
  });
}

function dispararNotificacion(titulo, cuerpo) {
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'SHOW_NOTIFICATION',
          title: titulo,
          body: cuerpo,
          tag: 'finance-pro-alert-' + Date.now()
        });
      } else {
        reg.showNotification(titulo, {
          body: cuerpo,
          icon: './logo.png',
          badge: './logo.png',
          vibrate: [200, 100, 200]
        });
      }
    });
  }
}

function sincronizarConServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      if (reg.active) {
        reg.active.postMessage({
          type: 'SYNC_CONFIG',
          horarios: horariosAlerta,
          tasaBCV: tasaBCV,
          tasaUSDT: tasaUSDT
        });
      }
    });
  }
}

async function activarSincronizacionFondo() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;

  if ('periodicSync' in reg) {
    try {
      await reg.periodicSync.register('check-rates-sync', {
        minInterval: 15 * 60 * 1000
      });
    } catch (e) {}
  }

  if ('sync' in reg) {
    try {
      await reg.sync.register('check-rates-sync');
    } catch (e) {}
  }

  if (reg.active) {
    reg.active.postMessage({ type: 'CHECK_NOW' });
  }
}

function iniciarRelojNotificaciones() {
  setInterval(() => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const currentTime = `${hh}:${mm}`;
    const keyHoy = `${now.toDateString()}_${currentTime}`;

    if (horariosAlerta.includes(currentTime) && ultimaHoraNotificada !== keyHoy) {
      ultimaHoraNotificada = keyHoy;
      dispararNotificacion(
        `Reporte Programado (${currentTime})`,
        `BCV: ${formato(tasaBCV)} Bs | USDT P2P: ${formato(tasaUSDT)} Bs | EUR: ${formato(tasaEUR)} Bs`
      );
    }
  }, 15000);
}

// === INICIALIZACIÓN DE EVENTOS AL CARGAR LA APP ===
window.addEventListener('DOMContentLoaded', () => {
  // Registrar Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => {
      sincronizarConServiceWorker();
      activarSincronizacionFondo();
    }).catch(() => {});
  }

  cargarRespaldoLocal();
  cargarHistorial();
  renderizarHorariosChips();
  iniciarRelojNotificaciones();

  if (!navigator.onLine) {
    mostrarAvisoEstadoRed(true);
  } else {
    sincronizarTasasAPI(false);
  }

  // Botones de copiar monto en resultados
  document.querySelectorAll('.btn-copy-val').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-copy-target');
      const el = document.getElementById(targetId);
      if (el) {
        const valorLimpio = limpiarMontoParaCopiar(el.textContent);
        copiarTextoAlPortapapeles(valorLimpio);
      }
    });
  });

  // Selector de moneda en Convertidor
  const labelsMoneda = {
    bcv: 'Monto en Dólares (BCV) ($):',
    usdt: 'Monto en USDT (P2P):',
    bs: 'Monto en Bolívares (Bs):',
    euro: 'Monto en Euros (€):',
    cop: 'Monto en Pesos (COP):'
  };

  document.querySelectorAll('.currency-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.currency-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      monedaSeleccionada = pill.getAttribute('data-curr');
      const lbl = document.getElementById('label-monto-entrada');
      if (lbl) lbl.textContent = labelsMoneda[monedaSeleccionada] || 'Monto:';
      calcularConversionDivisas();
    });
  });

  // Input de monto a convertir
  document.getElementById('monto-divisa-entrada')?.addEventListener('input', calcularConversionDivisas);

  // Inputs manuales de tasas
  CAMPOS_TASAS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        tasaBCV = parseFloat(document.getElementById('tasa-bcv').value) || 0;
        tasaUSDT = parseFloat(document.getElementById('tasa-usdt').value) || 0;
        tasaEUR = parseFloat(document.getElementById('tasa-euro').value) || 0;
        tasaCOP = parseFloat(document.getElementById('tasa-cop').value) || 0;
        actualizarCabeceraTasas();
        calcularConversionDivisas();
        calcularArbitraje();
        guardarRespaldoLocal();
      });
    }
  });

  // Mostrar / ocultar panel de configuración
  document.getElementById('btn-toggle-settings')?.addEventListener('click', () => {
    const drawer = document.getElementById('settings-drawer');
    if (drawer) {
      drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    }
  });

  // Botón restablecer campos
  document.getElementById('btn-reset-all')?.addEventListener('click', () => {
    const mDiv = document.getElementById('monto-divisa-entrada');
    const mCom = document.getElementById('com-monto');
    const mArb = document.getElementById('arb-capital-bs');
    if (mDiv) mDiv.value = '';
    if (mCom) mCom.value = '';
    if (mArb) mArb.value = '';
    calcularConversionDivisas();
    calcularComisiones();
    calcularArbitraje();
    mostrarBannerFlotante('🧹 Campos de cálculo restablecidos', 'green', 1800);
  });

  // Botones de sincronización
  document.getElementById('btn-refresh-rates')?.addEventListener('click', () => sincronizarTasasAPI(true));
  document.getElementById('btn-sync-bcv')?.addEventListener('click', () => sincronizarTasasAPI(true));
  document.getElementById('btn-sync-usdt')?.addEventListener('click', () => sincronizarTasasAPI(true));

  // Agregar nueva hora de alerta
  document.getElementById('btn-agregar-hora')?.addEventListener('click', () => {
    const inp = document.getElementById('input-nueva-hora');
    if (inp && inp.value && !horariosAlerta.includes(inp.value)) {
      horariosAlerta.push(inp.value);
      horariosAlerta.sort();
      guardarRespaldoLocal();
      renderizarHorariosChips();
      mostrarBannerFlotante(`⏰ Alerta agregada a las ${inp.value}`, 'green', 2000);
    }
  });

  // Activar permiso de notificaciones Push
  document.getElementById('btn-activar-alertas')?.addEventListener('click', async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      sincronizarConServiceWorker();
      activarSincronizacionFondo();
      dispararNotificacion(
        '🔔 Alertas Finance PRO Activas',
        `Tasas actuales — BCV: ${formato(tasaBCV)} Bs | USDT: ${formato(tasaUSDT)} Bs`
      );
    }
  });

  // Eventos de Calculadora de Comisiones
  document.querySelectorAll('.preset-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      const fee = parseFloat(chip.getAttribute('data-fee')) || 0;
      document.getElementById('com-pct').value = fee;
      document.getElementById('com-fijo').value = fee === 5.4 ? 0.3 : 0;
      calcularComisiones();
    });
  });

  ['com-monto', 'com-pct', 'com-fijo'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', calcularComisiones);
  });

  // Eventos de Arbitraje
  ['arb-capital-bs', 'arb-tasa-compra', 'arb-tasa-venta', 'arb-comision-pct'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', calcularArbitraje);
  });

  document.getElementById('btn-guardar-operacion')?.addEventListener('click', () => {
    const capBs = parseFloat(document.getElementById('arb-capital-bs')?.value) || 0;
    if (capBs <= 0) {
      mostrarBannerFlotante('⚠️ Ingresa un capital inicial en Bs', 'offline', 2200);
      return;
    }
    const ahora = new Date();
    const registro = {
      id: Date.now(),
      fechaHora: ahora.toLocaleString('es-VE'),
      canal: document.getElementById('arb-canal').value,
      inversionBs: capBs,
      tasaCompra: formato(document.getElementById('arb-tasa-compra').value),
      tasaVenta: formato(document.getElementById('arb-tasa-venta').value),
      puntoEquilibrio: document.getElementById('arb-res-equilibrio').textContent,
      montoFinalVenta: document.getElementById('arb-res-retorno').textContent,
      comisionesBs: document.getElementById('arb-res-comision').textContent,
      gananciaBsBruta: document.getElementById('arb-res-ganancia-bs').textContent,
      gananciaUsdtFinal: document.getElementById('arb-res-ganancia-usdt').textContent
    };

    historial.unshift(registro);
    localStorage.setItem('finance_pro_historial', JSON.stringify(historial));
    renderizarHistorial();
    mostrarBannerFlotante('💾 Operación guardada en el historial', 'green', 2200);
  });

  document.getElementById('btn-limpiar-historial')?.addEventListener('click', () => {
    historial = [];
    localStorage.removeItem('finance_pro_historial');
    renderizarHistorial();
  });

  document.getElementById('btn-cerrar-modal')?.addEventListener('click', () => {
    document.getElementById('modal-detalle').style.display = 'none';
  });

  document.getElementById('btn-eliminar-item')?.addEventListener('click', () => {
    if (!itemSeleccionadoModal) return;
    historial = historial.filter((h) => h.id !== itemSeleccionadoModal.id);
    localStorage.setItem('finance_pro_historial', JSON.stringify(historial));
    renderizarHistorial();
    document.getElementById('modal-detalle').style.display = 'none';
  });

  document.getElementById('btn-copiar-reporte')?.addEventListener('click', () => {
    if (!itemSeleccionadoModal) return;
    const texto = `📊 Finance PRO - ${itemSeleccionadoModal.canal}\nCapital: ${formato(itemSeleccionadoModal.inversionBs)} Bs\nGanancia: ${itemSeleccionadoModal.gananciaUsdtFinal} (${itemSeleccionadoModal.gananciaBsBruta})`;
    copiarTextoAlPortapapeles(texto);
  });

  // Navegación entre las 3 pestañas inferiores
  document.querySelectorAll('.nav-item').forEach((navBtn) => {
    navBtn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach((b) => b.classList.remove('active'));
      navBtn.classList.add('active');
      const targetTab = navBtn.getAttribute('data-tab');
      document.querySelectorAll('.tab-section').forEach((sec) => {
        sec.style.display = sec.id === targetTab ? 'block' : 'none';
      });
    });
  });
});

window.addEventListener('offline', () => {
  cargarRespaldoLocal();
  mostrarAvisoEstadoRed(true);
});

window.addEventListener('online', () => {
  mostrarAvisoEstadoRed(false);
  sincronizarTasasAPI(false);
  activarSincronizacionFondo();
});

setInterval(activarSincronizacionFondo, 25000);
document.addEventListener('visibilitychange', activarSincronizacionFondo);
