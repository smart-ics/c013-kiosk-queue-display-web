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
  displayName: z.string().optional(),
  locationName: z.string().nullable().optional(),
  layoutKey: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
  rowVersion: z.string().optional(),
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

export const AQ_CONFIG_ERROR_CODES = {
  AQ_CONFIG_INVALID: 'AQ_CONFIG_INVALID',
  AQ_WORKSTATION_NOT_FOUND: 'AQ_WORKSTATION_NOT_FOUND',
  AQ_WORKSTATION_INACTIVE: 'AQ_WORKSTATION_INACTIVE',
  AQ_WORKSTATION_LOKET_CONFLICT: 'AQ_WORKSTATION_LOKET_CONFLICT',
  AQ_DISPLAY_NOT_FOUND: 'AQ_DISPLAY_NOT_FOUND',
  AQ_DISPLAY_INACTIVE: 'AQ_DISPLAY_INACTIVE',
  AQ_DISPLAY_MAPPING_REQUIRED: 'AQ_DISPLAY_MAPPING_REQUIRED',
  AQ_KIOSK_NOT_FOUND: 'AQ_KIOSK_NOT_FOUND',
  AQ_KIOSK_INACTIVE: 'AQ_KIOSK_INACTIVE',
  AQ_KIOSK_MAPPING_REQUIRED: 'AQ_KIOSK_MAPPING_REQUIRED',
  AQ_CONFIG_CONCURRENCY: 'AQ_CONFIG_CONCURRENCY',
  AQ_CONFIG_FORBIDDEN: 'AQ_CONFIG_FORBIDDEN',
} as const

export const loginRequestSchema = z.object({
  email: z.string().min(1),
  pass: z.string().min(1),
  appId: z.string().min(1).default('Bilreg'),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

export const loginRoleSchema = z.object({
  role: z.string(),
})

export const loginResponseSchema = z.object({
  pegId: z.string(),
  userName: z.string(),
  userLogin: z.string().optional(),
  email: z.string(),
  expiredDate: z.string().optional(),
  tokenAuth: z.string().min(1),
  listRole: z.array(loginRoleSchema).default([]),
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

export const configurationWhoAmISchema = z.object({
  permission: z.string(),
  email: z.string(),
  userName: z.string(),
  roles: z.array(z.string()),
})
export type ConfigurationWhoAmI = z.infer<typeof configurationWhoAmISchema>

export const workstationSchema = z.object({
  workstationKey: z.string(),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  loketKey: z.string(),
  loketDisplayName: z.string().nullable().optional(),
  active: z.boolean(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  rowVersion: z.string(),
})
export type Workstation = z.infer<typeof workstationSchema>

export const workstationContextSchema = z.object({
  workstationKey: z.string(),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  loketKey: z.string(),
  loketDisplayName: z.string().nullable().optional(),
  active: z.boolean(),
})
export type WorkstationContext = z.infer<typeof workstationContextSchema>

export const createWorkstationBodySchema = z.object({
  workstationKey: z.string().min(1).max(50),
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  loketKey: z.string().min(1).max(50),
  active: z.boolean().default(true),
  notes: z.string().nullable().optional(),
})
export type CreateWorkstationBody = z.infer<typeof createWorkstationBodySchema>

export const updateWorkstationBodySchema = z.object({
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  loketKey: z.string().min(1).max(50),
  notes: z.string().nullable().optional(),
  rowVersion: z.string().min(1),
})
export type UpdateWorkstationBody = z.infer<typeof updateWorkstationBodySchema>

export const displayLoketMappingSchema = z.object({
  loketKey: z.string(),
  sortOrder: z.number().int().optional(),
})
export type DisplayLoketMapping = z.infer<typeof displayLoketMappingSchema>

export const queueDisplaySchema = z.object({
  displayId: z.string(),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  active: z.boolean(),
  audioEnabled: z.boolean(),
  pollIntervalMs: z.number().int().positive(),
  layoutKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lokets: z.array(displayLoketMappingSchema).default([]),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  rowVersion: z.string(),
})
export type QueueDisplay = z.infer<typeof queueDisplaySchema>

export const createQueueDisplayBodySchema = z.object({
  displayId: z.string().min(1).max(50),
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  active: z.boolean().default(true),
  audioEnabled: z.boolean().default(true),
  pollIntervalMs: z.number().int().positive().default(15000),
  layoutKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  lokets: z.array(displayLoketMappingSchema).default([]),
})
export type CreateQueueDisplayBody = z.infer<typeof createQueueDisplayBodySchema>

export const updateQueueDisplayBodySchema = z.object({
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  audioEnabled: z.boolean(),
  pollIntervalMs: z.number().int().positive(),
  layoutKey: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rowVersion: z.string().min(1),
})
export type UpdateQueueDisplayBody = z.infer<typeof updateQueueDisplayBodySchema>

export const replaceDisplayLoketsBodySchema = z.object({
  lokets: z.array(displayLoketMappingSchema),
  rowVersion: z.string().min(1),
})
export type ReplaceDisplayLoketsBody = z.infer<typeof replaceDisplayLoketsBodySchema>

export const displayBootConfigSchema = z.object({
  deviceId: z.string(),
  role: z.literal('display'),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  loketIds: z.array(z.string()),
  pollIntervalMs: z.number().int().positive(),
  audioEnabled: z.boolean(),
  layoutKey: z.string().nullable().optional(),
  updatedAt: z.string().optional(),
  rowVersion: z.string().optional(),
})
export type DisplayBootConfig = z.infer<typeof displayBootConfigSchema>

export const kioskServicePointMappingSchema = z.object({
  servicePointId: z.string(),
  sortOrder: z.number().int().optional(),
})
export type KioskServicePointMapping = z.infer<typeof kioskServicePointMappingSchema>

export const queueKioskSchema = z.object({
  stationId: z.string(),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  active: z.boolean(),
  printerProxyPort: z.number().int().min(1).max(65535),
  notes: z.string().nullable().optional(),
  servicePoints: z.array(kioskServicePointMappingSchema).default([]),
  createdAt: z.string().optional(),
  createdBy: z.string().optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
  rowVersion: z.string(),
})
export type QueueKiosk = z.infer<typeof queueKioskSchema>

export const createQueueKioskBodySchema = z.object({
  stationId: z.string().min(1).max(50),
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  active: z.boolean().default(true),
  printerProxyPort: z.number().int().min(1).max(65535).default(5050),
  notes: z.string().nullable().optional(),
  servicePoints: z.array(kioskServicePointMappingSchema).default([]),
})
export type CreateQueueKioskBody = z.infer<typeof createQueueKioskBodySchema>

export const updateQueueKioskBodySchema = z.object({
  displayName: z.string().min(1),
  locationName: z.string().nullable().optional(),
  printerProxyPort: z.number().int().min(1).max(65535),
  notes: z.string().nullable().optional(),
  rowVersion: z.string().min(1),
})
export type UpdateQueueKioskBody = z.infer<typeof updateQueueKioskBodySchema>

export const replaceKioskServicePointsBodySchema = z.object({
  servicePoints: z.array(kioskServicePointMappingSchema),
  rowVersion: z.string().min(1),
})
export type ReplaceKioskServicePointsBody = z.infer<
  typeof replaceKioskServicePointsBodySchema
>

export const kioskBootConfigSchema = z.object({
  deviceId: z.string(),
  role: z.literal('kiosk'),
  displayName: z.string(),
  locationName: z.string().nullable().optional(),
  servicePointIds: z.array(z.string()),
  printerProxyPort: z.number().int().min(1).max(65535),
  updatedAt: z.string().optional(),
  rowVersion: z.string().optional(),
})
export type KioskBootConfig = z.infer<typeof kioskBootConfigSchema>

export const configurationSummarySchema = z.object({
  activeWorkstationCount: z.number().int(),
  inactiveWorkstationCount: z.number().int(),
  activeDisplayCount: z.number().int(),
  inactiveDisplayCount: z.number().int(),
  activeKioskCount: z.number().int(),
  inactiveKioskCount: z.number().int(),
  activeLoketsWithoutDisplay: z.array(z.string()).default([]),
  displaysWithoutLoket: z.array(z.string()).default([]),
  kiosksWithoutServicePoint: z.array(z.string()).default([]),
  invalidReferences: z.array(z.string()).default([]),
  recentChanges: z
    .array(
      z.object({
        auditId: z.string(),
        eventTime: z.string(),
        userId: z.string(),
        actionType: z.string(),
        entityName: z.string(),
        entityId: z.string(),
      }),
    )
    .default([]),
})
export type ConfigurationSummary = z.infer<typeof configurationSummarySchema>

export const segmentationCoverageSchema = z.object({
  loketKeys: z.array(z.string()),
  displays: z.array(
    z.object({
      displayId: z.string(),
      displayName: z.string(),
      active: z.boolean(),
      loketKeys: z.array(z.string()),
    }),
  ),
})
export type SegmentationCoverage = z.infer<typeof segmentationCoverageSchema>

export const configurationAuditEntrySchema = z.object({
  auditId: z.string(),
  eventTime: z.string(),
  userId: z.string(),
  actionType: z.string(),
  entityName: z.string(),
  entityId: z.string(),
  reason: z.string().nullable().optional(),
  originalDataJson: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
})
export type ConfigurationAuditEntry = z.infer<typeof configurationAuditEntrySchema>

export const configurationAuditPageSchema = z.object({
  items: z.array(configurationAuditEntrySchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  totalCount: z.number().int(),
})
export type ConfigurationAuditPage = z.infer<typeof configurationAuditPageSchema>
