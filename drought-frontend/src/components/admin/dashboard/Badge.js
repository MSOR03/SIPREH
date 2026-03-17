'use client';

export default function Badge({ children, color = 'gray' }) {
  const styles = {
    blue: { background: 'rgba(219,234,254,0.9)', border: '1px solid #bfdbfe', color: '#1d4ed8' },
    sky: { background: 'rgba(224,242,254,0.9)', border: '1px solid #bae6fd', color: '#0369a1' },
    cyan: { background: 'rgba(207,250,254,0.9)', border: '1px solid #a5f3fc', color: '#0e7490' },
    teal: { background: 'rgba(204,251,241,0.9)', border: '1px solid #99f6e4', color: '#0f766e' },
    purple: { background: 'rgba(243,232,255,0.9)', border: '1px solid #e9d5ff', color: '#7c3aed' },
    green: { background: 'rgba(220,252,231,0.9)', border: '1px solid #bbf7d0', color: '#15803d' },
    red: { background: 'rgba(254,226,226,0.9)', border: '1px solid #fecaca', color: '#b91c1c' },
    amber: { background: 'rgba(255,251,235,0.9)', border: '1px solid #fde68a', color: '#b45309' },
    gray: { background: 'rgba(241,245,249,0.9)', border: '1px solid #e2e8f0', color: '#475569' },
    orange: { background: 'rgba(255,237,213,0.9)', border: '1px solid #fed7aa', color: '#c2410c' },
  };

  const style = styles[color] || styles.gray;
  return (
    <span className="ds-badge" style={style}>
      {children}
    </span>
  );
}
