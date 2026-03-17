'use client';

import { FileText, Users, Book, Cloud, Shield } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative
      bg-linear-to-r from-slate-100 via-blue-50 to-slate-100
      dark:from-gray-900 dark:via-blue-950 dark:to-gray-900
      border border-blue-200 dark:border-gray-700
      shadow-2xl overflow-hidden rounded-xl"
    >
      {/* Background accents */}
      <div className="absolute inset-0 opacity-15 dark:opacity-8 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-400 dark:bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400 dark:bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-7 relative">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">

          {/* Brand */}
          <div className="flex items-center gap-5 animate-slide-down">
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-400/30 dark:bg-blue-500/40 rounded-xl blur-lg group-hover:blur-xl transition-all" />
              <div className="relative p-3 bg-linear-to-br from-blue-500 to-blue-700 dark:from-blue-600 dark:to-blue-800 rounded-xl shadow-xl border border-blue-300/50 dark:border-blue-400/30">
                <Cloud className="w-7 h-7 text-white" strokeWidth={2.5} />
              </div>
            </div>
            <div className="text-center md:text-left">
              <p className="font-bold text-gray-800 dark:text-white text-base tracking-wide">
                Plataforma de Monitoreo y Predicción de Sequías
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 mt-1">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                Bogotá, Colombia © 2026
              </p>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-8 text-sm animate-fade-in">
            {[
              { icon: FileText, label: 'Condiciones de Uso', href: '#' },
              { icon: Users,    label: 'Créditos',           href: '#' },
              { icon: Book,     label: 'Documentación',      href: '#' },
              { icon: Shield,   label: 'Admin',              href: '/admin' },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="group flex items-center gap-2
                  text-gray-600 dark:text-gray-300
                  hover:text-blue-600 dark:hover:text-blue-400
                  transition-all duration-300 hover:scale-110"
              >
                <div className="p-1.5 rounded-lg transition-colors
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
          </div>

        </div>
      </div>
    </footer>
  );
}