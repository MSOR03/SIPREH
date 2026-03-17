'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Droplets, LogOut, Users, FileText, Shield, Cloud, ArrowLeft
} from 'lucide-react';
import { authApi } from '@/services/adminApi';
import FilesSection from '@/components/admin/dashboard/FilesSection';
import UsersSection from '@/components/admin/dashboard/UsersSection';
import CloudSection from '@/components/admin/dashboard/CloudSection';

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

  .ds-icon-btn--blue {
    color: #2563eb;
    border-color: rgba(37,99,235,0.2);
  }
  .ds-icon-btn--blue:hover {
    background: rgba(37,99,235,0.08);
    border-color: rgba(37,99,235,0.35);
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