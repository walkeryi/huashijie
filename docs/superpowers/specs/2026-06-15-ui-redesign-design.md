# 话世界 - 深度主题系统 + 标签页设置

## 背景

当前主题仅换色，需要深度主题：字体、边框形态、按钮质感、背景纹理都随主题变化。设置改为标签页。

## 设计目标

- 4 套深度主题：默认(金辉) / 蒸汽(工业) / 古风(朱墨) / 赛博
- 每套定义：颜色 × 字体 × 边框形态 × 按钮质感 × 背景纹理
- 设置用标签页：[主题] [API]
- 返回按钮已统一

## 主题系统

### CSS 变量体系

| 变量 | 作用 | 默认 | 蒸汽 |
|------|------|------|------|
| `--bg-primary` | 主背景 | `#0f0f0f` | `#1a1410` |
| `--bg-secondary` | 次背景 | `#1a1a1a` | `#231e17` |
| `--bg-card` | 卡片 | `#1e1e1e` | `#292218` |
| `--text-primary` | 主文字 | `#e0d5c1` | `#e8dcc8` |
| `--text-secondary` | 次文字 | `#a09888` | `#b0a088` |
| `--accent` | 强调色 | `#c9a96e` | `#b8954a` |
| `--accent-hover` | 悬停 | `#d4b87a` | `#c9a65d` |
| `--danger` | 危险 | `#8b4444` | `#9b5050` |
| `--border` | 边框色 | `#2a2a2a` | `#4a3828` |
| `--font-family` | 字体 | Georgia+Noto Serif SC | Impact+sans-serif |
| `--border-radius` | 圆角 | `0.75rem` | `0.25rem` |
| `--border-width` | 边框粗细 | `1px` | `2px` |
| `--border-style` | 边框样式 | `solid` | `double` |
| `--button-depth` | 按钮立体感 | `0` | `2px 2px 0 var(--border)` |
| `--bg-texture` | 背景纹理 | `none` | `repeating-linear-gradient(...)` |

### 四套主题

#### 🟡 金辉（默认）
经典暖金暗黑，Georgia 衬线，柔和圆角，浅阴影按钮。
```
--bg-primary: #0f0f0f
--accent: #c9a96e
--font-family: "Georgia", "Noto Serif SC", serif
--border-radius: 0.75rem
--border-width: 1px
```

#### ⚙️ 蒸汽（工业革命）
深棕黄铜，Impact 粗体，直角双线框，深阴影按钮，铆钉纹理。
```
--bg-primary: #1a1410
--accent: #b8954a
--font-family: "Impact", "SimHei", sans-serif
--border-radius: 0.25rem
--border-width: 2px
--border-style: double
--button-depth: 2px 2px 0 var(--border)
--bg-texture: 横向暗纹
```

#### 🏮 朱墨（古风）
宣纸墨底，楷体，细线金框，温润按钮。
```
--bg-primary: #111018
--accent: #c45050
--font-family: "KaiTi", "STKaiti", "Noto Serif SC", serif
--border-radius: 0.5rem
--border-width: 1px
--border-style: solid
```

#### 💜 赛博
深紫蓝底，霓虹青强调，等宽字体，发光边框，暗纹背景。
```
--bg-primary: #0a0a1a
--accent: #00ffcc
--font-family: "Courier New", "Fira Code", monospace
--border-radius: 0.25rem
--border-width: 1px
--border-style: solid
--button-depth: 0 0 8px var(--accent)
--bg-texture: 网格暗纹
```

### 设置页面

```
⚙️ 设置（全屏遮罩）
┌──────────────────┐
│ [主题]  [API]    │  ← 标签页
│                  │
│ 主题选择 4选1    │
│ 字体大小 小中大  │
│                  │
│   [关闭]         │
└──────────────────┘
```

## 验证

1. 切换4个主题 → 颜色+字体+边框+按钮全面变化
2. 蒸汽主题：直角双线框+粗体+铜色
3. 赛博主题：发光边框+等宽字体+霓虹
4. 设置标签页切换流畅
5. 刷新保持主题
