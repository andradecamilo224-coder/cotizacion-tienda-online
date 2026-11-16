/* Catálogo: buscador y filtros por categoría, precio y disponibilidad. Lee y escribe la URL (?q=&cat=&max=&disp=1&oferta=1). */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("filtros");
  const res = document.querySelector("[data-resultados]");
  const conteo = document.querySelector("[data-conteo]");
  const orden = document.getElementById("orden");
  const max = form.max;
  const maxValor = document.getElementById("max-valor");

  let productos;
  try { productos = await cargarProductos(); }
  catch (e) { errorDeCarga(res); return; }

  // Tope del rango según el producto más caro
  const tope = Math.ceil(Math.max(...productos.map(precioDesde)) / 100000) * 100000;
  max.max = tope;

  // Estado inicial desde la URL
  const u = new URLSearchParams(location.search);
  form.q.value = u.get("q") || "";
  const cat = u.get("cat") || "";
  const radio = form.querySelector(`input[name=cat][value="${CSS.escape(cat)}"]`);
  if (radio) radio.checked = true;
  max.value = u.get("max") || tope;
  form.disp.checked = u.get("disp") === "1";
  form.oferta.checked = u.get("oferta") === "1";
  orden.value = u.get("orden") || "relevancia";

  const normal = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  function aplicar() {
    const q = normal(form.q.value.trim());
    const c = form.querySelector("input[name=cat]:checked").value;
    const m = +max.value;
    maxValor.textContent = m >= tope ? "Sin límite" : "Hasta " + formatoCOP(m);

    let lista = productos.filter(p => {
      const texto = normal([p.nombre, p.subtitulo, p.descripcion, CATEGORIAS[p.categoria], ...(p.colores || []).map(x => x.nombre), ...(p.capacidades || []).map(x => x.nombre)].join(" "));
      return (!q || q.split(/\s+/).every(w => texto.includes(w)))
        && (!c || p.categoria === c)
        && precioDesde(p) <= m
        && (!form.disp.checked || p.disponible)
        && (!form.oferta.checked || p.oferta);
    });

    const o = orden.value;
    if (o === "menor") lista.sort((a, b) => precioDesde(a) - precioDesde(b));
    if (o === "mayor") lista.sort((a, b) => precioDesde(b) - precioDesde(a));
    if (o === "nombre") lista.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (o === "relevancia") lista.sort((a, b) => (b.disponible - a.disponible) || ((b.nuevo + b.masVendido + b.oferta) - (a.nuevo + a.masVendido + a.oferta)));

    res.innerHTML = "";
    if (!lista.length) {
      res.innerHTML = `<div class="vacio" style="grid-column:1/-1"><p>No hay productos con esos filtros.</p><p>Prueba otra palabra o sube el precio máximo.</p><button class="btn btn--primario" type="button" data-limpiar>Limpiar filtros</button></div>`;
    } else {
      lista.forEach(p => res.append(tarjetaProducto(p, "normal")));
    }
    conteo.textContent = `${lista.length} ${lista.length === 1 ? "producto" : "productos"}`;

    // Guardar filtros en la URL sin recargar
    const nu = new URLSearchParams();
    if (form.q.value.trim()) nu.set("q", form.q.value.trim());
    if (c) nu.set("cat", c);
    if (m < tope) nu.set("max", m);
    if (form.disp.checked) nu.set("disp", "1");
    if (form.oferta.checked) nu.set("oferta", "1");
    if (o !== "relevancia") nu.set("orden", o);
    if (u.get("borrador") === "1") nu.set("borrador", "1");
    history.replaceState(null, "", location.pathname + (nu.toString() ? "?" + nu : ""));
  }

  let t;
  form.addEventListener("input", e => {
    if (e.target === form.q) { clearTimeout(t); t = setTimeout(aplicar, 150); }
    else aplicar();
  });
  orden.addEventListener("change", aplicar);
  document.addEventListener("click", e => {
    if (!e.target.closest("[data-limpiar]")) return;
    form.reset();
    max.value = tope;
    orden.value = "relevancia";
    aplicar();
    form.q.focus();
  });

  const btnF = document.querySelector(".btn-filtros");
  btnF.addEventListener("click", () => {
    const ab = form.classList.toggle("abiertos");
    btnF.setAttribute("aria-expanded", String(ab));
  });

  aplicar();
});
