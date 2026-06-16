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
  '--font-family': string
  '--border-radius': string
  '--border-width': string
  '--border-style': string
  '--button-depth': string
  '--bg-texture': string
}

export interface Theme {
  id: string
  name: string
  emoji: string
  vars: ThemeVars
}

export const themes: Theme[] = [
  {
    id: 'gold',
    name: '金辉',
    emoji: '🟡',
    vars: {
      '--bg-primary': '#0f0f0f',
      '--bg-secondary': '#1a1a1a',
      '--bg-card': '#1e1e1e',
      '--text-primary': '#e0d5c1',
      '--text-secondary': '#a09888',
      '--accent': '#c9a96e',
      '--accent-hover': '#d4b87a',
      '--danger': '#8b4444',
      '--border': '#2a2a2a',
      '--font-family': '"Georgia", "Noto Serif SC", serif',
      '--border-radius': '0.75rem',
      '--border-width': '1px',
      '--border-style': 'solid',
      '--button-depth': '0 1px 3px rgba(0,0,0,0.3)',
      '--bg-texture': 'none',
    },
  },
  {
    id: 'steam',
    name: '蒸汽',
    emoji: '⚙️',
    vars: {
      '--bg-primary': '#1a1410',
      '--bg-secondary': '#231e17',
      '--bg-card': '#292218',
      '--text-primary': '#e8dcc8',
      '--text-secondary': '#b0a088',
      '--accent': '#b8954a',
      '--accent-hover': '#c9a65d',
      '--danger': '#9b5050',
      '--border': '#4a3828',
      '--font-family': '"Impact", "SimHei", "PingFang SC", sans-serif',
      '--border-radius': '0.25rem',
      '--border-width': '2px',
      '--border-style': 'double',
      '--button-depth': '2px 2px 0 var(--border)',
      '--bg-texture': 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(180,140,60,0.03) 2px, rgba(180,140,60,0.03) 4px)',
    },
  },
  {
    id: 'cinnabar',
    name: '朱墨',
    emoji: '🏮',
    vars: {
      '--bg-primary': '#111018',
      '--bg-secondary': '#1a1822',
      '--bg-card': '#201e28',
      '--text-primary': '#f0e8e0',
      '--text-secondary': '#c0b0a0',
      '--accent': '#c45050',
      '--accent-hover': '#d46565',
      '--danger': '#8b3030',
      '--border': '#2a2530',
      '--font-family': '"KaiTi", "STKaiti", "Noto Serif SC", serif',
      '--border-radius': '0.5rem',
      '--border-width': '1px',
      '--border-style': 'solid',
      '--button-depth': '0 1px 2px rgba(196,80,80,0.15)',
      '--bg-texture': 'none',
    },
  },
  {
    id: 'cyber',
    name: '赛博',
    emoji: '💜',
    vars: {
      '--bg-primary': '#0a0a1a',
      '--bg-secondary': '#0f0f24',
      '--bg-card': '#141430',
      '--text-primary': '#d0d0ff',
      '--text-secondary': '#8888bb',
      '--accent': '#00ffcc',
      '--accent-hover': '#33ffdd',
      '--danger': '#ff3366',
      '--border': '#1a1a44',
      '--font-family': '"Courier New", "Fira Code", "PingFang SC", monospace',
      '--border-radius': '0.25rem',
      '--border-width': '1px',
      '--border-style': 'solid',
      '--button-depth': '0 0 10px rgba(0,255,204,0.2)',
      '--bg-texture': 'repeating-linear-gradient(0deg, transparent, transparent 20px, rgba(0,255,204,0.02) 20px, rgba(0,255,204,0.02) 21px), repeating-linear-gradient(90deg, transparent, transparent 20px, rgba(0,255,204,0.02) 20px, rgba(0,255,204,0.02) 21px)',
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

export function setTheme(themeId: string): void {
  document.documentElement.setAttribute('data-theme', themeId)
  localStorage.setItem(THEME_KEY, themeId)
  document.cookie = `theme=${themeId}; path=/; max-age=31536000; SameSite=Lax`
}

export function getThemeCookie(cookieHeader: string): string {
  const match = cookieHeader.match(/(?:^|;\s*)theme=([^;]*)/)
  return match?.[1] || 'gold'
}

export function applyTheme(theme: Theme): void {
  setTheme(theme.id)
}

export function applyFontSize(size: FontSize): void {
  document.documentElement.style.setProperty('--font-size-base', fontSizes[size])
}
