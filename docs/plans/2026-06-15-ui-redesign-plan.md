# UI 重构：主题系统 + 统一导航 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** 实现4套主题配色系统、统一返回按钮、基础设置改为主题+字体选择

**Architecture:** 主题数据存 `src/lib/theme.ts`，通过设置 `document.documentElement.style.setProperty` 动态切换 CSS 变量。选择存 localStorage。使用 `ThemeProvider` context 包裹应用。

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4 (CSS variables)

---

### Task 1: 主题系统核心模块

**Files:**
- Create: `src/lib/theme.ts`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 创建主题定义和切换逻辑**

创建 `src/lib/theme.ts`：

```typescript
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
```

- [ ] **Step 2: 更新 globals.css**

在 `globals.css` 中把字体和字号改为引用 CSS 变量：

将 `body { font-family: ... }` 替换为：
```css
body {
  font-family: var(--font-family, "Georgia", "Noto Serif SC", serif);
  font-size: var(--font-size-base, 16px);
}
```

- [ ] **Step 3: 在 layout.tsx 添加 ThemeProvider**

创建 `src/components/ThemeProvider.tsx`：
```tsx
'use client'

import { useEffect } from 'react'
import { themes, loadTheme, applyTheme, loadFontSize, applyFontSize } from '@/lib/theme'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const id = loadTheme()
    const theme = themes.find(t => t.id === id) || themes[0]
    applyTheme(theme)
    const size = loadFontSize()
    applyFontSize(size)
  }, [])
  return <>{children}</>
}
```

在 `layout.tsx` 的 `<body>` 内包裹 `<ThemeProvider>`：
```tsx
<ThemeProvider>
  <GameProvider>
    {children}
    <AccountButton />
    <SystemSettings />
  </GameProvider>
</ThemeProvider>
```

- [ ] **Step 4: 验证编译并提交**

```bash
npx tsc --noEmit
git add src/lib/theme.ts src/components/ThemeProvider.tsx src/app/globals.css src/app/layout.tsx
git commit -m "feat: 4套主题系统核心 — 金辉/铜锈/朱墨/青岚 + ThemeProvider"
```

---

### Task 2: 基础设置改为主题+字体选择

**Files:**
- Modify: `src/components/SystemSettings.tsx`

- [ ] **Step 1: 重写基础设置部分**

把"基础设置"的存档/账户内容替换为主题选择 + 字体大小。移除 `useState` 中的账户/密码/状态变量，移除 `onlineRegister/onlineLogin/localListSaves` 导入。

基础设置内容改为：

```tsx
import { themes, loadTheme, saveTheme, applyTheme, loadFontSize, saveFontSize, applyFontSize, FontSize, Theme } from '@/lib/theme'

// 在组件内新增 state：
const [currentTheme, setCurrentTheme] = useState(loadTheme())
const [currentFontSize, setCurrentFontSize] = useState(loadFontSize())

// 切换主题：
const handleThemeChange = (id: string) => {
  const theme = themes.find(t => t.id === id)
  if (theme) {
    setCurrentTheme(id)
    saveTheme(id)
    applyTheme(theme)
  }
}

// 切换字体：
const handleFontSizeChange = (size: FontSize) => {
  setCurrentFontSize(size)
  saveFontSize(size)
  applyFontSize(size)
}
```

基础设置 UI（替换原来的账号/存档内容）：
```tsx
{page === 'general' && (
  <div>
    <div className="flex items-center px-5 pt-6 pb-4">
      <button onClick={() => setPage('menu')} className="...">← 返回</button>
      <h2 className="text-lg font-bold">👤 基础设置</h2>
    </div>
    <div className="px-6 pb-6 space-y-6">
      {/* 主题配色 */}
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-3">主题配色</label>
        <div className="grid grid-cols-2 gap-2">
          {themes.map(t => (
            <button key={t.id} onClick={() => handleThemeChange(t.id)}
              className={`p-3 rounded-xl border-2 text-left transition-colors ${
                currentTheme === t.id ? 'border-[var(--accent)] bg-[var(--bg-card)]' : 'border-[var(--border)] hover:border-[var(--accent)]/50'
              }`}>
              <span className="text-lg">{t.emoji}</span>
              <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 字体大小 */}
      <div>
        <label className="block text-sm text-[var(--text-secondary)] mb-3">字体大小</label>
        <div className="flex gap-2">
          {(['small','medium','large'] as FontSize[]).map(s => (
            <button key={s} onClick={() => handleFontSizeChange(s)}
              className={`flex-1 py-2.5 rounded-xl text-sm border transition-colors ${
                currentFontSize === s ? 'border-[var(--accent)] bg-[var(--bg-card)] text-[var(--text-primary)]' : 'border-[var(--border)] text-[var(--text-secondary)]'
              }`}>
              {{small:'小',medium:'中',large:'大'}[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 2: 清理 SystemSettings 中的账户相关代码**

移除这些不再需要的导入和 state：
- 删除 `import * as saveService from '@/lib/save-service'`
- 删除 `import { onlineRegister, onlineLogin } from '@/lib/online-storage'`
- 删除 `import { localListSaves } from '@/lib/local-storage'`
- 删除 `accountName, password, storageStatus, isLoggedIn, migrating, localSaveCount` state
- 删除 `handleRegister, handleLogin, handleLogout, handleMigrate, handleSwitchOffline` 函数

- [ ] **Step 3: 验证编译并提交**

```bash
npx tsc --noEmit
npm test
git add src/components/SystemSettings.tsx
git commit -m "feat: 基础设置改为主题配色+字体大小选择"
```

---

### Task 3: 统一所有返回按钮

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/creator/page.tsx` 或 `src/components/WorldCreator.tsx`

- [ ] **Step 1: 统一 page.tsx 的返回按钮**

所有返回按钮统一为：
```tsx
<button onClick={() => setScreen('menu')}
  className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
  ← 返回
</button>
```

- 世界选择页面：把"← 返回主菜单"文字链接改为统一按钮样式，放在左上角
- 读档页面：把"← 返回"全宽按钮改为统一按钮样式，放在左上角

- [ ] **Step 2: 统一创作台的返回按钮**

修改 `WorldCreator.tsx` 的返回按钮为：
```tsx
<button onClick={() => router.push('/')}
  className="px-4 py-2 rounded-xl border border-[var(--border)] text-sm text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors">
  ← 返回
</button>
```

- [ ] **Step 3: 统一设置子页面的返回按钮**

设置中已使用 `←` 纯文本按钮，改为统一样式。

- [ ] **Step 4: 验证并提交**

```bash
npx tsc --noEmit
git add src/app/page.tsx src/components/WorldCreator.tsx
git commit -m "fix: 统一所有页面返回按钮样式为 ← 返回"
```

---

### Task 4: 最终验证

- [ ] **Step 1: 本地测试**

```bash
npm run dev
```

浏览器测试：
1. 主菜单 → 2个按钮 + 右上角登录/齿轮
2. 齿轮 → 基础设置 → 切换4个主题 → 颜色变化
3. 切换字体大小 → 文字变化
4. 刷新 → 主题保持
5. 所有"← 返回"按钮样式一致
6. 登录面板独立于设置

- [ ] **Step 2: 运行测试并提交**

```bash
npm test
git add -A && git commit -m "test: 主题系统和统一导航通过" && git push
```
