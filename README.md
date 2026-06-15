# 话世界 (huashijie)

AI 驱动的互动冒险引擎 —— 选择一个世界，扮演角色，在 AI 叙事中自由探索。

## 特性

- **多世界冒险**：每个世界有独立的背景设定、角色属性和剧情走向
- **多 AI 供应商**：支持 OpenAI、Anthropic、DeepSeek，可自定义添加
- **按供应商独立保存**：每个供应商的 API Key 和配置独立存储，互不干扰
- **云存档**：支持在线存档，跨设备同步进度
- **属性系统**：角色属性随剧情发展动态变化
- **物品与标记**：探索中获得物品、解锁旗标，影响故事走向
- **主题切换**：内置多套配色主题，支持字体大小调节

## 技术栈

- [Next.js](https://nextjs.org) — React 全栈框架
- TypeScript — 类型安全
- Tailwind CSS — 样式
- Anthropic SDK / OpenAI SDK — AI 接口

## 快速开始

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 配置 AI

点击右上角 ⚙️ 进入设置 → **API** 标签：

1. 选择预设供应商（OpenAI / Anthropic / DeepSeek），或切到「自定义」填写自己的 API 地址
2. 填入 **API 密钥**
3. 点击 **🧪 测试连接** 验证配置
4. （可选）在高级选项中调整温度、核采样、流式输出等参数
5. （可选）自定义供应商配置好后，点「+ 添加供应商」保存为预设，方便快速切换

每个供应商的配置独立保存，切换供应商时会自动加载对应的 Key 和模型。

## 让朋友一起玩

### 同一 WiFi（免费）

启动 `npm run dev` 后，终端显示：

```
- Network: http://10.29.58.162:3000
```

把 Network 地址发给同一 WiFi 下的朋友即可。

### 部署到公网（免费）

通过 [Vercel](https://vercel.com) 一键部署：

1. 把代码推送到 GitHub 仓库
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
3. 点击 **New Project** → 导入仓库 → **Deploy**
4. 获得公网链接（如 `xxx.vercel.app`）

## 项目结构

```
src/
├── app/
│   ├── api/            # API 路由（AI 对话、测试连接、存档）
│   └── page.tsx        # 主页面
├── components/         # React 组件
│   ├── SystemSettings.tsx  # 设置面板（主题、API、供应商管理）
│   ├── AccountButton.tsx   # 账号管理
│   └── ...
├── lib/                # 核心逻辑
│   ├── game-context.tsx    # 游戏状态管理 + API 配置持久化
│   ├── types.ts            # 类型定义
│   ├── theme.ts            # 主题系统
│   ├── save-service.ts     # 存档服务（本地/在线）
│   └── ...
└── ...
```

## 了解更多

- [Next.js 文档](https://nextjs.org/docs)
- [Anthropic Messages API](https://docs.anthropic.com/en/docs/build-with-claude)
- [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat)
- [DeepSeek API](https://api-docs.deepseek.com)
