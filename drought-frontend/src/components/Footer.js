"use client";

import { useState, useRef, useEffect } from "react";
import {
  FileText,
  Users,
  Book,
  Shield,
  ExternalLink,
  Code2,
  Globe,
} from "lucide-react";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL
  ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api\/v1\/?$/, "")
  : "http://localhost:8000";

const GITHUB_REPO = "https://github.com/MSOR03/DroughtMonitor";

function DocDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const items = [
    {
      icon: Code2,
      label: "Swagger API Docs",
      description: "Endpoints interactivos",
      href: `${API_BASE}/docs`,
    },
    {
      icon: Book,
      label: "ReDoc API",
      description: "Documentacion detallada",
      href: `${API_BASE}/redoc`,
    },
    {
      icon: Globe,
      label: "GitHub",
      description: "Codigo fuente y docs",
      href: GITHUB_REPO,
    },
  ];

  return (
    <div ref={ref} className="relative flex-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="group flex items-center gap-2
          text-gray-600 dark:text-gray-300
          hover:text-blue-600 dark:hover:text-blue-400
          transition-all duration-300 hover:scale-105"
      >
        <div
          className="p-1.5 rounded-lg transition-colors
          bg-white dark:bg-gray-800
          border border-gray-200 dark:border-transparent
          shadow-sm
          group-hover:bg-blue-50 dark:group-hover:bg-blue-600/20"
        >
          <Book className="w-4 h-4" />
        </div>
        <span className="hidden sm:inline font-medium">Documentacion</span>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2
          w-64 max-w-[calc(100vw-2rem)] bg-white dark:bg-gray-800
          border border-gray-200 dark:border-gray-700
          rounded-xl shadow-2xl overflow-hidden z-50
          animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Documentación
            </p>
          </div>
          {items.map(({ icon: Icon, label, description, href }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5
                hover:bg-blue-50 dark:hover:bg-blue-900/20
                transition-colors group/item"
            >
              <div
                className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700
                group-hover/item:bg-blue-100 dark:group-hover/item:bg-blue-800/30
                transition-colors"
              >
                <Icon className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {description}
                </p>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500 opacity-0 group-hover/item:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Footer() {
  const simpleLinks = [
    {
      icon: FileText,
      label: "Condiciones de Uso",
      href: "/condiciones-de-uso",
    },
    { icon: Users, label: "Creditos", href: "#" },
  ];

  return (
    <footer
      className="relative shrink-0 min-h-[25px]
  bg-linear-to-r from-slate-100 via-blue-50 to-slate-100
  dark:from-gray-900 dark:via-blue-950 dark:to-gray-900
  border border-blue-200 dark:border-gray-700
  shadow-2xl rounded-xl"
    >
      {/* Background accents */}
      <div className="absolute inset-0 overflow-hidden rounded-xl pointer-events-none">
        <div className="absolute inset-0 opacity-15 dark:opacity-8">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-400 dark:bg-blue-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400 dark:bg-purple-500 rounded-full blur-3xl" />
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-50 py-10 sm:py-12 relative">
        <div className="flex items-center justify-center md:justify-end">
          {/* Nav links */}
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 sm:gap-6 text-sm leading-none animate-fade-in">
            {simpleLinks.map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-2
                  flex-none
                  py-1
                  text-gray-600 dark:text-gray-300
                  hover:text-blue-600 dark:hover:text-blue-400
                  transition-all duration-300 hover:scale-105"
              >
                <div
                  className="p-1.5 rounded-lg transition-colors
                  bg-white dark:bg-gray-800
                  border border-gray-200 dark:border-transparent
                  shadow-sm
                  group-hover:bg-blue-50 dark:group-hover:bg-blue-600/20"
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="hidden sm:inline font-medium">{label}</span>
              </Link>
            ))}

            {/* Documentation dropdown */}
            <DocDropdown />

            {/* Admin link */}
            <Link
              href="/admin"
              className="group flex items-center gap-2
                flex-none
                py-1
                text-gray-600 dark:text-gray-300
                hover:text-blue-600 dark:hover:text-blue-400
                transition-all duration-300 hover:scale-105"
            >
              <div
                className="p-1.5 rounded-lg transition-colors
                bg-white dark:bg-gray-800
                border border-gray-200 dark:border-transparent
                shadow-sm
                group-hover:bg-blue-50 dark:group-hover:bg-blue-600/20"
              >
                <Shield className="w-4 h-4" />
              </div>
              <span className="hidden sm:inline font-medium">Admin</span>
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
