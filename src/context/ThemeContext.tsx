import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ───────────────────────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorTokens {
  // Surfaces
  bg: string;
  card: string;
  cardBorder: string;
  cardAlt: string;     // slightly different card (readonly fields, etc.)
  // Text
  text: string;
  textSub: string;
  textMuted: string;
  // Student brand
  primary: string;
  primaryDim: string;  // tinted background (ECFDF5 in light)
  primaryText: string; // text on primaryDim surface
  // Lecturer brand
  secondary: string;
  secondaryDim: string;
  secondaryText: string;
  // Semantic
  danger: string;
  dangerDim: string;
  success: string;
  successDim: string;
  // Input
  inputBorder: string;
  inputBg: string;
  // Status bar
  statusBarStyle: 'light' | 'dark';
}

// ─── Palettes ─────────────────────────────────────────────────────────────────
const LIGHT: ColorTokens = {
  bg: '#F9FAFB',
  card: '#FFFFFF',
  cardBorder: '#F3F4F6',
  cardAlt: '#FAFAFA',
  text: '#111827',
  textSub: '#6B7280',
  textMuted: '#9CA3AF',
  primary: '#212F77',      // RUN Navy Blue from logo
  primaryDim: '#E8EAF6',
  primaryText: '#1A237E',
  secondary: '#D4AF37',    // Refined RUN Gold
  secondaryDim: '#FEF3C7',
  secondaryText: '#92400E',
  danger: '#DC2626',
  dangerDim: '#FEF2F2',
  success: '#16A34A',      // RUN Green
  successDim: '#DCFCE7',
  inputBorder: '#E5E7EB',
  inputBg: '#FFFFFF',
  statusBarStyle: 'light',
};

const DARK: ColorTokens = {
  bg: '#0F172A',
  card: '#1E293B',
  cardBorder: '#334155',
  cardAlt: '#172033',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  textMuted: '#64748B',
  primary: '#5C6BC0',      // Light Blue for dark mode
  primaryDim: '#1A237E',   
  primaryText: '#C5CAE9',
  secondary: '#b28800ff',
  secondaryDim: '#78350F',
  secondaryText: '#FEF3C7',
  danger: '#F87171',
  dangerDim: '#450A0A',
  success: '#4ADE80',
  successDim: '#14532D',
  inputBorder: '#334155',
  inputBg: '#1E293B',
  statusBarStyle: 'light',
};

// ─── Context ──────────────────────────────────────────────────────────────────
interface ThemeContextValue {
  mode: ThemeMode;
  colors: ColorTokens;
  isDark: boolean;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  colors: LIGHT,
  isDark: false,
  setMode: () => {},
});

const STORAGE_KEY = '@attendance_theme_mode';

// ─── Provider ─────────────────────────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [mode, setModeState] = useState<ThemeMode>('system');

  // Load persisted preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  };

  const resolvedScheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const isDark = resolvedScheme === 'dark';
  const colors = isDark ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ mode, colors, isDark, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTheme() {
  return useContext(ThemeContext);
}
