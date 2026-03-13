export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function classifyFile(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.includes('era5')) return { category: 'hydromet', source: 'ERA5', color: 'blue' };
  if (lower.includes('imerg')) return { category: 'hydromet', source: 'IMERG', color: 'sky' };
  if (lower.includes('chirps')) return { category: 'hydromet', source: 'CHIRPS', color: 'cyan' };
  if (lower.includes('hidro') || lower.includes('hydro') || lower.includes('caudal') || lower.includes('nivel')) {
    return { category: 'hydrological', source: 'Hidrológico', color: 'teal' };
  }
  if (lower.includes('pred') || lower.includes('forecast') || lower.includes('horizonte') || lower.includes('horizon')) {
    return { category: 'prediction', source: 'Predicción', color: 'purple' };
  }
  if (lower.includes('1m') || lower.includes('1mes')) return { category: 'prediction', source: 'Pred. 1 mes', color: 'purple' };
  if (lower.includes('3m') || lower.includes('3mes')) return { category: 'prediction', source: 'Pred. 3 meses', color: 'purple' };
  if (lower.includes('6m') || lower.includes('6mes')) return { category: 'prediction', source: 'Pred. 6 meses', color: 'purple' };
  if (lower.includes('12m') || lower.includes('12mes')) return { category: 'prediction', source: 'Pred. 12 meses', color: 'purple' };
  return { category: 'other', source: 'Otro', color: 'gray' };
}
