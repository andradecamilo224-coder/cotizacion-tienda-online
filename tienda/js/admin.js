/* ==========================================================================
   admin.js — panel para editar productos sin servidor.
   1. Carga el borrador de localStorage; si no hay, carga productos.json (o el respaldo productos.js).
   2. Cada cambio se guarda solo como borrador en este navegador.
   3. "Descargar productos.json" genera el archivo para reemplazarlo y subir el sitio a Netlify.
   ========================================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  const $ = s => document.querySelector(s);
  const estadoEl = $("[data-estado]");
  const filas = $("[data-filas]");
  const editor = $("[data-editor]");
  const form = $("[data-form]");
  const errorEl = $("[data-error]");
  let productos = [];
  let editando = null; // índice del producto abierto en el editor
  let desdeBorrador = false;

  function estado(txt) { estadoEl.textContent = txt; }

  try {
    const b = JSON.parse(localStorage.getItem(TIENDA.claveBorrador) || "null");
    if (Array.isArray(b)) { productos = b; desdeBorrador = true; }
  } catch (e) { /* sin borrador */ }
  if (!desdeBorrador) {
    try {
      const r = await fetch("productos.json", { cache: "no-cache" });
      if (!r.ok) throw new Error();
      productos = await r.json();
    } catch (e) {
      productos = JSON.parse(JSON.stringify(window.PRODUCTOS_RESPALDO || []));
    }
  }
  estado(desdeBorrador ? "Mostrando tu borrador guardado" : "Sin cambios: igual al archivo");

  function guardarBorrador() {
    try {
      localStorage.setItem(TIENDA.claveBorrador, JSON.stringify(productos));
      const h = new Date().toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
      estado(`Borrador guardado (${h}). Falta descargar el archivo.`);
    } catch (e) {
      estado("No se pudo guardar el borrador en este navegador. Descarga el archivo antes de cerrar.");
    }
  }

  /** Mantiene coherentes precio/precioAntes con la primera capacidad. */
  function normalizar(p) {
    const caps = p.capacidades || [];
    if (caps.length) {
      p.precio = caps[0].precio;
      p.precioAntes = caps[0].precioAntes || null;
    }
    p.precioEjemplo = p.precioEjemplo !== false;
    return p;
  }

  const num = v => {
    const n = parseInt(String(v ?? "").replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : null;
  };

  /* ---------- Tabla ---------- */
  function pintarTabla() {
    const q = $("#buscar-admin").value.trim().toLowerCase();
    $("[data-total]").textContent = `(${productos.length})`;
    filas.innerHTML = productos.map((p, i) => {
      if (q && !p.nombre.toLowerCase().includes(q)) return "";
      const caps = p.capacidades || [];
      const precio = caps.length ? caps[0].precio : p.precio;
      return `<tr data-i="${i}">
        <th scope="row"><div class="celda-prod"><img src="${esc(p.img)}" alt="" width="44" height="44" loading="lazy"><span>${esc(p.nombre)}${caps.length ? `<small>${esc(caps[0].nombre)}</small>` : ""}</span></div></th>
        <td>${esc(CATEGORIAS[p.categoria] || p.categoria)}</td>
        <td><label class="sr" for="precio-${i}">Precio de ${esc(p.nombre)}</label>
          <div class="precio-campo"><span aria-hidden="true">$</span><input id="precio-${i}" data-precio-rapido inputmode="numeric" value="${precio}"></div>
          <small class="formateado">${formatoCOP(precio)}</small></td>
        <td><label class="interruptor"><input type="checkbox" data-disp-rapido ${p.disponible ? "checked" : ""}><span class="sr">${esc(p.nombre)} disponible</span><span aria-hidden="true"></span></label></td>
        <td class="acciones-celda"><button class="btn btn--texto" type="button" data-editar>Editar</button></td>
      </tr>`;
    }).join("");
  }

  filas.addEventListener("change", e => {
    const tr = e.target.closest("tr");
    if (!tr) return;
    const p = productos[+tr.dataset.i];
    if (e.target.matches("[data-precio-rapido]")) {
      const v = num(e.target.value);
      if (!v) { e.target.setCustomValidity("Escribe un precio en números"); e.target.reportValidity(); return; }
      e.target.setCustomValidity("");
      if ((p.capacidades || []).length) p.capacidades[0].precio = v; else p.precio = v;
      normalizar(p);
      tr.querySelector(".formateado").textContent = formatoCOP(v);
      guardarBorrador();
    }
    if (e.target.matches("[data-disp-rapido]")) {
      p.disponible = e.target.checked;
      guardarBorrador();
    }
  });
  filas.addEventListener("click", e => {
    if (e.target.closest("[data-editar]")) abrirEditor(+e.target.closest("tr").dataset.i);
  });
  $("#buscar-admin").addEventListener("input", pintarTabla);

  /* ---------- Editor ---------- */
  function filaCap(c = {}) {
    return `<div class="fila-var">
      <label>Nombre<input data-k="nombre" value="${esc(c.nombre || "")}" placeholder="256 GB"></label>
      <label>Precio<input data-k="precio" inputmode="numeric" value="${c.precio ?? ""}"></label>
      <label>Precio antes<input data-k="precioAntes" inputmode="numeric" value="${c.precioAntes ?? ""}"></label>
      <button class="btn btn--texto peligro" type="button" data-quitar-fila>Quitar</button>
    </div>`;
  }
  function filaColor(c = {}) {
    return `<div class="fila-var">
      <label>Nombre<input data-k="nombre" value="${esc(c.nombre || "")}" placeholder="Azul"></label>
      <label>Tono<input data-k="hex" type="color" value="${esc(c.hex || "#cccccc")}"></label>
      <label>Foto (opcional)<input data-k="img" value="${esc(c.img || "")}" placeholder="img/archivo.jpg"></label>
      <button class="btn btn--texto peligro" type="button" data-quitar-fila>Quitar</button>
    </div>`;
  }

  function abrirEditor(i) {
    editando = i;
    const p = productos[i];
    errorEl.textContent = "";
    $("#editor-titulo").textContent = p.nombre ? `Editar: ${p.nombre}` : "Nuevo producto";
    ["nombre", "categoria", "img", "subtitulo", "descripcion"].forEach(k => form[k].value = p[k] || "");
    form.slug.value = p.id || "";
    form.precio.value = p.precio ?? "";
    form.precioAntes.value = p.precioAntes ?? "";
    form.specs.value = (p.specs || []).join("\n");
    ["disponible", "nuevo", "masVendido", "oferta", "enInicio"].forEach(k => form[k].checked = !!p[k]);
    $("[data-caps]").innerHTML = (p.capacidades || []).map(filaCap).join("");
    $("[data-colores]").innerHTML = (p.colores || []).map(filaColor).join("");
    editor.hidden = false;
    editor.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    $("#editor-titulo").focus({ preventScroll: true });
  }

  function cerrarEditor() {
    editor.hidden = true;
    editando = null;
  }

  editor.addEventListener("click", e => {
    if (e.target.closest("[data-quitar-fila]")) e.target.closest(".fila-var").remove();
    if (e.target.closest("[data-mas-cap]")) $("[data-caps]").insertAdjacentHTML("beforeend", filaCap());
    if (e.target.closest("[data-mas-color]")) $("[data-colores]").insertAdjacentHTML("beforeend", filaColor());
    if (e.target.closest("[data-cerrar-editor]")) cerrarEditor();
    if (e.target.closest("[data-borrar]") && editando !== null) {
      const p = productos[editando];
      if (confirm(`¿Borrar "${p.nombre}" del catálogo? Puedes deshacerlo con "Descartar borrador" mientras no descargues el archivo.`)) {
        productos.splice(editando, 1);
        cerrarEditor();
        pintarTabla();
        guardarBorrador();
      }
    }
  });

  form.addEventListener("submit", e => {
    e.preventDefault();
    const leer = sel => [...form.querySelectorAll(sel + " .fila-var")].map(f => {
      const o = {};
      f.querySelectorAll("[data-k]").forEach(inp => o[inp.dataset.k] = inp.value.trim());
      return o;
    });
    const caps = leer("[data-caps]").filter(c => c.nombre).map(c => {
      const o = { nombre: c.nombre, precio: num(c.precio) };
      const a = num(c.precioAntes);
      if (a) o.precioAntes = a;
      return o;
    });
    const colores = leer("[data-colores]").filter(c => c.nombre).map(c => {
      const o = { nombre: c.nombre, hex: c.hex };
      if (c.img) o.img = c.img;
      return o;
    });

    // Validación
    const errores = [];
    const id = form.slug.value.trim();
    if (!form.nombre.value.trim()) errores.push("Falta el nombre.");
    if (!/^[a-z0-9-]+$/.test(id)) errores.push("El ID solo puede tener minúsculas, números y guiones.");
    if (productos.some((x, j) => x.id === id && j !== editando)) errores.push("Ya existe otro producto con ese ID.");
    if (caps.some(c => !c.precio)) errores.push("Cada capacidad necesita un precio en números.");
    if (!caps.length && !num(form.precio.value)) errores.push("Escribe el precio, o agrega al menos una capacidad con precio.");
    if (errores.length) { errorEl.textContent = errores.join(" "); return; }
    errorEl.textContent = "";

    const p = productos[editando];
    Object.assign(p, {
      id,
      nombre: form.nombre.value.trim(),
      categoria: form.categoria.value,
      img: form.img.value.trim(),
      subtitulo: form.subtitulo.value.trim(),
      descripcion: form.descripcion.value.trim(),
      precio: num(form.precio.value) || 0,
      precioAntes: num(form.precioAntes.value),
      specs: form.specs.value.split("\n").map(s => s.trim()).filter(Boolean),
      capacidades: caps,
      colores,
      disponible: form.disponible.checked,
      nuevo: form.nuevo.checked,
      masVendido: form.masVendido.checked,
      oferta: form.oferta.checked,
      enInicio: form.enInicio.checked
    });
    normalizar(p);
    pintarTabla();
    guardarBorrador();
    $("#editor-titulo").textContent = `Editar: ${p.nombre}`;
    estado(`Guardado "${p.nombre}" en el borrador. Falta descargar el archivo.`);
  });

  $("[data-agregar-producto]").addEventListener("click", () => {
    productos.unshift({
      id: "producto-nuevo-" + Date.now().toString(36), nombre: "", categoria: "accesorios", subtitulo: "", descripcion: "",
      img: "", colores: [], capacidades: [], precio: 0, precioAntes: null,
      disponible: true, nuevo: true, masVendido: false, oferta: false, enInicio: false, precioEjemplo: true, specs: []
    });
    pintarTabla();
    abrirEditor(0);
  });

  /* ---------- Archivos ---------- */
  function descargar(nombre, contenido, tipo) {
    const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
    const a = document.createElement("a");
    a.href = url; a.download = nombre;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const jsonActual = () => JSON.stringify(productos.map(normalizar), null, 2);

  document.querySelectorAll("[data-descargar-json]").forEach(b => b.addEventListener("click", () => {
    descargar("productos.json", jsonActual() + "\n", "application/json");
    estado("Descargado productos.json. Reemplázalo en la carpeta sitio/ y súbela a Netlify.");
  }));
  $("[data-descargar-js]").addEventListener("click", () => {
    descargar("productos.js",
      "// Respaldo de productos.json para abrir el sitio con doble clic (file://), donde fetch no funciona.\n" +
      "// Mantener igual a productos.json: el admin descarga los dos archivos.\n" +
      "window.PRODUCTOS_RESPALDO = " + jsonActual() + ";\n", "text/javascript");
    estado("Descargado productos.js. Reemplázalo en la carpeta sitio/.");
  });
  $("[data-descartar]").addEventListener("click", () => {
    if (!confirm("¿Descartar todos los cambios del borrador y volver a los productos del archivo?")) return;
    try { localStorage.removeItem(TIENDA.claveBorrador); } catch (e) { /* nada */ }
    location.reload();
  });

  pintarTabla();
});
