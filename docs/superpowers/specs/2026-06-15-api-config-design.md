# API 高级配置 — 设计文档

> 日期: 2026-06-15 | 状态: 已确认

## 概述

前端 API 配置自由化：用户自选提供商、模型名，提供商只决定协议和默认地址。新增测试连接功能。

## 前端布局

```
┌─ API 设置 ───────────────────────┐
│  API Key:  [••••••••••••  ]      │
│  提供商:    [Anthropic ▼]        │
│  模型名:    [claude-sonnet-4-6]  │ ← 切换提供商自动填默认值，可手动改
│  API 地址: [               ]    │ ← 仅 custom 时显示
│  [🧪 测试连接]                    │
└──────────────────────────────────┘
```

## 提供商预设

| provider | 协议 | baseURL | 默认模型 |
|----------|------|---------|---------|
| anthropic | Anthropic SDK | - | claude-sonnet-4-6 |
| openai | OpenAI 兼容 | - | gpt-4o |
| deepseek | OpenAI 兼容 | api.deepseek.com | deepseek-chat |
| custom | OpenAI 兼容 | 用户填 | 用户填 |

## 后端改动

- `POST /api/adventure`：接收 `model` 字段，替换硬编码模型名
- 新增 `POST /api/test-connection`：发一条 "hi" 消息验证连通性

## 数据模型

GameState 新增：
- `model: string` — 模型名
- SET_MODEL action

## 范围

MVP：API 配置输入 + 测试连接
排除：流式传输（后续迭代）
