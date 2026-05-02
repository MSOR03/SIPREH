"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Moon, Sun, Activity } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

const BP = process.env.NEXT_PUBLIC_BASE_PATH || '';

const ENTITY_LOGOS = [
  {
    src: `${BP}/logos/entidad1.png`,
    alt: "Agencia Atenea",
    href: "https://www.agenciaatenea.gov.co/",
  },
  {
    src: `${BP}/logos/entidad2.png`,
    alt: "Universidad Nacional de Colombia",
    href: "https://bogota.unal.edu.co/",
  },
  {
    src: `${BP}/logos/entidad3.png`,
    alt: "Grupo de Investigación HERMES",
    href: "http://www.hermes.unal.edu.co/pages/Consultas/Grupo.xhtml?idGrupo=236&opcion=1",
  },
];

const DASHBOARD_LOGOS = {
  light: { src: `${BP}/logos/Logo_Dashboard_Diurno.png`, alt: "Logo Dashboard Diurno" },
  dark: { src: `${BP}/logos/Logo_Dashboard_Nocturno.png`, alt: "Logo Dashboard Nocturno" },
};

export default function Header() {
  const { theme, toggleTheme } = useTheme();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const dashboardLogo = theme === "dark" ? DASHBOARD_LOGOS.dark : DASHBOARD_LOGOS.light;

  return (
    <header className="relative bg-linear-to-r from-blue-600 via-blue-700 to-blue-800 dark:from-blue-900 dark:via-blue-950 dark:to-gray-900 shadow-2xl overflow-hidden rounded-xl border border-blue-500/30 dark:border-gray-700">
      {/* Animated background effect */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-0 -left-1/4 w-1/2 h-full bg-white/10 blur-3xl rounded-full animate-shimmer" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-full bg-blue-300/10 blur-3xl rounded-full" />
      </div>

      <div className="container mx-auto px-6 py-5 relative">
        <div className="flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-400/40 dark:bg-blue-500/40 rounded-xl blur-lg group-hover:blur-xl transition-all duration-300" />
              <div className="relative w-14 h-14 bg-linear-to-br from-white to-blue-50 dark:from-white/10 dark:to-blue-900/20 backdrop-blur-md rounded-xl flex items-center justify-center shadow-xl border border-white/20 group-hover:scale-105 transition-transform duration-300">
                {mounted && (
                  <Image
                    src={dashboardLogo.src}
                    alt={dashboardLogo.alt}
                    width={44}
                    height={44}
                    unoptimized
                    className="w-11 h-11 object-contain"
                  />
                )}
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg" />
              </div>
            </div>

            <div className="animate-slide-down">
              <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white drop-shadow-lg">
                SIPREH
              </h1>
              <p className="text-xs sm:text-sm text-blue-100 font-medium drop-shadow mt-0.5">
                Sistema Integrado de Predicción y Monitoreo de Sequías
                Hidrometeorológicas
              </p>
              <p className="text-xs text-blue-50 dark:text-blue-200 flex items-center gap-1.5 mt-0.5">
                <Activity className="w-2.5 h-2.5 animate-pulse" />
                <span className="font-medium">Bogotá, Colombia</span>
                <span className="text-blue-200 dark:text-blue-300">•</span>
                <span className="text-xs">En línea</span>
              </p>
            </div>
          </div>

          {/* Right side - Logos de entidades + Theme toggle */}
          <div className="flex items-center gap-4">
            {/* Logos de entidades asociadas */}
            <div className="hidden sm:flex items-center gap-3 bg-white/10 dark:bg-white/5 backdrop-blur-md rounded-xl px-5 py-2.5 border border-white/15">
              {ENTITY_LOGOS.map((logo, index) => (
                <div key={logo.alt} className="flex items-center gap-3">
                  {index > 0 && (
                    <div className="w-px h-7 bg-white/20" />
                  )}
                  <a
                    href={logo.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={logo.alt}
                    className="group/logo relative"
                  >
                    <div className="absolute inset-0 bg-white/0 group-hover/logo:bg-white/10 rounded-lg transition-all duration-300" />
                    <Image
                      src={logo.src}
                      alt={logo.alt}
                      width={36}
                      height={36}
                      unoptimized
                      className="h-9 w-auto object-contain p-1 rounded-lg hover:scale-110 transition-transform duration-300"
                    />
                  </a>
                </div>
              ))}
            </div>

            {/* Theme toggle */}
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
                <Moon className="w-6 h-6 text-white relative z-10" />
              )}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
