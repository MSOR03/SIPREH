'use client';

import { FileText, Users, Book, Cloud, Shield } from 'lucide-react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="relative
      bg-linear-to-r from-slate-100 via-blue-50 to-slate-100
      dark:from-gray-900 dark:via-blue-950 dark:to-gray-900
      border border-blue-200 dark:border-gray-700
      shadow-2xl overflow-hidden rounded-xl min-h-[25px]"
    >
      {/* Background accents */}
      <div className="absolute inset-0 opacity-15 dark:opacity-8 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-400 dark:bg-blue-500 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-indigo-400 dark:bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-48 relative">
        <div className="flex flex-col md:flex-row items-center justify-end gap-8">

          {/* Nav links */}
          <div className="flex items-center gap-8 text-sm animate-fade-in">
            {[
              { icon: FileText, label: 'Condiciones de Uso', href: '/condiciones-de-uso' },
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