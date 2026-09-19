import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';

export interface ProductoScrapeado {
  codigo_barras: string;
  nombre_comercial: string;
  sku?: string;
  marca?: string;
  laboratorio?: string;
  categoria?: string;
  principio_activo?: string;
  concentracion?: string;
  unidad_concentracion?: string;
  forma_farmaceutica?: string;
  via_administracion?: string;
  unidad_presentacion?: string;
  unidad_base?: string;
  cantidad_unidad_base: number;
  requiere_receta: boolean;
  afecto_igv: boolean;
  controla_lote: boolean;
  requiere_vencimiento: boolean;
  tipo_producto: string;
  descripcion?: string;
  foto_url?: string;
}

// Lista de principios activos frecuentes para detección inteligente
const PRINCIPIOS_ACTIVOS_COMUNES = [
  'PARACETAMOL',
  'IBUPROFENO',
  'AMOXICILINA',
  'AZITROMICINA',
  'DICLOFENACO',
  'OMEPRAZOL',
  'ESOMEPRAZOL',
  'LANSOPRAZOL',
  'LORATADINA',
  'CETIRIZINA',
  'CLORFENAMINA',
  'LOSARTAN',
  'ENALAPRIL',
  'CAPTOPRIL',
  'METFORMINA',
  'GLIBENCLAMIDA',
  'ATORVASTATINA',
  'SIMVASTATINA',
  'CLONAZEPAM',
  'ALPRAZOLAM',
  'DIAZEPAM',
  'NAPROXENO',
  'KETOROLACO',
  'TRAMADOL',
  'DEXAMETASONA',
  'PREDNISONA',
  'CIPROFLOXACINO',
  'CEFALEXINA',
  'CLINDAMICINA',
  'SALBUTAMOL',
  'BISMUTO',
  'HIDROCLOROTIAZIDA',
  'AMLODIPINO',
  'FLUCONAZOL',
  'KETOCONAZOL',
  'RANITIDINA',
  'HIOSCINA',
  'METAMIZOL',
];

@Injectable()
export class ScraperProductosService {
  private readonly logger = new Logger(ScraperProductosService.name);

  /**
   * Consulta go-upc.com y extrae la información estructurada y farmacéutica.
   */
  async buscarEnApiExterna(codigo: string): Promise<ProductoScrapeado | null> {
    const cleanCode = codigo.trim();
    if (!cleanCode) return null;

    try {
      this.logger.log(`Consultando API externa / go-upc para código: ${cleanCode}`);
      const url = `https://go-upc.com/search?q=${encodeURIComponent(cleanCode)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
      });

      clearTimeout(timeout);

      if (!response.ok) {
        this.logger.warn(`Respuesta no exitosa de go-upc (${response.status}) para ${cleanCode}`);
        return null;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const rawNombre = $('.product-name').first().text().trim();
      if (!rawNombre) {
        this.logger.log(`No se encontró producto en go-upc para ${cleanCode}`);
        return null;
      }

      let ean = '';
      let brand = '';
      let category = '';
      let imageUrl = $('.product-image img').attr('src') || $('.product-cover img').attr('src') || undefined;

      $('table tr').each((_, row) => {
        const label = $(row).find('td').eq(0).text().trim();
        const value = $(row).find('td').eq(1).text().trim();

        if (label === 'EAN' || label === 'UPC') ean = value;
        if (label === 'Brand') brand = value;
        if (label === 'Category') category = value;
      });

      const description = $('h2')
        .filter((_, el) => $(el).text().trim() === 'Description')
        .next()
        .text()
        .trim();

      const fullText = `${rawNombre} ${description}`.toUpperCase();

      // 1. Concentración y unidad
      const concMatch = fullText.match(
        /\b(\d+(?:[.,]\d+)?)\s*(MG|G|MCG|µG|UG|ML|%|UI)\b/i,
      );
      const concentracion = concMatch ? concMatch[1].replace(',', '.') : undefined;
      const unidadConcentracion = concMatch ? concMatch[2].toUpperCase() : 'MG';

      // 2. Forma Farmacéutica
      const formaMatch = fullText.match(
        /\b(TABLETAS?|TABS?|CAPSULAS?|CÁPSULAS?|JARABE|SUSPENSION|SUSPENSIÓN|SOLUCION|SOLUCIÓN|AMPOLLAS?|SOBRES?|CREMA|GEL|UNGÜENTO|UNGUENTO|GOTAS?|GRAGEAS?|COMPRIMIDOS?|INYECCION|INYECCIÓN|POLVO|LOCION|LOCIÓN|OVULOS?|ÓVULOS?|SPRAY|AEROSOL|PARCHES?|SUPOSITORIOS?)\b/i,
      );
      let formaFarmaceutica = 'TABLETA';
      if (formaMatch) {
        const rawForma = formaMatch[1].toUpperCase();
        if (rawForma.startsWith('TABLET') || rawForma.startsWith('TAB') || rawForma.startsWith('COMPRIMID')) {
          formaFarmaceutica = 'TABLETA';
        } else if (rawForma.startsWith('CAPSUL') || rawForma.startsWith('CÁPSUL') || rawForma.startsWith('GRAGEA')) {
          formaFarmaceutica = 'CAPSULA';
        } else if (rawForma.startsWith('JARABE')) {
          formaFarmaceutica = 'JARABE';
        } else if (rawForma.startsWith('SUSPENS')) {
          formaFarmaceutica = 'SUSPENSION';
        } else if (rawForma.startsWith('SOLUC')) {
          formaFarmaceutica = 'SOLUCION';
        } else if (rawForma.startsWith('AMPOLL') || rawForma.startsWith('INYEC')) {
          formaFarmaceutica = 'AMPOLLA';
        } else if (rawForma.startsWith('SOBRE')) {
          formaFarmaceutica = 'SOBRE';
        } else if (rawForma.startsWith('CREMA')) {
          formaFarmaceutica = 'CREMA';
        } else if (rawForma.startsWith('GEL')) {
          formaFarmaceutica = 'GEL';
        } else if (rawForma.startsWith('UNG')) {
          formaFarmaceutica = 'UNGUENTO';
        } else if (rawForma.startsWith('GOTA')) {
          formaFarmaceutica = 'GOTAS';
        } else if (rawForma.startsWith('POLVO')) {
          formaFarmaceutica = 'POLVO';
        } else if (rawForma.startsWith('LOCI')) {
          formaFarmaceutica = 'LOCION';
        } else if (rawForma.startsWith('OVUL') || rawForma.startsWith('ÓVUL')) {
          formaFarmaceutica = 'OVULO';
        } else if (rawForma.startsWith('SPRAY') || rawForma.startsWith('AEROSOL')) {
          formaFarmaceutica = 'SPRAY';
        } else if (rawForma.startsWith('PARCHE')) {
          formaFarmaceutica = 'PARCHE';
        } else if (rawForma.startsWith('SUPOSITOR')) {
          formaFarmaceutica = 'SUPOSITORIO';
        }
      }

      // 3. Cantidad por unidad base
      const cantMatch = fullText.match(
        /\b(?:X\s*|CAJA\s+CON\s+|CONTIENE\s+)?(\d+)\s*(?:TABLETAS?|TABS?|CAPSULAS?|CÁPSULAS?|UNIDADES?|AMPOLLAS?|SOBRES?|GRAGEAS?|COMPRIMIDOS?|DOSIS|PARCHES?|FRASCOS?)\b/i,
      ) || fullText.match(/\bX\s*(\d+)\b/i);

      let cantidadUnidadBase = 1;
      if (cantMatch && Number(cantMatch[1]) > 0) {
        cantidadUnidadBase = Number(cantMatch[1]);
      }

      // 4. Unidad Base
      let unidadBase = 'UNIDAD';
      if (formaFarmaceutica === 'TABLETA') unidadBase = 'TABLETA';
      else if (formaFarmaceutica === 'CAPSULA') unidadBase = 'CAPSULA';
      else if (formaFarmaceutica === 'AMPOLLA') unidadBase = 'AMPOLLA';
      else if (formaFarmaceutica === 'SOBRE') unidadBase = 'SOBRE';
      else if (formaFarmaceutica === 'OVULO') unidadBase = 'OVULO';
      else if (['JARABE', 'SUSPENSION', 'SOLUCION', 'GOTAS'].includes(formaFarmaceutica)) {
        unidadBase = 'FRASCO';
      } else if (['CREMA', 'GEL', 'UNGUENTO'].includes(formaFarmaceutica)) {
        unidadBase = 'TUBO';
      }

      // 5. Unidad de Presentación
      let unidadPresentacion = 'CAJA';
      if (['JARABE', 'SUSPENSION', 'SOLUCION', 'GOTAS'].includes(formaFarmaceutica) && cantidadUnidadBase <= 1) {
        unidadPresentacion = 'FRASCO';
      } else if (['CREMA', 'GEL', 'UNGUENTO'].includes(formaFarmaceutica) && cantidadUnidadBase <= 1) {
        unidadPresentacion = 'TUBO';
      } else if (fullText.includes('BLISTER') || fullText.includes('BLÍSTER')) {
        unidadPresentacion = 'BLISTER';
      } else if (fullText.includes('SOBRE') && cantidadUnidadBase <= 1) {
        unidadPresentacion = 'SOBRE';
      } else if (cantidadUnidadBase > 1) {
        unidadPresentacion = 'CAJA';
      }

      // 6. Principio Activo
      let principioActivo: string | undefined = undefined;
      for (const pa of PRINCIPIOS_ACTIVOS_COMUNES) {
        if (fullText.includes(pa)) {
          principioActivo = pa;
          break;
        }
      }

      // 7. Vía de Administración
      let viaAdministracion = 'ORAL';
      if (['CREMA', 'GEL', 'UNGUENTO', 'LOCION'].includes(formaFarmaceutica)) {
        viaAdministracion = 'TOPICA';
      } else if (formaFarmaceutica === 'AMPOLLA') {
        viaAdministracion = 'INTRAMUSCULAR';
      } else if (formaFarmaceutica === 'OVULO') {
        viaAdministracion = 'VAGINAL';
      } else if (formaFarmaceutica === 'SUPOSITORIO') {
        viaAdministracion = 'RECTAL';
      } else if (formaFarmaceutica === 'SPRAY') {
        viaAdministracion = 'NASAL';
      } else if (formaFarmaceutica === 'GOTAS' && (fullText.includes('OFTALM') || fullText.includes('OJOS'))) {
        viaAdministracion = 'OFTALMICA';
      } else if (formaFarmaceutica === 'GOTAS' && (fullText.includes('OTIC') || fullText.includes('OIDO'))) {
        viaAdministracion = 'OTICA';
      }

      // 8. Categoría Terapéutica
      let categoria = 'FARMACIA GENERAL';
      if (principioActivo && ['PARACETAMOL', 'IBUPROFENO', 'METAMIZOL', 'NAPROXENO', 'KETOROLACO', 'TRAMADOL'].includes(principioActivo)) {
        categoria = 'ANALGÉSICOS Y ANTIPIRÉTICOS';
      } else if (principioActivo && ['AMOXICILINA', 'AZITROMICINA', 'CIPROFLOXACINO', 'CEFALEXINA', 'CLINDAMICINA'].includes(principioActivo)) {
        categoria = 'ANTIBIÓTICOS';
      } else if (principioActivo && ['OMEPRAZOL', 'ESOMEPRAZOL', 'LANSOPRAZOL', 'RANITIDINA', 'BISMUTO'].includes(principioActivo)) {
        categoria = 'GASTROINTESTINAL';
      } else if (principioActivo && ['LORATADINA', 'CETIRIZINA', 'CLORFENAMINA'].includes(principioActivo)) {
        categoria = 'ANTIHISTAMÍNICOS';
      } else if (principioActivo && ['LOSARTAN', 'ENALAPRIL', 'CAPTOPRIL', 'AMLODIPINO', 'ATORVASTATINA'].includes(principioActivo)) {
        categoria = 'CARDIOVASCULAR';
      } else if (category && !category.toLowerCase().includes('folder')) {
        categoria = category.toUpperCase();
      }

      // 9. Laboratorio / Marca
      let laboratorio = brand ? brand.toUpperCase() : 'GENÉRICO';
      if (rawNombre.toUpperCase().startsWith('LABORATORIOS ') || rawNombre.toUpperCase().startsWith('LABORATORIO ')) {
        const matchLab = rawNombre.match(/LABORATORIOS?\s+([A-ZÁÉÍÓÚÑa-z]+)/i);
        if (matchLab) {
          laboratorio = matchLab[1].toUpperCase();
        }
      }

      // 10. Nombre Comercial Limpio
      const nombreComercial = rawNombre.toUpperCase().trim();

      // 11. Generación de SKU sugerido
      const skuPrefix = principioActivo
        ? `MED-${principioActivo.substring(0, 3)}-${concentracion || 'GEN'}`
        : `PROD-${cleanCode.slice(-6)}`;
      const sku = `${skuPrefix}-${cantidadUnidadBase > 1 ? cantidadUnidadBase : 'UNI'}`.toUpperCase();

      const resultado: ProductoScrapeado = {
        codigo_barras: cleanCode,
        nombre_comercial: nombreComercial,
        sku,
        marca: brand ? brand.toUpperCase() : undefined,
        laboratorio,
        categoria,
        principio_activo: principioActivo,
        concentracion,
        unidad_concentracion: unidadConcentracion,
        forma_farmaceutica: formaFarmaceutica,
        via_administracion: viaAdministracion,
        unidad_presentacion: unidadPresentacion,
        unidad_base: unidadBase,
        cantidad_unidad_base: cantidadUnidadBase,
        requiere_receta: false,
        afecto_igv: true,
        controla_lote: true,
        requiere_vencimiento: true,
        tipo_producto: 'MEDICAMENTO',
        descripcion: description || undefined,
        foto_url: imageUrl || undefined,
      };

      this.logger.log(`Producto extraído exitosamente de API externa: ${nombreComercial}`);
      return resultado;
    } catch (err: any) {
      this.logger.error(`Error extrayendo información externa para ${cleanCode}: ${err.message}`);
      return null;
    }
  }
}
