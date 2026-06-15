# 话世界 - 在线/离线双模式存档系统

## 背景

当前所有存档（3槽位 + 1自动存档）存储在浏览器 localStorage 中。换设备或清缓存就丢失。需要让玩家拥有云端存档能力，同时保留离线模式作为默认选项。

## 设计目标

- **离线模式（默认）**：免注册，localStorage 存档，零成本
- **在线模式**：自定义账户名 + 密码注册/登录，存档存服务器，跨设备访问
- 双模式共存，用户一键切换；离线→在线可迁移本地数据
- 无数据库依赖，仅用服务器 JSON 文件存储
- v1 只做云存档，不涉及社区世界卡、计费等

## 核心概念

| | 离线模式（默认） | 在线模式 |
|------|------|------|
| 登录 | 不需要 | 自定义账户名 + 密码 |
| 存储位置 | 浏览器 localStorage | 服务器 JSON 文件 |
| API Key | 存本地 | 不上传（每台设备自己填） |
| 跨设备 | 不支持 | 支持（登录即可） |
| 费用 | 永久免费 | 永久免费 |

## 架构

```
浏览器                              服务器
┌──────────────┐                   ┌──────────────────┐
│  UI 组件     │                   │ /api/saves/*     │
│  (StatusPanel│                   │  ├─ register     │
│   Settings等)│                   │  ├─ login        │
└──────┬───────┘                   │  ├─ list         │
       │                           │  ├─ save         │
┌──────▼───────┐                   │  ├─ load         │
│ save-service │ ← 统一外观        │  └─ delete       │
│ (路由模式)   │                   └────────┬─────────┘
├──────────────┤                           │
│ 离线→local   │                   ┌────────▼─────────┐
│ 在线→fetch   │                   │ data/saves/      │
└──────────────┘                   │  {hash}/         │
                                   │    account.json  │
                                   │    1.json        │
                                   │    2.json        │
                                   │    3.json        │
                                   │    0.json        │
                                   └──────────────────┘
```

## 服务器文件存储

```
/www/wwwroot/huashijie/data/saves/
  {账户名的MD5}/
    account.json      ← {name, passwordHash, createdAt}
    1.json            ← 槽位 1 完整 SaveData
    2.json            ← 槽位 2 完整 SaveData
    3.json            ← 槽位 3 完整 SaveData
    0.json            ← 自动存档
```

## API 设计

全部 `POST + JSON`，与现有 API 风格一致。

| 端点 | 功能 | 请求体 | 响应 |
|------|------|------|------|
| `POST /api/saves/register` | 注册 | `{name, password}` | `{ok: true}` 或 `{ok: false, error: "账户已存在"}` |
| `POST /api/saves/login` | 登录 | `{name, password}` | `{ok: true}` 或 `{ok: false, error: "密码错误"}` |
| `POST /api/saves/list` | 列出存档 | `{name, password}` | `{ok: true, saves: SaveMeta[]}` |
| `POST /api/saves/save` | 保存 | `{name, password, slot, save: SaveData}` | `{ok: true}` |
| `POST /api/saves/load` | 读取 | `{name, password, slot}` | `{ok: true, save: SaveData}` |
| `POST /api/saves/delete` | 删除 | `{name, password, slot}` | `{ok: true}` |

每次请求带 `name + password` 做身份验证。密码用 MD5 存储。

## 客户端文件改动

### 新增
- `src/lib/local-storage.ts` — 从 storage.ts 拆分，函数加 `local` 前缀
- `src/lib/online-storage.ts` — fetch 封装的在线存档操作
- `src/lib/save-service.ts` — 统一外观，按模式路由
- `src/lib/server-save-utils.ts` — 服务端文件读写工具

### 修改
- `src/lib/types.ts` — 追加 `SaveMode`, `SaveMeta`, `OnlineAccount`；GameState 加 `saveMode`/`onlineAccount`；GameAction 加 `SET_SAVE_MODE`
- `src/lib/game-context.tsx` — 存档操作改为 async；新增 saveMode 状态管理；持久化到 localStorage
- `src/components/SystemSettings.tsx` — 新增"存储"标签页：模式切换、注册/登录、迁移按钮、状态显示
- `src/components/StatusPanel.tsx` — 显示模式图标（💾/☁️），槽位信息异步加载

### 保留
- `src/lib/storage.ts` — re-export 自 local-storage.ts，保持兼容

## UI 设计

### 设置面板 — "存储"标签页

```
⚙️ 系统设置
─────────────────
[API]  [存储]

─ 存储设置 ──────────
  存档模式:
  ● 离线模式（本地存储）
  ○ 在线模式（云端同步）

─ 在线模式 ──────────
  账户名: [         ]
  密码:   [         ]
  [注册] [登录]

  状态: ✅ 已登录: 张三
  [退出登录]

  检测到 3 个本地存档 → [迁移到云端]
```

### 游戏内存档面板

- 存档按钮旁显示模式图标：💾 离线 / ☁️ 在线已登录 / ☁️⚠️ 在线未登录

## 数据迁移流程

1. 用户在设置中选择"在线模式" → 输入账户名密码 → 注册/登录
2. 系统检测本地有存档 → 弹出"检测到 N 个存档，是否迁移到云端？"
3. 确认 → 调用 `/api/saves/save` 逐槽位上传
4. 成功后设置模式；失败则提示重试
5. 切换回离线模式时，本地存档仍在

## 关键设计决策

- **API Key 不上传服务器**：在线保存时 apiKey 置空，每台设备单独配置
- **MD5 密码**：游戏场景够用，定期提醒用户不要用重要密码
- **在线失败静默回退**：autoSave 失败时回退到 localStorage
- **目录哈希**：账户名 MD5 作目录名，防特殊字符

## 验证

1. 默认离线模式，存档正常
2. 切换到在线 → 注册 → 登录 → 存档操作走 API
3. 同一账户在另一个浏览器登录 → 加载到相同存档
4. 断网时 autoSave 静默回退到本地
5. 服务器停止 → 在线操作显示错误提示
6. `npm test` 现有测试通过
