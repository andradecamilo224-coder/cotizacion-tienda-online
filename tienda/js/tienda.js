/* ==========================================================================
   tienda.js — núcleo compartido de la tienda (sin librerías).
   - Configuración (nombre, WhatsApp)
   - Carga de productos: primero productos.json; si falla (file://), productos.js
   - Formato de precio COP, mensajes de WhatsApp, carrito en localStorage
   - Encabezado, menú móvil, carrito lateral (drawer), pie y tarjetas
   ========================================================================== */

window.TIENDA = {
  nombre: "[NOMBRE DE LA TIENDA]",   // Cambiar por el nombre real
  whatsapp: "573204894218",           // Con 57 de Colombia, sin +
  // Datos del proveedor exigidos por la Ley 1480 de 2011, art. 50 (pendientes del cliente)
  razonSocial: "[RAZÓN SOCIAL]",
  nit: "[NIT]",
  direccion: "[DIRECCIÓN]",
  correo: "[CORREO]",
  claveCarrito: "tienda.carrito.v1",
  claveBorrador: "tienda.admin.borrador.v1"
};

/* Raíz del sitio, calculada desde la ubicación de este archivo (js/tienda.js).
   Así los enlaces funcionan en subcarpetas (/tienda/, /legal/) y con doble clic. */
const RAIZ = (() => {
  const s = document.currentScript;
  return s && s.src ? new URL("..", s.src).href : "";
})();
/** Ruta relativa del sitio -> URL desde la raíz. Deja intactas las URL absolutas, data: y anclas. */
const enRaiz = r => (/^([a-z]+:|\/\/|#)/i.test(r || "") ? r : RAIZ + (r || ""));
const LEGAL = {
  terminos: "legal/terminos.html",
  privacidad: "legal/privacidad.html",
  garantias: "legal/garantias-y-retracto.html",
  sic: "https://www.sic.gov.co"
};

const CATEGORIAS = {
  iphone: "iPhone",
  playstation: "PlayStation",
  accesorios: "Accesorios",
  smartwatch: "Smartwatch"
};

/* ---------- Datos ---------- */

/**
 * Carga los productos.
 * 1) Si la URL trae ?borrador=1 y hay un borrador del admin, usa ese borrador (vista previa).
 * 2) Intenta fetch("productos.json") — funciona en un hosting o con un servidor local.
 * 3) Si falla (por ejemplo al abrir con doble clic, file://), usa window.PRODUCTOS_RESPALDO
 *    que define productos.js.
 */
async function cargarProductos() {
  if (new URLSearchParams(location.search).get("borrador") === "1") {
    try {
      const b = JSON.parse(localStorage.getItem(TIENDA.claveBorrador) || "null");
      if (Array.isArray(b)) return b;
    } catch (e) { /* sin borrador */ }
  }
  try {
    const r = await fetch(enRaiz("productos.json"), { cache: "no-cache" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const datos = await r.json();
    if (!Array.isArray(datos)) throw new Error("Formato inválido");
    return datos;
  } catch (e) {
    if (Array.isArray(window.PRODUCTOS_RESPALDO)) return window.PRODUCTOS_RESPALDO;
    throw e;
  }
}

/* ---------- Formato ---------- */

function formatoCOP(n) {
  const v = Math.round(Number(n) || 0);
  return "$" + String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** Precio actual de un producto según la capacidad elegida. */
function precioDe(p, capIdx = 0) {
  const cap = (p.capacidades || [])[capIdx];
  const precio = cap ? cap.precio : p.precio;
  const antes = cap ? cap.precioAntes : p.precioAntes;
  return { precio, antes: antes && antes > precio ? antes : null };
}

function precioDesde(p) {
  const caps = p.capacidades || [];
  return caps.length ? Math.min(...caps.map(c => c.precio)) : p.precio;
}

function textoVariante(p, colorIdx = 0, capIdx = 0) {
  const c = (p.colores || [])[colorIdx];
  const k = (p.capacidades || [])[capIdx];
  return [c && c.nombre, k && k.nombre].filter(Boolean).join(", ");
}

/* ---------- WhatsApp ---------- */

function enlaceWhatsApp(texto) {
  return "https://wa.me/" + TIENDA.whatsapp + "?text=" + encodeURIComponent(texto);
}

function mensajeComprar(p, colorIdx, capIdx) {
  const v = textoVariante(p, colorIdx, capIdx);
  const { precio } = precioDe(p, capIdx);
  return `Hola, quiero comprar: ${p.nombre}${v ? " (" + v + ")" : ""} por ${formatoCOP(precio)}. ¿Cómo hago el pedido?`;
}

function mensajeConsultar(p, colorIdx, capIdx) {
  const v = textoVariante(p, colorIdx, capIdx);
  return `Hola, ¿tienen disponible ${p.nombre}${v ? " en " + v : ""}? Quisiera saber la disponibilidad y el tiempo de entrega.`;
}

function mensajeCarrito(items) {
  const lineas = items.map((it, i) =>
    `${i + 1}. ${it.nombre}${it.variante ? " (" + it.variante + ")" : ""} x${it.cant} - ${formatoCOP(it.precio)} c/u = ${formatoCOP(it.precio * it.cant)}`
  );
  return ["Hola, quiero hacer este pedido:", "", ...lineas, "", "Total: " + formatoCOP(totalCarrito(items))].join("\n");
}

/* ---------- Carrito (localStorage) ---------- */

function leerCarrito() {
  try {
    const c = JSON.parse(localStorage.getItem(TIENDA.claveCarrito) || "[]");
    return Array.isArray(c) ? c : [];
  } catch (e) { return []; }
}

function guardarCarrito(items) {
  try { localStorage.setItem(TIENDA.claveCarrito, JSON.stringify(items)); } catch (e) { /* almacenamiento bloqueado */ }
  pintarCarrito();
}

function totalCarrito(items) {
  return items.reduce((s, it) => s + it.precio * it.cant, 0);
}

function agregarAlCarrito(p, colorIdx = 0, capIdx = 0, cant = 1) {
  const items = leerCarrito();
  const color = (p.colores || [])[colorIdx];
  const cap = (p.capacidades || [])[capIdx];
  const clave = [p.id, color ? color.nombre : "", cap ? cap.nombre : ""].join("|");
  const existente = items.find(it => it.clave === clave);
  if (existente) existente.cant += cant;
  else items.push({
    clave, id: p.id, nombre: p.nombre,
    variante: textoVariante(p, colorIdx, capIdx),
    precio: precioDe(p, capIdx).precio,
    img: (color && color.img) || p.img,
    cant
  });
  guardarCarrito(items);
  abrirCarrito();
}

function cambiarCantidad(clave, delta) {
  const items = leerCarrito();
  const it = items.find(i => i.clave === clave);
  if (!it) return;
  it.cant += delta;
  guardarCarrito(it.cant <= 0 ? items.filter(i => i !== it) : items);
}

function quitarDelCarrito(clave) {
  guardarCarrito(leerCarrito().filter(i => i.clave !== clave));
}

/*
 * Punto de conexión para una pasarela de pago futura (Wompi o Mercado Pago).
 * No está implementado: hoy los pedidos se cierran por WhatsApp.
 *
 * async function checkout() {
 *   const items = leerCarrito();
 *   // 1. Enviar items y total a una función serverless,
 *   //    que cree la transacción con la llave privada de Wompi o Mercado Pago.
 *   //    Nunca poner llaves privadas en este archivo.
 *   // 2. Recibir la URL de pago o abrir el widget de la pasarela.
 *   // 3. Al volver con pago aprobado, vaciar el carrito: guardarCarrito([]);
 * }
 */

/* ---------- Íconos (SVG propios, trazo 1.75) ---------- */

const ICONO = {
  bolsa: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19.1L4 20Z"/><path d="M9.5 9.5c.3 2 2 4 4.5 4.6l1-1.2 1.6.8c-.4 1.1-1.3 1.6-2.3 1.5-3.2-.4-5.8-3.1-6-6.2 0-1 .5-1.8 1.5-2.1l.8 1.6-1.1 1Z"/></svg>',
  buscar: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>',
  menu: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>',
  cerrar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  menos: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>'
};

/* ---------- Encabezado, pie y carrito ---------- */

function montarMarco() {
  if (document.body.classList.contains("admin")) return; // el panel no lleva cabecera de tienda
  const enInicio = !document.body.classList.contains("legal") && /(^|\/)(index\.html)?$/.test(location.pathname);
  const base = enInicio ? "" : enRaiz("index.html");
  const enlaces = [
    ["Inicio", base + "#inicio"],
    ["iPhone", base + "#iphone"],
    ["PlayStation", base + "#playstation"],
    ["Accesorios", base + "#accesorios"],
    ["Smartwatch", base + "#smartwatch"],
    ["Ofertas", base + "#destacados"]
  ];
  const nav = enlaces.map(([t, h]) => `<li><a href="${h}">${t}</a></li>`).join("");

  const cab = document.createElement("header");
  cab.className = "cabecera";
  cab.innerHTML = `
    ${htmlFranja()}
    <div class="cabecera__fila contenedor">
      <a class="logo" href="${enRaiz("index.html")}" aria-label="${esc(TIENDA.nombre)}, ir al inicio">
        <span class="logo__marca" aria-hidden="true"></span><span class="logo__texto">${esc(TIENDA.nombre)}</span>
      </a>
      <nav class="nav" id="nav-principal" aria-label="Principal">
        <ul>${nav}</ul>
        <a class="nav__catalogo" href="${enRaiz("catalogo.html")}">Ver todo el catálogo</a>
        <a class="nav__catalogo" href="${enlaceWhatsApp("Hola, quiero información sobre sus productos.")}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
      </nav>
      <div class="cabecera__acciones">
        <a class="icono-btn" href="${enRaiz("catalogo.html")}" aria-label="Buscar productos">${ICONO.buscar}</a>
        <a class="icono-btn icono-btn--wa" href="${enlaceWhatsApp("Hola, quiero información sobre sus productos.")}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${ICONO.chat}</a>
        <button class="icono-btn" type="button" data-abrir-carrito aria-label="Abrir carrito, 0 productos">
          ${ICONO.bolsa}<span class="contador" data-contador hidden>0</span>
        </button>
        <button class="icono-btn menu-btn" type="button" aria-expanded="false" aria-controls="nav-principal" aria-label="Abrir menú">${ICONO.menu}</button>
      </div>
    </div>`;
  const saltar = document.querySelector(".saltar");
  if (saltar) saltar.after(cab); else document.body.prepend(cab);

  const menuBtn = cab.querySelector(".menu-btn");
  const navEl = cab.querySelector(".nav");
  const cerrarMenu = () => {
    navEl.classList.remove("abierto");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.setAttribute("aria-label", "Abrir menú");
    menuBtn.innerHTML = ICONO.menu;
    document.body.classList.remove("sin-scroll");
  };
  menuBtn.addEventListener("click", () => {
    const abierto = navEl.classList.toggle("abierto");
    menuBtn.setAttribute("aria-expanded", String(abierto));
    menuBtn.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
    menuBtn.innerHTML = abierto ? ICONO.cerrar : ICONO.menu;
    document.body.classList.toggle("sin-scroll", abierto);
  });
  navEl.addEventListener("click", e => { if (e.target.closest("a")) cerrarMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && navEl.classList.contains("abierto")) { cerrarMenu(); menuBtn.focus(); } });

  const sombra = () => cab.classList.toggle("con-borde", window.scrollY > 8);
  window.addEventListener("scroll", sombra, { passive: true });
  sombra();

  // Carrito lateral
  const capa = document.createElement("div");
  capa.className = "carrito-capa";
  capa.hidden = true;
  capa.innerHTML = `
    <aside class="carrito" role="dialog" aria-modal="true" aria-labelledby="carrito-titulo" tabindex="-1">
      <div class="carrito__cabeza">
        <h2 id="carrito-titulo">Tu carrito</h2>
        <button class="icono-btn" type="button" data-cerrar-carrito aria-label="Cerrar carrito">${ICONO.cerrar}</button>
      </div>
      <div class="carrito__cuerpo" data-carrito-lista></div>
      <div class="carrito__pie" data-carrito-pie>
        <div class="carrito__total"><span>Total <small>(IVA incluido)</small></span><strong data-carrito-total>$0</strong></div>
        <p class="carrito__nota">Envías el pedido por WhatsApp y te confirmamos disponibilidad, envío y forma de pago.</p>
        <a class="btn btn--primario btn--bloque" data-finalizar target="_blank" rel="noopener" href="#">${ICONO.chat}<span>Finalizar por WhatsApp</span></a>
        <p class="carrito__acepto">Al continuar aceptas los <a href="${enRaiz(LEGAL.terminos)}">Términos</a> y la <a href="${enRaiz(LEGAL.privacidad)}">Política de datos</a>.</p>
      </div>
    </aside>`;
  document.body.append(capa);
  capa.addEventListener("click", e => {
    if (e.target === capa || e.target.closest("[data-cerrar-carrito]")) cerrarCarrito();
    const b = e.target.closest("[data-accion]");
    if (!b) return;
    const clave = b.dataset.clave;
    if (b.dataset.accion === "sumar") cambiarCantidad(clave, 1);
    if (b.dataset.accion === "restar") cambiarCantidad(clave, -1);
    if (b.dataset.accion === "quitar") quitarDelCarrito(clave);
  });
  document.addEventListener("click", e => { if (e.target.closest("[data-abrir-carrito]")) abrirCarrito(); });
  document.addEventListener("keydown", e => {
    if (capa.hidden) return;
    if (e.key === "Escape") cerrarCarrito();
    if (e.key === "Tab") atraparFoco(e, capa.querySelector(".carrito"));
  });

  // Pie
  const pie = document.createElement("footer");
  pie.className = "pie";
  pie.innerHTML = `
    <div class="contenedor pie__grid">
      <div>
        <p class="pie__marca">${esc(TIENDA.nombre)}</p>
        <p>iPhone, PlayStation, accesorios y wearables. Asesoría y pedidos por WhatsApp.</p>
        <a class="btn btn--secundario" href="${enlaceWhatsApp("Hola, quiero información sobre sus productos.")}" target="_blank" rel="noopener">${ICONO.chat}<span>Escríbenos por WhatsApp</span></a>
      </div>
      <nav aria-label="Categorías"><p class="pie__titulo">Tienda</p><ul>
        ${Object.entries(CATEGORIAS).map(([k, v]) => `<li><a href="${enRaiz("catalogo.html?cat=" + k)}">${v}</a></li>`).join("")}
        <li><a href="${enRaiz("catalogo.html?oferta=1")}">Ofertas</a></li>
      </ul></nav>
      <nav aria-label="Ayuda"><p class="pie__titulo">Ayuda</p><ul>
        <li><a href="${enRaiz("catalogo.html")}">Buscar productos</a></li>
        <li><a href="${enRaiz(LEGAL.garantias)}">Garantías y envíos</a></li>
        <li><a href="${LEGAL.sic}" target="_blank" rel="noopener">Quejas ante la SIC</a></li>
      </ul></nav>
      <nav aria-label="Legal"><p class="pie__titulo">Legal</p><ul>
        <li><a href="${enRaiz(LEGAL.terminos)}">Términos y condiciones</a></li>
        <li><a href="${enRaiz(LEGAL.privacidad)}">Política de datos personales</a></li>
        <li><a href="${enRaiz(LEGAL.garantias)}">Garantías y retracto</a></li>
      </ul></nav>
    </div>
    <div class="contenedor pie__legal">
      <p><strong>Precios con IVA incluido · Precios de referencia.</strong> Son de ejemplo, están en pesos colombianos y pueden cambiar. Confirma el valor final por WhatsApp antes de pagar.</p>
      <p>${esc(TIENDA.razonSocial)} · NIT ${esc(TIENDA.nit)} · ${esc(TIENDA.direccion)} · ${esc(TIENDA.correo)} · WhatsApp +57 ${esc(TIENDA.whatsapp.slice(2))}</p>
      <p>iPhone y Apple son marcas de Apple Inc. PlayStation y DualSense son marcas de Sony Interactive Entertainment. Esta tienda es un revendedor independiente: no está afiliada a Apple ni a Sony ni es su distribuidor oficial. Fotos de referencia de Pexels.</p>
      <p>Sin cookies de rastreo ni analítica: el carrito se guarda solo en tu navegador (almacenamiento local). <a href="${enRaiz(LEGAL.privacidad)}#almacenamiento">Más información</a>.</p>
      <p>Para quejas, escríbenos primero. También puedes acudir a la <a href="${LEGAL.sic}" target="_blank" rel="noopener">Superintendencia de Industria y Comercio (SIC)</a>.</p>
    </div>`;
  document.body.append(pie);

  pintarCarrito();
  window.addEventListener("storage", e => { if (e.key === TIENDA.claveCarrito) pintarCarrito(); });
}

/** Franja de vista previa: va dentro de la cabecera, que es sticky, así queda fija arriba. */
function htmlFranja() {
  return `<p class="franja-previa">Vista previa · precios y productos de ejemplo</p>`;
}

let focoAntesDelCarrito = null;

function abrirCarrito() {
  const capa = document.querySelector(".carrito-capa");
  if (!capa || !capa.hidden) return;
  focoAntesDelCarrito = document.activeElement;
  capa.hidden = false;
  document.body.classList.add("sin-scroll");
  requestAnimationFrame(() => {
    capa.classList.add("abierta");
    capa.querySelector(".carrito").focus();
  });
}

function cerrarCarrito() {
  const capa = document.querySelector(".carrito-capa");
  if (!capa || capa.hidden) return;
  capa.classList.remove("abierta");
  document.body.classList.remove("sin-scroll");
  const fin = () => { capa.hidden = true; };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) fin();
  else setTimeout(fin, 260);
  if (focoAntesDelCarrito && focoAntesDelCarrito.focus) focoAntesDelCarrito.focus();
}

function atraparFoco(e, cont) {
  const f = [...cont.querySelectorAll('a[href],button:not([disabled]),input,select,[tabindex="-1"]')].filter(el => el.offsetParent !== null || el === cont);
  if (!f.length) return;
  const primero = f[0], ultimo = f[f.length - 1];
  if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
}

function pintarCarrito() {
  const items = leerCarrito();
  const n = items.reduce((s, it) => s + it.cant, 0);
  document.querySelectorAll("[data-contador]").forEach(el => { el.textContent = n; el.hidden = n === 0; });
  document.querySelectorAll("[data-abrir-carrito]").forEach(b => b.setAttribute("aria-label", `Abrir carrito, ${n} ${n === 1 ? "producto" : "productos"}`));
  const lista = document.querySelector("[data-carrito-lista]");
  const pie = document.querySelector("[data-carrito-pie]");
  if (!lista) return;
  if (!items.length) {
    lista.innerHTML = `<div class="carrito__vacio"><p>Tu carrito está vacío.</p><p>Elige un producto y aparecerá aquí.</p><a class="btn btn--secundario" href="${enRaiz("catalogo.html")}">Explorar productos</a></div>`;
    pie.hidden = true;
    return;
  }
  pie.hidden = false;
  lista.innerHTML = `<ul class="carrito__items">${items.map(it => `
    <li class="item">
      <img src="${esc(enRaiz(it.img))}" alt="" width="72" height="72" loading="lazy">
      <div class="item__info">
        <a class="item__nombre" href="${enRaiz("producto.html")}?id=${encodeURIComponent(it.id)}">${esc(it.nombre)}</a>
        ${it.variante ? `<p class="item__variante">${esc(it.variante)}</p>` : ""}
        <p class="item__precio">${formatoCOP(it.precio * it.cant)}</p>
        <div class="item__controles">
          <div class="cantidad" role="group" aria-label="Cantidad de ${esc(it.nombre)}">
            <button type="button" data-accion="restar" data-clave="${esc(it.clave)}" aria-label="Restar uno">${ICONO.menos}</button>
            <output aria-live="polite">${it.cant}</output>
            <button type="button" data-accion="sumar" data-clave="${esc(it.clave)}" aria-label="Sumar uno">${ICONO.mas}</button>
          </div>
          <button type="button" class="enlace-quitar" data-accion="quitar" data-clave="${esc(it.clave)}">Quitar</button>
        </div>
      </div>
    </li>`).join("")}</ul>`;
  document.querySelector("[data-carrito-total]").textContent = formatoCOP(totalCarrito(items));
  document.querySelector("[data-finalizar]").href = enlaceWhatsApp(mensajeCarrito(items));
}

/* ---------- Tarjetas de producto ---------- */

function insignias(p) {
  const b = [];
  if (!p.disponible) b.push('<span class="insignia insignia--agotado">Agotado</span>');
  if (p.oferta) b.push('<span class="insignia insignia--oferta">Oferta</span>');
  if (p.nuevo) b.push('<span class="insignia insignia--nuevo">Nuevo</span>');
  if (p.masVendido) b.push('<span class="insignia">Más vendido</span>');
  return b.length ? `<div class="insignias">${b.join("")}</div>` : "";
}

function htmlPrecio(p, capIdx = 0) {
  const { precio, antes } = precioDe(p, capIdx);
  return `<span class="precio__actual">${formatoCOP(precio)}</span>${antes ? `<s class="precio__antes"><span class="sr">Antes </span>${formatoCOP(antes)}</s>` : ""}`;
}

function htmlSelectores(p, uid) {
  const colores = p.colores || [];
  const caps = p.capacidades || [];
  let h = "";
  if (colores.length > 1) {
    h += `<div class="selector" role="group" aria-label="Color">
      <p class="selector__etiqueta">Color: <span data-nombre-color>${esc(colores[0].nombre)}</span></p>
      <div class="muestras">${colores.map((c, i) => `<button type="button" class="muestra" style="--c:${esc(c.hex)}" data-color="${i}" aria-pressed="${i === 0}" aria-label="${esc(c.nombre)}"></button>`).join("")}</div>
    </div>`;
  }
  if (caps.length > 1) {
    h += `<div class="selector" role="group" aria-label="Capacidad">
      <div class="chips">${caps.map((c, i) => `<button type="button" class="chip" data-cap="${i}" aria-pressed="${i === 0}">${esc(c.nombre)}</button>`).join("")}</div>
    </div>`;
  } else if (caps.length === 1) {
    h += `<p class="selector__etiqueta">${esc(caps[0].nombre)}</p>`;
  }
  return h;
}

/**
 * Tarjeta de producto con selector de color y capacidad.
 * tipo: "lanzamiento" (grande, sección iPhone), "normal", "compacta".
 */
function tarjetaProducto(p, tipo = "normal") {
  const enlace = `producto.html?id=${encodeURIComponent(p.id)}`;
  const art = document.createElement("article");
  art.className = `tarjeta tarjeta--${tipo}${p.disponible ? "" : " tarjeta--agotada"}`;
  art.dataset.id = p.id;
  art.innerHTML = `
    <a class="tarjeta__media" href="${enlace}" tabindex="-1" aria-hidden="true">
      <img src="${esc(p.img)}" alt="" width="800" height="600">
      <span class="tono"></span>
    </a>
    ${insignias(p)}
    <div class="tarjeta__cuerpo">
      <h3 class="tarjeta__nombre"><a href="${enlace}">${esc(p.nombre)}</a></h3>
      ${tipo !== "compacta" ? `<p class="tarjeta__sub">${esc(p.subtitulo)}</p>` : ""}
      ${tipo !== "compacta" ? htmlSelectores(p) : ""}
      <p class="precio" aria-live="polite">${(p.capacidades || []).length > 1 && tipo === "compacta" ? '<span class="precio__desde">Desde</span>' : ""}${htmlPrecio(p)}</p>
      <div class="tarjeta__acciones">
        ${p.disponible
          ? `<a class="btn btn--primario" data-wa="comprar" target="_blank" rel="noopener" href="#">Comprar por WhatsApp</a>
             <button type="button" class="icono-btn icono-btn--borde" data-agregar aria-label="Agregar ${esc(p.nombre)} al carrito">${ICONO.bolsa}</button>`
          : ""}
        <a class="btn btn--texto" data-wa="consultar" target="_blank" rel="noopener" href="#">Consultar disponibilidad</a>
      </div>
    </div>`;
  activarVariantes(art, p);
  return art;
}

/** Conecta selectores de color/capacidad, foto, tono, precio y enlaces de una tarjeta o ficha. */
function activarVariantes(raiz, p, alCambiar) {
  const estado = { color: 0, cap: 0 };
  const img = raiz.querySelector(".tarjeta__media img, .ficha__media img");
  const tono = raiz.querySelector(".tono");
  const precioEl = raiz.querySelector(".precio");
  const nombreColor = raiz.querySelector("[data-nombre-color]");
  const desde = raiz.querySelector(".precio__desde");

  function actualizar() {
    const c = (p.colores || [])[estado.color];
    const foto = (c && c.img) || p.img;
    if (img && img.getAttribute("src") !== foto) {
      img.classList.add("cambiando");
      const nueva = new Image();
      nueva.onload = nueva.onerror = () => { img.src = foto; img.classList.remove("cambiando"); };
      nueva.src = foto;
    }
    if (tono) {
      tono.style.setProperty("--tono", c ? c.hex : "transparent");
      tono.classList.toggle("activo", !!(c && !c.img));
    }
    if (nombreColor && c) nombreColor.textContent = c.nombre;
    if (precioEl) precioEl.innerHTML = (desde ? desde.outerHTML : "") + htmlPrecio(p, estado.cap);
    raiz.querySelectorAll("[data-wa=comprar]").forEach(a => a.href = enlaceWhatsApp(mensajeComprar(p, estado.color, estado.cap)));
    raiz.querySelectorAll("[data-wa=consultar]").forEach(a => a.href = enlaceWhatsApp(mensajeConsultar(p, estado.color, estado.cap)));
    if (alCambiar) alCambiar(estado);
  }

  raiz.addEventListener("click", e => {
    const bc = e.target.closest("[data-color]");
    const bk = e.target.closest("[data-cap]");
    if (bc) {
      estado.color = +bc.dataset.color;
      raiz.querySelectorAll("[data-color]").forEach(b => b.setAttribute("aria-pressed", String(b === bc)));
      actualizar();
    }
    if (bk) {
      estado.cap = +bk.dataset.cap;
      raiz.querySelectorAll("[data-cap]").forEach(b => b.setAttribute("aria-pressed", String(b === bk)));
      actualizar();
    }
    if (e.target.closest("[data-agregar]")) agregarAlCarrito(p, estado.color, estado.cap);
  });
  actualizar();
  return estado;
}

/* ---------- Animación de aparición ---------- */

function activarAparicion() {
  const els = document.querySelectorAll("[data-aparecer]");
  if (!("IntersectionObserver" in window) || matchMedia("(prefers-reduced-motion: reduce)").matches) {
    els.forEach(el => el.classList.add("visible"));
    return;
  }
  const io = new IntersectionObserver(entradas => {
    entradas.forEach(en => {
      if (en.isIntersecting) { en.target.classList.add("visible"); io.unobserve(en.target); }
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.12 });
  els.forEach(el => io.observe(el));
}

function errorDeCarga(cont) {
  cont.innerHTML = `<div class="aviso"><p><strong>No se pudieron cargar los productos.</strong></p>
    <p>Revisa que <code>productos.json</code> o <code>productos.js</code> estén en la misma carpeta que esta página y recarga.</p></div>`;
}

document.documentElement.classList.add("js");
// Solo para capturas de pantalla de página completa: ?alto=800 fija la altura de "una pantalla" del hero.
{
  const alto = parseInt(new URLSearchParams(location.search).get("alto"), 10);
  if (alto > 300) document.documentElement.style.setProperty("--alto-pantalla", alto + "px");
}
document.addEventListener("DOMContentLoaded", montarMarco);
