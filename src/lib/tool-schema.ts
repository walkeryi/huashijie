// src/lib/tool-schema.ts — 三阶段管线 Schema 定义
import { z } from 'zod'

// ===== Stage 1: Turn Planner =====
// 只描述状态变更，不含选项
export const planSchema = z.object({
  attributeChanges: z.record(z.string(), z.number()).optional(),
  npcAffinityChanges: z.record(z.string(), z.number()).optional(),
  newFlags: z.array(z.string()).optional(),
  lostFlags: z.array(z.string()).optional(),
  itemsGained: z.array(z.string()).optional(),
  itemsLost: z.array(z.string()).optional(),
})

export type PlanArgs = z.infer<typeof planSchema>

// ===== Stage 3: Choices Maker =====
// 只描述选项，不含状态变更
export const choicesSchema = z.object({
  options: z.array(
    z.object({
      text: z.string(),
      attributeChecks: z.record(z.string(), z.string()).optional(),
      npcAffinityChecks: z.record(z.string(), z.string()).optional(),
      flagChecks: z.array(z.string()).optional(),
      flagNot: z.array(z.string()).optional(),
      itemChecks: z.array(z.string()).optional(),
      itemNot: z.array(z.string()).optional(),
    })
  ).min(2).max(4),
})

export type ChoicesArgs = z.infer<typeof choicesSchema>
