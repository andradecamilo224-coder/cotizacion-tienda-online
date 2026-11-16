/* Página de inicio: en cada sección muestra solo los productos estrella
   (campo "enInicio" en productos.json, máximo 3) y un botón "Ver todos" al catálogo filtrado. */
const MAX_POR_SECCION = 3;

document.addEventListener("DOMContentLoaded", async () => {
  let productos;
  try {
    productos = await cargarProductos();
  } catch (e) {
    errorDeCarga(document.querySelector("[data-lista=iphone]"));
    return;
  }

  const deCat = cat => productos.filter(p => p.categoria === cat);
  /** Primero los marcados para el inicio y disponibles; si faltan, completa con el resto. */
  const estrellas = (lista, n) => {
    const orden = [...lista].sort((a, b) => (!!b.enInicio - !!a.enInicio) || (b.disponible - a.disponible));
    return orden.slice(0, n);
  };
  const mostrados = new Set();
  const poner = (cont, lista, tipo) => lista.forEach(p => { mostrados.add(p.id); cont.append(tarjetaProducto(p, tipo)); });

  // C. iPhone: un modelo en grande, estilo lanzamiento, y debajo otros tres
  const iphones = estrellas(deCat("iphone"), MAX_POR_SECCION + 1);
  if (iphones.length) {
    mostrados.add(iphones[0].id);
    document.querySelector("[data-estelar]").append(tarjetaProducto(iphones[0], "lanzamiento"));
    poner(document.querySelector("[data-lista=iphone]"), iphones.slice(1), "lanzamiento");
  }

  // D, E, F
  ["playstation", "accesorios", "smartwatch"].forEach(cat =>
    poner(document.querySelector(`[data-lista=${cat}]`), estrellas(deCat(cat), MAX_POR_SECCION), "normal"));

  // "Ver todos (n)" con el número real de productos de la categoría
  document.querySelectorAll("[data-ver-todos]").forEach(a => {
    const n = deCat(a.dataset.verTodos).length;
    if (n) a.textContent += ` (${n})`;
  });

  // G. Destacados con pestañas: prefiere productos que no aparecen arriba
  const panel = document.querySelector("[data-destacados]");
  const tabs = [...document.querySelectorAll(".pestana")];
  const verMas = document.querySelector("[data-ver-destacados]");
  const textos = { oferta: "Ver todas las ofertas", nuevo: "Ver todo el catálogo", masVendido: "Ver todo el catálogo" };
  function mostrar(filtro) {
    tabs.forEach(t => {
      const activa = t.dataset.filtro === filtro;
      t.setAttribute("aria-selected", String(activa));
      t.tabIndex = activa ? 0 : -1;
      if (activa) panel.setAttribute("aria-labelledby", t.id);
    });
    const candidatos = productos.filter(p => p[filtro] && p.disponible);
    const lista = [...candidatos.filter(p => !mostrados.has(p.id)), ...candidatos.filter(p => mostrados.has(p.id))].slice(0, MAX_POR_SECCION);
    panel.innerHTML = "";
    lista.forEach(p => panel.append(tarjetaProducto(p, "compacta")));
    if (verMas) {
      verMas.textContent = textos[filtro];
      verMas.href = filtro === "oferta" ? "catalogo.html?oferta=1" : "catalogo.html";
    }
  }
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => mostrar(t.dataset.filtro));
    t.addEventListener("keydown", e => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const sig = tabs[(i + d + tabs.length) % tabs.length];
      sig.focus();
      mostrar(sig.dataset.filtro);
    });
  });
  mostrar("oferta");
  document.querySelectorAll("[data-ir-pestana]").forEach(a => a.addEventListener("click", () => mostrar(a.dataset.irPestana)));

  activarAparicion();
});
