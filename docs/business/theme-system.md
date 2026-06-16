---
name: theme-system
description: CSS data-theme 属性切换（零 JS 运行时）、globals.css 中的四个主题变量块、SSR Cookie 同步（layout.tsx async cookies → getThemeCookie）、setTheme() 三路写入（DOM / localStorage / cookie）、字号管理（applyFontSize / FontSize / fontSizes 映射表）
---

# 主题系统

## 设计原则：零 JS 运行时换肤

主题切换不依赖任何 JS 运行时逻辑（删除了 `ThemeProvider.tsx`）。通过 CSS `data-theme` 属性 + CSS 变量实现，SSR 首帧通过 Cookie 传递主题偏好。

## CSS 变量定义

`src/app/globals.css` 包含四个 `[data-theme]` 块：

| 主题 ID | 名称 | 主色调 |
|--------|------|-------|
| gold | 鎏金 | 金色系 |
| steam | 蒸汽 | 蓝色系 |
| cinnabar | 朱砂 | 红色系 |
| cyber | 赛博 | 霓虹色系 |

每个块定义 15 个 CSS 变量，覆盖背景、文字、边框、强调色等。组件通过 `var(--bg-primary)`、`var(--accent)` 等引用。

## SSR Cookie 同步

`src/app/layout.tsx`（RSC, async）在服务端读取 theme cookie：

```ts
const cookieStore = await cookies()
const themeId = getThemeCookie(cookieStore.toString())
return <html lang="zh-CN" data-theme={themeId}>
```

`getThemeCookie()`（`src/lib/theme.ts`）解析 cookie 字符串，提取 `theme=` 值，无效时返回默认 `'gold'`。

## 用户切换主题

`setTheme(themeId)`（`src/lib/theme.ts`）同时写入三处：

1. `document.documentElement.setAttribute('data-theme', id)` — 即时 UI 切换
2. `localStorage.setItem('theme', id)` — 客户端持久化（下次访问可用）
3. `document.cookie = 'theme=${id};...'` — **RSC 首屏可达**（不写 cookie 会导致 SSR 首帧用默认主题，hydration 时闪烁切换）

## delete 文件

`src/components/ThemeProvider.tsx` 已删除，主题切换零 JS 运行时依赖。

## 字号管理

`src/lib/theme.ts` 提供独立的字号管理功能，与主题系统共享 localStorage 机制但使用独立的 key。

### 字号类型

```ts
type FontSize = 'small' | 'medium' | 'large'
```

### fontSizes 映射表

```ts
const fontSizes: Record<FontSize, string> = {
  small: '14px',
  medium: '16px',
  large: '18px',
}
```

### applyFontSize

写入 `document.documentElement.style.setProperty('--font-size-base', fontSizes[size])`，通过 CSS 变量 `--font-size-base` 全局生效。各组件通过 `var(--font-size-base)` 引用该值。

### loadFontSize / saveFontSize

与主题存储相同的 localStorage 模式，key 名称为 `adventure_font_size`：

```ts
const THEME_KEY = 'adventure_theme'
const FONT_KEY = 'adventure_font_size'

function loadFontSize(): FontSize  // 默认返回 'medium'
function saveFontSize(size: FontSize): void
```

### 字号与主题的 key 隔离

两个外观定制功能使用独立的 localStorage key：
- 主题：`adventure_theme`
- 字号：`adventure_font_size`

切换主题不影响字号，反之亦然。

## SystemSettings 中的主题/字号 UI

`src/components/SystemSettings.tsx` 设置面板包含 "主题" 标签页（tab === 'theme'），内部分两组：

1. **主题风格**：2x2 网格展示四个主题（金辉/蒸汽/朱墨/赛博），点击后调用 `handleThemeChange` → `saveTheme` + `setTheme`
2. **字体大小**：三个等宽按钮（小/中/大），点击后调用 `handleFontSizeChange` → `saveFontSize` + `applyFontSize`

面板打开时通过 `loadTheme()` / `loadFontSize()` 初始化本地状态，确保展示当前已保存的值而不是 SSR 默认值。

## 相关文档
→ （主题系统独立，无强业务依赖）

## 边界
本文件覆盖主题换肤（CSS data-theme）和字号管理（CSS --font-size-base）两个外观定制功能。
不覆盖：API 配置（见 ai-engine.md）、存档数据的存储（见 save-system.md）。
