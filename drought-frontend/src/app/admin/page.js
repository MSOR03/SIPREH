"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Droplets,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowLeft,
  Moon,
  Sun,
} from "lucide-react";
import { authApi } from "@/services/adminApi";
import { useTheme } from "@/contexts/ThemeContext";

export default function AdminLoginPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (authApi.isAuthenticated()) {
      authApi
        .me()
        .then(() => {
          router.replace("/admin/dashboard");
        })
        .catch(() => {
          authApi.logout();
        });
    }
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.login(email, password);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(
        err.status === 401
          ? "Correo o contraseña incorrectos"
          : err.message || "Error al iniciar sesión",
      );
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

        .login-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f4f8;
          padding: 2rem;
          position: relative;
          overflow: hidden;
        }

        .dark .login-root {
          background: #0d1117;
        }

        /* Soft mesh background */
        .login-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(59,130,246,0.12) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 80%, rgba(99,102,241,0.10) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 60% 10%, rgba(147,197,253,0.08) 0%, transparent 60%);
          pointer-events: none;
        }

        .dark .login-root::before {
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(59,130,246,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 80% 80%, rgba(99,102,241,0.07) 0%, transparent 70%);
        }

        .login-wrapper {
          position: relative;
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .back-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 500;
          color: #64748b;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.5rem 0;
          transition: color 0.2s, gap 0.2s;
          width: fit-content;
          letter-spacing: 0.01em;
        }

        .back-btn:hover {
          color: #2563eb;
          gap: 0.75rem;
        }

        .dark .back-btn { color: #94a3b8; }
        .dark .back-btn:hover { color: #60a5fa; }

        .back-btn svg {
          transition: transform 0.2s;
        }

        .back-btn:hover svg {
          transform: translateX(-3px);
        }

        /* Card */
        .login-card {
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-radius: 28px;
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow:
            0 4px 6px rgba(0,0,0,0.03),
            0 12px 40px rgba(0,0,0,0.08),
            0 1px 0 rgba(255,255,255,0.8) inset;
          padding: 3rem 3rem;
        }

        .dark .login-card {
          background: rgba(22, 28, 42, 0.92);
          border-color: rgba(255,255,255,0.07);
          box-shadow:
            0 4px 6px rgba(0,0,0,0.2),
            0 20px 60px rgba(0,0,0,0.4),
            0 1px 0 rgba(255,255,255,0.04) inset;
        }

        /* Header */
        .login-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 2.75rem;
          text-align: center;
        }

        .logo-wrap {
          position: relative;
          margin-bottom: 1.5rem;
        }

        .logo-glow {
          position: absolute;
          inset: -8px;
          background: radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%);
          border-radius: 50%;
          pointer-events: none;
        }

        .logo-icon {
          position: relative;
          width: 68px;
          height: 68px;
          background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow:
            0 8px 24px rgba(59,130,246,0.35),
            0 2px 4px rgba(0,0,0,0.1),
            0 1px 0 rgba(255,255,255,0.2) inset;
        }

        .login-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.625rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.02em;
          line-height: 1.2;
          margin: 0 0 0.5rem;
        }

        .dark .login-title { color: #f1f5f9; }

        .login-subtitle {
          font-size: 0.9rem;
          color: #64748b;
          font-weight: 400;
          letter-spacing: 0.01em;
          margin: 0;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .dark .login-subtitle { color: #64748b; }

        .subtitle-dot {
          width: 4px;
          height: 4px;
          background: #3b82f6;
          border-radius: 50%;
          display: inline-block;
        }

        /* Error */
        .error-box {
          margin-bottom: 1.75rem;
          padding: 1rem 1.25rem;
          border-radius: 14px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #b91c1c;
          font-size: 0.875rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          line-height: 1.4;
        }

        .dark .error-box {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.25);
          color: #fca5a5;
        }

        /* Form */
        .login-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .field-group {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .field-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #374151;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .dark .field-label { color: #94a3b8; }

        .field-label svg {
          color: #3b82f6;
          flex-shrink: 0;
        }

        .input-wrap {
          position: relative;
        }

        .field-input {
          width: 100%;
          padding: 0.9rem 1.25rem;
          border-radius: 14px;
          border: 1.5px solid #e2e8f0;
          background: #f8fafc;
          color: #0f172a;
          font-size: 0.9375rem;
          font-family: 'DM Sans', sans-serif;
          font-weight: 400;
          outline: none;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
          letter-spacing: 0.01em;
        }

        .field-input::placeholder {
          color: #94a3b8;
          font-weight: 300;
        }

        .field-input:focus {
          border-color: #3b82f6;
          background: #fff;
          box-shadow: 0 0 0 4px rgba(59,130,246,0.1);
        }

        .dark .field-input {
          background: rgba(15,23,42,0.6);
          border-color: rgba(255,255,255,0.1);
          color: #e2e8f0;
        }

        .dark .field-input:focus {
          border-color: #3b82f6;
          background: rgba(15,23,42,0.8);
          box-shadow: 0 0 0 4px rgba(59,130,246,0.15);
        }

        .field-input.has-toggle {
          padding-right: 3.25rem;
        }

        .toggle-btn {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.25rem;
          color: #94a3b8;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
        }

        .toggle-btn:hover {
          color: #3b82f6;
          background: rgba(59,130,246,0.08);
        }

        /* Submit */
        .submit-btn {
          width: 100%;
          padding: 1rem 1.5rem;
          border-radius: 14px;
          border: none;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.9375rem;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.02em;
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          box-shadow:
            0 4px 16px rgba(37,99,235,0.35),
            0 1px 0 rgba(255,255,255,0.15) inset;
          transition: all 0.25s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          margin-top: 0.25rem;
        }

        .submit-btn:hover:not(:disabled) {
          background: linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%);
          box-shadow:
            0 6px 24px rgba(37,99,235,0.45),
            0 1px 0 rgba(255,255,255,0.15) inset;
          transform: translateY(-1px);
        }

        .submit-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .submit-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          flex-shrink: 0;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* Footer */
        .login-footer {
          text-align: center;
          font-size: 0.78rem;
          color: #94a3b8;
          letter-spacing: 0.01em;
        }

        /* Divider */
        .header-divider {
          width: 40px;
          height: 2px;
          background: linear-gradient(90deg, #3b82f6, #818cf8);
          border-radius: 99px;
          margin: 1rem auto 0;
        }
      `}</style>

      <div className="login-root">
        <div className="login-wrapper">
          <div className="flex items-center justify-between w-full">
            <button className="back-btn" onClick={() => router.push("/")}>
              <ArrowLeft size={16} />
              Volver al mapa
            </button>

            <button
              onClick={toggleTheme}
              className="group relative p-2.5 rounded-lg bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/15 backdrop-blur-md transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 border border-white/20"
              aria-label="Toggle theme"
              title={
                mounted
                  ? theme === "light"
                    ? "Cambiar a modo oscuro"
                    : "Cambiar a modo claro"
                  : "Toggle theme"
              }
            >
              <div className="absolute inset-0 rounded-xl bg-linear-to-br from-white/0 to-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />

              {!mounted ? (
                <span className="block w-6 h-6" />
              ) : theme === "dark" ? (
                <Sun
                  className="w-6 h-6 text-yellow-300 relative z-10 animate-spin"
                  style={{ animationDuration: "20s" }}
                />
              ) : (
                <Moon className="w-6 h-6 text-blue-500 relative z-10" />
              )}
            </button>
          </div>

          <div className="login-card">
            <div className="login-header">
              <div className="logo-wrap">
                <div className="logo-glow" />
                <div className="logo-icon">
                  <Droplets size={30} color="white" strokeWidth={2} />
                </div>
              </div>
              <h1 className="login-title">Panel de Administración</h1>
              <p className="login-subtitle">
                <span className="subtitle-dot" />
                Monitor de Sequías — Bogotá
              </p>
              <div className="header-divider" />
            </div>

            {error && (
              <div className="error-box">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle
                    cx="8"
                    cy="8"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M8 5v3.5M8 10.5v.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <div className="field-group">
                <label className="field-label">
                  <Mail size={14} />
                  Correo electrónico
                </label>
                <div className="input-wrap">
                  <input
                    className="field-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@ejemplo.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">
                  <Lock size={14} />
                  Contraseña
                </label>
                <div className="input-wrap">
                  <input
                    className="field-input has-toggle"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading ? (
                  <>
                    <div className="spinner" />
                    Ingresando...
                  </>
                ) : (
                  <>
                    <Lock size={17} />
                    Iniciar Sesión
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="login-footer">
            Acceso restringido a administradores autorizados
          </p>
        </div>
      </div>
    </>
  );
}
