/**
 * ClinicX Mobile Design System - Color Tokens
 * Conforming to WCAG AA/AAA contrast ratios and medical application standards.
 */

export const palette = {
  // Cyan (Primary Brand - Medical & Trust)
  cyan50: '#ECFEFF',
  cyan100: '#CFFAFE',
  cyan200: '#A5F3FC',
  cyan300: '#67E8F9',
  cyan400: '#22D3EE',
  cyan500: '#06B6D4',
  cyan600: '#0891B2', // Primary
  cyan700: '#0E7490',
  cyan800: '#155E75',
  cyan900: '#164E63',

  // Emerald (Success & Health)
  emerald50: '#ECFDF5',
  emerald100: '#D1FAE5',
  emerald500: '#10B981',
  emerald600: '#059669', // Accent/Health
  emerald700: '#047857',

  // Amber (Warning / Pending / In-Queue)
  amber50: '#FFFBEB',
  amber100: '#FEF3C7',
  amber500: '#F59E0B',
  amber600: '#D97706',
  amber700: '#B45309',

  // Red (Urgent / Emergency / Cancelled)
  red50: '#FEF2F2',
  red100: '#FEE2E2',
  red500: '#EF4444',
  red600: '#DC2626',
  red700: '#B91C1C',

  // Slate (Neutrals)
  slate25: '#FCFCFD',
  slate50: '#F8FAFC',
  slate100: '#F1F5F9',
  slate200: '#E2E8F0',
  slate300: '#CBD5E1',
  slate400: '#94A3B8',
  slate500: '#64748B',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1E293B',
  slate900: '#0F172A',
  slate950: '#020617',

  // Dark background accents
  navyDark: '#0A0F1D',
  navyCard: '#131B2E',
  navyBorder: '#1E293B',

  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const lightColors = {
  isDark: false,
  primary: palette.cyan600,
  primaryLight: palette.cyan50,
  primaryBorder: palette.cyan200,
  onPrimary: palette.white,

  secondary: palette.cyan800,
  secondaryLight: palette.cyan100,
  onSecondary: palette.white,

  accent: palette.emerald600,
  accentLight: palette.emerald50,
  onAccent: palette.white,

  warning: palette.amber600,
  warningLight: palette.amber50,
  onWarning: palette.white,

  destructive: palette.red600,
  destructiveLight: palette.red50,
  onDestructive: palette.white,

  background: palette.slate50,
  surface: palette.white,
  surfaceSecondary: palette.slate100,
  surfaceElevated: palette.white,

  border: palette.slate200,
  borderSubtle: palette.slate100,

  textPrimary: palette.slate900,
  textSecondary: palette.slate600,
  textMuted: palette.slate500,
  textInverse: palette.white,

  // Status Badges
  statusWaitingBg: palette.amber50,
  statusWaitingText: palette.amber700,
  statusInConsultBg: palette.cyan50,
  statusInConsultText: palette.cyan800,
  statusCompletedBg: palette.emerald50,
  statusCompletedText: palette.emerald700,
  statusCancelledBg: palette.red50,
  statusCancelledText: palette.red700,

  // System
  statusBar: 'dark-content' as 'dark-content' | 'light-content',
  navBar: palette.white,
  tint: palette.cyan600,
};

export const darkColors: typeof lightColors = {
  isDark: true,
  primary: palette.cyan500,
  primaryLight: 'rgba(6, 182, 212, 0.15)',
  primaryBorder: palette.cyan800,
  onPrimary: palette.white,

  secondary: palette.cyan400,
  secondaryLight: 'rgba(34, 211, 238, 0.15)',
  onSecondary: palette.slate900,

  accent: palette.emerald500,
  accentLight: 'rgba(16, 185, 129, 0.15)',
  onAccent: palette.white,

  warning: palette.amber500,
  warningLight: 'rgba(245, 158, 11, 0.15)',
  onWarning: palette.slate900,

  destructive: palette.red500,
  destructiveLight: 'rgba(239, 68, 68, 0.15)',
  onDestructive: palette.white,

  background: palette.navyDark,
  surface: palette.navyCard,
  surfaceSecondary: palette.slate900,
  surfaceElevated: '#1A243D',

  border: palette.navyBorder,
  borderSubtle: 'rgba(255, 255, 255, 0.08)',

  textPrimary: palette.slate50,
  textSecondary: palette.slate300,
  textMuted: palette.slate400,
  textInverse: palette.slate900,

  // Status Badges
  statusWaitingBg: 'rgba(245, 158, 11, 0.15)',
  statusWaitingText: palette.amber500,
  statusInConsultBg: 'rgba(6, 182, 212, 0.15)',
  statusInConsultText: palette.cyan400,
  statusCompletedBg: 'rgba(16, 185, 129, 0.15)',
  statusCompletedText: palette.emerald500,
  statusCancelledBg: 'rgba(239, 68, 68, 0.15)',
  statusCancelledText: palette.red500,

  // System
  statusBar: 'light-content' as const,
  navBar: palette.navyCard,
  tint: palette.cyan400,
};

export type ThemeColors = typeof lightColors;
