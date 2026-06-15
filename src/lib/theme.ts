export interface ThemeVars {
  '--bg-primary': string
  '--bg-secondary': string
  '--bg-card': string
  '--text-primary': string
  '--text-secondary': string
  '--accent': string
  '--accent-hover': string
  '--danger': string
  '--border': string
}

export interface Theme {
  id: string
  name: string
  emoji: string
  fontFamily: string
  vars: ThemeVars
}

export const themes: Theme[] = [
  {
    id: 'gold',
    name: '金辉',
    emoji: '🟡',
    fontFamily: '"Georgia", "Noto Serif SC", serif',
    vars: {
      '--bg-primary': '#0f0f0f', '--bg-secondary': '#1a1a1a', '--bg-card': '#1e1e1e',
      '--text-primary': '#e0d5c1', '--text-secondary': '#a09888',
      '--accent': '#c9a96e', '--accent-hover': '#d4b87a',
      '--danger': '#8b4444', '--border': '#2a2a2a',
    },
  },
  {
    id: 'copper',
    name: '铜锈',
    emoji: '⚙️',
    fontFamily: '"Georgia", "Courier New", monospace',
    vars: {
      '--bg-primary': '#1a1410', '--bg-secondary': '#231e17', '--bg-card': '#292218',
      '--text-primary': '#e8dcc8', '--text-secondary': '#b0a088',
      '--accent': '#7a9a7e', '--accent-hover': '#8db091',
      '--danger': '#9b5050', '--border': '#3a3228',
    },
  },
  {
    id: 'cinnabar',
    name: '朱墨',
    emoji: '🏮',
    fontFamily: '"Georgia", "Noto Serif SC", serif',
    vars: {
      '--bg-primary': '#111018', '--bg-secondary': '#1a1822', '--bg-card': '#201e28',
      '--text-primary': '#f0e8e0', '--text-secondary': '#c0b0a0',
      '--accent': '#c45050', '--accent-hover': '#d46565',
      '--danger': '#8b3030', '--border': '#2a2530',
    },
  },
  {
    id: 'cyan',
    name: '青岚',
    emoji: '🌿',
    fontFamily: '"system-ui", "Inter", sans-serif',
    vars: {
      '--bg-primary': '#0d1618', '--bg-secondary': '#141f22', '--bg-card': '#1a2628',
      '--text-primary': '#dde8ea', '--text-secondary': '#98b0b5',
      '--accent': '#5aacb8', '--accent-hover': '#6dc0cc',
      '--danger': '#885555', '--border': '#223338',
    },
  },
]

export type FontSize = 'small' | 'medium' | 'large'

export const fontSizes: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}

const THEME_KEY = 'adventure_theme'
const FONT_KEY = 'adventure_font_size'

export function loadTheme(): string {
  if (typeof window === 'undefined') return 'gold'
  return localStorage.getItem(THEME_KEY) || 'gold'
}

export function saveTheme(id: string): void {
  localStorage.setItem(THEME_KEY, id)
}

export function loadFontSize(): FontSize {
  if (typeof window === 'undefined') return 'medium'
  return (localStorage.getItem(FONT_KEY) as FontSize) || 'medium'
}

export function saveFontSize(size: FontSize): void {
  localStorage.setItem(FONT_KEY, size)
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement
  Object.entries(theme.vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
  root.style.setProperty('--font-family', theme.fontFamily)
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.style.setProperty('--font-size-base', fontSizes[size])
}
