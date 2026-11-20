import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isPayRoute = typeof window !== 'undefined' && window.location.pathname === '/pay';

  const [theme, setThemeState] = useState<Theme>(() => {
    if (isPayRoute) {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch {
        return 'light';
      }
    }
    try {
      const saved = localStorage.getItem('mix_theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    if (!isPayRoute) {
      try {
        localStorage.setItem('mix_theme', theme);
      } catch {
        // storage unavailable
      }
    }
  }, [theme, isPayRoute]);

  // On /pay route, respond to color-scheme media changes without touching localStorage
  useEffect(() => {
    if (!isPayRoute || typeof window === 'undefined') return;
    try {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = (e: MediaQueryListEvent) => {
        setThemeState(e.matches ? 'dark' : 'light');
      };
      if (mql.addEventListener) {
        mql.addEventListener('change', listener);
        return () => mql.removeEventListener('change', listener);
      }
    } catch {
      // fallback
    }
  }, [isPayRoute]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
