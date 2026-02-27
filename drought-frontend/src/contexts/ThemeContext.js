'use client';

import { createContext, useContext, useState } from 'react';

const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

// Lazy initializer — only runs on the client, never on the server.
// By the time this runs, the blocking inline script in layout.js
// has already applied the correct class to <html>, so we just read it.
function readThemeFromDOM() {
  if (typeof window === 'undefined') return 'light'; // SSR fallback
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(readThemeFromDOM);

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';

      // Update DOM class
      document.documentElement.classList.toggle('dark', next === 'dark');

      // Persist preference
      try {
        localStorage.setItem('drought-theme', next);
      } catch (_) {}

      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);