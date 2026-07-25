// File: src/web/ThemeContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  ThemePreference,
  ColorProfile,
  AppearanceMode,
  loadThemeForUser,
  saveThemeForUser,
  applyTheme,
} from './theme.js';

interface ThemeContextValue {
  theme: ThemePreference;
  setProfile: (profile: ColorProfile) => void;
  setMode: (mode: AppearanceMode) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: { profile: 'cyber', mode: 'dark' },
  setProfile: () => {},
  setMode: () => {},
  toggleMode: () => {},
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  userId: string | null;
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ userId, children }) => {
  const [theme, setTheme] = useState<ThemePreference>(() => {
    const t = loadThemeForUser(userId);
    applyTheme(t);
    return t;
  });

  // When userId changes (e.g. user switches human operator), reload their saved theme
  useEffect(() => {
    const t = loadThemeForUser(userId);
    setTheme(t);
    applyTheme(t);
  }, [userId]);

  const updateTheme = useCallback((next: ThemePreference) => {
    setTheme(next);
    saveThemeForUser(userId, next);
    applyTheme(next);
  }, [userId]);

  const setProfile = useCallback((profile: ColorProfile) => {
    updateTheme({ ...theme, profile });
  }, [theme, updateTheme]);

  const setMode = useCallback((mode: AppearanceMode) => {
    updateTheme({ ...theme, mode });
  }, [theme, updateTheme]);

  const toggleMode = useCallback(() => {
    updateTheme({ ...theme, mode: theme.mode === 'dark' ? 'light' : 'dark' });
  }, [theme, updateTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setProfile, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};
