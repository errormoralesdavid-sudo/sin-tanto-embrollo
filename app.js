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

var BANCOS_BASE = [
  { id: 1, nombre: 'BdV', comision: 2.5 },
  { id: 2, nombre: 'BDT', comision: 1.5 },
  { id: 3, nombre: 'B. Tesoro', comision: 2.5 },
  { id: 4, nombre: 'Banesco', comision: 1.5 },
  { id: 5, nombre: 'Provincial', comision: 1.5 },
  { id: 6, nombre: 'BNC', comision: 1.5 }
];

var BINANCE_BASE = [
  { id: 1, nombre: 'Maker', comision: 0.0 },
  { id: 2, nombre: 'Taker', comision: 0.1 },
  { id: 3, nombre: 'P2P Ref', comision: 0.2 },
  { id: 4, nombre: 'Tarjeta', comision: 0.35 }
];

var listaBancos = JSON.parse(JSON.stringify(BANCOS_BASE));
var listaBinance = JSON.parse(JSON.stringify(BINANCE_BASE));

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
  if (!container) return;
  var toast = document.createElement('div');
  toast.className = 'toast-msg';
  toast.textContent = mensaje;
  container.appendChild(toast);
  setTimeout(function() {
    toast.style.opacity = '0';
    setTimeout(function() { toast.remove(); }, 250);
  }, 2600);
};

window.copiarMontoIndividual = function(elementId) {
  var el = document.getElementById(elementId);
  if (!el) return;
  var texto = el.textContent.trim();
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(function() {
      window.mostrarToast("Copiado: " + texto);
    }).catch(function() { fallbackCopiar(texto); });
  } else {
    fallbackCopiar(texto);
  }
};

function fallbackCopiar(texto) {
  var temp = document.createElement('textarea');
  temp.value = texto;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand('copy');
  document.body.removeChild(temp);
  window.mostrarToast("Copiado: " + texto);
}

// === FUNCIONES DEL INPUT MATEMÁTICO ===
window.pegarAlInput = async function() {
  try {
    var texto = await navigator.clipboard.readText();
    var numLimpiado = texto.replace(/[^0-9.,+\-*/]/g, ''); 
    if (numLimpiado) {
      var input = document.getElementById('main-amount-input');
      input.value = numLimpiado;
      window.calcularMultimoneda();
      window.mostrarToast("Monto pegado");
    }
  } catch(e) {
    window.mostrarToast("No se pudo pegar");
  }
};

window.agregarOperador = function(operador) {
  var input = document.getElementById('main-amount-input');
  if (!input) return;
  var val = input.value.trim();
  if (val === '') return;
  // Si ya termina en un operador, lo reemplaza por el nuevo
  if (/[\+\-\*\/]$/.test(val)) {
    input.value = val.slice(0, -1) + operador;
  } else {
    input.value = val + operador;
  }
  input.focus();
};

window.resolverExpresionInput = function() {
  var input = document.getElementById('main-amount-input');
  if (!input || !input.value) return;
  try {
    var saneado = input.value.replace(/,/g, '.').replace(/[^0-9.\+\-\*\/]/g, '');
    var listo = saneado.replace(/[\+\-\*\/]+$/, '');
    if (listo !== '' && /[\+\-\*\/]/.test(listo)) {
      var res = new Function('return ' + listo)();
      if (isFinite(res)) {
        input.value = Number(res.toFixed(2));
        window.calcularMultimoneda();
      }
    }
  } catch (e) {}
};

// === FUSIÓN INTELIGENTE PARA NO PERDER DATOS ENTRE TELÉFONO Y NUBE ===
function fusionarListasConfig(listaLocal, listaNube) {
  var mapa = {};
  var resultado = [];

  (listaNube || []).forEach(function(item) {
    if (!item || !item.nombre) return;
    var clave = String(item.id || item.nombre).toLowerCase();
    mapa[clave] = item;
    resultado.push(item);
  });

  (listaLocal || []).forEach(function(item) {
    if (!item || !item.nombre) return;
    var clave = String(item.id || item.nombre).toLowerCase();
    var existeNombre = resultado.some(function(r) {
      return r.nombre.toLowerCase() === item.nombre.toLowerCase();
    });
    if (!mapa[clave] && !existeNombre) {
      resultado.push(item);
    }
  });

  return resultado;
}

function fusionarHistorialContable(histLocal, histNube) {
  var mapaIds = {};
  var combinado = [];

  (histNube || []).concat(histLocal || []).forEach(function(item) {
    if (item && item.id && !mapaIds[item.id]) {
      mapaIds[item.id] = true;
      combinado.push(item);
    }
  });

  combinado.sort(function(a, b) { return (b.id || 0) - (a.id || 0); });
  return combinado;
}

function asegurarHistoricoGrafico() {
  var bcvBase = parseFloat(tasaBCV) || 832.48;
  var usdtBase = parseFloat(tasaUSDT) || 885.10;

  var valido = Array.isArray(historicoGrafico) && historicoGrafico.length >= 2 && historicoGrafico.every(function(d) {
    return d && isFinite(Number(d.bcv)) && Number(d.bcv) > 0 && isFinite(Number(d.usdt)) && Number(d.usdt) > 0;
  });

  if (!valido) {
    historicoGrafico = [
      { fecha: 'T-3', bcv: +(bcvBase * 0.985).toFixed(2), usdt: +(usdtBase * 0.980).toFixed(2) },
      { fecha: 'T-2', bcv: +(bcvBase * 0.992).toFixed(2), usdt: +(usdtBase * 0.990).toFixed(2) },
      { fecha: 'Ayer', bcv: +(bcvBase * 0.997).toFixed(2), usdt: +(usdtBase * 0.995).toFixed(2) },
      { fecha: 'Hoy', bcv: +bcvBase.toFixed(2), usdt: +usdtBase.toFixed(2) }
    ];
  } else {
    historicoGrafico[historicoGrafico.length - 1] = {
      fecha: 'Hoy',
      bcv: +bcvBase.toFixed(2),
      usdt: +usdtBase.toFixed(2)
    };
  }
}

window.onload = function() {
  registrarServiceWorkerYBackgroundSync();

  // Cargamos siempre el respaldo local inmediatamente para que la gráfica y tus datos estén listos desde el segundo 0
  cargarDatosGuardados();
  asegurarHistoricoGrafico();

  renderBancos();
  renderBinance();
  renderHorariosNotificaciones();
  renderHistorial();
  window.actualizarTasasManuales(false);
  renderGraficoD3();
  
  window.sincronizarDolarVzlaAPI(false);
  window.sincronizarBinanceP2P(false);
  
  setInterval(function() {
    window.sincronizarDolarVzlaAPI(false);
    window.sincronizarBinanceP2P(false);
  }, 180000); 

  iniciarSmoothSlider();
  iniciarScrollWheelSlider();
  iniciarRelojNotificaciones();
  iniciarAutoScrollEnInputs();

  window.addEventListener('resize', function() {
    renderGraficoD3();
  });
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
        icon: './logo.png',
        badge: './logo.png',
        vibrate: [250, 120, 250],
        renotify: true,
        tag: 'finance-pro-alert'
      });
    });
  }
}

function iniciarScrollWheelSlider() {
  var slider = document.getElementById('rate-slider');
  if(!slider) return;
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
  if(!slider) return;
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

window.toggleAccordion = function(id) {
  var el = document.getElementById(id);
  if(el) el.classList.toggle('open');
};

window.obtenerPayloadActual = function() {
  asegurarHistoricoGrafico();
  return {
    bcv: document.getElementById('input-tasa-bcv') ? document.getElementById('input-tasa-bcv').value : tasaBCV,
    usdt: document.getElementById('input-tasa-usdt') ? document.getElementById('input-tasa-usdt').value : tasaUSDT,
    eur: document.getElementById('input-tasa-eur') ? document.getElementById('input-tasa-eur').value : tasaEUR,
    cop: document.getElementById('input-tasa-cop') ? document.getElementById('input-tasa-cop').value : tasaCOP,
    prevBCV: prevBCV,
    prevUSDT: prevUSDT,
    prevEUR: prevEUR,
    bancos: listaBancos,
    binance: listaBinance,
    historial: historial,
    historicoGrafico: historicoGrafico,
    horariosNotif: listaHorariosNotif,
    monedaActiva: monedaActiva,
    comPorcBanco: document.getElementById('com-porc-banco') ? document.getElementById('com-porc-banco').value : 0,
    comPorcBinance: document.getElementById('com-porc-binance') ? document.getElementById('com-porc-binance').value : 0,
    comPorcPersonal: document.getElementById('com-porc-personal') ? document.getElementById('com-porc-personal').value : 0,
    arbComPersonal: document.getElementById('arb-com-personal') ? document.getElementById('arb-com-personal').value : 0,
    bancoActivoNombre: bancoActivoNombre,
    binanceActivoNombre: binanceActivoNombre
  };
};

function guardarDatos(subirANube = true) {
  var datos = window.obtenerPayloadActual();
  localStorage.setItem('embrollo_data_pro_v5', JSON.stringify(datos));
  sincronizarConfigConServiceWorker();

  if (subirANube && !aplicandoNube && window.nubeCargadaInicialmente && window.guardarDatosEnFirebase) {
    window.guardarDatosEnFirebase(datos);
  }
}

window.aplicarDatosDesdeNube = function(datos, esCargaLocal = false) {
  if (!datos) return;
  aplicandoNube = true;
  try {
    if(datos.bcv && document.getElementById('input-tasa-bcv')) document.getElementById('input-tasa-bcv').value = datos.bcv;
    if(datos.usdt && document.getElementById('input-tasa-usdt')) document.getElementById('input-tasa-usdt').value = datos.usdt;
    if(datos.eur && document.getElementById('input-tasa-eur')) document.getElementById('input-tasa-eur').value = datos.eur;
    if(datos.cop && document.getElementById('input-tasa-cop')) document.getElementById('input-tasa-cop').value = datos.cop;
    
    if(datos.prevBCV !== undefined) prevBCV = datos.prevBCV;
    if(datos.prevUSDT !== undefined) prevUSDT = datos.prevUSDT;
    if(datos.prevEUR !== undefined) prevEUR = datos.prevEUR;

    if (Array.isArray(datos.bancos) && datos.bancos.length > 0) {
      listaBancos = esCargaLocal ? datos.bancos : fusionarListasConfig(listaBancos, datos.bancos);
      renderBancos();
    }

    if (Array.isArray(datos.binance) && datos.binance.length > 0) {
      listaBinance = esCargaLocal ? datos.binance : fusionarListasConfig(listaBinance, datos.binance);
      renderBinance();
    }

    if (Array.isArray(datos.historial)) {
      if (esCargaLocal) {
        historial = datos.historial;
      } else {
        historial = fusionarHistorialContable(historial, datos.historial);
      }
      renderHistorial();
    }

    if (Array.isArray(datos.historicoGrafico) && datos.historicoGrafico.length >= 2) {
      historicoGrafico = datos.historicoGrafico;
    }
    asegurarHistoricoGrafico();
    renderGraficoD3();

    if (Array.isArray(datos.horariosNotif) && datos.horariosNotif.length > 0) {
      listaHorariosNotif = datos.horariosNotif;
      renderHorariosNotificaciones();
    }

    if(datos.comPorcBanco !== undefined && document.getElementById('com-porc-banco')) document.getElementById('com-porc-banco').value = datos.comPorcBanco;
    if(datos.comPorcBinance !== undefined && document.getElementById('com-porc-binance')) document.getElementById('com-porc-binance').value = datos.comPorcBinance;
    if(datos.comPorcPersonal !== undefined && document.getElementById('com-porc-personal')) document.getElementById('com-porc-personal').value = datos.comPorcPersonal;
    if(datos.arbComPersonal !== undefined && document.getElementById('arb-com-personal')) document.getElementById('arb-com-personal').value = datos.arbComPersonal;

    if(datos.bancoActivoNombre && document.getElementById('label-banco-activo')) {
      bancoActivoNombre = datos.bancoActivoNombre;
      document.getElementById('label-banco-activo').textContent = bancoActivoNombre + ' (' + document.getElementById('com-porc-banco').value + '%)';
    }
    if(datos.binanceActivoNombre && document.getElementById('label-binance-activo')) {
      binanceActivoNombre = datos.binanceActivoNombre;
      document.getElementById('label-binance-activo').textContent = binanceActivoNombre + ' (' + document.getElementById('com-porc-binance').value + '%)';
    }

    if(datos.monedaActiva) {
      var btn = document.querySelector('.curr-btn[data-curr="' + datos.monedaActiva + '"]');
      if (btn) window.seleccionarMonedaBase(datos.monedaActiva, btn, false);
    }

    actualizarResumenCanal();
    window.actualizarTasasManuales(false);
    localStorage.setItem('embrollo_data_pro_v5', JSON.stringify(window.obtenerPayloadActual()));
    sincronizarConfigConServiceWorker();
  } catch(e) {}
  
  setTimeout(function() { aplicandoNube = false; }, 350); 
};

function cargarDatosGuardados() {
  try {
    var datos = JSON.parse(localStorage.getItem('embrollo_data_pro_v5'));
    if (datos) {
      window.aplicarDatosDesdeNube(datos, true);
    }
  } catch(e) {}
  asegurarHistoricoGrafico();
}

// === CAMBIO INTELIGENTE DE MONEDA ===
window.seleccionarMonedaBase = function(nuevaMoneda, el, guardar = true) {
  var inputEl = document.getElementById('main-amount-input');
  var rawMonto = inputEl ? inputEl.value : '';
  var montoAnterior = 0;

  try {
    var saneado = rawMonto.replace(/,/g, '.').replace(/[^0-9.\+\-\*\/]/g, '');
    var listo = saneado.replace(/[\+\-\*\/]+$/, '');
    if (listo !== '') {
      montoAnterior = new Function('return ' + listo)() || 0;
    }
  } catch (e) { montoAnterior = 0; }

  if (montoAnterior > 0 && nuevaMoneda !== monedaActiva && inputEl) {
    var baseEnBs = 0;
    if (monedaActiva === 'VES') baseEnBs = montoAnterior;
    else if (monedaActiva === 'USD') baseEnBs = montoAnterior * tasaBCV;
    else if (monedaActiva === 'USDT') baseEnBs = montoAnterior * tasaUSDT;
    else if (monedaActiva === 'EUR') baseEnBs = montoAnterior * tasaEUR;
    else if (monedaActiva === 'COP') baseEnBs = tasaCOP > 0 ? montoAnterior * (tasaBCV / tasaCOP) : 0;

    var nuevoMontoInput = 0;
    if (nuevaMoneda === 'VES') nuevoMontoInput = baseEnBs;
    else if (nuevaMoneda === 'USD') nuevoMontoInput = tasaBCV > 0 ? baseEnBs / tasaBCV : 0;
    else if (nuevaMoneda === 'USDT') nuevoMontoInput = tasaUSDT > 0 ? baseEnBs / tasaUSDT : 0;
    else if (nuevaMoneda === 'EUR') nuevoMontoInput = tasaEUR > 0 ? baseEnBs / tasaEUR : 0;
    else if (nuevaMoneda === 'COP') nuevoMontoInput = tasaBCV > 0 ? baseEnBs / (tasaBCV / tasaCOP) : 0;

    inputEl.value = Number(nuevoMontoInput.toFixed(2));
  }

  monedaActiva = nuevaMoneda;
  document.querySelectorAll('.curr-btn').forEach(function(b) { b.classList.remove('active'); });
  if (el) el.classList.add('active');

  var labels = {
    'USD': 'Monto en Dólares BCV ($):',
    'USDT': 'Monto en USDT P2P:',
    'VES': 'Monto en Bolívares (Bs):',
    'EUR': 'Monto en Euros (€):',
    'COP': 'Monto en Pesos COP:'
  };
  var labelEl = document.getElementById('main-input-label');
  if(labelEl) labelEl.textContent = labels[nuevaMoneda] || 'Monto:';
  
  window.calcularMultimoneda();
  if (guardar) guardarDatos(true);
};

window.calcularMultimoneda = function() {
  var inputEl = document.getElementById('main-amount-input');
  if(!inputEl) return;
  var rawMonto = inputEl.value;
  var monto = 0;

  try {
    var saneado = rawMonto.replace(/,/g, '.').replace(/[^0-9.\+\-\*\/]/g, '');
    var listoParaEvaluar = saneado.replace(/[\+\-\*\/]+$/, '');
    if (listoParaEvaluar !== '') {
      monto = new Function('return ' + listoParaEvaluar)() || 0;
    }
  } catch (e) {
    monto = 0;
  }

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
};

function renderHorariosNotificaciones() {
  var cont = document.getElementById('lista-horarios');
  if(!cont) return;
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

window.agregarHorarioNotificacion = function() {
  var nuevo = document.getElementById('nuevo-horario').value;
  if (!nuevo) return;
  if (!listaHorariosNotif.includes(nuevo)) {
    listaHorariosNotif.push(nuevo);
    listaHorariosNotif.sort();
    renderHorariosNotificaciones();
    guardarDatos(true);
    window.mostrarToast("Alerta programada a las " + nuevo);
  }
};

function eliminarHorarioNotificacion(idx) {
  listaHorariosNotif.splice(idx, 1);
  renderHorariosNotificaciones();
  guardarDatos(true);
}

// === MODAL MEJORADO: PERMITE EDITAR NOMBRE, COMISIÓN Y ELIMINAR ENTIDAD ===
function abrirModalInput(titulo, mostrarNombre, valorNombre, valorPct, callbackGuardar, callbackEliminar) {
  document.getElementById('modal-input-title').textContent = titulo;
  var nameWrap = document.getElementById('modal-input-name-wrap');
  var inputName = document.getElementById('modal-input-name');
  var inputPct = document.getElementById('modal-input-pct');
  var btnDel = document.getElementById('modal-input-delete');

  nameWrap.style.display = mostrarNombre ? 'block' : 'none';
  inputName.value = valorNombre || '';
  inputPct.value = valorPct !== undefined ? valorPct : '';

  if (btnDel) {
    if (typeof callbackEliminar === 'function') {
      btnDel.style.display = 'flex';
      btnDel.onclick = function() {
        callbackEliminar();
        window.cerrarModalInput();
      };
    } else {
      btnDel.style.display = 'none';
      btnDel.onclick = null;
    }
  }

  document.getElementById('modal-input-custom').style.display = 'flex';

  document.getElementById('modal-input-save').onclick = function() {
    var n = sanitizarTexto(inputName.value.trim());
    var p = parseFloat(inputPct.value);
    if (isNaN(p)) p = 0;
    if (mostrarNombre && !n) {
      window.mostrarToast("Ingrese un nombre válido");
      return;
    }
    callbackGuardar(n, p);
    window.cerrarModalInput();
  };
}

window.cerrarModalInput = function() {
  var m = document.getElementById('modal-input-custom');
  if(m) m.style.display = 'none';
};

function renderBancos() {
  var grid = document.getElementById('grid-bancos');
  if(!grid) return;
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
      abrirModalInput(
        'Editar Banco',
        true,
        b.nombre,
        b.comision,
        function(nuevoNombre, nuevaCom) {
          var eraActivo = (bancoActivoNombre === b.nombre);
          b.nombre = nuevoNombre;
          b.comision = nuevaCom;
          if (eraActivo) {
            bancoActivoNombre = nuevoNombre;
            document.getElementById('com-porc-banco').value = nuevaCom;
            document.getElementById('label-banco-activo').textContent = nuevoNombre + ' (' + nuevaCom + '%)';
          }
          renderBancos();
          actualizarResumenCanal();
          window.calcularComisiones(1);
          window.calcularArbitraje();
          guardarDatos(true);
          window.mostrarToast("Banco actualizado en la nube");
        },
        listaBancos.length > 1 ? function() {
          listaBancos = listaBancos.filter(function(item) { return item.id !== b.id; });
          if (bancoActivoNombre === b.nombre && listaBancos[0]) {
            bancoActivoNombre = listaBancos[0].nombre;
            document.getElementById('com-porc-banco').value = listaBancos[0].comision;
            document.getElementById('label-banco-activo').textContent = bancoActivoNombre + ' (' + listaBancos[0].comision + '%)';
          }
          renderBancos();
          actualizarResumenCanal();
          guardarDatos(true);
          window.mostrarToast("Banco eliminado");
        } : null
      );
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
      window.mostrarToast("Banco guardado en la nube");
    }, null);
  };
  grid.appendChild(btnAdd);
}

function renderBinance() {
  var grid = document.getElementById('grid-binance');
  if(!grid) return;
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
      abrirModalInput(
        'Editar Modalidad P2P',
        true,
        bin.nombre,
        bin.comision,
        function(nuevoNombre, nuevaCom) {
          var eraActiva = (binanceActivoNombre === bin.nombre);
          bin.nombre = nuevoNombre;
          bin.comision = nuevaCom;
          if (eraActiva) {
            binanceActivoNombre = nuevoNombre;
            document.getElementById('com-porc-binance').value = nuevaCom;
            document.getElementById('label-binance-activo').textContent = nuevoNombre + ' (' + nuevaCom + '%)';
          }
          renderBinance();
          actualizarResumenCanal();
          window.calcularComisiones(1);
          window.calcularArbitraje();
          guardarDatos(true);
          window.mostrarToast("Tarifa sincronizada en la nube");
        },
        listaBinance.length > 1 ? function() {
          listaBinance = listaBinance.filter(function(item) { return item.id !== bin.id; });
          if (binanceActivoNombre === bin.nombre && listaBinance[0]) {
            binanceActivoNombre = listaBinance[0].nombre;
            document.getElementById('com-porc-binance').value = listaBinance[0].comision;
            document.getElementById('label-binance-activo').textContent = binanceActivoNombre + ' (' + listaBinance[0].comision + '%)';
          }
          renderBinance();
          actualizarResumenCanal();
          guardarDatos(true);
          window.mostrarToast("Tarifa eliminada");
        } : null
      );
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
      window.mostrarToast("Modalidad guardada en la nube");
    }, null);
  };
  grid.appendChild(btnAdd);
}

function seleccionarBancoComision(comision, nombreBanco, el) {
  document.querySelectorAll('#grid-bancos .bank-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('com-porc-banco').value = comision;
  bancoActivoNombre = nombreBanco;
  document.getElementById('label-banco-activo').textContent = nombreBanco + ' (' + comision + '%)';
  window.toggleAccordion('acc-bancos');
  actualizarResumenCanal();
  window.calcularComisiones(1);
  window.calcularArbitraje();
  guardarDatos(true);
}

function seleccionarBinanceComision(comision, nombreBinance, el) {
  document.querySelectorAll('#grid-binance .binance-btn').forEach(function(b) { b.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('com-porc-binance').value = comision;
  binanceActivoNombre = nombreBinance;
  document.getElementById('label-binance-activo').textContent = nombreBinance + ' (' + comision + '%)';
  window.toggleAccordion('acc-binance');
  actualizarResumenCanal();
  window.calcularComisiones(1);
  window.calcularArbitraje();
  guardarDatos(true);
}

function actualizarResumenCanal() {
  var pb = document.getElementById('com-porc-banco') ? document.getElementById('com-porc-banco').value : 0;
  var pbin = document.getElementById('com-porc-binance') ? document.getElementById('com-porc-binance').value : 0;
  var resCanal = document.getElementById('resumen-canal-activo');
  if(resCanal) resCanal.textContent = bancoActivoNombre + ' [' + pb + '%] + ' + binanceActivoNombre + ' [' + pbin + '%]';
}

window.actualizarTasasManuales = function(subirNube = true) {
  tasaBCV = parseFloat(document.getElementById('input-tasa-bcv').value) || 0;
  tasaUSDT = parseFloat(document.getElementById('input-tasa-usdt').value) || 0;
  tasaEUR = parseFloat(document.getElementById('input-tasa-eur').value) || 0;
  tasaCOP = parseFloat(document.getElementById('input-tasa-cop').value) || 0;

  var rBcv = document.getElementById('rate-bcv');
  var rUsdt = document.getElementById('rate-usdt');
  var rEur = document.getElementById('rate-eur');
  var rCop = document.getElementById('rate-cop');

  if(rBcv) rBcv.textContent = formato(tasaBCV) + ' Bs';
  if(rUsdt) rUsdt.textContent = formato(tasaUSDT) + ' Bs';
  if(rEur) rEur.textContent = formato(tasaEUR) + ' Bs';
  if(rCop) rCop.textContent = formato(tasaCOP);

  calcularVariacion('var-bcv', tasaBCV, prevBCV);
  calcularVariacion('var-usdt', tasaUSDT, prevUSDT);
  calcularVariacion('var-eur', tasaEUR, prevEUR);

  var spread = tasaBCV > 0 ? ((tasaUSDT - tasaBCV) / tasaBCV) * 100 : 0;
  var rSpread = document.getElementById('rate-spread');
  if(rSpread) rSpread.textContent = spread.toFixed(2) + '%';

  var arbC = document.getElementById('arb-tasa-compra');
  var arbV = document.getElementById('arb-tasa-venta');
  if(arbC) arbC.value = tasaBCV;
  if(arbV) arbV.value = tasaUSDT;
  
  asegurarHistoricoGrafico();
  renderGraficoD3();
  window.calcularMultimoneda();
  window.calcularArbitraje();
  window.calcularMetaNeta();
  guardarDatos(subirNube);
};

function calcularVariacion(elementId, actual, previo) {
  var el = document.getElementById(elementId);
  if(!el) return;
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

window.sincronizarDolarVzlaAPI = async function(mostrarAlerta) {
  try {
    var response = await fetch('https://rates.dolarvzla.com/bcv/current.json');
    var data = await response.json();
    var huboCambio = false;

    if (data.current) {
      var nuevoUsd = parseFloat(data.current.usd);
      if (nuevoUsd && Math.abs(nuevoUsd - tasaBCV) >= 0.01) {
        prevBCV = tasaBCV;
        if(document.getElementById('input-tasa-bcv')) document.getElementById('input-tasa-bcv').value = nuevoUsd;
        huboCambio = true;
        dispararNotificacion(
          'Cambio en Dólar BCV Oficial',
          'Nueva tasa: ' + formato(nuevoUsd) + ' Bs (Antes: ' + formato(prevBCV) + ' Bs)'
        );
      }
      var nuevoEur = parseFloat(data.current.eur);
      if (nuevoEur && Math.abs(nuevoEur - tasaEUR) >= 0.01) {
        prevEUR = tasaEUR;
        if(document.getElementById('input-tasa-eur')) document.getElementById('input-tasa-eur').value = nuevoEur;
        huboCambio = true;
      }
    }
    window.actualizarTasasManuales(huboCambio);
    var sync = document.getElementById('sync-status');
    if(sync) sync.textContent = 'Tasas Oficiales Sincronizadas';
    if (mostrarAlerta) window.mostrarToast('Tasas BCV actualizadas');
  } catch (error) {
    var sync = document.getElementById('sync-status');
    if(sync) sync.textContent = 'Modo Offline Activo';
  }
};

window.sincronizarBinanceP2P = async function(mostrarAlerta) {
  try {
    var response = await fetch('https://ve.dolarapi.com/v1/dolares');
    var data = await response.json();
    var binanceObj = data.find(function(item) { return item.fuente === 'paralelo' || item.fuente === 'cripto'; }) || data[1];
    
    if (binanceObj && binanceObj.promedio) {
      var nuevaTasa = parseFloat(binanceObj.promedio);
      var huboCambio = false;
      if (nuevaTasa && Math.abs(nuevaTasa - tasaUSDT) >= 0.01) {
        prevUSDT = tasaUSDT;
        if(document.getElementById('input-tasa-usdt')) document.getElementById('input-tasa-usdt').value = nuevaTasa;
        huboCambio = true;
        dispararNotificacion(
          'Cambio en USDT P2P',
          'Nueva cotización: ' + formato(nuevaTasa) + ' Bs | BCV: ' + formato(tasaBCV) + ' Bs'
        );
      }
      window.actualizarTasasManuales(huboCambio);
      var sync = document.getElementById('sync-status');
      if(sync) sync.textContent = 'Mercado P2P Sincronizado';
      if (mostrarAlerta) window.mostrarToast('Tasa USDT P2P actualizada');
    }
  } catch (e) {
    var sync = document.getElementById('sync-status');
    if(sync) sync.textContent = 'Modo Offline Activo';
  }
};

window.switchTab = function(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.nav-item').forEach(function(i) { i.classList.remove('active'); });
  var target = document.getElementById('tab-' + tabId);
  if(target) target.classList.add('active');
  if(el) el.classList.add('active');
  if (tabId === 'inicio') {
    setTimeout(renderGraficoD3, 60);
  }
};

window.calcularComisionTransf = function() {
  var bs = parseFloat(document.getElementById('transf-monto-bs').value) || 0;
  var comision = bs * 0.003;
  document.getElementById('transf-res-comision').textContent = formato(comision) + ' Bs';
  document.getElementById('transf-res-total').textContent = formato(bs + comision) + ' Bs';
};

window.calcularMetaNeta = function() {
  var metaUsd = parseFloat(document.getElementById('meta-usd').value) || 0;
  var pBanco = parseFloat(document.getElementById('com-porc-banco') ? document.getElementById('com-porc-banco').value : 0) || 2.5;
  var pBinance = parseFloat(document.getElementById('com-porc-binance') ? document.getElementById('com-porc-binance').value : 0) || 0;
  var factorComision = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  var usdNecesarios = factorComision > 0 ? metaUsd / factorComision : metaUsd;
  var metaEl = document.getElementById('meta-res-bs');
  if(metaEl) metaEl.textContent = formato((usdNecesarios * tasaBCV) * 1.003) + ' Bs';
};

window.calcularIGTF = function() {
  var usd = parseFloat(document.getElementById('igtf-monto-usd').value) || 0;
  var baseBs = usd * tasaBCV;
  var igtfUsd = usd * 0.03;
  document.getElementById('igtf-res-3pct').textContent = formato(igtfUsd) + ' $';
  document.getElementById('igtf-res-total').textContent = formato(usd + igtfUsd) + ' $ / ' + formato(baseBs + (igtfUsd * tasaBCV)) + ' Bs';
};

window.calcularComisiones = function(modo) {
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
  window.calcularMetaNeta();
};

window.calcularArbitraje = function() {
  var bs = parseFloat(document.getElementById('arb-bs-inicial').value) || 0;
  var tCompra = parseFloat(document.getElementById('arb-tasa-compra').value) || tasaBCV;
  var tVenta = parseFloat(document.getElementById('arb-tasa-venta').value) || tasaUSDT;
  var pBanco = parseFloat(document.getElementById('com-porc-banco').value) || 0;
  var pBinance = parseFloat(document.getElementById('com-porc-binance').value) || 0;
  var pPersonal = parseFloat(document.getElementById('arb-com-personal').value) || 0;

  var factorComision = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  var eq = document.getElementById('arb-res-breakeven');
  if(eq) eq.textContent = formato(factorComision > 0 ? tCompra / factorComision : tCompra) + ' Bs';

  if (bs > 0 && tCompra > 0) {
    var usdBrutos = bs / tCompra;
    var usdtNetos = usdBrutos * factorComision;
    var bsFinales = usdtNetos * tVenta;
    var gananciaBsBruta = bsFinales - bs;
    var gananciaUsdBcvBruta = tCompra > 0 ? gananciaBsBruta / tCompra : 0;
    var gananciaUsdtBruta = tVenta > 0 ? gananciaBsBruta / tVenta : 0;
    var gananciaUsdtFinal = gananciaUsdtBruta * (1 + (pPersonal / 100));

    var colorRes = gananciaBsBruta >= 0 ? 'var(--neon-green)' : 'var(--danger-color)';

    var arbFinal = document.getElementById('arb-res-final');
    var arbCom = document.getElementById('arb-res-comision-bs');
    if(arbFinal) arbFinal.textContent = formato(bsFinales) + ' Bs';
    if(arbCom) arbCom.textContent = formato(bs - (usdtNetos * tCompra)) + ' Bs';
    
    var elBs = document.getElementById('arb-res-ganancia-bs');
    if(elBs){ elBs.textContent = formato(gananciaBsBruta) + ' Bs'; elBs.style.color = colorRes; }

    var elUsdBcv = document.getElementById('arb-res-ganancia-usd-bcv');
    if(elUsdBcv) { elUsdBcv.textContent = formato(gananciaUsdBcvBruta) + ' $'; elUsdBcv.style.color = colorRes; }

    var elUsdt = document.getElementById('arb-res-ganancia-usdt');
    if(elUsdt) { elUsdt.textContent = formato(gananciaUsdtBruta) + ' USDT'; elUsdt.style.color = colorRes; }

    var elUsd = document.getElementById('arb-res-ganancia-usd');
    if(elUsd) { elUsd.textContent = formato(gananciaUsdtFinal) + ' USDT'; elUsd.style.color = colorRes; }
  }
};

window.registrarOperacion = function() {
  var bs = document.getElementById('arb-bs-inicial').value;
  var ganBs = document.getElementById('arb-res-ganancia-bs').textContent;
  if (!bs || ganBs === '0,00 Bs') {
    window.mostrarToast("Ingrese un monto de inversión válido");
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
  window.mostrarToast('Operación guardada en tu Libro en la Nube');
};

function parsearNumeroVenezolano(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  var limpio = String(str).replace(/[^\d.,\-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(limpio) || 0;
}

function renderHistorial(filtro) {
  var q = (filtro || '').toLowerCase();
  var container = document.getElementById('historial-cards-container');
  if(!container) return;
  container.innerHTML = '';

  var filtrados = historial.filter(function(h) {
    return (h.canal || '').toLowerCase().includes(q) || (h.nota || '').toLowerCase().includes(q);
  });

  // Actualizar barra de resumen acumulado
  var totalBs = 0;
  var totalUsdt = 0;
  filtrados.forEach(function(h) {
    totalBs += parseFloat(h.inversionBs) || 0;
    totalUsdt += parsearNumeroVenezolano(h.gananciaUsdtFinal);
  });

  var elOps = document.getElementById('libro-total-ops');
  var elTotBs = document.getElementById('libro-total-bs');
  var elTotUsdt = document.getElementById('libro-total-usdt');
  if (elOps) elOps.textContent = filtrados.length;
  if (elTotBs) elTotBs.textContent = formato(totalBs) + ' Bs';
  if (elTotUsdt) {
    elTotUsdt.textContent = (totalUsdt >= 0 ? '+' : '') + formato(totalUsdt) + ' USDT';
    elTotUsdt.style.color = totalUsdt >= 0 ? 'var(--neon-green)' : 'var(--danger-color)';
  }

  filtrados.forEach(function(h) {
    var card = document.createElement('div');
    card.className = 'history-card';
    card.onclick = function() { window.abrirModalDetalle(h.id); };

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

window.abrirModalDetalle = function(id) {
  var item = historial.find(function(h) { return h.id === id; });
  if (!item) return;
  itemSeleccionadoModal = item;

  var body = document.getElementById('modal-body-content');
  if(!body) return;
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
};

window.cerrarModalDetalle = function(e) {
  if (!e || e.target.id === 'modal-detalle') {
    var modal = document.getElementById('modal-detalle');
    if(modal) modal.style.display = 'none';
  }
};

window.eliminarDesdeModal = function() {
  if (!itemSeleccionadoModal) return;
  historial = historial.filter(function(h) { return h.id !== itemSeleccionadoModal.id; });
  renderHistorial();
  guardarDatos(true);
  window.cerrarModalDetalle(null);
  window.mostrarToast("Registro eliminado de la nube");
};

window.copiarDetalleWhatsApp = function() {
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
  window.mostrarToast('Comprobante copiado para WhatsApp');
};

window.filtrarHistorial = function() {
  renderHistorial(document.getElementById('buscar-historial').value);
};

window.copiarTexto = function(tipo) {
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
  window.mostrarToast('Copiado al portapapeles');
};

window.limpiarTodo = function() {
  document.getElementById('main-amount-input').value = '';
  document.querySelectorAll('input').forEach(function(i) {
    if(!['input-tasa-bcv','input-tasa-usdt','input-tasa-eur','input-tasa-cop','nuevo-horario','auth-email','auth-password','com-porc-banco','com-porc-binance','com-porc-personal','arb-com-personal'].includes(i.id)) {
      i.value = '';
    }
  });
  window.calcularMultimoneda();
  window.calcularArbitraje();
  window.calcularMetaNeta();
  window.mostrarToast("Campos de cálculo limpiados");
};

// === GRÁFICA D3 REPARADA Y BLINDADA ===
function renderGraficoD3() {
  if (typeof d3 === 'undefined') return;
  var container = d3.select("#chart-container");
  if (container.empty()) return;
  container.html("");

  asegurarHistoricoGrafico();

  var node = container.node();
  if (!node) return;
  var width = node.getBoundingClientRect().width;
  if (!width || width < 120) width = 310;
  var height = 190;
  var margin = {top: 22, right: 20, bottom: 28, left: 48};

  var svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  var datosLimpios = historicoGrafico.map(function(d) {
    return {
      fecha: String(d.fecha || 'Hoy'),
      bcv: Number(d.bcv) || tasaBCV || 832.48,
      usdt: Number(d.usdt) || tasaUSDT || 885.10
    };
  });

  var x = d3.scalePoint()
    .domain(datosLimpios.map(function(d) { return d.fecha; }))
    .range([margin.left, width - margin.right])
    .padding(0.2);

  var minVal = d3.min(datosLimpios, function(d) { return Math.min(d.bcv, d.usdt); });
  var maxVal = d3.max(datosLimpios, function(d) { return Math.max(d.bcv, d.usdt); });
  if (minVal === maxVal) {
    minVal = minVal * 0.95;
    maxVal = maxVal * 1.05;
  }

  var y = d3.scaleLinear()
    .domain([minVal * 0.985, maxVal * 1.015])
    .range([height - margin.bottom, margin.top]);

  var lineBCV = d3.line()
    .curve(d3.curveMonotoneX)
    .x(function(d) { return x(d.fecha); })
    .y(function(d) { return y(d.bcv); });

  var lineUSDT = d3.line()
    .curve(d3.curveMonotoneX)
    .x(function(d) { return x(d.fecha); })
    .y(function(d) { return y(d.usdt); });

  svg.append("g")
    .attr("transform", "translate(0," + (height - margin.bottom) + ")")
    .call(d3.axisBottom(x))
    .attr("color", "#64748b");

  svg.append("g")
    .attr("transform", "translate(" + margin.left + ",0)")
    .call(d3.axisLeft(y).ticks(4))
    .attr("color", "#64748b");

  // Línea BCV (Verde Neón)
  svg.append("path")
    .datum(datosLimpios)
    .attr("fill", "none")
    .attr("stroke", "#00e676")
    .attr("stroke-width", 2.8)
    .attr("d", lineBCV);

  // Línea USDT (Amarillo Oro)
  svg.append("path")
    .datum(datosLimpios)
    .attr("fill", "none")
    .attr("stroke", "#f0b90b")
    .attr("stroke-width", 2.8)
    .attr("d", lineUSDT);

  // Puntos BCV
  svg.selectAll(".dot-bcv")
    .data(datosLimpios)
    .enter()
    .append("circle")
    .attr("cx", function(d) { return x(d.fecha); })
    .attr("cy", function(d) { return y(d.bcv); })
    .attr("r", 3.5)
    .attr("fill", "#00e676");

  // Puntos USDT
  svg.selectAll(".dot-usdt")
    .data(datosLimpios)
    .enter()
    .append("circle")
    .attr("cx", function(d) { return x(d.fecha); })
    .attr("cy", function(d) { return y(d.usdt); })
    .attr("r", 3.5)
    .attr("fill", "#f0b90b");
}

window.solicitarPermisoNotificaciones = function() {
  if (!("Notification" in window)) {
    window.mostrarToast("Navegador sin soporte de alertas");
    return;
  }
  Notification.requestPermission().then(function(permission) {
    if (permission === "granted") {
      var notifStatus = document.getElementById("notif-status");
      if(notifStatus) notifStatus.textContent = "Alertas Activas (Horarios y Cambios de Tasa)";
      window.mostrarToast("Alertas activadas en segundo plano");
      sincronizarConfigConServiceWorker();
      dispararNotificacion(
        'Alertas Financieras Activas',
        'BCV: ' + formato(tasaBCV) + ' Bs | USDT P2P: ' + formato(tasaUSDT) + ' Bs'
      );
    } else {
      var notifStatus = document.getElementById("notif-status");
      if(notifStatus) notifStatus.textContent = "Permiso de alerta denegado";
    }
  });
};

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
const CAMPOS_TASAS = ['input-tasa-bcv', 'input-tasa-usdt', 'input-tasa-eur', 'input-tasa-cop'];

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
    banner.innerHTML = '<svg class="icon-svg-sm" style="vertical-align:-2px; margin-right:4px;" viewBox="0 0 24 24"><path d="M10.5 2h3l-1.5 8h4.5l-6 12 1.5-8h-4.5z"/></svg> Modo Offline Activo • Usando últimas tasas';
    banner.style.opacity = '1';
  } else {
    banner.style.background = 'linear-gradient(135deg, #059669, #047857)';
    banner.style.border = '1px solid #34d399';
    banner.innerHTML = '<svg class="icon-svg-sm" style="vertical-align:-2px; margin-right:4px;" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Conexión restaurada • Tasas sincronizadas';
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
