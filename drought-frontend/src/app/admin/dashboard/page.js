'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplets, LogOut, Users, Upload, FileText, Trash2, CheckCircle2,
  Plus, X, RefreshCw, CloudRain, Waves, TrendingUp, EyeOff,
  Mail, User, Shield, AlertCircle, Cloud,
  HardDrive, Clock, Hash, ArrowLeft, BarChart3
} from 'lucide-react';
import { authApi, usersApi, filesApi } from '@/services/adminApi';

// ── Helpers ──────────────────────────────────────────────────
function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-CO', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function classifyFile(filename) {
  const lower = (filename || '').toLowerCase();
  if (lower.includes('era5')) return { category: 'hydromet', source: 'ERA5', color: 'blue' };
  if (lower.includes('imerg')) return { category: 'hydromet', source: 'IMERG', color: 'sky' };
  if (lower.includes('chirps')) return { category: 'hydromet', source: 'CHIRPS', color: 'cyan' };
  if (lower.includes('hidro') || lower.includes('hydro') || lower.includes('caudal') || lower.includes('nivel')) return { category: 'hydrological', source: 'Hidrológico', color: 'teal' };
  if (lower.includes('pred') || lower.includes('forecast') || lower.includes('horizonte') || lower.includes('horizon')) return { category: 'prediction', source: 'Predicción', color: 'purple' };
  if (lower.includes('1m') || lower.includes('1mes')) return { category: 'prediction', source: 'Pred. 1 mes', color: 'purple' };
  if (lower.includes('3m') || lower.includes('3mes')) return { category: 'prediction', source: 'Pred. 3 meses', color: 'purple' };
  if (lower.includes('6m') || lower.includes('6mes')) return { category: 'prediction', source: 'Pred. 6 meses', color: 'purple' };
  if (lower.includes('12m') || lower.includes('12mes')) return { category: 'prediction', source: 'Pred. 12 meses', color: 'purple' };
  return { category: 'other', source: 'Otro', color: 'gray' };
}

// ── Shared styles ────────────────────────────────────────────
const DS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

  * { box-sizing: border-box; }

  .ds-root {
    font-family: 'DM Sans', sans-serif;
    min-height: 100vh;
    background: #f0f4f8;
    position: relative;
  }
  .dark .ds-root { background: #0d1117; }

  .ds-root::before {
    content: '';
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 40% at 10% 10%, rgba(59,130,246,0.09) 0%, transparent 65%),
      radial-gradient(ellipse 50% 50% at 90% 90%, rgba(99,102,241,0.07) 0%, transparent 65%);
    pointer-events: none;
    z-index: 0;
  }

  /* ── Header ── */
  .ds-header {
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(255,255,255,0.88);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 1px 12px rgba(0,0,0,0.06);
  }
  .dark .ds-header {
    background: rgba(18,24,38,0.9);
    border-bottom-color: rgba(255,255,255,0.06);
  }

  .ds-header-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 2.5rem;
    height: 72px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .ds-header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .ds-back-btn {
    background: none;
    border: 1px solid transparent;
    border-radius: 10px;
    padding: 0.5rem;
    cursor: pointer;
    color: #94a3b8;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
  }
  .ds-back-btn:hover {
    color: #3b82f6;
    background: rgba(59,130,246,0.08);
    border-color: rgba(59,130,246,0.2);
  }

  .ds-logo {
    width: 44px;
    height: 44px;
    background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
    border-radius: 13px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 4px 14px rgba(59,130,246,0.3);
    flex-shrink: 0;
  }

  .ds-header-title {
    font-family: 'Syne', sans-serif;
    font-size: 1.0625rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }
  .dark .ds-header-title { color: #f1f5f9; }

  .ds-header-sub {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    font-weight: 400;
  }

  .ds-header-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .ds-user-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: rgba(59,130,246,0.08);
    border: 1px solid rgba(59,130,246,0.18);
    border-radius: 10px;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #2563eb;
  }
  .dark .ds-user-chip {
    background: rgba(59,130,246,0.1);
    border-color: rgba(59,130,246,0.2);
    color: #60a5fa;
  }

  .ds-logout-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: none;
    border: 1px solid rgba(239,68,68,0.2);
    border-radius: 10px;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8125rem;
    font-weight: 500;
    color: #dc2626;
    transition: all 0.2s;
  }
  .ds-logout-btn:hover {
    background: rgba(239,68,68,0.07);
    border-color: rgba(239,68,68,0.35);
  }
  .dark .ds-logout-btn { color: #f87171; border-color: rgba(239,68,68,0.2); }
  .dark .ds-logout-btn:hover { background: rgba(239,68,68,0.1); }

  /* ── Tabs ── */
  .ds-tabs-wrap {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem 2.5rem 0;
    position: relative;
    z-index: 1;
  }

  .ds-tabs {
    display: inline-flex;
    gap: 0.25rem;
    background: rgba(255,255,255,0.75);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 14px;
    padding: 0.3125rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.05);
  }
  .dark .ds-tabs {
    background: rgba(22,28,42,0.8);
    border-color: rgba(255,255,255,0.07);
  }

  .ds-tab {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.375rem;
    border-radius: 10px;
    border: none;
    background: none;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 500;
    color: #64748b;
    transition: all 0.2s;
    white-space: nowrap;
  }
  .ds-tab:hover:not(.ds-tab--active) {
    background: rgba(0,0,0,0.04);
    color: #374151;
  }
  .dark .ds-tab:hover:not(.ds-tab--active) {
    background: rgba(255,255,255,0.05);
    color: #cbd5e1;
  }

  .ds-tab--active {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: #fff !important;
    box-shadow: 0 3px 12px rgba(37,99,235,0.3);
  }

  /* ── Content ── */
  .ds-content {
    max-width: 1280px;
    margin: 0 auto;
    padding: 2rem 2.5rem 4rem;
    position: relative;
    z-index: 1;
  }

  /* ── Cards ── */
  .ds-card {
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 20px;
    box-shadow: 0 2px 16px rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .dark .ds-card {
    background: rgba(22,28,42,0.9);
    border-color: rgba(255,255,255,0.07);
    box-shadow: 0 2px 24px rgba(0,0,0,0.3);
  }

  .ds-card-header {
    padding: 1.375rem 1.75rem;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    gap: 1rem;
  }
  .dark .ds-card-header { border-bottom-color: rgba(255,255,255,0.06); }

  .ds-card-header-left {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .ds-card-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 3px 10px rgba(0,0,0,0.15);
  }

  .ds-card-title {
    font-family: 'Syne', sans-serif;
    font-size: 0.9375rem;
    font-weight: 700;
    color: #0f172a;
    margin: 0 0 0.125rem;
    letter-spacing: -0.01em;
  }
  .dark .ds-card-title { color: #f1f5f9; }

  .ds-card-subtitle {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    font-weight: 400;
  }

  /* ── Badge ── */
  .ds-badge {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 99px;
    font-size: 0.6875rem;
    font-weight: 700;
    border: 1px solid;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  /* ── Stat Cards ── */
  .ds-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.25rem;
    margin-bottom: 2rem;
  }

  .ds-stat-card {
    background: rgba(255,255,255,0.9);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 18px;
    padding: 1.375rem 1.5rem;
    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    display: flex;
    align-items: center;
    gap: 1rem;
    border-left-width: 3px;
  }
  .dark .ds-stat-card {
    background: rgba(22,28,42,0.9);
    border-color: rgba(255,255,255,0.07);
  }

  .ds-stat-icon {
    width: 46px;
    height: 46px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .ds-stat-value {
    font-family: 'Syne', sans-serif;
    font-size: 2rem;
    font-weight: 700;
    color: #0f172a;
    line-height: 1;
    margin: 0 0 0.25rem;
    letter-spacing: -0.02em;
  }
  .dark .ds-stat-value { color: #f1f5f9; }

  .ds-stat-label {
    font-size: 0.75rem;
    color: #64748b;
    margin: 0;
    font-weight: 500;
  }

  /* ── File rows ── */
  .ds-file-row {
    padding: 1rem 1.75rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: background 0.15s;
    border-bottom: 1px solid rgba(0,0,0,0.04);
  }
  .dark .ds-file-row { border-bottom-color: rgba(255,255,255,0.04); }
  .ds-file-row:last-child { border-bottom: none; }
  .ds-file-row:hover { background: rgba(59,130,246,0.03); }
  .dark .ds-file-row:hover { background: rgba(255,255,255,0.03); }

  .ds-file-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #1e293b;
    margin: 0 0 0.375rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 420px;
  }
  .dark .ds-file-name { color: #e2e8f0; }

  .ds-file-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 0.6875rem;
    color: #94a3b8;
  }

  .ds-file-meta-item {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }

  .ds-file-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .ds-file-row:hover .ds-file-actions { opacity: 1; }

  /* ── Icon buttons ── */
  .ds-icon-btn {
    width: 34px;
    height: 34px;
    border-radius: 9px;
    border: 1px solid transparent;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    background: none;
    transition: all 0.18s;
  }

  .ds-icon-btn--green {
    color: #16a34a;
    border-color: rgba(22,163,74,0.2);
  }
  .ds-icon-btn--green:hover {
    background: rgba(22,163,74,0.08);
    border-color: rgba(22,163,74,0.35);
  }

  .ds-icon-btn--red {
    color: #dc2626;
    border-color: rgba(220,38,38,0.15);
  }
  .ds-icon-btn--red:hover {
    background: rgba(220,38,38,0.08);
    border-color: rgba(220,38,38,0.3);
  }

  .ds-icon-btn--gray {
    color: #64748b;
    border-color: rgba(100,116,139,0.15);
  }
  .ds-icon-btn--gray:hover {
    background: rgba(100,116,139,0.08);
    color: #374151;
    border-color: rgba(100,116,139,0.3);
  }

  /* ── Text buttons ── */
  .ds-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.125rem;
    border-radius: 11px;
    border: 1px solid;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.8125rem;
    font-weight: 600;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .ds-btn--primary {
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 3px 12px rgba(37,99,235,0.28);
  }
  .ds-btn--primary:hover:not(:disabled) {
    box-shadow: 0 5px 18px rgba(37,99,235,0.38);
    transform: translateY(-1px);
  }
  .ds-btn--primary:active:not(:disabled) { transform: none; }
  .ds-btn--primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .ds-btn--orange {
    background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
    color: #fff;
    border-color: transparent;
    box-shadow: 0 3px 12px rgba(249,115,22,0.28);
  }
  .ds-btn--orange:hover:not(:disabled) {
    box-shadow: 0 5px 18px rgba(249,115,22,0.38);
    transform: translateY(-1px);
  }
  .ds-btn--orange:disabled { opacity: 0.5; cursor: not-allowed; }

  .ds-btn--ghost {
    background: none;
    color: #475569;
    border-color: rgba(0,0,0,0.12);
  }
  .ds-btn--ghost:hover {
    background: rgba(0,0,0,0.04);
    color: #1e293b;
  }
  .dark .ds-btn--ghost {
    color: #94a3b8;
    border-color: rgba(255,255,255,0.1);
  }
  .dark .ds-btn--ghost:hover {
    background: rgba(255,255,255,0.06);
    color: #e2e8f0;
  }

  .ds-btn--danger-outline {
    background: none;
    color: #dc2626;
    border-color: rgba(220,38,38,0.25);
  }
  .ds-btn--danger-outline:hover {
    background: rgba(220,38,38,0.06);
    border-color: rgba(220,38,38,0.4);
  }
  .dark .ds-btn--danger-outline {
    color: #f87171;
    border-color: rgba(239,68,68,0.2);
  }

  /* ── Upload zone ── */
  .ds-upload-zone {
    margin: 0;
    padding: 1.25rem 1.75rem;
    border-bottom: 1px solid rgba(0,0,0,0.06);
    background: rgba(248,250,252,0.8);
  }
  .dark .ds-upload-zone {
    background: rgba(15,21,35,0.5);
    border-bottom-color: rgba(255,255,255,0.05);
  }

  .ds-drop-area {
    border: 2px dashed #cbd5e1;
    border-radius: 16px;
    padding: 2.5rem;
    text-align: center;
    transition: all 0.2s;
  }
  .dark .ds-drop-area { border-color: #334155; }
  .ds-drop-area:hover { border-color: #3b82f6; }
  .ds-drop-area--over {
    border-color: #3b82f6;
    background: rgba(59,130,246,0.05);
  }

  .ds-drop-title {
    font-size: 0.875rem;
    color: #475569;
    margin: 0.75rem 0 1rem;
    font-weight: 400;
  }
  .dark .ds-drop-title { color: #94a3b8; }

  .ds-drop-hint {
    font-size: 0.75rem;
    color: #94a3b8;
    margin-top: 0.75rem;
  }

  /* ── Empty & Loading states ── */
  .ds-empty {
    padding: 3.5rem 2rem;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.625rem;
  }

  .ds-empty-title {
    font-size: 0.875rem;
    color: #64748b;
    font-weight: 500;
    margin: 0;
  }

  .ds-empty-sub {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 0;
  }

  .ds-loader {
    padding: 3rem;
    display: flex;
    justify-content: center;
  }

  .ds-spinner {
    width: 36px;
    height: 36px;
    border: 2.5px solid rgba(59,130,246,0.2);
    border-top-color: #3b82f6;
    border-radius: 50%;
    animation: ds-spin 0.65s linear infinite;
  }
  .ds-spinner--orange {
    border-color: rgba(249,115,22,0.2);
    border-top-color: #f97316;
  }

  @keyframes ds-spin { to { transform: rotate(360deg); } }

  /* ── Alerts ── */
  .ds-alert {
    padding: 1rem 1.25rem;
    border-radius: 14px;
    border: 1px solid;
    font-size: 0.8125rem;
    font-weight: 500;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    line-height: 1.5;
  }

  .ds-alert--error {
    background: rgba(254,242,242,0.9);
    border-color: #fecaca;
    color: #b91c1c;
  }
  .dark .ds-alert--error {
    background: rgba(239,68,68,0.08);
    border-color: rgba(239,68,68,0.2);
    color: #fca5a5;
  }

  .ds-alert--success {
    background: rgba(240,253,244,0.9);
    border-color: #bbf7d0;
    color: #15803d;
  }
  .dark .ds-alert--success {
    background: rgba(34,197,94,0.08);
    border-color: rgba(34,197,94,0.2);
    color: #86efac;
  }

  /* ── Form fields ── */
  .ds-field-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 0.5rem;
  }
  .dark .ds-field-label { color: #64748b; }

  .ds-input {
    width: 100%;
    padding: 0.75rem 1rem;
    border: 1.5px solid #e2e8f0;
    border-radius: 11px;
    background: #f8fafc;
    color: #0f172a;
    font-family: 'DM Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 400;
    outline: none;
    transition: all 0.2s;
    appearance: none;
  }
  .ds-input::placeholder { color: #94a3b8; font-weight: 300; }
  .ds-input:focus {
    border-color: #3b82f6;
    background: #fff;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
  }
  .dark .ds-input {
    background: rgba(15,23,42,0.5);
    border-color: rgba(255,255,255,0.1);
    color: #e2e8f0;
  }
  .dark .ds-input:focus {
    border-color: #3b82f6;
    background: rgba(15,23,42,0.8);
    box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
  }

  /* ── User avatar ── */
  .ds-avatar {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }

  /* ── Section gap ── */
  .ds-section-gap { display: flex; flex-direction: column; gap: 1.5rem; }

  /* ── Checkbox ── */
  .ds-check-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-size: 0.875rem;
    color: #374151;
    font-weight: 500;
  }
  .dark .ds-check-label { color: #cbd5e1; }

  .ds-check-label input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: #3b82f6;
    cursor: pointer;
  }
`;

// ── Badge component ──────────────────────────────────────────
function Badge({ children, color = 'gray' }) {
  const styles = {
    blue:   { background:'rgba(219,234,254,0.9)', border:'1px solid #bfdbfe', color:'#1d4ed8' },
    sky:    { background:'rgba(224,242,254,0.9)', border:'1px solid #bae6fd', color:'#0369a1' },
    cyan:   { background:'rgba(207,250,254,0.9)', border:'1px solid #a5f3fc', color:'#0e7490' },
    teal:   { background:'rgba(204,251,241,0.9)', border:'1px solid #99f6e4', color:'#0f766e' },
    purple: { background:'rgba(243,232,255,0.9)', border:'1px solid #e9d5ff', color:'#7c3aed' },
    green:  { background:'rgba(220,252,231,0.9)', border:'1px solid #bbf7d0', color:'#15803d' },
    red:    { background:'rgba(254,226,226,0.9)', border:'1px solid #fecaca', color:'#b91c1c' },
    amber:  { background:'rgba(255,251,235,0.9)', border:'1px solid #fde68a', color:'#b45309' },
    gray:   { background:'rgba(241,245,249,0.9)', border:'1px solid #e2e8f0', color:'#475569' },
    orange: { background:'rgba(255,237,213,0.9)', border:'1px solid #fed7aa', color:'#c2410c' },
  };
  const s = styles[color] || styles.gray;
  return (
    <span className="ds-badge" style={s}>{children}</span>
  );
}


// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function AdminDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('files');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then(setCurrentUser)
      .catch(() => { authApi.logout(); router.replace('/admin'); })
      .finally(() => setLoading(false));
  }, [router]);

  const handleLogout = () => { authApi.logout(); router.replace('/admin'); };

  if (loading) return (
    <div className="ds-root" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <style>{DS}</style>
      <div className="ds-spinner" />
    </div>
  );

  if (!currentUser) return null;

  const tabs = [
    { key: 'files',  label: 'Archivos', icon: FileText },
    { key: 'users',  label: 'Usuarios', icon: Users },
    { key: 'cloud',  label: 'Nube',     icon: Cloud },
  ];

  return (
    <div className="ds-root">
      <style>{DS}</style>

      {/* Header */}
      <header className="ds-header">
        <div className="ds-header-inner">
          <div className="ds-header-left">
            <button className="ds-back-btn" onClick={() => router.push('/')} title="Volver al mapa">
              <ArrowLeft size={18} />
            </button>
            <div className="ds-logo">
              <Droplets size={22} color="white" strokeWidth={2} />
            </div>
            <div>
              <p className="ds-header-title">Panel de Administración</p>
              <p className="ds-header-sub">Monitor de Sequías — Bogotá</p>
            </div>
          </div>
          <div className="ds-header-right">
            <div className="ds-user-chip">
              <Shield size={14} />
              {currentUser.email}
            </div>
            <button className="ds-logout-btn" onClick={handleLogout}>
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="ds-tabs-wrap">
        <div className="ds-tabs">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              className={`ds-tab${activeTab === key ? ' ds-tab--active' : ''}`}
              onClick={() => setActiveTab(key)}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="ds-content">
        {activeTab === 'files' && <FilesSection />}
        {activeTab === 'users' && <UsersSection />}
        {activeTab === 'cloud' && <CloudSection />}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// FILES SECTION
// ═══════════════════════════════════════════════════════════════
function FilesSection() {
  const [files, setFiles] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadSection, setUploadSection] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadFiles = useCallback(async () => {
    try {
      const data = await filesApi.list(0, 200);
      setFiles(data.files || []);
      setTotal(data.total || 0);
    } catch (err) { setError('Error cargando archivos: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleUpload = async (fileList) => {
    setUploading(true); setError(''); setSuccess('');
    let ok = 0, errs = [];
    for (const file of fileList) {
      try { await filesApi.upload(file); ok++; }
      catch (err) { errs.push(`${file.name}: ${err.message}`); }
    }
    setUploading(false);
    if (ok > 0) { setSuccess(`${ok} archivo(s) subido(s) correctamente`); loadFiles(); }
    if (errs.length > 0) setError(errs.join('\n'));
    setTimeout(() => { setSuccess(''); setError(''); }, 5000);
  };

  const handleDelete = async (fileId, filename) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return;
    try { await filesApi.delete(fileId); setSuccess(`"${filename}" eliminado`); loadFiles(); }
    catch (err) { setError('Error eliminando: ' + err.message); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const handleActivate = async (fileId, filename) => {
    try { await filesApi.activate(fileId); setSuccess(`"${filename}" activado`); loadFiles(); }
    catch (err) { setError('Error activando: ' + err.message); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const hydrometFiles    = files.filter(f => classifyFile(f.original_filename).category === 'hydromet');
  const hydrologicalFiles = files.filter(f => classifyFile(f.original_filename).category === 'hydrological');
  const predictionFiles  = files.filter(f => classifyFile(f.original_filename).category === 'prediction');
  const otherFiles       = files.filter(f => classifyFile(f.original_filename).category === 'other');

  const stats = [
    { label: 'Total archivos',       value: total,                   icon: BarChart3,  iconStyle: { background:'rgba(219,234,254,0.8)' }, iconColor: '#1d4ed8', accent: '#3b82f6' },
    { label: 'Hidrometeorológicos',  value: hydrometFiles.length,    icon: CloudRain,  iconStyle: { background:'rgba(224,242,254,0.8)' }, iconColor: '#0369a1', accent: '#0ea5e9' },
    { label: 'Hidrológicos',         value: hydrologicalFiles.length, icon: Waves,     iconStyle: { background:'rgba(204,251,241,0.8)' }, iconColor: '#0f766e', accent: '#14b8a6' },
    { label: 'Predicción',           value: predictionFiles.length,  icon: TrendingUp, iconStyle: { background:'rgba(243,232,255,0.8)' }, iconColor: '#7c3aed', accent: '#a855f7' },
  ];

  return (
    <div className="ds-section-gap">
      {error && <div className="ds-alert ds-alert--error"><AlertCircle size={16} style={{flexShrink:0}} /><span style={{whiteSpace:'pre-line'}}>{error}</span></div>}
      {success && <div className="ds-alert ds-alert--success"><CheckCircle2 size={16} style={{flexShrink:0}} />{success}</div>}

      {/* Stats */}
      <div className="ds-stats">
        {stats.map(({ label, value, icon: Icon, iconStyle, iconColor, accent }) => (
          <div className="ds-stat-card" key={label} style={{ borderLeftColor: accent }}>
            <div className="ds-stat-icon" style={iconStyle}>
              <Icon size={20} color={iconColor} />
            </div>
            <div>
              <p className="ds-stat-value">{value}</p>
              <p className="ds-stat-label">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <FileCategory title="Datos Hidrometeorológicos" subtitle="ERA5, IMERG, CHIRPS — archivos .parquet" icon={CloudRain}  accentColor="#3b82f6" iconGradient="linear-gradient(135deg,#3b82f6,#1d4ed8)" files={hydrometFiles}     loading={loading} onDelete={handleDelete} onActivate={handleActivate} uploadOpen={uploadSection==='hydromet'}      onToggleUpload={() => setUploadSection(uploadSection==='hydromet'?null:'hydromet')}           onUpload={handleUpload} uploading={uploading} acceptHint="ERA5, IMERG o CHIRPS en el nombre" multiple />
      <FileCategory title="Datos Hidrológicos"        subtitle="Caudales, niveles — estaciones hidrológicas"        icon={Waves}      accentColor="#14b8a6" iconGradient="linear-gradient(135deg,#14b8a6,#0f766e)" files={hydrologicalFiles} loading={loading} onDelete={handleDelete} onActivate={handleActivate} uploadOpen={uploadSection==='hydrological'}  onToggleUpload={() => setUploadSection(uploadSection==='hydrological'?null:'hydrological')}   onUpload={handleUpload} uploading={uploading} acceptHint="Datos de caudal o nivel hidrológico" multiple={false} />
      <FileCategory title="Datos de Predicción"       subtitle="Horizontes: 1, 3, 6 y 12 meses"                   icon={TrendingUp} accentColor="#a855f7" iconGradient="linear-gradient(135deg,#a855f7,#7c3aed)" files={predictionFiles}   loading={loading} onDelete={handleDelete} onActivate={handleActivate} uploadOpen={uploadSection==='prediction'}    onToggleUpload={() => setUploadSection(uploadSection==='prediction'?null:'prediction')}         onUpload={handleUpload} uploading={uploading} acceptHint="1 archivo por horizonte: 1m, 3m, 6m, 12m" multiple />
      {otherFiles.length > 0 && (
        <FileCategory title="Otros Archivos" subtitle="Sin clasificación automática" icon={FileText} accentColor="#64748b" iconGradient="linear-gradient(135deg,#64748b,#475569)" files={otherFiles} loading={loading} onDelete={handleDelete} onActivate={handleActivate} uploadOpen={false} onToggleUpload={()=>{}} onUpload={handleUpload} uploading={uploading} acceptHint="" hideUpload />
      )}
    </div>
  );
}

// ── File Category Card ───────────────────────────────────────
function FileCategory({ title, subtitle, icon: Icon, accentColor, iconGradient, files, loading, onDelete, onActivate, uploadOpen, onToggleUpload, onUpload, uploading, acceptHint, multiple=true, hideUpload=false }) {
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.parquet'));
    if (dropped.length > 0) onUpload(multiple ? dropped : [dropped[0]]);
  };

  const handleFileInput = (e) => {
    const selected = Array.from(e.target.files);
    if (selected.length > 0) onUpload(multiple ? selected : [selected[0]]);
    e.target.value = '';
  };

  return (
    <div className="ds-card" style={{ borderTop: `3px solid ${accentColor}` }}>
      {/* Header */}
      <div className="ds-card-header">
        <div className="ds-card-header-left">
          <div className="ds-card-icon" style={{ background: iconGradient }}>
            <Icon size={20} color="white" />
          </div>
          <div>
            <p className="ds-card-title">{title}</p>
            <p className="ds-card-subtitle">{subtitle}</p>
          </div>
          <Badge color={accentColor === '#64748b' ? 'gray' : accentColor === '#3b82f6' ? 'blue' : accentColor === '#14b8a6' ? 'teal' : 'purple'}>
            {files.length} archivo{files.length !== 1 ? 's' : ''}
          </Badge>
        </div>
        {!hideUpload && (
          <button
            className={`ds-btn ${uploadOpen ? 'ds-btn--danger-outline' : 'ds-btn--ghost'}`}
            onClick={onToggleUpload}
          >
            {uploadOpen ? <X size={14} /> : <Upload size={14} />}
            {uploadOpen ? 'Cerrar' : 'Subir archivo'}
          </button>
        )}
      </div>

      {/* Upload zone */}
      {uploadOpen && (
        <div className="ds-upload-zone">
          <div
            className={`ds-drop-area${dragOver ? ' ds-drop-area--over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:'0.75rem' }}>
                <div className="ds-spinner" />
                <p style={{ fontSize:'0.875rem', color:'#64748b', margin:0 }}>Subiendo archivo(s)…</p>
              </div>
            ) : (
              <>
                <Upload size={32} color="#94a3b8" />
                <p className="ds-drop-title">Arrastra archivos .parquet aquí o</p>
                <label className="ds-btn ds-btn--primary" style={{ cursor:'pointer' }}>
                  <Plus size={14} />
                  Seleccionar archivo{multiple ? 's' : ''}
                  <input type="file" accept=".parquet" multiple={multiple} onChange={handleFileInput} style={{ display:'none' }} />
                </label>
                {acceptHint && <p className="ds-drop-hint">{acceptHint}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* File list */}
      {loading ? (
        <div className="ds-loader"><div className="ds-spinner" /></div>
      ) : files.length === 0 ? (
        <div className="ds-empty">
          <FileText size={40} color="#cbd5e1" />
          <p className="ds-empty-title">No hay archivos en esta categoría</p>
          <p className="ds-empty-sub">Sube un archivo .parquet para comenzar</p>
        </div>
      ) : (
        <div>
          {files.map((file) => {
            const info = classifyFile(file.original_filename);
            const isActive = file.status === 'active';
            return (
              <div key={file.id} className="ds-file-row">
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap' }}>
                    <p className="ds-file-name">{file.original_filename}</p>
                    <Badge color={info.color}>{info.source}</Badge>
                    {isActive ? <Badge color="green">Activo</Badge> : <Badge color="amber">{file.status}</Badge>}
                  </div>
                  <div className="ds-file-meta">
                    <span className="ds-file-meta-item"><HardDrive size={11} />{formatBytes(file.file_size)}</span>
                    <span className="ds-file-meta-item"><Clock size={11} />{formatDate(file.created_at)}</span>
                    <span className="ds-file-meta-item"><Hash size={11} />ID: {file.id}</span>
                  </div>
                </div>
                <div className="ds-file-actions">
                  {!isActive && (
                    <button className="ds-icon-btn ds-icon-btn--green" onClick={() => onActivate(file.id, file.original_filename)} title="Activar">
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  <button className="ds-icon-btn ds-icon-btn--red" onClick={() => onDelete(file.id, file.original_filename)} title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// USERS SECTION
// ═══════════════════════════════════════════════════════════════
function UsersSection() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({ email:'', full_name:'', password:'', is_active:true, is_superuser:false });

  const loadUsers = useCallback(async () => {
    try { const data = await usersApi.list(); setUsers(data); }
    catch (err) { setError('Error cargando usuarios: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const resetForm = () => {
    setFormData({ email:'', full_name:'', password:'', is_active:true, is_superuser:false });
    setShowCreateForm(false); setEditingUser(null);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault(); setError('');
    try { await usersApi.create(formData); setSuccess('Usuario creado correctamente'); resetForm(); loadUsers(); }
    catch (err) { setError('Error creando usuario: ' + err.message); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault(); setError('');
    try {
      const updateData = { ...formData };
      if (!updateData.password) delete updateData.password;
      delete updateData.is_superuser;
      await usersApi.update(editingUser.id, updateData);
      setSuccess('Usuario actualizado'); resetForm(); loadUsers();
    } catch (err) { setError('Error actualizando: ' + err.message); }
    setTimeout(() => { setSuccess(''); setError(''); }, 4000);
  };

  const startEdit = (user) => {
    setEditingUser(user);
    setFormData({ email:user.email, full_name:user.full_name||'', password:'', is_active:user.is_active, is_superuser:user.is_superuser });
    setShowCreateForm(false);
  };

  return (
    <div className="ds-section-gap">
      {error && <div className="ds-alert ds-alert--error"><AlertCircle size={16} style={{flexShrink:0}} />{error}</div>}
      {success && <div className="ds-alert ds-alert--success"><CheckCircle2 size={16} style={{flexShrink:0}} />{success}</div>}

      {/* Form card */}
      {(showCreateForm || editingUser) && (
        <div className="ds-card" style={{ borderTop:'3px solid #3b82f6' }}>
          <div className="ds-card-header">
            <div className="ds-card-header-left">
              <div className="ds-card-icon" style={{ background:'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                <User size={20} color="white" />
              </div>
              <div>
                <p className="ds-card-title">{editingUser ? `Editar usuario` : 'Nuevo usuario'}</p>
                <p className="ds-card-subtitle">{editingUser ? editingUser.email : 'Completa los campos para crear la cuenta'}</p>
              </div>
            </div>
            <button className="ds-icon-btn ds-icon-btn--gray" onClick={resetForm}><X size={16} /></button>
          </div>

          <form onSubmit={editingUser ? handleUpdateUser : handleCreateUser} style={{ padding:'1.5rem 1.75rem', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.25rem' }}>
            <div>
              <label className="ds-field-label"><Mail size={12} />Correo electrónico</label>
              <input className="ds-input" type="email" required value={formData.email} onChange={e => setFormData({...formData, email:e.target.value})} placeholder="correo@ejemplo.com" />
            </div>
            <div>
              <label className="ds-field-label"><User size={12} />Nombre completo</label>
              <input className="ds-input" type="text" value={formData.full_name} onChange={e => setFormData({...formData, full_name:e.target.value})} placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="ds-field-label"><EyeOff size={12} />{editingUser ? 'Nueva contraseña (vacío para no cambiar)' : 'Contraseña'}</label>
              <input className="ds-input" type="password" required={!editingUser} value={formData.password} onChange={e => setFormData({...formData, password:e.target.value})} placeholder="••••••••" />
            </div>
            <div style={{ display:'flex', alignItems:'flex-end', gap:'1.5rem', paddingBottom:'0.125rem' }}>
              <label className="ds-check-label">
                <input type="checkbox" checked={formData.is_active} onChange={e => setFormData({...formData, is_active:e.target.checked})} />
                Activo
              </label>
              {!editingUser && (
                <label className="ds-check-label">
                  <input type="checkbox" checked={formData.is_superuser} onChange={e => setFormData({...formData, is_superuser:e.target.checked})} />
                  Administrador
                </label>
              )}
            </div>
            <div style={{ gridColumn:'1/-1', display:'flex', gap:'0.75rem', paddingTop:'0.5rem', borderTop:'1px solid rgba(0,0,0,0.06)' }}>
              <button type="submit" className="ds-btn ds-btn--primary">
                {editingUser ? 'Guardar cambios' : 'Crear usuario'}
              </button>
              <button type="button" className="ds-btn ds-btn--ghost" onClick={resetForm}>Cancelar</button>
            </div>
          </form>
        </div>
      )}

      {/* User list */}
      <div className="ds-card" style={{ borderTop:'3px solid #3b82f6' }}>
        <div className="ds-card-header">
          <div className="ds-card-header-left">
            <div className="ds-card-icon" style={{ background:'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
              <Users size={20} color="white" />
            </div>
            <div>
              <p className="ds-card-title">Usuarios registrados</p>
              <p className="ds-card-subtitle">{users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema</p>
            </div>
          </div>
          {!showCreateForm && !editingUser && (
            <button className="ds-btn ds-btn--primary" onClick={() => { setShowCreateForm(true); setEditingUser(null); }}>
              <Plus size={14} />Nuevo usuario
            </button>
          )}
        </div>

        {loading ? (
          <div className="ds-loader"><div className="ds-spinner" /></div>
        ) : users.length === 0 ? (
          <div className="ds-empty">
            <Users size={40} color="#cbd5e1" />
            <p className="ds-empty-title">No hay usuarios registrados</p>
          </div>
        ) : (
          <div>
            {users.map((user) => (
              <div key={user.id} className="ds-file-row">
                <div className="ds-avatar" style={{ background: user.is_superuser ? 'linear-gradient(135deg,#f59e0b,#d97706)' : 'linear-gradient(135deg,#3b82f6,#1d4ed8)' }}>
                  {(user.full_name || user.email).charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', flexWrap:'wrap', marginBottom:'0.3rem' }}>
                    <span style={{ fontSize:'0.875rem', fontWeight:500, color:'#1e293b' }}>{user.full_name || user.email}</span>
                    {user.is_superuser && <Badge color="amber">Admin</Badge>}
                    {user.is_active ? <Badge color="green">Activo</Badge> : <Badge color="red">Inactivo</Badge>}
                  </div>
                  <div className="ds-file-meta">
                    <span>{user.email}</span>
                    <span className="ds-file-meta-item"><Clock size={11} />Creado: {formatDate(user.created_at)}</span>
                  </div>
                </div>
                <div className="ds-file-actions">
                  <button className="ds-btn ds-btn--ghost" style={{ fontSize:'0.8125rem' }} onClick={() => startEdit(user)}>Editar</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// CLOUD SECTION
// ═══════════════════════════════════════════════════════════════
function CloudSection() {
  const [cloudFiles, setCloudFiles] = useState([]);
  const [bucket, setBucket] = useState('');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCloud = useCallback(async () => {
    setLoading(true);
    try { const data = await filesApi.listCloud(); setCloudFiles(data.files||[]); setBucket(data.bucket||''); }
    catch (err) { setError('Error listando archivos en la nube: ' + err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadCloud(); }, [loadCloud]);

  const handleSync = async () => {
    setSyncing(true); setError('');
    try {
      const result = await filesApi.syncCloud();
      setSuccess(`Sincronización: ${result.registered} registrados, ${result.skipped} omitidos, ${result.deleted_from_db} eliminados de BD`);
      loadCloud();
    } catch (err) { setError('Error sincronizando: ' + err.message); }
    finally { setSyncing(false); }
    setTimeout(() => { setSuccess(''); setError(''); }, 6000);
  };

  return (
    <div className="ds-section-gap">
      {error && <div className="ds-alert ds-alert--error"><AlertCircle size={16} style={{flexShrink:0}} />{error}</div>}
      {success && <div className="ds-alert ds-alert--success"><CheckCircle2 size={16} style={{flexShrink:0}} />{success}</div>}

      <div className="ds-card" style={{ borderTop:'3px solid #f97316' }}>
        <div className="ds-card-header">
          <div className="ds-card-header-left">
            <div className="ds-card-icon" style={{ background:'linear-gradient(135deg,#f97316,#ea580c)' }}>
              <Cloud size={20} color="white" />
            </div>
            <div>
              <p className="ds-card-title">Cloudflare R2</p>
              <p className="ds-card-subtitle">Bucket: {bucket || '…'} — {cloudFiles.length} archivos</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'0.625rem' }}>
            <button className="ds-btn ds-btn--ghost" onClick={loadCloud} disabled={loading}>
              <RefreshCw size={14} style={loading ? { animation:'ds-spin 0.65s linear infinite' } : {}} />
              Refrescar
            </button>
            <button className="ds-btn ds-btn--orange" onClick={handleSync} disabled={syncing}>
              <RefreshCw size={14} style={syncing ? { animation:'ds-spin 0.65s linear infinite' } : {}} />
              {syncing ? 'Sincronizando…' : 'Sincronizar BD ↔ Nube'}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="ds-loader"><div className="ds-spinner ds-spinner--orange" /></div>
        ) : cloudFiles.length === 0 ? (
          <div className="ds-empty">
            <Cloud size={40} color="#cbd5e1" />
            <p className="ds-empty-title">No se encontraron archivos en la nube</p>
          </div>
        ) : (
          <div>
            {cloudFiles.map((file, idx) => {
              const info = classifyFile(file.filename);
              return (
                <div key={idx} className="ds-file-row">
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'0.625rem', flexWrap:'wrap', marginBottom:'0.3rem' }}>
                      <p className="ds-file-name">{file.filename}</p>
                      <Badge color={info.color}>{info.source}</Badge>
                      {file.registered ? <Badge color="green">Registrado</Badge> : <Badge color="amber">Sin registrar</Badge>}
                    </div>
                    <div className="ds-file-meta">
                      <span className="ds-file-meta-item"><HardDrive size={11} />{file.size_mb} MB</span>
                      <span className="ds-file-meta-item"><Clock size={11} />{formatDate(file.last_modified)}</span>
                      {file.file_id && <span className="ds-file-meta-item"><Hash size={11} />ID: {file.file_id}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}