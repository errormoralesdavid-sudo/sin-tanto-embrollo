var tasaBCV = 832.48;
var tasaUSDT = 885.10;
var tasaEUR = 968.06;
var tasaCOP = 3102.00;

var prevBCV = null;
var prevUSDT = null;
var prevEUR = null;

var monedaActiva = 'USD';
var bancoActivoNombre = 'BdV';
var binanceActivoNombre = 'Maker';

var historial = [];
var historicoGrafico = [];
var listaHorariosNotif = ["04:00", "09:00", "13:00"];

var listaBancos = [
  { id: 1, nombre: 'BdV', comision: 2.5 },
  { id: 2, nombre: 'BDT', comision: 1.5 },
  { id: 3, nombre: 'B. Tesoro', comision: 2.5 },
  { id: 4, nombre: 'Banesco', comision: 1.5 },
  { id: 5, nombre: 'Provincial', comision: 1.5 },
  { id: 6, nombre: 'BNC', comision: 1.5 }
];

var listaBinance = [
  { id: 1, nombre: 'Maker', comision: 0.0 },
  { id: 2, nombre: 'Taker', comision: 0.1 },
  { id: 3, nombre: 'P2P Ref', comision: 0.2 },
  { id: 4, nombre: 'Tarjeta', comision: 0.35 }
];

var itemSeleccionadoModal = null;
var isUserInteracting = false;
var resumeTimeout = null;
var aplicandoNube = false;

function sanitizarTexto(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function (s) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s];
  });
}

window.mostrarToast = function(mensaje) {
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 250);
  }, 2600);
};

window.onload = function() {
  registrarServiceWorkerYBackgroundSync();

  cargarDatosGuardados();
  renderBancos();
  renderBinance();
  renderHorariosNotificaciones();
  actualizarTasasManuales(false);
  
  sincronizarDolarVzlaAPI(false);
  sincronizarBinanceP2P(false);
  
  // Revisión periódica automática de cambios en el mercado cambiario
  setInterval(function() {
    sincronizarDolarVzlaAPI(false);
    sincronizarBinanceP2P(false);
  }, 180000); // Cada 3 minutos mientras esté activa o en background

  iniciarSmoothSlider();
  iniciarScrollWheelSlider();
  renderGraficoD3();
  iniciarRelojNotificaciones();
  iniciarAutoScrollEnInputs();
};

async function registrarServiceWorkerYBackgroundSync() {
  if ('serviceWorker' in navigator) {
    try {
      var reg = await navigator.serviceWorker.register('sw.js');
      sincronizarConfigConServiceWorker();

      if ('periodicSync' in reg) {
        try {
          await reg.periodicSync.register('check-rates-and-alarms', {
            minInterval: 15 * 60 * 1000
          });
        } catch(e) {}
      }
    } catch (err) {}
  }
}

function sincronizarConfigConServiceWorker() {
  var payloadSW = {
    type: 'SYNC_CONFIG',
    horarios: listaHorariosNotif,
    tasaBCV: tasaBCV,
    tasaUSDT: tasaUSDT,
    tasaEUR: tasaEUR
  };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(payloadSW);
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function(reg) {
      if (reg.active) reg.active.postMessage(payloadSW);
    });
  }
}

function dispararNotificacion(titulo, cuerpo) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'NOTIFY',
      title: titulo,
      body: cuerpo
    });
  } else if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then(function(reg) {
      reg.showNotification(titulo, {
        body: cuerpo,
        icon: 'https://files.catbox.moe/gdnebi.png',
        badge: 'https://files.catbox.moe/gdnebi.png',
        vibrate: [250, 120, 250],
        renotify: true,
        tag: 'finance-pro-alert'
      });
    });
  }
}

function iniciarScrollWheelSlider() {
  var slider = document.getElementById('rate-slider');
  slider.addEventListener('wheel', function(e) {
    if (e.deltaY !== 0) {
      e.preventDefault();
      slider.scrollLeft += e.deltaY;
    }
  }, { passive: false });
}

function iniciarAutoScrollEnInputs() {
  document.querySelectorAll('input').forEach(function(input) {
    input.addEventListener('focus', function() {
      var self = this;
      setTimeout(function() {
        self.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 280);
    });
  });
}

function iniciarSmoothSlider() {
  var slider = document.getElementById('rate-slider');
  slider.addEventListener('touchstart', detenerAutoScroll);
  slider.addEventListener('touchend', reanudarAutoScrollConDelay);
  slider.addEventListener('mouseenter', detenerAutoScroll);
  slider.addEventListener('mouseleave', reanudarAutoScrollConDelay);

  function step() {
    if (!isUserInteracting) {
      slider.scrollLeft += 0.5;
      if (slider.scrollLeft >= (slider.scrollWidth - slider.clientWidth - 1)) {
        slider.scrollLeft = 0;
      }
    }
    requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function detenerAutoScroll() {
  isUserInteracting = true;
  if (resumeTimeout) clearTimeout(resumeTimeout);
}

function reanudarAutoScrollConDelay() {
  if (resumeTimeout) clearTimeout(resumeTimeout);
  resumeTimeout = setTimeout(function() { isUserInteracting = false; }, 2500);
}

function formato(num) {
  var val = Number(num);
  if (!isFinite(val)) val = 0;
  return val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toggleAccordion(id) {
  document.getElementById(id).classList.toggle('open');
}

// ESTRUCTURA UNIFICADA PARA LOCALSTORAGE Y FIREBASE FIRESTORE
window.obtenerPayloadActual = function() {
  return {
    bcv: document.getElementById('input-tasa-bcv').value,
    usdt: document.getElementById('input-tasa-usdt').value,
    eur: document.getElementById('input-tasa-eur').value,
    cop: document.getElementById('input-tasa-cop').value,
    prevBCV: prevBCV,
    prevUSDT: prevUSDT,
    prevEUR: prevEUR,
    bancos: listaBancos,
    binance: listaBinance,
    historial: historial,
    historicoGrafico: historicoGrafico,
    horariosNotif: listaHorariosNotif,
    monedaActiva: monedaActiva,
    comPorcBanco: document.getElementById('com-porc-banco').value,
    comPorcBinance: document.getElementById('com-porc-binance').value,
    comPorcPersonal: document.getElementById('com-porc-personal').value,
    arbComPersonal: document.getElementById('arb-com-personal').value,
    bancoActivoNombre: bancoActivoNombre,
    binanceActivoNombre: binanceActivoNombre
  };
};

function guardarDatos(subirANube = true) {
  var datos = window.obtenerPayloadActual();
  localStorage.setItem('embrollo_data_pro_v5', JSON.stringify(datos));
  sincronizarConfigConServiceWorker();

  if (subirANube && !aplicandoNube && window.guardarDatosEnFirebase) {
    window.guardarDatosEnFirebase(datos);
  }
}

// RECIBIR Y APLICAR AJUSTES Y LIBRO CONTABLE DESDE FIREBASE
window.aplicarDatosDesdeNube = function(datos) {
  if (!datos) return;
  aplicandoNube = true;
  try {
    if(datos.bcv) document.getElementById('input-tasa-bcv').value = datos.bcv;
    if(datos.usdt) document.getElementById('input-tasa-usdt').value = datos.usdt;
    if(datos.eur) document.getElementById('input-tasa-eur').value = datos.eur;
    if(datos.cop) document.getElementById('input-tasa-cop').value = datos.cop;
    
    if(datos.prevBCV !== undefined) prevBCV = datos.prevBCV;
    if(datos.prevUSDT !== undefined) prevUSDT = datos.prevUSDT;
    if(datos.prevEUR !== undefined) prevEUR = datos.prevEUR;

    if(Array.isArray(datos.bancos)) { listaBancos = datos.bancos; renderBancos(); }
    if(Array.isArray(datos.binance)) { listaBinance = datos.binance; renderBinance(); }
    if(Array.isArray(datos.historial)) { historial = datos.historial; renderHistorial(); }
    if(Array.isArray(datos.historicoGrafico)) { historicoGrafico = datos.historicoGrafico; renderGraficoD3(); }
    if(Array.isArray(datos.horariosNotif)) { listaHorariosNotif = datos.horariosNotif; renderHorariosNotificaciones(); }

    if(datos.comPorcBanco !== undefined) document.getElementById('com-porc-banco').value = datos.comPorcBanco;
    if(datos.comPorcBinance !== undefined) document.getElementById('com-porc-binance').value = datos.comPorcBinance;
    if(datos.comPorcPersonal !== undefined) document.getElementById('com-porc-personal').value = datos.comPorcPersonal;
    if(datos.arbComPersonal !== undefined) document.getElementById('arb-com-personal').value = datos.arbComPersonal;

    if(datos.bancoActivoNombre) {
      bancoActivoNombre = datos.bancoActivoNombre;
      document.getElementById('label-banco-activo').textContent = bancoActivoNombre + ' (' + document.getElementById('com-porc-banco').value + '%)';
    }
    if(datos.binanceActivoNombre) {
      binanceActivoNombre = datos.binanceActivoNombre;
      document.getElementById('label-binance-activo').textContent = binanceActivoNombre + ' (' + document.getElementById('com-porc-binance').value + '%)';
    }

    if(datos.monedaActiva) {
      var btn = document.querySelector('.curr-btn[data-curr="' + datos.monedaActiva + '"]');
      if (btn) seleccionarMonedaBase(datos.monedaActiva, btn, false);
    }

    actualizarResumenCanal();
    actualizarTasasManuales(false);
    localStorage.setItem('embrollo_data_pro_v5', JSON.stringify(window.obtenerPayloadActual()));
    sincronizarConfigConServiceWorker();
  } catch(e) {}
  aplicandoNube = false;
};

function cargarDatosGuardados() {
  try {
    var datos = JSON.parse(localStorage.getItem('embrollo_data_pro_v5'));
    if (datos) {
      window.aplicarDatosDesdeNube(datos);
    }
  } catch(e) {}

  if (historicoGrafico.length === 0) {
    historicoGrafico = [
      { fecha: 'T-3', bcv: tasaBCV * 0.985, usdt: tasaUSDT * 0.98 },
      { fecha: 'T-2', bcv: tasaBCV * 0.992, usdt: tasaUSDT * 0.99 },
      { fecha: 'Ayer', bcv: tasaBCV * 0.997, usdt: tasaUSDT * 0.995 },
      { fecha: 'Hoy', bcv: tasaBCV, usdt: tasaUSDT }
    ];
  }
}

function seleccionarMonedaBase(moneda, el, guardar = true) {
  monedaActiva = moneda;
  document.querySelectorAll('.curr-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');

  var labels = {
    'USD': 'Monto en Dólares Oficiales BCV ($):',
    'USDT': 'Monto en Cripto USDT (P2P):',
    'VES': 'Monto en Bolívares (Bs):',
    'EUR': 'Monto en Euros Oficiales (€):',
    'COP': 'Monto en Pesos Colombianos (COP):'
  };
  document.getElementById('main-input-label').textContent = labels[moneda] || 'Monto:';
  calcularMultimoneda();
  if (guardar) guardarDatos(true);
}

function calcularMultimoneda() {
  var monto = parseFloat(document.getElementById('main-amount-input').value) || 0;
  var baseEnBs = 0;

  if (monedaActiva === 'VES') baseEnBs = monto;
  else if (monedaActiva === 'USD') baseEnBs = monto * tasaBCV;
  else if (monedaActiva === 'USDT') baseEnBs = monto * tasaUSDT;
  else if (monedaActiva === 'EUR') baseEnBs = monto * tasaEUR;
  else if (monedaActiva === 'COP') baseEnBs = tasaCOP > 0 ? monto * (tasaBCV / tasaCOP) : 0;

  var usdBcv = tasaBCV > 0 ? baseEnBs / tasaBCV : 0;
  var usdtP2p = tasaUSDT > 0 ? baseEnBs / tasaUSDT : 0;
  var eur = tasaEUR > 0 ? baseEnBs / tasaEUR : 0;
  var cop = usdBcv * tasaCOP;

  document.getElementById('res-multi-ves-bcv').textContent = formato(baseEnBs) + ' Bs';
  document.getElementById('res-multi-usd').textContent = formato(usdBcv) + ' $';
  document.getElementById('res-multi-usdt').textContent = formato(usdtP2p) + ' USDT';
  document.getElementById('res-multi-eur').textContent = formato(eur) + ' €';
  document.getElementById('res-multi-cop').textContent = formato(cop) + ' COP';
}

function renderHorariosNotificaciones() {
  var cont = document.getElementById('lista-horarios');
  cont.innerHTML = '';
  listaHorariosNotif.forEach(function(hora, idx) {
    var tag = document.createElement('div');
    tag.style = 'background:rgba(0,230,118,0.14); border:1px solid var(--neon-green); color:var(--text-color); font-size:11px; padding:4px 10px; border-radius:8px; display:flex; align-items:center; gap:8px; font-weight:600;';
    
    var spanHora = document.createElement('span');
    spanHora.textContent = hora;
    
    var btnDel = document.createElement('span');
    btnDel.textContent = '✕';
    btnDel.style = 'cursor:pointer; color:var(--danger-color); font-weight:bold;';
    btnDel.onclick = function() { eliminarHorarioNotificacion(idx); };
    
    tag.appendChild(spanHora);
    tag.appendChild(btnDel);
    cont.appendChild(tag);
  });
}

function agregarHorarioNotificacion() {
  var nuevo = document.getElementById('nuevo-horario').value;
  if (!nuevo) return;
  if (!listaHorariosNotif.includes(nuevo)) {
    listaHorariosNotif.push(nuevo);
    listaHorariosNotif.sort();
    renderHorariosNotificaciones();
    guardarDatos(true);
    mostrarToast("Alerta programada a las " + nuevo);
  }
}

function eliminarHorarioNotificacion(idx) {
  listaHorariosNotif.splice(idx, 1);
  renderHorariosNotificaciones();
  guardarDatos(true);
}

function abrirModalInput(titulo, mostrarNombre, valorNombre, valorPct, callback) {
  document.getElementById('modal-input-title').textContent = titulo;
  var nameWrap = document.getElementById('modal-input-name-wrap');
  var inputName = document.getElementById('modal-input-name');
  var inputPct = document.getElementById('modal-input-pct');

  nameWrap.style.display = mostrarNombre ? 'block' : 'none';
  inputName.value = valorNombre || '';
  inputPct.value = valorPct !== undefined ? valorPct : '';

  document.getElementById('modal-input-custom').style.display = 'flex';

  document.getElementById('modal-input-save').onclick = function() {
    var n = sanitizarTexto(inputName.value.trim());
    var p = parseFloat(inputPct.value) || 0;
    if (mostrarNombre && !n) {
      mostrarToast("Ingrese un nombre válido");
      return;
    }
    callback(n, p);
    cerrarModalInput();
  };
}

function cerrarModalInput() {
  document.getElementById('modal-input-custom').style.display = 'none';
}

function renderBancos() {
  var grid = document.getElementById('grid-bancos');
  grid.innerHTML = '';
  listaBancos.forEach(function(b) {
    var div = document.createElement('div');
    div.className = 'bank-btn' + (b.nombre === bancoActivoNombre ? ' active' : '');
    
    var spNombre = document.createElement('span');
    spNombre.textContent = b.nombre;
    
    var rightWrap = document.createElement('div');
    rightWrap.style = 'display:flex; align-items:center; gap:6px;';
    
    var badge = document.createElement('span');
    badge.className = 'bank-badge';
    badge.textContent = b.comision + '%';
    
    var editBtn = document.createElement('span');
    editBtn.innerHTML = '<svg class="icon-svg-sm" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    editBtn.style = 'opacity:0.7;';
    editBtn.onclick = function(e) {
      e.stopPropagation();
      abrirModalInput('Editar ' + b.nombre, false, b.nombre, b.comision, function(_, nuevaCom) {
        b.comision = nuevaCom;
        renderBancos();
        guardarDatos(true);
        mostrarToast("Comisión sincronizada en la nube");
      });
    };

    rightWrap.appendChild(badge);
    rightWrap.appendChild(editBtn);
    div.appendChild(spNombre);
    div.appendChild(rightWrap);

    div.onclick = function() { seleccionarBancoComision(b.comision, b.nombre, div); };
    grid.appendChild(div);
  });

  var btnAdd = document.createElement('div');
  btnAdd.className = 'btn-add-item';
  btnAdd.textContent = '+ Agregar Entidad Bancaria';
  btnAdd.onclick = function() {
    abrirModalInput('Nuevo Banco', true, '', 1.5, function(nombre, comision) {
      listaBancos.push({ id: Date.now(), nombre: nombre, comision: comision });
      renderBancos();
      guardarDatos(true);
      mostrarToast("Banco guardado en la nube");
    });
  };
  grid.appendChild(btnAdd);
}

function renderBinance() {
  var grid = document.getElementById('grid-binance');
  grid.innerHTML = '';
  listaBinance.forEach(function(bin) {
    var div = document.createElement('div');
    div.className = 'binance-btn' + (bin.nombre === binanceActivoNombre ? ' active' : '');
    
    var spNombre = document.createElement('span');
    spNombre.textContent = bin.nombre;

    var rightWrap = document.createElement('div');
    rightWrap.style = 'display:flex; align-items:center; gap:6px;';

    var badge = document.createElement('span');
    badge.className = 'bank-badge';
    badge.textContent = bin.comision + '%';

    var editBtn = document.createElement('span');
    editBtn.innerHTML = '<svg class="icon-svg-sm" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
    editBtn.style = 'opacity:0.7;';
    editBtn.onclick = function(e) {
      e.stopPropagation();
      abrirModalInput('Editar ' + bin.nombre, false, bin.nombre, bin.comision, function(_, nuevaCom) {
        bin.comision = nuevaCom;
        renderBinance();
        guardarDatos(true);
        mostrarToast("Tarifa sincronizada en la nube");
      });
    };

    rightWrap.appendChild(badge);
    rightWrap.appendChild(editBtn);
    div.appendChild(spNombre);
    div.appendChild(rightWrap);

    div.onclick = function() { seleccionarBinanceComision(bin.comision, bin.nombre, div); };
    grid.appendChild(div);
  });

  var btnAdd = document.createElement('div');
  btnAdd.className = 'btn-add-item';
  btnAdd.textContent = '+ Agregar Tarifa P2P';
  btnAdd.onclick = function() {
    abrirModalInput('Nueva Modalidad P2P', true, '', 0.15, function(nombre, comision) {
      listaBinance.push({ id: Date.now(), nombre: nombre, comision: comision });
      renderBinance();
      guardarDatos(true);
      mostrarToast("Modalidad guardada en la nube");
    });
  };
  grid.appendChild(btnAdd);
}

function seleccionarBancoComision(comision, nombreBanco, el) {
  document.querySelectorAll('#grid-bancos .bank-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('com-porc-banco').value = comision;
  bancoActivoNombre = nombreBanco;
  document.getElementById('label-banco-activo').textContent = nombreBanco + ' (' + comision + '%)';
  toggleAccordion('acc-bancos');
  actualizarResumenCanal();
  calcularComisiones(1);
  calcularArbitraje();
  guardarDatos(true);
}

function seleccionarBinanceComision(comision, nombreBinance, el) {
  document.querySelectorAll('#grid-binance .binance-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('com-porc-binance').value = comision;
  binanceActivoNombre = nombreBinance;
  document.getElementById('label-binance-activo').textContent = nombreBinance + ' (' + comision + '%)';
  toggleAccordion('acc-binance');
  actualizarResumenCanal();
  calcularComisiones(1);
  calcularArbitraje();
  guardarDatos(true);
}

function actualizarResumenCanal() {
  var pb = document.getElementById('com-porc-banco').value;
  var pbin = document.getElementById('com-porc-binance').value;
  document.getElementById('resumen-canal-activo').textContent = bancoActivoNombre + ' [' + pb + '%] + ' + binanceActivoNombre + ' [' + pbin + '%]';
}

function actualizarTasasManuales(subirNube = true) {
  tasaBCV = parseFloat(document.getElementById('input-tasa-bcv').value) || 0;
  tasaUSDT = parseFloat(document.getElementById('input-tasa-usdt').value) || 0;
  tasaEUR = parseFloat(document.getElementById('input-tasa-eur').value) || 0;
  tasaCOP = parseFloat(document.getElementById('input-tasa-cop').value) || 0;

  document.getElementById('rate-bcv').textContent = formato(tasaBCV) + ' Bs';
  document.getElementById('rate-usdt').textContent = formato(tasaUSDT) + ' Bs';
  document.getElementById('rate-eur').textContent = formato(tasaEUR) + ' Bs';
  document.getElementById('rate-cop').textContent = formato(tasaCOP);

  calcularVariacion('var-bcv', tasaBCV, prevBCV);
  calcularVariacion('var-usdt', tasaUSDT, prevUSDT);
  calcularVariacion('var-eur', tasaEUR, prevEUR);

  var spread = tasaBCV > 0 ? ((tasaUSDT - tasaBCV) / tasaBCV) * 100 : 0;
  document.getElementById('rate-spread').textContent = spread.toFixed(2) + '%';

  document.getElementById('arb-tasa-compra').value = tasaBCV;
  document.getElementById('arb-tasa-venta').value = tasaUSDT;
  
  calcularMultimoneda();
  calcularArbitraje();
  calcularMetaNeta();
  guardarDatos(subirNube);
}

function calcularVariacion(elementId, actual, previo) {
  var el = document.getElementById(elementId);
  if (!previo || previo === actual) {
    el.textContent = 'Estable';
    el.className = 'trend neutral';
    return;
  }
  var diff = ((actual - previo) / previo) * 100;
  if (diff > 0) {
    el.textContent = '+' + diff.toFixed(2) + '%';
    el.className = 'trend up';
  } else {
    el.textContent = diff.toFixed(2) + '%';
    el.className = 'trend down';
  }
}

async function sincronizarDolarVzlaAPI(mostrarAlerta) {
  try {
    var response = await fetch('https://rates.dolarvzla.com/bcv/current.json');
    var data = await response.json();
    var huboCambio = false;

    if (data.current) {
      var nuevoUsd = parseFloat(data.current.usd);
      if (nuevoUsd && Math.abs(nuevoUsd - tasaBCV) >= 0.01) {
        prevBCV = tasaBCV;
        document.getElementById('input-tasa-bcv').value = nuevoUsd;
        huboCambio = true;
        dispararNotificacion(
          'Cambio en Dólar BCV Oficial',
          'Nueva tasa: ' + formato(nuevoUsd) + ' Bs (Antes: ' + formato(prevBCV) + ' Bs)'
        );
      }
      var nuevoEur = parseFloat(data.current.eur);
      if (nuevoEur && Math.abs(nuevoEur - tasaEUR) >= 0.01) {
        prevEUR = tasaEUR;
        document.getElementById('input-tasa-eur').value = nuevoEur;
        huboCambio = true;
      }
    }
    actualizarTasasManuales(huboCambio);
    document.getElementById('sync-status').textContent = 'Tasas Oficiales Sincronizadas';
    if (mostrarAlerta) mostrarToast('Tasas BCV actualizadas');
  } catch (error) {
    document.getElementById('sync-status').textContent = 'Modo Offline Activo';
  }
}

async function sincronizarBinanceP2P(mostrarAlerta) {
  try {
    var response = await fetch('https://ve.dolarapi.com/v1/dolares');
    var data = await response.json();
    var binanceObj = data.find(function(item) { return item.fuente === 'paralelo' || item.fuente === 'cripto'; }) || data[1];
    
    if (binanceObj && binanceObj.promedio) {
      var nuevaTasa = parseFloat(binanceObj.promedio);
      var huboCambio = false;
      if (nuevaTasa && Math.abs(nuevaTasa - tasaUSDT) >= 0.01) {
        prevUSDT = tasaUSDT;
        document.getElementById('input-tasa-usdt').value = nuevaTasa;
        huboCambio = true;
        dispararNotificacion(
          'Cambio en USDT P2P',
          'Nueva cotización: ' + formato(nuevaTasa) + ' Bs | BCV: ' + formato(tasaBCV) + ' Bs'
        );
      }
      actualizarTasasManuales(huboCambio);
      document.getElementById('sync-status').textContent = 'Mercado P2P Sincronizado';
      if (mostrarAlerta) mostrarToast('Tasa USDT P2P actualizada');
    }
  } catch (e) {
    document.getElementById('sync-status').textContent = 'Modo Offline Activo';
  }
}

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
  document.getElementById('tab-' + tabId).classList.add('active');
  el.classList.add('active');
}

function calcularComisionTransf() {
  var bs = parseFloat(document.getElementById('transf-monto-bs').value) || 0;
  var comision = bs * 0.003;
  document.getElementById('transf-res-comision').textContent = formato(comision) + ' Bs';
  document.getElementById('transf-res-total').textContent = formato(bs + comision) + ' Bs';
}

function calcularMetaNeta() {
  var metaUsd = parseFloat(document.getElementById('meta-usd').value) || 0;
  var pBanco = parseFloat(document.getElementById('com-porc-banco').value) || 2.5;
  var pBinance = parseFloat(document.getElementById('com-porc-binance').value) || 0;
  var factorComision = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  var usdNecesarios = factorComision > 0 ? metaUsd / factorComision : metaUsd;
  document.getElementById('meta-res-bs').textContent = formato((usdNecesarios * tasaBCV) * 1.003) + ' Bs';
}

function calcularIGTF() {
  var usd = parseFloat(document.getElementById('igtf-monto-usd').value) || 0;
  var baseBs = usd * tasaBCV;
  var igtfUsd = usd * 0.03;
  document.getElementById('igtf-res-3pct').textContent = formato(igtfUsd) + ' $';
  document.getElementById('igtf-res-total').textContent = formato(usd + igtfUsd) + ' $ / ' + formato(baseBs + (igtfUsd * tasaBCV)) + ' Bs';
}

function calcularComisiones(modo) {
  var pBanco = parseFloat(document.getElementById('com-porc-banco').value) || 0;
  var pBinance = parseFloat(document.getElementById('com-porc-binance').value) || 0;
  var pPersonal = parseFloat(document.getElementById('com-porc-personal').value) || 0;

  var factorSystem = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  var env = document.getElementById('com-envio-usd');
  var rec = document.getElementById('com-recibo-usdt');

  if (modo === 1) {
    var v = parseFloat(env.value) || 0;
    var netoUsdt = v * factorSystem;
    rec.value = netoUsdt.toFixed(2);
    document.getElementById('com-res-total-personal').textContent = formato(netoUsdt * (1 + (pPersonal / 100))) + ' USDT';
  } else {
    var v = parseFloat(rec.value) || 0;
    env.value = (factorSystem > 0 ? (v / factorSystem) : 0).toFixed(2);
    document.getElementById('com-res-total-personal').textContent = formato(v * (1 + (pPersonal / 100))) + ' USDT';
  }

  actualizarResumenCanal();
  calcularMetaNeta();
}

function calcularArbitraje() {
  var bs = parseFloat(document.getElementById('arb-bs-inicial').value) || 0;
  var tCompra = parseFloat(document.getElementById('arb-tasa-compra').value) || tasaBCV;
  var tVenta = parseFloat(document.getElementById('arb-tasa-venta').value) || tasaUSDT;
  var pBanco = parseFloat(document.getElementById('com-porc-banco').value) || 0;
  var pBinance = parseFloat(document.getElementById('com-porc-binance').value) || 0;
  var pPersonal = parseFloat(document.getElementById('arb-com-personal').value) || 0;

  var factorComision = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  document.getElementById('arb-res-breakeven').textContent = formato(factorComision > 0 ? tCompra / factorComision : tCompra) + ' Bs';

  if (bs > 0 && tCompra > 0) {
    var usdBrutos = bs / tCompra;
    var usdtNetos = usdBrutos * factorComision;
    var bsFinales = usdtNetos * tVenta;
    var gananciaBsBruta = bsFinales - bs;
    var gananciaUsdBcvBruta = tCompra > 0 ? gananciaBsBruta / tCompra : 0;
    var gananciaUsdtBruta = tVenta > 0 ? gananciaBsBruta / tVenta : 0;
    var gananciaUsdtFinal = gananciaUsdtBruta * (1 + (pPersonal / 100));

    var colorRes = gananciaBsBruta >= 0 ? 'var(--neon-green)' : 'var(--danger-color)';

    document.getElementById('arb-res-final').textContent = formato(bsFinales) + ' Bs';
    document.getElementById('arb-res-comision-bs').textContent = formato(bs - (usdtNetos * tCompra)) + ' Bs';
    
    var elBs = document.getElementById('arb-res-ganancia-bs');
    elBs.textContent = formato(gananciaBsBruta) + ' Bs';
    elBs.style.color = colorRes;

    var elUsdBcv = document.getElementById('arb-res-ganancia-usd-bcv');
    elUsdBcv.textContent = formato(gananciaUsdBcvBruta) + ' $';
    elUsdBcv.style.color = colorRes;

    var elUsdt = document.getElementById('arb-res-ganancia-usdt');
    elUsdt.textContent = formato(gananciaUsdtBruta) + ' USDT';
    elUsdt.style.color = colorRes;

    var elUsd = document.getElementById('arb-res-ganancia-usd');
    elUsd.textContent = formato(gananciaUsdtFinal) + ' USDT';
    elUsd.style.color = colorRes;
  }
}

function registrarOperacion() {
  var bs = document.getElementById('arb-bs-inicial').value;
  var ganBs = document.getElementById('arb-res-ganancia-bs').textContent;
  if (!bs || ganBs === '0,00 Bs') {
    mostrarToast("Ingrese un monto de inversión válido");
    return;
  }

  var now = new Date();
  var fechaHoraStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  var notaLimpia = sanitizarTexto(document.getElementById('arb-nota').value.trim()) || 'Sin observaciones';

  historial.unshift({
    id: Date.now(),
    fechaHora: fechaHoraStr,
    canal: document.getElementById('resumen-canal-activo').textContent,
    inversionBs: bs,
    tasaCompra: document.getElementById('arb-tasa-compra').value,
    tasaVenta: document.getElementById('arb-tasa-venta').value,
    recargoPersonal: document.getElementById('arb-com-personal').value || '0',
    puntoEquilibrio: document.getElementById('arb-res-breakeven').textContent,
    montoFinalVenta: document.getElementById('arb-res-final').textContent,
    comisionesBs: document.getElementById('arb-res-comision-bs').textContent,
    gananciaBsBruta: ganBs,
    gananciaUsdBcvBruta: document.getElementById('arb-res-ganancia-usd-bcv').textContent,
    gananciaUsdtBruta: document.getElementById('arb-res-ganancia-usdt').textContent,
    gananciaUsdtFinal: document.getElementById('arb-res-ganancia-usd').textContent,
    nota: notaLimpia
  });

  document.getElementById('arb-nota').value = '';
  renderHistorial();
  guardarDatos(true);
  mostrarToast('Operación guardada en tu Libro en la Nube');
}

function renderHistorial(filtro) {
  var q = (filtro || '').toLowerCase();
  var container = document.getElementById('historial-cards-container');
  container.innerHTML = '';

  historial.filter(function(h) {
    return h.canal.toLowerCase().includes(q) || h.nota.toLowerCase().includes(q);
  }).forEach(function(h) {
    var card = document.createElement('div');
    card.className = 'history-card';
    card.onclick = function() { abrirModalDetalle(h.id); };

    var left = document.createElement('div');
    var dFecha = document.createElement('div');
    dFecha.style = 'font-size:10px; color:var(--text-muted);';
    dFecha.textContent = h.fechaHora;

    var dCanal = document.createElement('div');
    dCanal.style = 'font-size:12px; font-weight:bold; margin-top:2px;';
    dCanal.textContent = h.canal;

    var dInv = document.createElement('div');
    dInv.style = 'font-size:11px; color:var(--text-muted); margin-top:2px;';
    dInv.textContent = 'Capital: ' + formato(h.inversionBs) + ' Bs';

    left.appendChild(dFecha);
    left.appendChild(dCanal);
    left.appendChild(dInv);

    var right = document.createElement('div');
    right.style = 'text-align:right;';

    var dGanFinal = document.createElement('div');
    dGanFinal.style = 'font-size:13px; font-weight:bold; color:var(--neon-green);';
    dGanFinal.textContent = h.gananciaUsdtFinal;

    var dGanBruta = document.createElement('div');
    dGanBruta.style = 'font-size:10px; color:var(--text-muted);';
    dGanBruta.textContent = 'Base: ' + h.gananciaUsdtBruta;

    right.appendChild(dGanFinal);
    right.appendChild(dGanBruta);

    card.appendChild(left);
    card.appendChild(right);
    container.appendChild(card);
  });
}

function crearLineaDetalle(label, valor, colorDestacado) {
  var row = document.createElement('div');
  row.className = 'result-line';
  var sp = document.createElement('span');
  sp.textContent = label;
  var st = document.createElement('strong');
  st.textContent = valor;
  if (colorDestacado) st.style.color = colorDestacado;
  row.appendChild(sp);
  row.appendChild(st);
  return row;
}

function abrirModalDetalle(id) {
  var item = historial.find(function(h) { return h.id === id; });
  if (!item) return;
  itemSeleccionadoModal = item;

  var body = document.getElementById('modal-body-content');
  body.innerHTML = '';

  body.appendChild(crearLineaDetalle('Fecha y Hora:', item.fechaHora));
  body.appendChild(crearLineaDetalle('Canal Operativo:', item.canal));
  body.appendChild(crearLineaDetalle('Capital Inicial:', formato(item.inversionBs) + ' Bs'));
  body.appendChild(crearLineaDetalle('Tasas (Compra / Venta):', item.tasaCompra + ' / ' + item.tasaVenta));
  body.appendChild(crearLineaDetalle('Punto de Equilibrio:', item.puntoEquilibrio));
  body.appendChild(crearLineaDetalle('Retorno Bruto en Bs:', item.montoFinalVenta));
  body.appendChild(crearLineaDetalle('Deducible Comisiones:', item.comisionesBs, 'var(--danger-color)'));
  body.appendChild(crearLineaDetalle('Ganancia Neta Base (Bs):', item.gananciaBsBruta));
  body.appendChild(crearLineaDetalle('Ganancia Neta Base (USD):', item.gananciaUsdBcvBruta || '0,00 $'));
  body.appendChild(crearLineaDetalle('Ganancia Neta Base (USDT):', item.gananciaUsdtBruta));
  body.appendChild(crearLineaDetalle('Margen / Comisión Personal:', item.recargoPersonal + '%'));
  body.appendChild(crearLineaDetalle('Liquidación Final (USDT):', item.gananciaUsdtFinal, 'var(--neon-green)'));
  body.appendChild(crearLineaDetalle('Observación:', item.nota));

  document.getElementById('modal-detalle').style.display = 'flex';
}

function cerrarModalDetalle(e) {
  if (!e || e.target.id === 'modal-detalle') {
    document.getElementById('modal-detalle').style.display = 'none';
  }
}

function eliminarDesdeModal() {
  if (!itemSeleccionadoModal) return;
  historial = historial.filter(function(h) { return h.id !== itemSeleccionadoModal.id; });
  renderHistorial();
  guardarDatos(true);
  cerrarModalDetalle(null);
  mostrarToast("Registro eliminado de la nube");
}

function copiarDetalleWhatsApp() {
  if (!itemSeleccionadoModal) return;
  var h = itemSeleccionadoModal;
  var texto = "*COMPROBANTE DE OPERACIÓN FINANCIERA*\n" +
    "• Fecha: " + h.fechaHora + "\n" +
    "• Canal: " + h.canal + "\n" +
    "• Capital Inicial: " + formato(h.inversionBs) + " Bs\n" +
    "• Tasas (Compra/Venta): " + h.tasaCompra + " / " + h.tasaVenta + "\n" +
    "• Retorno Bruto: " + h.montoFinalVenta + "\n" +
    "• Comisiones Bancarias: " + h.comisionesBs + "\n" +
    "--------------------------\n" +
    "• Ganancia Neta (Sin recargo): " + h.gananciaBsBruta + " | " + (h.gananciaUsdBcvBruta || '') + " | " + h.gananciaUsdtBruta + "\n" +
    "• Ajuste Comisión Personal: " + h.recargoPersonal + "%\n" +
    "• *TOTAL FINAL EN USDT: " + h.gananciaUsdtFinal + "*\n" +
    "• Nota: " + h.nota;

  navigator.clipboard.writeText(texto);
  mostrarToast('Comprobante copiado para WhatsApp');
}

function filtrarHistorial() {
  renderHistorial(document.getElementById('buscar-historial').value);
}

function copiarTexto(tipo) {
  var texto = '';
  if (tipo === 'resumen-rapido') {
    var val = document.getElementById('main-amount-input').value || '0';
    texto = "*COTIZACIÓN MULTIMONEDA (" + val + " " + monedaActiva + ")*\n" +
      "• En Bs (BCV): " + document.getElementById('res-multi-ves-bcv').textContent + "\n" +
      "• En USD (BCV): " + document.getElementById('res-multi-usd').textContent + "\n" +
      "• En USDT (P2P): " + document.getElementById('res-multi-usdt').textContent + "\n" +
      "• En Euros: " + document.getElementById('res-multi-eur').textContent + "\n" +
      "• En Pesos COP: " + document.getElementById('res-multi-cop').textContent;
  } else if (tipo === 'meta-neta') {
    texto = "Para recibir *" + (document.getElementById('meta-usd').value || 0) + " $ netos*, el monto exacto a transferir es *" + document.getElementById('meta-res-bs').textContent + "*.";
  }
  navigator.clipboard.writeText(texto);
  mostrarToast('Copiado al portapapeles');
}

function limpiarTodo() {
  document.querySelectorAll('input').forEach(function(i) {
    if(!['input-tasa-bcv','input-tasa-usdt','input-tasa-eur','input-tasa-cop','nuevo-horario','auth-email','auth-password'].includes(i.id)) {
      i.value = '';
    }
  });
  document.getElementById('com-porc-banco').value = '2.5';
  document.getElementById('com-porc-binance').value = '0.0';
  document.getElementById('com-porc-personal').value = '0';
  document.getElementById('arb-com-personal').value = '0';
  actualizarTasasManuales(true);
  mostrarToast("Campos restablecidos");
}

function renderGraficoD3() {
  var container = d3.select("#chart-container");
  container.html("");

  var node = container.node();
  if (!node) return;
  var width = node.getBoundingClientRect().width || 300;
  var height = 180;
  var margin = {top: 15, right: 15, bottom: 25, left: 45};

  var svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  var x = d3.scalePoint()
    .domain(historicoGrafico.map(function(d) { return d.fecha; }))
    .range([margin.left, width - margin.right]);

  var y = d3.scaleLinear()
    .domain([
      d3.min(historicoGrafico, function(d) { return Math.min(d.bcv, d.usdt); }) * 0.98,
      d3.max(historicoGrafico, function(d) { return Math.max(d.bcv, d.usdt); }) * 1.02
    ])
    .range([height - margin.bottom, margin.top]);

  var lineBCV = d3.line().x(function(d) { return x(d.fecha); }).y(function(d) { return y(d.bcv); });
  var lineUSDT = d3.line().x(function(d) { return x(d.fecha); }).y(function(d) { return y(d.usdt); });

  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x))
    .attr("color", "#64748b");

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).ticks(4))
    .attr("color", "#64748b");

  svg.append("path")
    .datum(historicoGrafico)
    .attr("fill", "none")
    .attr("stroke", "#00e676")
    .attr("stroke-width", 2.5)
    .attr("d", lineBCV);

  svg.append("path")
    .datum(historicoGrafico)
    .attr("fill", "none")
    .attr("stroke", "#f0b90b")
    .attr("stroke-width", 2.5)
    .attr("d", lineUSDT);
}

function solicitarPermisoNotificaciones() {
  if (!("Notification" in window)) {
    mostrarToast("Navegador sin soporte de alertas");
    return;
  }
  Notification.requestPermission().then(function(permission) {
    if (permission === "granted") {
      document.getElementById("notif-status").textContent = "Alertas Activas (Horarios y Cambios de Tasa)";
      mostrarToast("Alertas activadas en segundo plano");
      sincronizarConfigConServiceWorker();
      dispararNotificacion(
        'Alertas Financieras Activas',
        'BCV: ' + formato(tasaBCV) + ' Bs | USDT P2P: ' + formato(tasaUSDT) + ' Bs'
      );
    } else {
      document.getElementById("notif-status").textContent = "Permiso de alerta denegado";
    }
  });
}

var ultimaHoraNotificada = '';
function iniciarRelojNotificaciones() {
  setInterval(function() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var now = new Date();
    var hh = String(now.getHours()).padStart(2, '0');
    var mm = String(now.getMinutes()).padStart(2, '0');
    var currentTime = hh + ':' + mm;
    var keyHoy = now.toDateString() + '_' + currentTime;

    if (listaHorariosNotif.includes(currentTime) && ultimaHoraNotificada !== keyHoy) {
      ultimaHoraNotificada = keyHoy;
      dispararNotificacion(
        'Reporte Programado (' + currentTime + ')',
        'BCV: ' + formato(tasaBCV) + ' Bs | USDT P2P: ' + formato(tasaUSDT) + ' Bs | EUR: ' + formato(tasaEUR) + ' Bs'
      );
    }
  }, 15000);
}
// === RESPALDO OFFLINE AUTOMÁTICO Y AVISO VISUAL ===
const CAMPOS_TASAS = ['tasa-bcv', 'tasa-usdt', 'tasa-euro', 'tasa-cop'];

function mostrarAvisoEstadoRed(esOffline) {
  let banner = document.getElementById('offline-toast-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-toast-banner';
    banner.style.cssText = 'position:fixed; top:12px; left:50%; transform:translateX(-50%); z-index:99999; padding:10px 18px; border-radius:30px; font-size:12px; font-weight:bold; color:#fff; box-shadow:0 4px 15px rgba(0,0,0,0.6); transition:opacity 0.3s ease; text-align:center; width:max-content; max-width:90%; pointer-events:none;';
    document.body.appendChild(banner);
  }

  if (esOffline) {
    banner.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
    banner.style.border = '1px solid #fbbf24';
    banner.textContent = '⚡ Modo Offline Activo • Usando últimas tasas guardadas';
    banner.style.opacity = '1';
  } else {
    banner.style.background = 'linear-gradient(135deg, #059669, #047857)';
    banner.style.border = '1px solid #34d399';
    banner.textContent = '✅ Conexión restaurada • Tasas sincronizadas';
    banner.style.opacity = '1';
    setTimeout(() => {
      if (banner) banner.style.opacity = '0';
    }, 3500);
  }
}

function guardarRespaldoLocal() {
  const respaldo = {};
  CAMPOS_TASAS.forEach((id) => {
    const el = document.getElementById(id);
    if (el && el.value) respaldo[id] = el.value;
  });
  localStorage.setItem('finance_pro_tasas_offline', JSON.stringify(respaldo));
}

function cargarRespaldoLocal() {
  try {
    const guardado = JSON.parse(localStorage.getItem('finance_pro_tasas_offline') || '{}');
    CAMPOS_TASAS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && (!el.value || parseFloat(el.value) === 0) && guardado[id]) {
        el.value = guardado[id];
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
  } catch (e) {}
}

window.addEventListener('DOMContentLoaded', () => {
  cargarRespaldoLocal();

  if (!navigator.onLine) {
    mostrarAvisoEstadoRed(true);
  }

  CAMPOS_TASAS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', guardarRespaldoLocal);
      el.addEventListener('change', guardarRespaldoLocal);
    }
  });

  setTimeout(guardarRespaldoLocal, 3500);
});

window.addEventListener('offline', () => {
  cargarRespaldoLocal();
  mostrarAvisoEstadoRed(true);
});

window.addEventListener('online', () => {
  mostrarAvisoEstadoRed(false);
  activarSincronizacionFondo();
});

// === MOTOR DE ACTIVACIÓN DE NOTIFICACIONES ===
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

setInterval(activarSincronizacionFondo, 25000);
document.addEventListener('visibilitychange', activarSincronizacionFondo);
