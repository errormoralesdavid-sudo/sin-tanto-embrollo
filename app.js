// VARIABLES DE ESTADO PRINCIPALES
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

// BLINDAJE ANTI-XSS (SANITIZACIÓN DE TEXTO)
function sanitizarTexto(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"'`=\/]/g, function (s) {
    return {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;',
      "'": '&#39;', '/': '&#x2F;', '`': '&#x60;', '=': '&#x3D;'
    }[s];
  });
}

// SISTEMA DE NOTIFICACIONES TOAST (REEMPLAZA ALERT NATIVO)
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
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {});
  }

  cargarDatosGuardados();
  renderBancos();
  renderBinance();
  renderHorariosNotificaciones();
  actualizarTasasManuales();
  
  sincronizarDolarVzlaAPI(false);
  sincronizarBinanceP2P(false);
  
  iniciarSmoothSlider();
  iniciarScrollWheelSlider();
  renderGraficoD3();
  iniciarRelojNotificaciones();
  iniciarAutoScrollEnInputs();
};

function actualizarIconoTema(theme) {
  var btn = document.getElementById("theme-btn");
  if (theme === "light") {
    btn.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  } else {
    btn.innerHTML = '<svg class="icon-svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }
}

function toggleTheme() {
  var currentTheme = document.documentElement.getAttribute("data-theme");
  var newTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  actualizarIconoTema(newTheme);
  localStorage.setItem("embrollo_theme", newTheme);
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

function guardarDatos() {
  var datos = {
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
    monedaActiva: monedaActiva
  };
  localStorage.setItem('embrollo_data_pro_v3', JSON.stringify(datos));
}

function cargarDatosGuardados() {
  var theme = localStorage.getItem("embrollo_theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  actualizarIconoTema(theme);

  try {
    var datos = JSON.parse(localStorage.getItem('embrollo_data_pro_v3'));
    if (datos) {
      if(datos.bcv) document.getElementById('input-tasa-bcv').value = datos.bcv;
      if(datos.usdt) document.getElementById('input-tasa-usdt').value = datos.usdt;
      if(datos.eur) document.getElementById('input-tasa-eur').value = datos.eur;
      if(datos.cop) document.getElementById('input-tasa-cop').value = datos.cop;
      
      if(datos.prevBCV) prevBCV = datos.prevBCV;
      if(datos.prevUSDT) prevUSDT = datos.prevUSDT;
      if(datos.prevEUR) prevEUR = datos.prevEUR;

      if(Array.isArray(datos.bancos)) listaBancos = datos.bancos;
      if(Array.isArray(datos.binance)) listaBinance = datos.binance;
      if(Array.isArray(datos.historial)) { historial = datos.historial; renderHistorial(); }
      if(Array.isArray(datos.historicoGrafico)) historicoGrafico = datos.historicoGrafico;
      if(Array.isArray(datos.horariosNotif)) listaHorariosNotif = datos.horariosNotif;
      if(datos.monedaActiva) {
        var btn = document.querySelector('.curr-btn[data-curr="' + datos.monedaActiva + '"]');
        if (btn) seleccionarMonedaBase(datos.monedaActiva, btn);
      }
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

// CONVERTIDOR MULTIMONEDA INTERACTIVO
function seleccionarMonedaBase(moneda, el) {
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
  guardarDatos();
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
  var vesParalelo = monedaActiva === 'USD' ? monto * tasaUSDT : baseEnBs;

  document.getElementById('res-multi-ves-bcv').textContent = formato(baseEnBs) + ' Bs';
  document.getElementById('res-multi-ves-usdt').textContent = formato(vesParalelo) + ' Bs';
  document.getElementById('res-multi-usd').textContent = formato(usdBcv) + ' $';
  document.getElementById('res-multi-usdt').textContent = formato(usdtP2p) + ' USDT';
  document.getElementById('res-multi-eur').textContent = formato(eur) + ' €';
  document.getElementById('res-multi-cop').textContent = formato(cop) + ' COP';
}

// HORARIOS DE NOTIFICACIÓN
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
    guardarDatos();
    mostrarToast("Alerta programada a las " + nuevo);
  }
}

function eliminarHorarioNotificacion(idx) {
  listaHorariosNotif.splice(idx, 1);
  renderHorariosNotificaciones();
  guardarDatos();
}

// MODAL PERSONALIZADO PARA BANCOS Y BINANCE
function abrirModalInput(titulo, mostrarNombre, valorNombre, valorPct, callback) {
  document.getElementById('modal-input-title').textContent = titulo;
  var nameWrap = document.getElementById('modal-input-name-wrap');
  var inputName = document.getElementById('modal-input-name');
  var inputPct = document.getElementById('modal-input-pct');

  nameWrap.style.display = mostrarNombre ? 'block' : 'none';
  inputName.value = valorNombre || '';
  inputPct.value = valorPct !== undefined ? valorPct : '';

  var modal = document.getElementById('modal-input-custom');
  modal.style.display = 'flex';

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
  listaBancos.forEach(function(b, idx) {
    var div = document.createElement('div');
    div.className = 'bank-btn' + (idx === 0 ? ' active' : '');
    
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
        guardarDatos();
        mostrarToast("Comisión actualizada");
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
      guardarDatos();
      mostrarToast("Banco agregado");
    });
  };
  grid.appendChild(btnAdd);
}

function renderBinance() {
  var grid = document.getElementById('grid-binance');
  grid.innerHTML = '';
  listaBinance.forEach(function(bin, idx) {
    var div = document.createElement('div');
    div.className = 'binance-btn' + (idx === 0 ? ' active' : '');
    
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
        guardarDatos();
        mostrarToast("Tarifa actualizada");
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
      guardarDatos();
      mostrarToast("Modalidad agregada");
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
}

function actualizarResumenCanal() {
  var pb = document.getElementById('com-porc-banco').value;
  var pbin = document.getElementById('com-porc-binance').value;
  document.getElementById('resumen-canal-activo').textContent = bancoActivoNombre + ' [' + pb + '%] + ' + binanceActivoNombre + ' [' + pbin + '%]';
}

function actualizarTasasManuales() {
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
  guardarDatos();
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
    if (data.current) {
      if (data.current.usd && data.current.usd !== tasaBCV) {
        prevBCV = tasaBCV;
        document.getElementById('input-tasa-bcv').value = data.current.usd;
      }
      if (data.current.eur && data.current.eur !== tasaEUR) {
        prevEUR = tasaEUR;
        document.getElementById('input-tasa-eur').value = data.current.eur;
      }
    }
    actualizarTasasManuales();
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
      if (nuevaTasa !== tasaUSDT) {
        prevUSDT = tasaUSDT;
        document.getElementById('input-tasa-usdt').value = nuevaTasa;
      }
      actualizarTasasManuales();
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
  guardarDatos();
  mostrarToast('Operación archivada en el libro');
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
  guardarDatos();
  cerrarModalDetalle(null);
  mostrarToast("Registro eliminado");
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
      "• En Bs (P2P): " + document.getElementById('res-multi-ves-usdt').textContent + "\n" +
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
  actualizarTasasManuales();
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
      document.getElementById("notif-status").textContent = "Alertas Push Activas";
      mostrarToast("Notificaciones activadas");
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFY',
          title: 'Terminal Financiero PRO',
          body: 'BCV: ' + formato(tasaBCV) + ' Bs | USDT: ' + formato(tasaUSDT) + ' Bs'
        });
      }
    } else {
      document.getElementById("notif-status").textContent = "Permiso de alerta denegado";
    }
  });
}

function iniciarRelojNotificaciones() {
  setInterval(function() {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    var now = new Date();
    var currentTime = now.toTimeString().substring(0, 5);

    if (listaHorariosNotif.includes(currentTime) && now.getSeconds() === 0) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFY',
          title: 'Reporte Programado de Divisas',
          body: 'BCV: ' + formato(tasaBCV) + ' Bs | USDT P2P: ' + formato(tasaUSDT) + ' Bs'
        });
      }
    }
  }, 1000);
}
