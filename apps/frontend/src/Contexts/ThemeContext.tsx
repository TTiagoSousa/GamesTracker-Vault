import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type ThemeMode = 'dark' | 'light' | 'auto';

interface ThemeContextType {
  mode: ThemeMode;
  /** The theme actually on screen (resolves 'auto'). */
  isDark: boolean;
  handleDarkMode: () => void;
  handleLightMode: () => void;
  handleAutoMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Night is the Vault's main theme
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem('mode');
      return stored === 'light' || stored === 'auto' || stored === 'dark' ? stored : 'dark';
    } catch {
      return 'dark';
    }
  });

  // Updates the body class whenever "mode" changes
  useEffect(() => {
    if (mode === 'light') {
      document.body.className = 'Light_Mode';
    } else if (mode === 'dark') {
      document.body.className = 'Dark_Mode';
    } else {
      // auto mode — switches based on the time of day
      const currentTime = new Date().getHours();
      if (currentTime >= 20 || currentTime < 7) {
        document.body.className = 'Dark_Mode';
      } else {
        document.body.className = 'Light_Mode';
      }
    }
  }, [mode]);

  // Functions to switch theme
  const handleDarkMode = () => {
    localStorage.setItem('mode', 'dark');
    setMode('dark');
  };

  const handleLightMode = () => {
    localStorage.setItem('mode', 'light');
    setMode('light');
  };

  const handleAutoMode = () => {
    localStorage.setItem('mode', 'auto');
    setMode('auto');
  };

  const hour = new Date().getHours();
  const isDark = mode === 'dark' || (mode === 'auto' && (hour >= 20 || hour < 7));

  return (
    <ThemeContext.Provider
      value={{
        mode,
        isDark,
        handleDarkMode,
        handleLightMode,
        handleAutoMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- the hook belongs with its provider
export function useTheme() {
  const context = useContext(ThemeContext);
  
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  
  return context;
}