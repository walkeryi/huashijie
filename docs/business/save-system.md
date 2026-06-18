---
name: save-system
description: 存档系统完整业务：本地存档（localStorage 3槽位+自动存档+JSON序列化）、云端存档（REST API + apiKey安全策略 + 密码管理）、服务端文件存储（MD5哈希 + JSON索引 + 账户验证）、统一存档服务（在线/离线路由 + 2秒防抖 + 失败回退 + 本地到云端迁移）、6条 /api/saves/* 路由、AccountButton 登录UI、StatusPanel 乐观更新存档UI
---

# 存档系统

## 架构总览

存档系统分为三层，客户端由 `save-service.ts` 统一调度：

```
                  UI 层（GameToolbar / AccountButton）
                           │
                    save-service.ts (外观/路由层)
                    ┌──────┴──────┐
                    │             │
          local-storage.ts   online-storage.ts
          (浏览器 localStorage)  (REST API 客户端)
                                   │
                          /api/saves/* route.ts
                                   │
                          server-save-utils.ts
                          (文件系统操作)
```

- **本地层** (`local-storage.ts`)：纯浏览器端，localStorage 持久化，3 个用户槽 + 1 个自动槽。
- **云端层** (`online-storage.ts`)：通过 HTTP POST 调用服务端 API，所有请求共享 `apiCall` 封装。
- **服务端层** (`server-save-utils.ts`)：Next.js API 路由内的文件系统操作，MD5 账户哈希，JSON 文件存储。

`save-service.ts` 根据 `localStorage['adventure_save_config']` 中的 `mode` 字段决定走本地还是云端，对 UI 层屏蔽差异。

## 边界

本文件覆盖存档的完整生命周期：创建、读取、更新、删除、列表、自动存档、在线/离线切换。

不覆盖：游戏状态的 reducer 逻辑（见 state-management.md）、AI 引擎的 apiKey 管理（见 ai-engine.md）、打字机与对话归档（见 event-bus-typewriter.md）。

## 数据结构

### SaveData（完整存档）

```ts
interface SaveData {
  id: string              // 存档唯一标识
  slotName: string        // 用户自定义的存档名称
  timestamp: number       // 时间戳（Date.now()）
  worldCardId: string     // 世界卡 ID
  playerState: PlayerState // 玩家状态快照
  dialogueHistory: DialogueEntry[]  // 完整对话历史
  apiKey: string          // 本地保留，上传时置空
}
```

### SaveMeta（轻量元数据，用于列表）

```ts
interface SaveMeta {
  slot: number
  id: string
  slotName: string
  timestamp: number
  worldCardId: string
  playerName: string
}
```

`SaveMeta` 不含 `dialogueHistory` 和 `apiKey`，仅用于存档选择界面。

### SaveModeConfig

```ts
interface SaveModeConfig {
  mode: 'offline' | 'online'
  accountName: string
}
```

持久化在 `localStorage` key `adventure_save_config` 中，由 `save-service.ts` 的 `setMode()` / `getConfig()` 读写。

## 本地存档（local-storage.ts）

### 存储键名

| 槽位 | localStorage key |
|------|------------------|
| 槽位 1 | `adventure_save_1` |
| 槽位 2 | `adventure_save_2` |
| 槽位 3 | `adventure_save_3` |
| 自动存档 | `adventure_autosave` |

前缀常量 `SAVE_PREFIX = 'adventure_save_'`，自动存档键 `AUTO_SAVE_KEY = 'adventure_autosave'`。

### 核心函数

- **`localSaveToSlot(slot, saveId, slotName, worldCardId, playerState, dialogueHistory, apiKey)`** — 将完整存档写入指定槽位。参数展开而非接收 `SaveData` 对象。
- **`localAutoSave(worldCardId, playerState, dialogueHistory, apiKey)`** — 写入自动存档槽，`id` 固定为 `'autosave'`，`slotName` 固定为 `'自动存档'`。
- **`localLoadSave(slotOrKey)`** — 按数字槽位（0=自动存档, 1-3=用户槽）或字符串读取。JSON 解析失败返回 `null`。
- **`localDeleteSave(slot)`** — 按槽位删除。
- **`localListSaves()`** — 遍历 `localStorage`，匹配 `SAVE_PREFIX` 前缀或 `AUTO_SAVE_KEY`，JSON 解析后按时间戳降序排列。解析失败（损坏）的条目静默忽略。
- **`localListSaveMetas()`** — 轻量版本，返回 `SaveMeta[]` 不含对话历史和 apiKey。
- **`localClearAllSaves()`** — 遍历删除所有匹配的 key（删除时 `i--` 处理数组偏移）。
- **`localGetSaveSummary(save)`** — 截取最后一条对话内容前 60 字符作为摘要。

### 损坏处理

所有 JSON 解析操作包裹在 `try/catch` 中，损坏的存档文件被静默忽略（视为不存在），不会导致整个列表失败。

## 云端存档（online-storage.ts）

### 通信协议

所有请求通过统一的 `apiCall<T>(endpoint, body)` 函数发送 POST 请求：

```ts
async function apiCall<T>(endpoint, body): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) throw new Error(...)   // 尝试从 JSON 响应中提取 error 字段
  const data = await res.json()
  if (!data.ok) throw new Error(...)
  return data
}
```

API 基础路径 `API_BASE = '/api/saves'`。

### 函数映射

| 客户端函数 | 对应 API | 说明 |
|-----------|---------|------|
| `onlineRegister(name, password)` | `POST /api/saves/register` | 注册新账户 |
| `onlineLogin(name, password)` | `POST /api/saves/login` | 验证账户 |
| `onlineListSaveMetas(name, password)` | `POST /api/saves/list` | 获取元数据列表 |
| `onlineSaveToSlot(name, password, slot, save)` | `POST /api/saves/save` | 保存（apiKey 置空后上传） |
| `onlineLoadSave(name, password, slot)` | `POST /api/saves/load` | 读取完整存档 |
| `onlineDeleteSave(name, password, slot)` | `POST /api/saves/delete` | 删除存档 |
| `onlineMigrateSaves(name, password, saves)` | 循环调用 `onlineSaveToSlot` | 批量迁移本地到云端 |
| `onlineCheckConnection()` | `POST /api/saves/login` (ping) | 检查服务器连通性 |

### apiKey 安全策略

`onlineSaveToSlot` 在上传前将 `apiKey` 置空：

```ts
await apiCall('/save', { name, password, slot, save: { ...save, apiKey: '' } })
```

apiKey 仅留在本地 localStorage 中，用于恢复 API 配置，永不发送到服务器。

### 连通性检查

`onlineCheckConnection()` 向 `/api/saves/login` 发送假的账户名密码 `__ping__`。即使服务端返回 401（登录失败），客户端也认为连接成功——只要服务器在响应。只有在网络错误（fetch 抛异常）时才返回 `false`。

### 密码管理

密码通过 `savePassword()` 存储在 `localStorage['adventure_online_pwd']`，登录/注册成功后保存。每次云端操作前通过 `getPassword()` 读取，不保存在内存中。退出登录时调用 `clearPassword()` 清除。

## 服务端实现（server-save-utils.ts）

### 目录结构

```
<DATA_ROOT>/saves/
  <md5(accountName)>/
    account.json     # 账户信息
    index.json       # 存档索引（元数据）
    1.json           # 槽位 1 完整存档
    2.json           # 槽位 2 完整存档
    3.json           # 槽位 3 完整存档
    0.json           # 自动存档槽位
```

`DATA_ROOT` 默认值为 `<project>/data`，可通过环境变量 `DATA_ROOT` 覆盖。

### 账户管理

- 密码存储为 MD5 哈希（明文密码的 `crypto.createHash('md5').digest('hex')`），不存储明文。
- `registerAccount(name, password)`：创建账户文件，已存在则返回 `false`。
- `verifyAccount(name, password)`：读取账户文件，比对哈希值。
- 目录路径使用 `hashName(name) = MD5(name)` 推导，不暴露原始账户名。

### 索引管理

服务端维护 `index.json` 作为轻量元数据索引，避免每次列表读取完整存档：

```ts
interface SaveIndex {
  accountName: string
  updatedAt: number
  slots: Array<{
    slot: number
    id: string
    slotName: string
    timestamp: number
    worldCardId: string
    playerName: string
  }>
}
```

保存时同时更新 `{slot}.json` 和 `index.json`，删除时同时移除 `{slot}.json` 并更新索引。读列表仅读取 `index.json`。

### 文件工具函数

`readJSON<T>` / `writeJSON` 封装了 `fs.existsSync` + `JSON.parse` / `JSON.stringify`，自动创建中间目录。`ensureDir` 使用 `fs.mkdirSync({ recursive: true })`。

## API 路由（`/api/saves/*`）

6 条路由全部接受 `POST`，Content-Type `application/json`，返回统一格式 `{ ok: boolean, error?: string, ... }`。

### POST /api/saves/register

```ts
body: { name: string, password: string }
```
- 验证 `name` 和 `password` 非空
- `name` 最长 50 字符，`password` 最长 100 字符
- 调用 `registerAccount(name.trim(), password)`
- 成功：`{ ok: true }`
- 账户已存在：HTTP 409 + `{ ok: false, error: '账户已存在' }`
- 参数错误：HTTP 400

### POST /api/saves/login

```ts
body: { name: string, password: string }
```
- 验证 `verifyAccount(name.trim(), password)`
- 成功：`{ ok: true }`
- 失败：HTTP 401 + `{ ok: false, error: '账户不存在或密码错误' }`
- 参数不完整：HTTP 400

### POST /api/saves/save

```ts
body: { name: string, password: string, slot: number, save: SaveData }
```
- 验证 `slot` 在 0-3 范围内
- 验证账户名密码
- 写入完整存档数据（但不包含客户端传过来的冗余 apiKey——客户端已在 `onlineSaveToSlot` 中置空，服务端不做额外处理）
- 更新 `index.json` 中的对应槽位元数据（替换而不是追加，先 filter 去除旧条目再 push）
- 成功：`{ ok: true, timestamp: Date.now() }`

### POST /api/saves/load

```ts
body: { name: string, password: string, slot: number }
```
- 验证账户名密码
- 读取 `{slot}.json`
- 不存在：HTTP 404 + `{ ok: false, error: '存档不存在' }`
- 成功：`{ ok: true, save: SaveData }`

### POST /api/saves/list

```ts
body: { name: string, password: string }
```
- 验证账户名密码
- 读取 `index.json`，返回 `slots` 数组
- 无索引时返回空数组：`{ ok: true, saves: [] }`

### POST /api/saves/delete

```ts
body: { name: string, password: string, slot: number }
```
- 验证账户名密码和槽位
- 删除 `{slot}.json` 文件（不存在则跳过）
- 更新 `index.json` 移除对应槽位
- 成功：`{ ok: true }`

## 统一存档服务（save-service.ts）

`save-service.ts` 是外观层（Facade），所有 UI 组件通过它而非直接调用 local/online 模块。

### 模式切换

```ts
setMode(mode: SaveMode, accountName: string)
```

将 `{ mode, accountName }` 写入 `localStorage['adventure_save_config']`。`getConfig()` 读取此值，默认返回 `{ mode: 'offline', accountName: '' }`。

`isOnline()` 返回 `getConfig().mode === 'online'`。

### 在线/离线路由

每个操作先检查 `isOnline()`，在线则走 `online.*` 函数（传递 `accountName` 和从 localStorage 读取的密码），离线则走 `local.*` 函数：

| UI 调用 | 在线分支 | 离线分支 |
|---------|---------|---------|
| `listSaveMetas()` | `onlineListSaveMetas(name, pwd)` | `localListSaveMetas()` |
| `saveToSlot(slot, data)` | `onlineSaveToSlot(name, pwd, slot, data)` | `localSaveToSlot(...)` |
| `autoSave(data)` | `onlineSaveToSlot(name, pwd, 0, data)` | `localAutoSave(...)` |
| `loadSave(slot)` | `onlineLoadSave(name, pwd, slot)` | `localLoadSave(slot)` |
| `deleteSave(slot)` | `onlineDeleteSave(name, pwd, slot)` | `localDeleteSave(slot)` |

### 自动存档与防抖

```ts
async function autoSave(data: SaveData): Promise<void> {
  if (isOnline()) {
    try {
      await onlineSaveToSlot(cfg.accountName, getPassword(), 0, data)
      return
    } catch {
      console.warn('在线自动存档失败，回退到本地存档')
    }
  }
  local.localAutoSave(...)
}
```

- 在线模式尝试云端保存，失败时**静默回退**到本地自动存档。
- 防抖函数 `debouncedAutoSave(data)`：每次调用清除之前的定时器，2 秒无新调用后才真正执行 `autoSave`。
- `debounceTimer` 为模块级变量（非 React state），每次调用 `debouncedAutoSave` 清除前一次定时器。
- 在 GameScreen 中，每轮对话结束后触发 `debouncedAutoSave`（见 event-bus-typewriter.md 的对话归档时序）。

### 批量迁移

```ts
async function migrateLocalToOnline(): Promise<{ success: boolean; count: number }>
```

在登录/注册成功后可能的迁移入口。收集所有本地存档，通过 `onlineMigrateSaves` 逐个保存到云端。单个失败不影响其他存档。返回迁移成功的数量。

### 密码管理

- `savePassword(pwd)` → `localStorage['adventure_online_pwd']`
- `getPassword()` → 从 localStorage 读取
- `clearPassword()` → 退出登录时清除
- 密码仅用于 API 调用时的认证，不保存在 React state 中。

## UI 层

### AccountButton（登录/注册 UI）

- 位置：右上角（`fixed top-4 right-16`）或内联模式（inline prop）。
- 显示状态：未登录显示"☁️ 登录"，已登录显示绿色圆点 + 账户名。
- 面板内容：未登录显示账户名/密码输入框 + 登录/注册按钮；已登录显示当前账户信息 + 退出登录按钮。
- 注册/登录成功后，同时执行三道操作：
  1. `saveService.savePassword(password)` — 持久化密码
  2. `saveService.setMode('online', name)` — 切换存档模式
  3. `actions.setSaveMode('online', name)` — 同步到 AppConfigContext（React state）
- 退出登录时，同样三道操作反向执行（setMode + clearPassword + setSaveMode 离线）。
- 组件 mount 后 `setMounted(true)` 避免 SSR 不匹配。

### GameToolbar（存档/加载 UI + 乐观更新）

- 游戏进行中，顶部工具栏提供"💾 存档"和"📂 加载"两个按钮。
- 点击存档按钮展开 3 个槽位下拉面板，通过 `saveService.loadSave(slot)` 加载元数据。
- 选中槽位后弹出命名输入框，确认后调用 `actions.saveGame(slot, name)`（委托 `saveService.saveToSlot` 写入）。
- **乐观更新**：使用 React 19 `useOptimistic` + `useTransition`：
  ```ts
  const [optimisticSlotInfos, addOptimisticSlotInfo] = useOptimistic(slotInfos, ...)
  const [isSaving, startSaveTransition] = useTransition()
  ```
  用户点击保存时，`startSaveTransition` 包裹 `addOptimisticSlotInfo` 立即更新 UI，无需等待服务端响应。
- 保存完成后 `loadSave` 回读真实数据覆盖乐观状态。
- 加载面板同样 3 槽位，点击有存档的槽位调用 `actions.loadGame(save, card)` 恢复游戏。
- 在线/离线模式体现为图标区分：`saveService.isOnline() ? '☁️' : '💾'`。

## 关键设计决策

### 1. 三层分离 + Facade 模式

本地与云端实现完全解耦，`save-service.ts` 作为单一入口。UI 层不关心当前模式，只需调用 `saveService.saveToSlot()`。新增存储后端时，只需在 `save-service.ts` 的 if 分支中加入新的实现。

### 2. apiKey 不上传

apiKey 是敏感信息，`onlineSaveToSlot` 在上传前将 `apiKey: ''`。本地存档保留 apiKey 以支持页面刷新后恢复 API 配置。用户切换设备后需要重新输入 apiKey。

### 3. 密码安全

- 密码存储在服务端为 MD5 哈希（不可逆）。
- 客户端密码明文存储在 `localStorage['adventure_online_pwd']`——这是设计权衡：每次调用云端 API 都需要密码，不存储在内存中意味着每次都要用户输入，因此采用 localStorage 存储。退出登录时清除。
- 服务端不存储 session token，每次 API 调用都需传入账户名密码。

### 4. 自动存档失败回退

在线模式下的自动存档失败时不像手动保存那样抛异常，而是静默回退到本地自动存档，确保用户不会因网络问题丢失进度。

### 5. 索引与数据分离

服务端维护 `index.json`（轻量元数据）和 `{slot}.json`（完整存档体）分离，列表操作只需读取小文件的索引，不需要加载全部存档数据。

### 6. 2 秒防抖

`debouncedAutoSave` 使用模块级定时器（非 React state），避免 React 重渲染干扰定时逻辑。每次新触发重置等待，确保对话期间的连续状态变更只产生一次写入。

### 7. 乐观更新

GameToolbar 使用 `useOptimistic` + `useTransition` 实现存档操作的即时 UI 反馈，消除等待服务端响应（尤其是云端场景）带来的感知延迟。

### 8. 服务端验证

所有 API 路由在操作数据前都执行 `verifyAccount` 验证，确保未授权用户无法读写其他账户的数据。槽位值严格限制在 0-3 范围（0=自动存档, 1-3=用户槽）。

## 相关文档
→ state-management.md：存档数据的 LOAD_SAVE dispatch 目标，debouncedAutoSave 在 PlayerStateContext 中的触发时机
→ ai-engine.md：apiKey 在存档时的安全策略（上传时置空，本地保留用于 API 配置恢复）
→ event-bus-typewriter.md：对话归档后触发防抖自动存档的时序
