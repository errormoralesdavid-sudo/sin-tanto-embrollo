var tasaBCV = 832.48;
var tasaUSDT = 885.10;
var tasaEUR = 968.06;
var tasaCOP = 3102.00;

var prevBCV = null;
var prevUSDT = null;
var prevEUR = null;

var historial = [];
var historicoGrafico = [];

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

var modoBaseUSD = true;
var itemSeleccionadoModal = null;
var isUserInteracting = false;
var resumeTimeout = null;

window.onload = function() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Error:', err));
  }

  cargarDatosGuardados();
  renderBancos();
  renderBinance();
  actualizarTasasManuales();
  
  sincronizarDolarVzlaAPI(false);
  sincronizarBinanceP2P(false);
  
  iniciarSmoothSlider();
  renderGraficoD3();
  iniciarRelojNotificaciones();
};

function toggleTheme() {
  var currentTheme = document.documentElement.getAttribute("data-theme");
  var newTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", newTheme);
  document.getElementById("theme-btn").innerText = newTheme === "light" ? "🌙" : "☀️";
  localStorage.setItem("embrollo_theme", newTheme);
}

function iniciarSmoothSlider() {
  var slider = document.getElementById('rate-slider');
  
  slider.addEventListener('touchstart', function() { detenerAutoScroll(); });
  slider.addEventListener('touchend', function() { reanudarAutoScrollConDelay(); });
  slider.addEventListener('mouseenter', function() { detenerAutoScroll(); });
  slider.addEventListener('mouseleave', function() { reanudarAutoScrollConDelay(); });

  function step() {
    if (!isUserInteracting) {
      slider.scrollLeft += 0.6;
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
  return Number(num).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    crossMon1: document.getElementById('cross-mon-1').value,
    crossMon2: document.getElementById('cross-mon-2').value,
    crossVal1: document.getElementById('cross-val-1').value,
    notifTime1: document.getElementById('notif-time-1').value,
    notifTime2: document.getElementById('notif-time-2').value
  };
  localStorage.setItem('embrollo_data_pro_v2', JSON.stringify(datos));
}

function cargarDatosGuardados() {
  var theme = localStorage.getItem("embrollo_theme") || "dark";
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("theme-btn").innerText = theme === "light" ? "🌙" : "☀️";

  var datos = JSON.parse(localStorage.getItem('embrollo_data_pro_v2'));
  if (datos) {
    if(datos.bcv) document.getElementById('input-tasa-bcv').value = datos.bcv;
    if(datos.usdt) document.getElementById('input-tasa-usdt').value = datos.usdt;
    if(datos.eur) document.getElementById('input-tasa-eur').value = datos.eur;
    if(datos.cop) document.getElementById('input-tasa-cop').value = datos.cop;
    
    if(datos.prevBCV) prevBCV = datos.prevBCV;
    if(datos.prevUSDT) prevUSDT = datos.prevUSDT;
    if(datos.prevEUR) prevEUR = datos.prevEUR;

    if(datos.bancos) listaBancos = datos.bancos;
    if(datos.binance) listaBinance = datos.binance;
    if(datos.historial) { historial = datos.historial; renderHistorial(); }
    if(datos.historicoGrafico) historicoGrafico = datos.historicoGrafico;

    if(datos.crossMon1) document.getElementById('cross-mon-1').value = datos.crossMon1;
    if(datos.crossMon2) document.getElementById('cross-mon-2').value = datos.crossMon2;
    if(datos.crossVal1) document.getElementById('cross-val-1').value = datos.crossVal1;

    if(datos.notifTime1) document.getElementById('notif-time-1').value = datos.notifTime1;
    if(datos.notifTime2) document.getElementById('notif-time-2').value = datos.notifTime2;
  }
}

function renderBancos() {
  var grid = document.getElementById('grid-bancos');
  grid.innerHTML = '';
  listaBancos.forEach((b, idx) => {
    var div = document.createElement('div');
    div.className = 'bank-btn' + (idx === 0 ? ' active' : '');
    div.innerHTML = `
      <span>🏛️ ${b.nombre}</span>
      <span class="bank-badge">${b.comision}%</span>
      <span style="font-size:10px; margin-left:4px; opacity:0.6;" onclick="event.stopPropagation(); editarBanco(${b.id})">✏️</span>
    `;
    div.onclick = function() { seleccionarBancoComision(b.comision, b.nombre, this); };
    grid.appendChild(div);
  });

  var btnAdd = document.createElement('div');
  btnAdd.className = 'btn-add-item';
  btnAdd.innerText = '➕ Agregar Banco';
  btnAdd.onclick = agregarNuevoBanco;
  grid.appendChild(btnAdd);
}

function agregarNuevoBanco() {
  var nombre = prompt('Nombre del nuevo Banco:');
  if (!nombre) return;
  var comision = parseFloat(prompt('Comisión en %:', '1.5')) || 0;
  listaBancos.push({ id: Date.now(), nombre: nombre, comision: comision });
  renderBancos();
  guardarDatos();
}

function editarBanco(id) {
  var b = listaBancos.find(x => x.id === id);
  if (!b) return;
  var nuevaCom = prompt(`Editar comisión % para ${b.nombre}:`, b.comision);
  if (nuevaCom !== null) {
    b.comision = parseFloat(nuevaCom) || 0;
    renderBancos();
    guardarDatos();
  }
}

function renderBinance() {
  var grid = document.getElementById('grid-binance');
  grid.innerHTML = '';
  listaBinance.forEach((bin, idx) => {
    var div = document.createElement('div');
    div.className = 'binance-btn' + (idx === 0 ? ' active' : '');
    div.innerHTML = `
      <span>⚡ ${bin.nombre}</span>
      <span class="bank-badge">${bin.comision}%</span>
      <span style="font-size:10px; margin-left:4px; opacity:0.6;" onclick="event.stopPropagation(); editarBinance(${bin.id})">✏️</span>
    `;
    div.onclick = function() { seleccionarBinanceComision(bin.comision, bin.nombre, this); };
    grid.appendChild(div);
  });

  var btnAdd = document.createElement('div');
  btnAdd.className = 'btn-add-item';
  btnAdd.innerText = '➕ Agregar Opción Binance';
  btnAdd.onclick = agregarNuevoBinance;
  grid.appendChild(btnAdd);
}

function agregarNuevoBinance() {
  var nombre = prompt('Nombre de la opción:');
  if (!nombre) return;
  var comision = parseFloat(prompt('Comisión en %:', '0.15')) || 0;
  listaBinance.push({ id: Date.now(), nombre: nombre, comision: comision });
  renderBinance();
  guardarDatos();
}

function editarBinance(id) {
  var bin = listaBinance.find(x => x.id === id);
  if (!bin) return;
  var nuevaCom = prompt(`Editar comisión % para ${bin.nombre}:`, bin.comision);
  if (nuevaCom !== null) {
    bin.comision = parseFloat(nuevaCom) || 0;
    renderBinance();
    guardarDatos();
  }
}

function seleccionarBancoComision(comision, nombreBanco, el) {
  document.querySelectorAll('#grid-bancos .bank-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('com-porc-banco').value = comision;
  document.getElementById('banco-seleccionado-nombre').value = nombreBanco;
  document.getElementById('label-banco-activo').innerText = nombreBanco + ` (${comision}%) ▾`;
  toggleAccordion('acc-bancos');
  actualizarResumenCanal();
  calcularComisiones(1);
  calcularArbitraje();
}

function seleccionarBinanceComision(comision, nombreBinance, el) {
  document.querySelectorAll('#grid-binance .binance-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('com-porc-binance').value = comision;
  document.getElementById('binance-seleccionado-nombre').value = nombreBinance;
  document.getElementById('label-binance-activo').innerText = nombreBinance + ` (${comision}%) ▾`;
  toggleAccordion('acc-binance');
  actualizarResumenCanal();
  calcularComisiones(1);
  calcularArbitraje();
}

function actualizarResumenCanal() {
  var banco = document.getElementById('banco-seleccionado-nombre').value;
  var pb = document.getElementById('com-porc-banco').value;
  var binance = document.getElementById('binance-seleccionado-nombre').value;
  var pbin = document.getElementById('com-porc-binance').value;
  document.getElementById('resumen-canal-activo').innerText = `${banco} [${pb}%] + ${binance} [${pbin}%]`;
}

function actualizarTasasManuales() {
  tasaBCV = parseFloat(document.getElementById('input-tasa-bcv').value) || 0;
  tasaUSDT = parseFloat(document.getElementById('input-tasa-usdt').value) || 0;
  tasaEUR = parseFloat(document.getElementById('input-tasa-eur').value) || 0;
  tasaCOP = parseFloat(document.getElementById('input-tasa-cop').value) || 0;

  document.getElementById('rate-bcv').innerText = formato(tasaBCV) + ' Bs';
  document.getElementById('rate-usdt').innerText = formato(tasaUSDT) + ' Bs';
  document.getElementById('rate-eur').innerText = formato(tasaEUR) + ' Bs';
  document.getElementById('rate-cop').innerText = formato(tasaCOP) + ' Bs';

  calcularVariacion('var-bcv', tasaBCV, prevBCV);
  calcularVariacion('var-usdt', tasaUSDT, prevUSDT);
  calcularVariacion('var-eur', tasaEUR, prevEUR);

  var spread = tasaBCV > 0 ? ((tasaUSDT - tasaBCV) / tasaBCV) * 100 : 0;
  document.getElementById('rate-spread').innerText = spread.toFixed(2) + '%';

  document.getElementById('arb-tasa-compra').value = tasaBCV;
  document.getElementById('arb-tasa-venta').value = tasaUSDT;
  
  calcularDirecto();
  calcularCruzado(1);
  calcularArbitraje();
  calcularMetaNeta();
  guardarDatos();
}

function calcularVariacion(elementId, actual, previo) {
  var el = document.getElementById(elementId);
  if (!previo || previo === actual) {
    el.innerText = 'Sin cambios';
    el.className = 'trend neutral';
    return;
  }
  var diff = ((actual - previo) / previo) * 100;
  if (diff > 0) {
    el.innerText = `▲ +${diff.toFixed(2)}%`;
    el.className = 'trend up';
  } else {
    el.innerText = `▼ ${diff.toFixed(2)}%`;
    el.className = 'trend down';
  }
}

async function sincronizarDolarVzlaAPI(mostrarAlerta = false) {
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
    document.getElementById('sync-status').innerText = '✅ Tasas BCV actualizadas en vivo';
    if (mostrarAlerta) alert('¡Tasas oficiales BCV sincronizadas!');
  } catch (error) {
    document.getElementById('sync-status').innerText = '⚡ Modo Offline (Datos locales)';
  }
}

async function sincronizarBinanceP2P(mostrarAlerta = false) {
  try {
    var response = await fetch('https://ve.dolarapi.com/v1/dolares');
    var data = await response.json();
    var binanceObj = data.find(item => item.fuente === 'paralelo' || item.fuente === 'cripto') || data[1];
    
    if (binanceObj && binanceObj.promedio) {
      var nuevaTasa = parseFloat(binanceObj.promedio);
      if (nuevaTasa !== tasaUSDT) {
        prevUSDT = tasaUSDT;
        document.getElementById('input-tasa-usdt').value = nuevaTasa;
      }
      actualizarTasasManuales();
      document.getElementById('sync-status').innerText = '✅ Tasa Binance P2P obtenida en tiempo real';
      if (mostrarAlerta) alert('¡Tasa de Binance P2P sincronizada!');
    }
  } catch (e) {
    document.getElementById('sync-status').innerText = '⚡ Modo Offline (Datos locales)';
  }
}

function switchTab(tabId, el) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  el.classList.add('active');
}

function toggleModoCalculadora() {
  modoBaseUSD = !modoBaseUSD;
  var inputVal = document.getElementById('usd-input');
  inputVal.value = '';

  if (modoBaseUSD) {
    document.getElementById('calc-title').innerText = 'Calculadora Rápida ($)';
    document.getElementById('main-input-label').innerText = 'Monto en Dólares ($):';
    document.getElementById('toggle-icon').innerText = '🔄 VES ⇄ USD';

    document.getElementById('lbl-res-bcv').innerText = 'Al cambio BCV:';
    document.getElementById('lbl-res-usdt').innerText = 'Al cambio USDT P2P:';
    document.getElementById('lbl-res-eur').innerText = 'En Euros (€):';
    document.getElementById('lbl-res-cop').innerText = 'En Pesos (COP):';
  } else {
    document.getElementById('calc-title').innerText = 'Calculadora Rápida (Bs)';
    document.getElementById('main-input-label').innerText = 'Monto en Bolívares (Bs):';
    document.getElementById('toggle-icon').innerText = '🔄 USD ⇄ VES';

    document.getElementById('lbl-res-bcv').innerText = 'Equivale a BCV ($):';
    document.getElementById('lbl-res-usdt').innerText = 'Equivale a USDT P2P ($):';
    document.getElementById('lbl-res-eur').innerText = 'Equivale a Euros (€):';
    document.getElementById('lbl-res-cop').innerText = 'Equivale a Pesos (COP):';
  }
  calcularDirecto();
}

function calcularDirecto() {
  var val = parseFloat(document.getElementById('usd-input').value) || 0;

  if (modoBaseUSD) {
    var bsBcv = val * tasaBCV;
    document.getElementById('res-bcv').innerText = formato(bsBcv) + ' Bs';
    document.getElementById('res-usdt').innerText = formato(val * tasaUSDT) + ' Bs';
    document.getElementById('res-eur').innerText = formato(bsBcv / (tasaEUR || 1)) + ' €';
    document.getElementById('res-cop').innerText = tasaCOP > 0 ? formato(val * tasaCOP) + ' COP' : '0 COP';
  } else {
    var usdBcv = tasaBCV > 0 ? val / tasaBCV : 0;
    var usdP2p = tasaUSDT > 0 ? val / tasaUSDT : 0;
    var eur = tasaEUR > 0 ? val / tasaEUR : 0;
    var cop = tasaBCV > 0 ? (val / tasaBCV) * tasaCOP : 0;

    document.getElementById('res-bcv').innerText = formato(usdBcv) + ' $';
    document.getElementById('res-usdt').innerText = formato(usdP2p) + ' $';
    document.getElementById('res-eur').innerText = formato(eur) + ' €';
    document.getElementById('res-cop').innerText = formato(cop) + ' COP';
  }
}

function calcularCruzado(modo) {
  var v1 = document.getElementById('cross-val-1');
  var v2 = document.getElementById('cross-val-2');
  var m1 = document.getElementById('cross-mon-1').value;
  var m2 = document.getElementById('cross-mon-2').value;

  function obtenerValorEnBs(monto, moneda) {
    if (moneda === 'BCV') return monto;
    if (moneda === 'USD') return monto * tasaBCV;
    if (moneda === 'USDT') return monto * tasaUSDT;
    if (moneda === 'EUR') return monto * tasaEUR;
    if (moneda === 'COP') return monto * (tasaBCV / tasaCOP);
    return 0;
  }

  function convertirDesdeBs(montoBs, monedaDestino) {
    if (monedaDestino === 'BCV') return montoBs;
    if (monedaDestino === 'USD') return montoBs / tasaBCV;
    if (monedaDestino === 'USDT') return montoBs / tasaUSDT;
    if (monedaDestino === 'EUR') return montoBs / tasaEUR;
    if (monedaDestino === 'COP') return montoBs / (tasaBCV / tasaCOP);
    return 0;
  }

  if (modo === 1) {
    var bs = obtenerValorEnBs(parseFloat(v1.value) || 0, m1);
    v2.value = convertirDesdeBs(bs, m2).toFixed(2);
  } else {
    var bs = obtenerValorEnBs(parseFloat(v2.value) || 0, m2);
    v1.value = convertirDesdeBs(bs, m1).toFixed(2);
  }
  guardarDatos();
}

function calcularComisionTransf() {
  var bs = parseFloat(document.getElementById('transf-monto-bs').value) || 0;
  var pct = parseFloat(document.getElementById('transf-tipo').value) || 0;
  var comision = bs * (pct / 100);
  document.getElementById('transf-res-comision').innerText = formato(comision) + ' Bs';
  document.getElementById('transf-res-total').innerText = formato(bs + comision) + ' Bs';
}

function calcularMetaNeta() {
  var metaUsd = parseFloat(document.getElementById('meta-usd').value) || 0;
  var pBanco = parseFloat(document.getElementById('com-porc-banco').value) || 2.5;
  var pBinance = parseFloat(document.getElementById('com-porc-binance').value) || 0;
  var factorComision = (1 - (pBanco / 100)) * (1 - (pBinance / 100));
  var usdNecesarios = factorComision > 0 ? metaUsd / factorComision : metaUsd;
  document.getElementById('meta-res-bs').innerText = formato((usdNecesarios * tasaBCV) * 1.003) + ' Bs';
}

function calcularIGTF() {
  var usd = parseFloat(document.getElementById('igtf-monto-usd').value) || 0;
  var baseBs = usd * tasaBCV;
  var igtfUsd = usd * 0.03;
  document.getElementById('igtf-res-base').innerText = formato(baseBs) + ' Bs';
  document.getElementById('igtf-res-3pct').innerText = formato(igtfUsd) + ' $';
  document.getElementById('igtf-res-total').innerText = formato(usd + igtfUsd) + ' $ / ' + formato(baseBs + (igtfUsd * tasaBCV)) + ' Bs';
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
    document.getElementById('com-res-total-personal').innerText = formato(netoUsdt * (1 + (pPersonal / 100))) + ' $';
  } else {
    var v = parseFloat(rec.value) || 0;
    env.value = (factorSystem > 0 ? (v / factorSystem) : 0).toFixed(2);
    document.getElementById('com-res-total-personal').innerText = formato(v * (1 + (pPersonal / 100))) + ' $';
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
  document.getElementById('arb-res-breakeven').innerText = formato(factorComision > 0 ? tCompra / factorComision : tCompra) + ' Bs';

  if (bs > 0 && tCompra > 0) {
    var usdBrutos = bs / tCompra;
    var usdtNetos = usdBrutos * factorComision;
    var bsFinales = usdtNetos * tVenta;
    var gananciaBs = bsFinales - bs;
    var gananciaUSD = (gananciaBs / tCompra) * (1 + (pPersonal / 100));
    var colorRes = gananciaBs >= 0 ? 'var(--neon-green)' : 'var(--danger-color)';

    document.getElementById('arb-res-final').innerText = formato(bsFinales) + ' Bs';
    document.getElementById('arb-res-comision-bs').innerText = formato(bs - (usdtNetos * tCompra)) + ' Bs';
    
    var elBs = document.getElementById('arb-res-ganancia-bs');
    elBs.innerText = formato(gananciaBs) + ' Bs';
    elBs.style.color = colorRes;

    var elUsdt = document.getElementById('arb-res-ganancia-usdt');
    elUsdt.innerText = formato(gananciaBs / tVenta) + ' USDT';
    elUsdt.style.color = colorRes;

    var elUsd = document.getElementById('arb-res-ganancia-usd');
    elUsd.innerText = formato(gananciaUSD) + ' $';
    elUsd.style.color = colorRes;
  }
}

function registrarOperacion() {
  var bs = document.getElementById('arb-bs-inicial').value;
  var ganBs = document.getElementById('arb-res-ganancia-bs').innerText;
  if (!bs || ganBs === '0,00 Bs') return;

  var now = new Date();
  var fechaHoraStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  historial.unshift({
    id: Date.now(),
    fechaHora: fechaHoraStr,
    canal: document.getElementById('resumen-canal-activo').innerText,
    inversionBs: bs,
    tasaCompra: document.getElementById('arb-tasa-compra').value,
    tasaVenta: document.getElementById('arb-tasa-venta').value,
    recargoPersonal: document.getElementById('arb-com-personal').value || '0',
    puntoEquilibrio: document.getElementById('arb-res-breakeven').innerText,
    montoFinalVenta: document.getElementById('arb-res-final').innerText,
    comisionesBs: document.getElementById('arb-res-comision-bs').innerText,
    gananciaBs: ganBs,
    gananciaUsdt: document.getElementById('arb-res-ganancia-usdt').innerText,
    gananciaUsdFinal: document.getElementById('arb-res-ganancia-usd').innerText,
    nota: document.getElementById('arb-nota').value || 'Sin notas'
  });

  document.getElementById('arb-nota').value = '';
  renderHistorial();
  guardarDatos();
  alert('¡Operación registrada!');
}

function renderHistorial(filtro = '') {
  var container = document.getElementById('historial-cards-container');
  container.innerHTML = '';

  historial.filter(h => h.canal.toLowerCase().includes(filtro.toLowerCase()) || h.nota.toLowerCase().includes(filtro.toLowerCase())).forEach(h => {
    var card = document.createElement('div');
    card.className = 'history-card';
    card.onclick = function() { abrirModalDetalle(h.id); };
    card.innerHTML = `
      <div>
        <div style="font-size:10px; color:var(--text-muted);">${h.fechaHora}</div>
        <div style="font-size:12px; font-weight:bold; margin-top:2px;">${h.canal}</div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Inv: ${formato(h.inversionBs)} Bs</div>
      </div>
      <div style="text-align:right;">
        <div style="font-size:13px; font-weight:bold; color:var(--neon-green);">${h.gananciaBs}</div>
        <div style="font-size:10px; color:var(--text-muted);">${h.gananciaUsdFinal}</div>
      </div>
    `;
    container.appendChild(card);
  });
}

function abrirModalDetalle(id) {
  var item = historial.find(h => h.id === id);
  if (!item) return;
  itemSeleccionadoModal = item;

  var body = document.getElementById('modal-body-content');
  body.innerHTML = `
    <div class="result-line"><span>Fecha / Hora:</span> <strong>${item.fechaHora}</strong></div>
    <div class="result-line"><span>Canal:</span> <strong style="font-size:11px;">${item.canal}</strong></div>
    <div class="result-line"><span>Monto Inicial Banco:</span> <strong>${formato(item.inversionBs)} Bs</strong></div>
    <div class="result-line"><span>Tasa Compra / Venta:</span> <strong>${item.tasaCompra} / ${item.tasaVenta}</strong></div>
    <div class="result-line"><span>Mi Recargo / Comisión:</span> <strong>${item.recargoPersonal}%</strong></div>
    <div class="result-line"><span>Punto de Equilibrio:</span> <strong>${item.puntoEquilibrio}</strong></div>
    <div class="result-line"><span>Monto Final Venta:</span> <strong>${item.montoFinalVenta}</strong></div>
    <div class="result-line"><span>Comisiones Totales:</span> <strong style="color:var(--danger-color);">${item.comisionesBs}</strong></div>
    <div class="result-line"><span>Ganancia Neta Real:</span> <strong style="color:var(--neon-green);">${item.gananciaBs}</strong></div>
    <div class="result-line"><span>Ganancia Neta USDT:</span> <strong>${item.gananciaUsdt}</strong></div>
    <div class="result-line"><span>Ganancia + Mi Comisión:</span> <strong style="color:var(--neon-green);">${item.gananciaUsdFinal}</strong></div>
    <div class="result-line" style="border-top:1px dashed var(--glass-border); padding-top:6px;"><span>Nota:</span> <strong>${item.nota}</strong></div>
  `;

  document.getElementById('modal-detalle').style.display = 'flex';
}

function cerrarModalDetalle(e) {
  if (!e || e.target.id === 'modal-detalle') {
    document.getElementById('modal-detalle').style.display = 'none';
  }
}

function eliminarDesdeModal() {
  if (!itemSeleccionadoModal) return;
  historial = historial.filter(h => h.id !== itemSeleccionadoModal.id);
  renderHistorial();
  guardarDatos();
  cerrarModalDetalle(null);
}

function copiarDetalleWhatsApp() {
  if (!itemSeleccionadoModal) return;
  var h = itemSeleccionadoModal;
  var texto = `📊 *REPORTE DE OPERACIÓN*\n` +
    `📅 *Fecha:* ${h.fechaHora}\n` +
    `🏛️ *Canal:* ${h.canal}\n` +
    `💵 *Inversión Inicial:* ${formato(h.inversionBs)} Bs\n` +
    `📈 *Tasas (Compra/Venta):* ${h.tasaCompra} / ${h.tasaVenta}\n` +
    `💼 *Mi Comisión:* ${h.recargoPersonal}%\n` +
    `💰 *Monto Final Venta:* ${h.montoFinalVenta}\n` +
    `🔻 *Comisiones:* ${h.comisionesBs}\n` +
    `✅ *Ganancia Neta:* ${h.gananciaBs} (${h.gananciaUsdt})\n` +
    `🎯 *Total Final ($):* ${h.gananciaUsdFinal}\n` +
    `📝 *Nota:* ${h.nota}`;

  navigator.clipboard.writeText(texto);
  alert('¡Reporte copiado listo para WhatsApp!');
}

function filtrarHistorial() {
  renderHistorial(document.getElementById('buscar-historial').value);
}

function copiarTexto(tipo) {
  var texto = '';
  if (tipo === 'resumen-rapido') {
    var val = document.getElementById('usd-input').value || '0';
    if (modoBaseUSD) {
      texto = `💵 *Cotización $${val}:*\n• BCV: ${document.getElementById('res-bcv').innerText}\n• USDT: ${document.getElementById('res-usdt').innerText}\n• EUR: ${document.getElementById('res-eur').innerText}\n• COP: ${document.getElementById('res-cop').innerText}`;
    } else {
      texto = `💵 *Cotización ${val} Bs:*\n• BCV: ${document.getElementById('res-bcv').innerText}\n• USDT: ${document.getElementById('res-usdt').innerText}\n• EUR: ${document.getElementById('res-eur').innerText}\n• COP: ${document.getElementById('res-cop').innerText}`;
    }
  } else if (tipo === 'meta-neta') {
    texto = `📌 Para recibir *${document.getElementById('meta-usd').value || 0} $ netos*, debes transferir *${document.getElementById('meta-res-bs').innerText}*.`;
  }
  navigator.clipboard.writeText(texto);
  alert('¡Copiado!');
}

function limpiarTodo() {
  document.querySelectorAll('input').forEach(i => {
    if(!['input-tasa-bcv','input-tasa-usdt','input-tasa-eur','input-tasa-cop','notif-time-1','notif-time-2'].includes(i.id)) i.value = '';
  });
  document.getElementById('com-porc-banco').value = '2.5';
  document.getElementById('com-porc-binance').value = '0.0';
  document.getElementById('com-porc-personal').value = '0';
  document.getElementById('arb-com-personal').value = '0';
  actualizarTasasManuales();
}

function renderGraficoD3() {
  var container = d3.select("#chart-container");
  container.html("");

  var width = container.node().getBoundingClientRect().width || 300;
  var height = 180;
  var margin = {top: 15, right: 15, bottom: 25, left: 45};

  var svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  var x = d3.scalePoint()
    .domain(historicoGrafico.map(d => d.fecha))
    .range([margin.left, width - margin.right]);

  var y = d3.scaleLinear()
    .domain([
      d3.min(historicoGrafico, d => Math.min(d.bcv, d.usdt)) * 0.98,
      d3.max(historicoGrafico, d => Math.max(d.bcv, d.usdt)) * 1.02
    ])
    .range([height - margin.bottom, margin.top]);

  var lineBCV = d3.line()
    .x(d => x(d.fecha))
    .y(d => y(d.bcv));

  var lineUSDT = d3.line()
    .x(d => x(d.fecha))
    .y(d => y(d.usdt));

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .attr("color", "#b0bec5");

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(4))
    .attr("color", "#b0bec5");

  svg.append("path")
    .datum(historicoGrafico)
    .attr("fill", "none")
    .attr("stroke", "#00e676")
    .attr("stroke-width", 2)
    .attr("d", lineBCV);

  svg.append("path")
    .datum(historicoGrafico)
    .attr("fill", "none")
    .attr("stroke", "#f0b90b")
    .attr("stroke-width", 2)
    .attr("d", lineUSDT);
}

function solicitarPermisoNotificaciones() {
  if (!("Notification" in window)) {
    alert("Tu navegador no soporta notificaciones.");
    return;
  }
  Notification.requestPermission().then(permission => {
    if (permission === "granted") {
      document.getElementById("notif-status").innerText = "✅ Notificaciones activadas";
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFY',
          title: 'Calculadora Financial PRO',
          body: `BCV: ${tasaBCV} Bs | USDT: ${tasaUSDT} Bs`
        });
      }
    } else {
      document.getElementById("notif-status").innerText = "❌ Permiso denegado";
    }
  });
}

function iniciarRelojNotificaciones() {
  setInterval(() => {
    if (Notification.permission !== "granted") return;
    
    var now = new Date();
    var currentTime = now.toTimeString().substring(0, 5);
    
    var t1 = document.getElementById('notif-time-1').value;
    var t2 = document.getElementById('notif-time-2').value;

    if ((currentTime === t1 || currentTime === t2) && now.getSeconds() === 0) {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'NOTIFY',
          title: '📊 Tasa del Dólar Actualizada',
          body: `BCV: ${tasaBCV} Bs | USDT: ${tasaUSDT} Bs`
        });
      }
    }
  }, 1000);
}
