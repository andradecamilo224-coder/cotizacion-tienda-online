/* Ficha de producto: producto.html?id=... */
document.addEventListener("DOMContentLoaded", async () => {
  const main = document.querySelector("[data-ficha]");
  let productos;
  try { productos = await cargarProductos(); }
  catch (e) { errorDeCarga(main); return; }

  const id = new URLSearchParams(location.search).get("id");
  const p = productos.find(x => x.id === id);
  if (!p) {
    document.title = "Producto no encontrado";
    main.innerHTML = `<div class="vacio" style="margin:48px 0 96px"><p>No encontramos ese producto.</p><p>Puede que ya no esté en el catálogo. Búscalo entre los productos disponibles.</p><a class="btn btn--primario" href="catalogo.html">Ir al catálogo</a></div>`;
    return;
  }

  document.title = `${p.nombre}: precio y colores`;
  const cat = CATEGORIAS[p.categoria] || p.categoria;
  main.innerHTML = `
    <nav class="migas" aria-label="Ruta de navegación"><ol>
      <li><a href="index.html">Inicio</a></li>
      <li><a href="catalogo.html?cat=${encodeURIComponent(p.categoria)}">${esc(cat)}</a></li>
      <li aria-current="page">${esc(p.nombre)}</li>
    </ol></nav>
    <article class="ficha">
      <div class="ficha__media">
        <img src="${esc(p.img)}" alt="Foto de referencia de ${esc(p.nombre)}" width="1200" height="1200">
        <span class="tono"></span>
      </div>
      <div class="ficha__info">
        ${insignias(p)}
        <h1 class="ficha__nombre">${esc(p.nombre)}</h1>
        <p class="ficha__sub">${esc(p.subtitulo)}</p>
        <div>
          <p class="precio" aria-live="polite">${htmlPrecio(p)}</p>
          <p class="nota-precio">Precio de referencia en pesos colombianos. Se confirma por WhatsApp.</p>
        </div>
        ${htmlSelectores(p)}
        <p class="estado ${p.disponible ? "" : "estado--no"}">${p.disponible ? "Disponible" : "Agotado por ahora"}</p>
        <div class="ficha__acciones">
          ${p.disponible ? `<div class="fila">
            <button type="button" class="btn btn--primario btn--grande" data-agregar>Agregar al carrito</button>
            <a class="btn btn--secundario btn--grande" data-wa="comprar" target="_blank" rel="noopener" href="#">Comprar por WhatsApp</a>
          </div>` : ""}
          <a class="btn btn--texto" data-wa="consultar" target="_blank" rel="noopener" href="#">Consultar disponibilidad</a>
        </div>
        <p class="ficha__desc">${esc(p.descripcion)}</p>
        ${(p.specs || []).length ? `<ul class="specs" aria-label="Características">${p.specs.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
      </div>
    </article>`;

  // Cambiar color: foto o tono, nombre del color y alt; cambiar capacidad: precio
  const img = main.querySelector(".ficha__media img");
  activarVariantes(main, p, est => {
    const c = (p.colores || [])[est.color];
    img.alt = `Foto de referencia de ${p.nombre}${c ? " en " + c.nombre : ""}`;
  });

  // Relacionados de la misma categoría
  const rel = productos.filter(x => x.categoria === p.categoria && x.id !== p.id).slice(0, 3);
  if (rel.length) {
    const sec = document.querySelector("[data-relacionados]");
    const lista = sec.querySelector("[data-lista-rel]");
    rel.forEach(x => lista.append(tarjetaProducto(x, "compacta")));
    sec.hidden = false;
  }
});
