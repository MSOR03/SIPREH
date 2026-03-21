"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ArrowLeft,
  Moon,
  Sun,
  Cloud,
  AlertTriangle,
  Database,
  ShieldCheck,
  Globe,
  BookOpen,
  Scale,
  RefreshCw,
  Mail,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const sections = [
  {
    id: 1,
    icon: Globe,
    title: "Aceptación de las Condiciones",
    content:
      "Al acceder y utilizar la Plataforma de Monitoreo y Predicción de Sequías, usted acepta cumplir y quedar vinculado por las presentes Condiciones de Uso. Si no está de acuerdo con alguna parte de estas condiciones, le rogamos que no utilice la plataforma. El uso continuado de la plataforma constituye la aceptación de cualquier modificación que se realice a estas condiciones.",
  },
  {
    id: 2,
    icon: Database,
    title: "Uso de Datos e Información",
    content:
      "La información meteorológica, índices de sequía y predicciones proporcionadas por esta plataforma tienen carácter científico y de referencia. Los datos son generados mediante modelos computacionales y fuentes oficiales del IDEAM y entidades afines. El usuario podrá consultar, descargar y utilizar los datos para fines académicos, de investigación y planificación, citando adecuadamente la fuente. Queda prohibida la comercialización de los datos sin autorización expresa.",
  },
  {
    id: 3,
    icon: AlertTriangle,
    title: "Limitación de Responsabilidad",
    content:
      "Las predicciones y análisis ofrecidos por la plataforma son herramientas de apoyo a la toma de decisiones y no constituyen una garantía sobre condiciones climáticas futuras. La plataforma no se responsabiliza por daños directos, indirectos, incidentales o consecuentes derivados del uso o la imposibilidad de uso de la información aquí presentada. Las decisiones basadas en los datos de esta plataforma son responsabilidad exclusiva del usuario.",
  },
  {
    id: 4,
    icon: ShieldCheck,
    title: "Privacidad y Protección de Datos",
    content:
      "La plataforma puede recopilar datos de uso anónimos con el fin de mejorar la experiencia del usuario y el rendimiento del sistema. No se recopilan datos personales sin el consentimiento explícito del usuario. Los datos de sesión se gestionan de forma segura y no son compartidos con terceros, salvo obligación legal. Para el módulo de administración, las credenciales son almacenadas de forma cifrada y se aplican estándares modernos de seguridad.",
  },
  {
    id: 5,
    icon: BookOpen,
    title: "Propiedad Intelectual",
    content:
      "Todo el contenido de la plataforma, incluyendo diseño, código fuente, modelos predictivos, visualizaciones, textos y logotipos, es propiedad de sus desarrolladores y se encuentra protegido por las leyes de propiedad intelectual vigentes en Colombia. Se permite la reproducción parcial con fines académicos o informativos, siempre que se incluya la cita correspondiente y no se alteren los datos originales.",
  },
  {
    id: 6,
    icon: Scale,
    title: "Conducta del Usuario",
    content:
      "El usuario se compromete a utilizar la plataforma de manera responsable y ética. Queda expresamente prohibido: intentar vulnerar la seguridad del sistema, realizar scraping automatizado masivo, publicar información falsa o engañosa, y cualquier uso que contravenga la legislación colombiana vigente. La plataforma se reserva el derecho de restringir el acceso a usuarios que incumplan estas condiciones.",
  },
  {
    id: 7,
    icon: RefreshCw,
    title: "Modificaciones a las Condiciones",
    content:
      "La plataforma se reserva el derecho de modificar estas Condiciones de Uso en cualquier momento. Los cambios entrarán en vigor inmediatamente tras su publicación en esta página. Se recomienda a los usuarios revisar periódicamente este documento. La fecha de última actualización se indica al pie de esta página.",
  },
  {
    id: 8,
    icon: Mail,
    title: "Contacto",
    content:
      "Para consultas relacionadas con estas Condiciones de Uso, el tratamiento de datos o el funcionamiento de la plataforma, puede comunicarse con el equipo de desarrollo a través de los canales institucionales de la universidad. Responderemos a su solicitud en un plazo razonable de tiempo.",
  },
];

export default function CondicionesDeUsoPage() {
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

        .tou-root {
          font-family: 'DM Sans', sans-serif;
          min-height: 100vh;
          background: #f0f4f8;
          padding: 2rem 1rem 4rem;
          position: relative;
          overflow-x: hidden;
        }

        .dark .tou-root {
          background: #0d1117;
        }

        .tou-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 60% 40% at 15% 10%, rgba(59,130,246,0.10) 0%, transparent 65%),
            radial-gradient(ellipse 50% 50% at 85% 85%, rgba(99,102,241,0.08) 0%, transparent 65%),
            radial-gradient(ellipse 40% 30% at 50% 50%, rgba(147,197,253,0.05) 0%, transparent 60%);
          pointer-events: none;
        }

        .dark .tou-root::before {
          background:
            radial-gradient(ellipse 60% 40% at 15% 10%, rgba(59,130,246,0.07) 0%, transparent 65%),
            radial-gradient(ellipse 50% 50% at 85% 85%, rgba(99,102,241,0.06) 0%, transparent 65%);
        }

        .tou-container {
          position: relative;
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        /* Top bar */
        .tou-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
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

        .theme-btn {
          position: relative;
          padding: 0.625rem;
          border-radius: 10px;
          background: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.8);
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .theme-btn:hover {
          background: rgba(255,255,255,0.8);
          box-shadow: 0 4px 12px rgba(0,0,0,0.10);
          transform: scale(1.05);
        }

        .dark .theme-btn {
          background: rgba(255,255,255,0.05);
          border-color: rgba(255,255,255,0.08);
        }

        .dark .theme-btn:hover {
          background: rgba(255,255,255,0.10);
        }

        /* Hero card */
        .tou-hero {
          background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 50%, #3b82f6 100%);
          border-radius: 28px;
          padding: 2.75rem 3rem;
          color: white;
          position: relative;
          overflow: hidden;
          box-shadow:
            0 8px 32px rgba(37,99,235,0.30),
            0 1px 0 rgba(255,255,255,0.15) inset;
        }

        .tou-hero::before {
          content: '';
          position: absolute;
          top: -60px;
          right: -60px;
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          pointer-events: none;
        }

        .tou-hero::after {
          content: '';
          position: absolute;
          bottom: -40px;
          left: -40px;
          width: 160px;
          height: 160px;
          border-radius: 50%;
          background: rgba(255,255,255,0.04);
          pointer-events: none;
        }

        .hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.375rem 0.875rem;
          background: rgba(255,255,255,0.15);
          border: 1px solid rgba(255,255,255,0.25);
          border-radius: 99px;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin-bottom: 1.25rem;
        }

        .hero-title {
          font-family: 'Syne', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.15;
          margin: 0 0 0.75rem;
        }

        .hero-subtitle {
          font-size: 0.95rem;
          opacity: 0.82;
          font-weight: 400;
          line-height: 1.6;
          margin: 0;
          max-width: 520px;
        }

        .hero-meta {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          margin-top: 1.75rem;
          padding-top: 1.5rem;
          border-top: 1px solid rgba(255,255,255,0.15);
          font-size: 0.8125rem;
          opacity: 0.8;
        }

        .hero-meta-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        /* Sections */
        .tou-sections {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .tou-section {
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-radius: 20px;
          border: 1px solid rgba(255,255,255,0.9);
          box-shadow:
            0 2px 4px rgba(0,0,0,0.03),
            0 8px 24px rgba(0,0,0,0.05);
          padding: 1.75rem 2rem;
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
          transition: box-shadow 0.25s, transform 0.25s;
        }

        .tou-section:hover {
          box-shadow:
            0 4px 8px rgba(0,0,0,0.04),
            0 16px 40px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }

        .dark .tou-section {
          background: rgba(22,28,42,0.88);
          border-color: rgba(255,255,255,0.06);
          box-shadow:
            0 2px 4px rgba(0,0,0,0.2),
            0 8px 24px rgba(0,0,0,0.3);
        }

        .dark .tou-section:hover {
          box-shadow:
            0 4px 8px rgba(0,0,0,0.25),
            0 16px 40px rgba(0,0,0,0.4);
        }

        .section-icon-wrap {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.10) 100%);
          border: 1px solid rgba(59,130,246,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #2563eb;
          margin-top: 0.1rem;
        }

        .dark .section-icon-wrap {
          background: linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(99,102,241,0.14) 100%);
          border-color: rgba(59,130,246,0.25);
          color: #60a5fa;
        }

        .section-body {
          flex: 1;
          min-width: 0;
        }

        .section-header {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          margin-bottom: 0.6rem;
        }

        .section-num {
          font-size: 0.7rem;
          font-weight: 700;
          color: #2563eb;
          background: rgba(59,130,246,0.10);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 6px;
          padding: 0.15rem 0.5rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }

        .dark .section-num {
          color: #60a5fa;
          background: rgba(59,130,246,0.15);
          border-color: rgba(59,130,246,0.3);
        }

        .section-title {
          font-family: 'Syne', sans-serif;
          font-size: 1.0rem;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.01em;
          margin: 0;
        }

        .dark .section-title {
          color: #e2e8f0;
        }

        .section-text {
          font-size: 0.9rem;
          color: #475569;
          line-height: 1.7;
          margin: 0;
          font-weight: 400;
        }

        .dark .section-text {
          color: #94a3b8;
        }

        /* Footer note */
        .tou-footer {
          text-align: center;
          font-size: 0.78rem;
          color: #94a3b8;
          letter-spacing: 0.01em;
          padding-top: 0.5rem;
        }

        .tou-footer a {
          color: #2563eb;
          text-decoration: none;
          font-weight: 500;
        }

        .tou-footer a:hover {
          text-decoration: underline;
        }

        .dark .tou-footer a {
          color: #60a5fa;
        }
      `}</style>

      <div className="tou-root">
        <div className="tou-container">

          {/* Top bar */}
          <div className="tou-topbar">
            <button className="back-btn" onClick={() => router.push("/")}>
              <ArrowLeft size={16} />
              Volver al mapa
            </button>

            <button
              onClick={toggleTheme}
              className="theme-btn"
              aria-label="Toggle theme"
              title={theme === "light" ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5 text-yellow-300" style={{ animationDuration: "20s" }} />
              ) : (
                <Moon className="w-5 h-5 text-blue-500" />
              )}
            </button>
          </div>

          {/* Hero */}
          <div className="tou-hero">
            <div className="hero-badge">
              <FileText size={12} />
              Documento Legal
            </div>
            <h1 className="hero-title">Condiciones de Uso</h1>
            <p className="hero-subtitle">
              Plataforma de Monitoreo y Predicción de Sequías para la región de Bogotá, Colombia.
              Lea detenidamente estas condiciones antes de utilizar la plataforma.
            </p>
            <div className="hero-meta">
              <span className="hero-meta-item">
                <Cloud size={13} />
                Bogotá, Colombia
              </span>
              <span className="hero-meta-item">
                <RefreshCw size={13} />
                Última actualización: Marzo 2026
              </span>
            </div>
          </div>

          {/* Sections */}
          <div className="tou-sections">
            {sections.map(({ id, icon: Icon, title, content }) => (
              <div key={id} className="tou-section">
                <div className="section-icon-wrap">
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <div className="section-body">
                  <div className="section-header">
                    <span className="section-num">Art. {id}</span>
                    <h2 className="section-title">{title}</h2>
                  </div>
                  <p className="section-text">{content}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Footer note */}
          <p className="tou-footer">
            Al usar esta plataforma, usted confirma haber leído y aceptado estas condiciones.
            <br />
            Para más información visita la{" "}
            <a href="/">página principal</a>.
          </p>

        </div>
      </div>
    </>
  );
}
