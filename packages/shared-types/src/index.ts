import { z } from 'zod'

export const deviceRoleSchema = z.enum(['kiosk', 'display'])
export type DeviceRole = z.infer<typeof deviceRoleSchema>

export const deviceConfigSchema = z.object({
  deviceId: z.string().min(1),
  role: deviceRoleSchema,
  servicePointIds: z.array(z.string()).optional(),
  loketIds: z.array(z.string()).optional(),
  printerProxyPort: z.number().int().positive().optional(),
  pollIntervalMs: z.number().int().positive().optional(),
  audioEnabled: z.boolean().optional(),
})
export type DeviceConfig = z.infer<typeof deviceConfigSchema>

/** Matches Bilreg CurrentLoketDisplayItem.DisplayState (numeric enum). */
export const admissionQueueClaimStateSchema = z.union([z.literal(0), z.literal(1), z.literal(2)])
export type AdmissionQueueClaimState = z.infer<typeof admissionQueueClaimStateSchema>

export const ADMISSION_QUEUE_CLAIM_STATE = {
  Released: 0,
  Outstanding: 1,
  InService: 2,
} as const

export const currentLoketDisplayItemSchema = z.object({
  loketKey: z.string(),
  antrianId: z.string(),
  noUrut: z.number().int(),
  queueLabel: z.string().nullable(),
  servicePointId: z.string(),
  displayState: admissionQueueClaimStateSchema,
  announcementVersion: z.number(),
  calledAt: z.string(),
  serviceStartedAt: z.string().nullable(),
  rowVersion: z.string(),
})
export type CurrentLoketDisplayItem = z.infer<typeof currentLoketDisplayItemSchema>

export const admissionServicePointStatusSchema = z.enum(['Active', 'Retired'])
export type AdmissionServicePointStatus = z.infer<typeof admissionServicePointStatusSchema>

export const admissionServicePointSchema = z.object({
  servicePointId: z.string(),
  displayName: z.string(),
  queuePrefix: z.string(),
  status: admissionServicePointStatusSchema,
})
export type AdmissionServicePoint = z.infer<typeof admissionServicePointSchema>

export const intakeBodySchema = z.object({
  servicePointId: z.string().min(1),
})
export type IntakeBody = z.infer<typeof intakeBodySchema>

export const admissionQueueIntakeResponseSchema = z.object({
  antrianId: z.string(),
  noUrut: z.number().int(),
  queueLabel: z.string(),
  createdAt: z.string(),
})
export type AdmissionQueueIntakeResponse = z.infer<typeof admissionQueueIntakeResponseSchema>

export const appVersionSchema = z.object({
  version: z.string(),
  builtAt: z.string(),
})
export type AppVersion = z.infer<typeof appVersionSchema>
