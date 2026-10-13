// Basemaps de CARTO (rastertiles). Desde agosto de 2026 CARTO exige una API key
// en basemaps.cartocdn.com; sin ella los tiles llegan con la marca de agua
// "API KEY REQUIRED". La key se obtiene gratis en https://carto.com/basemaps/apikey
// y se define en NEXT_PUBLIC_CARTO_API_KEY (.env.local / variable del repositorio).
const CARTO_API_KEY = process.env.NEXT_PUBLIC_CARTO_API_KEY || '';

if (!CARTO_API_KEY && typeof window !== 'undefined') {
  console.warn('NEXT_PUBLIC_CARTO_API_KEY no está definida: el mapa base de CARTO mostrará la marca "API KEY REQUIRED".');
}

/**
 * URL template del mapa base de CARTO.
 * @param {'light'|'dark'} theme - Tema activo
 * @param {object} [options]
 * @param {boolean} [options.retina=true] - Incluir el placeholder {r} de Leaflet
 * @param {string} [options.subdomain='{s}'] - Subdominio fijo o placeholder {s}
 */
export function getCartoTileUrl(theme, { retina = true, subdomain = '{s}' } = {}) {
  const style = theme === 'dark' ? 'dark_all' : 'light_all';
  const query = CARTO_API_KEY ? `?key=${encodeURIComponent(CARTO_API_KEY)}` : '';
  return `https://${subdomain}.basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}${retina ? '{r}' : ''}.png${query}`;
}
