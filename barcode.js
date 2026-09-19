const cheerio = require("cheerio");

async function buscarCodigoBarras(codigo) {
  const url = `https://go-upc.com/search?q=${encodeURIComponent(codigo)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Error HTTP: ${response.status}`);
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  // Nombre
  const nombre = $(".product-name").first().text().trim();

  if (!nombre) {
    return {
      encontrado: false,
      codigoBarras: codigo,
      mensaje: "No se encontró el producto en go-upc.com",
    };
  }

  // Datos de la tabla
  let ean = "";
  let marca = "";
  let categoria = "";
  let descripcion = "";

  $("table tr").each((_, row) => {
    const label = $(row).find("td").eq(0).text().trim();
    const value = $(row).find("td").eq(1).text().trim();

    if (label === "EAN") ean = value;
    if (label === "Brand") marca = value;
    if (label === "Category") categoria = value;
  });

  descripcion = $("h2")
    .filter((_, el) => $(el).text().trim() === "Description")
    .next()
    .text()
    .trim();

  // Intentamos extraer información farmacéutica
  const texto = `${nombre} ${descripcion}`;

  const concentracion =
    texto.match(/\b\d+(?:[.,]\d+)?\s*(?:mg|g|mcg|µg|ml|%|UI)\b/i)?.[0] || null;

  const cantidad =
    texto.match(
      /\b(?:x\s*)?(\d+)\s*(?:tabletas?|capsulas?|cápsulas?|unidades?|ampollas?|sobres?|grageas?|comprimidos?)\b/i
    )?.[1] || null;

  const presentacion =
    texto.match(
      /\b(tabletas?|capsulas?|cápsulas?|jarabe|suspensión|solución|ampollas?|sobres?|crema|gel|ungüento|gotas?|grageas?|comprimidos?)\b/i
    )?.[1] || null;

  return {
    encontrado: true,
    codigoBarras: codigo,
    ean: ean || codigo,
    nombre,
    marca,
    categoria,
    concentracion,
    presentacion,
    cantidad: cantidad ? Number(cantidad) : null,
    descripcion,
  };
}

// Permitir pasar el código por argumento CLI o usar el default de prueba
const codigoArg = process.argv[2] || "7503004908691";

console.log(`Buscando código de barras: ${codigoArg}...\n`);

buscarCodigoBarras(codigoArg)
  .then((resultado) => {
    console.log("Resultado obtenido:");
    console.log(JSON.stringify(resultado, null, 2));
  })
  .catch((error) => {
    console.error("Error al buscar código de barras:", error.message);
  });

module.exports = { buscarCodigoBarras };
