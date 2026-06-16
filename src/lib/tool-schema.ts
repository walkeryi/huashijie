// src/lib/tool-schema.ts
import { z } from 'zod'

export const updateStateSchema = z.object({
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
  ).min(1).max(4),
  attributeChanges: z.record(z.string(), z.number()).optional(),
  npcAffinityChanges: z.record(z.string(), z.number()).optional(),
  newFlags: z.array(z.string()).optional(),
  lostFlags: z.array(z.string()).optional(),
  itemsGained: z.array(z.string()).optional(),
  itemsLost: z.array(z.string()).optional(),
})

export type UpdateStateArgs = z.infer<typeof updateStateSchema>
