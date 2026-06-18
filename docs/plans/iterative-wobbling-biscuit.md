# 话世界 - 在线/离线双模式存档系统

## 背景

当前所有存档（3槽位 + 1自动存档）、自定义世界卡、API 配置都存储在浏览器 localStorage 中。换设备或清缓存就丢失。需要让**每个玩家拥有独立的云端存档**，同时保留离线模式作为默认选项。

## 设计目标

- **离线模式（默认）**：localStorage 存档，零成本，无需服务器
- **在线模式**：玩家设定"玩家代号"，存档存服务器文件系统，跨设备访问
- 双模式共存，用户自由切换；离线→在线可迁移数据
- 无数据库依赖，仅用 JSON 文件存储

## 架构

```
UI 组件
  └─ save-service.ts (统一外观，根据模式路由)
       ├─ 离线 → local-storage.ts (同步 localStorage)
       └─ 在线 → online-storage.ts (fetch → /api/saves/*)
```

## 服务器文件存储

```
/www/wwwroot/huashijie/data/saves/
  {playerCode的SHA256前16位}/
    index.json       ← 存档元数据列表
    1.json / 2.json / 3.json / 0.json  ← 完整 SaveData
```

## API 路由

遵循现有 `POST + JSON` 模式，新建 `src/app/api/saves/`：

| 端点 | 功能 |
|------|------|
| `POST /api/saves/list` | 列出某玩家的存档元数据 |
| `POST /api/saves/save` | 保存（playerCode + slot + data） |
| `POST /api/saves/load` | 读取完整存档 |
| `POST /api/saves/delete` | 删除指定槽位 |
| `POST /api/saves/migrate` | 批量上传本地存档 |

新增 `src/lib/server-save-utils.ts`（服务端文件读写工具，客户端不会加载到）。

## 客户端文件改动

### 新增
- `src/lib/local-storage.ts` — 从 storage.ts 复制，函数加 `local` 前缀
- `src/lib/online-storage.ts` — fetch 封装的在线存档调用
- `src/lib/save-service.ts` — 统一外观，按模式路由，在线失败时 autoSave 回退本地
- `src/lib/server-save-utils.ts` — 服务端工具

### 修改
- `src/lib/types.ts` — 追加 `SaveMode`, `SaveMeta` 类型, `GameState` 加 `saveMode`/`playerCode`, `GameAction` 加 `SET_SAVE_MODE`
- `src/lib/game-context.tsx` — `refreshSaves/saveGame/deleteGame` 改为 async，新增 saveMode 状态，持久化 `adventure_save_config` 到 localStorage
- `src/components/SystemSettings.tsx` — 新增"存储设置"区：模式切换（离线/在线）、玩家代号输入、迁移按钮、连接状态
- `src/components/StatusPanel.tsx` — 存档槽位信息改为异步加载，显示模式图标（💾/☁️）

### 保留
- `src/lib/storage.ts` — 保留原文件，导出改为 re-export 自 local-storage.ts，确保兼容

## 数据迁移流程

1. 用户在设置中选择"在线模式"→ 输入玩家代号
2. 系统检测到本地有存档 → 弹出"检测到 N 个存档，是否迁移到云端？"
3. 确认 → 调用 `/api/saves/migrate` 批量上传
4. 成功后保存模式配置；失败则保留离线模式
5. 切换回离线模式时原有本地存档仍在；在线期间的存档需手动下载

## 关键设计决策

- **不存储 API Key 到服务器**：在线保存时 `apiKey` 置空，每台设备需要单独配置
- **玩家代号无密码**：游戏场景接受此安全级别
- **在线失败静默回退**：autoSave 失败时回退到本地 localStorage
- **目录哈希防注入**：playerCode SHA256 取前 16 位作为目录名

## 验证

1. 本地 `npm run dev` → 默认离线模式，存档正常
2. 切换到在线模式 → 输入代号 → 存档操作走 API
3. 同一代号在另一个浏览器加载存档 → 能读到
4. 断网时 autoSave 静默回退到本地
5. 手工操作退出 PM2 → 在线操作显示错误提示
6. `npm test` — 现有 storage.test.ts 测试仍然通过
