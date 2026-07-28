import {
  configurationAuditPageSchema,
  configurationSummarySchema,
  configurationWhoAmISchema,
  currentLoketDisplayItemSchema,
  createQueueDisplayBodySchema,
  createWorkstationBodySchema,
  displayBootConfigSchema,
  loginResponseSchema,
  queueDisplaySchema,
  replaceDisplayLoketsBodySchema,
  segmentationCoverageSchema,
  updateQueueDisplayBodySchema,
  updateWorkstationBodySchema,
  workstationContextSchema,
  workstationSchema,
  type CreateQueueDisplayBody,
  type CreateWorkstationBody,
  type LoginRequest,
  type LoginResponse,
  type ReplaceDisplayLoketsBody,
  type UpdateQueueDisplayBody,
  type UpdateWorkstationBody,
} from "@aq/shared-types";
import { z } from "zod";
import { ApiClientError } from "./errors";
import type { AdmissionQueueClient } from "./http";

const workstationsSchema = z.array(workstationSchema);
const displaysSchema = z.array(queueDisplaySchema);
const availableWorkstationsSchema = z.array(workstationContextSchema);
const currentDisplaysSchema = z.array(currentLoketDisplayItemSchema);

/** Login lives at server root `/login`, not under `/api`. */
export function buildLoginUrl(apiBase: string): string {
  const trimmed = apiBase.replace(/\/+$/, "");
  return `${trimmed}/user/login`;
}

export async function loginBilreg(
  apiBase: string,
  body: LoginRequest,
  fetchImpl: typeof fetch = fetch.bind(globalThis),
): Promise<LoginResponse> {
  const url = buildLoginUrl(apiBase);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email: body.email,
        pass: body.pass,
        appId: body.appId ?? "Bilreg",
      }),
    });
  } catch (error) {
    throw new ApiClientError(
      error instanceof Error ? error.message : "Network request failed",
      0,
    );
  }

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    throw new ApiClientError(
      "Response is not valid JSON",
      response.status,
      undefined,
      text,
    );
  }

  const envelope = z
    .object({
      status: z.string(),
      data: z.unknown().optional(),
      message: z.string().optional(),
      code: z.string().optional(),
    })
    .safeParse(payload);

  if (!response.ok || !envelope.success || envelope.data.status !== "success") {
    throw new ApiClientError(
      (envelope.success && envelope.data.message) ||
        `Login failed with status ${response.status}`,
      response.status,
      envelope.success ? envelope.data.code : undefined,
      payload,
    );
  }

  const parsed = loginResponseSchema.safeParse(envelope.data.data);
  if (!parsed.success) {
    throw new ApiClientError(
      `Login response validation failed: ${parsed.error.message}`,
      response.status,
    );
  }
  return parsed.data;
}

export function createConfigurationApi(client: AdmissionQueueClient) {
  const base = "v1/admission-queue/configuration";
  return {
    whoAmI() {
      return client.getJson(`${base}/whoami`, configurationWhoAmISchema);
    },

    getSummary() {
      return client.getJson(`${base}/summary`, configurationSummarySchema);
    },

    listWorkstations() {
      return client.getJson(`${base}/workstations`, workstationsSchema);
    },

    getWorkstation(workstationKey: string) {
      return client.getJson(
        `${base}/workstations/${encodeURIComponent(workstationKey)}`,
        workstationSchema,
      );
    },

    createWorkstation(body: CreateWorkstationBody) {
      const parsed = createWorkstationBodySchema.parse(body);
      return client.postJson(`${base}/workstations`, parsed, workstationSchema);
    },

    updateWorkstation(workstationKey: string, body: UpdateWorkstationBody) {
      const parsed = updateWorkstationBodySchema.parse(body);
      return client.putJson(
        `${base}/workstations/${encodeURIComponent(workstationKey)}`,
        parsed,
        workstationSchema,
      );
    },

    activateWorkstation(workstationKey: string) {
      return client.postJson(
        `${base}/workstations/${encodeURIComponent(workstationKey)}/activate`,
        {},
        workstationSchema,
      );
    },

    deactivateWorkstation(workstationKey: string) {
      return client.postJson(
        `${base}/workstations/${encodeURIComponent(workstationKey)}/deactivate`,
        {},
        workstationSchema,
      );
    },

    listDisplays() {
      return client.getJson(`${base}/displays`, displaysSchema);
    },

    getDisplay(displayId: string) {
      return client.getJson(
        `${base}/displays/${encodeURIComponent(displayId)}`,
        queueDisplaySchema,
      );
    },

    createDisplay(body: CreateQueueDisplayBody) {
      const parsed = createQueueDisplayBodySchema.parse(body);
      return client.postJson(`${base}/displays`, parsed, queueDisplaySchema);
    },

    updateDisplay(displayId: string, body: UpdateQueueDisplayBody) {
      const parsed = updateQueueDisplayBodySchema.parse(body);
      return client.putJson(
        `${base}/displays/${encodeURIComponent(displayId)}`,
        parsed,
        queueDisplaySchema,
      );
    },

    replaceDisplayLokets(displayId: string, body: ReplaceDisplayLoketsBody) {
      const parsed = replaceDisplayLoketsBodySchema.parse(body);
      return client.putJson(
        `${base}/displays/${encodeURIComponent(displayId)}/lokets`,
        parsed,
        queueDisplaySchema,
      );
    },

    activateDisplay(displayId: string) {
      return client.postJson(
        `${base}/displays/${encodeURIComponent(displayId)}/activate`,
        {},
        queueDisplaySchema,
      );
    },

    deactivateDisplay(displayId: string) {
      return client.postJson(
        `${base}/displays/${encodeURIComponent(displayId)}/deactivate`,
        {},
        queueDisplaySchema,
      );
    },

    getSegmentation() {
      return client.getJson(`${base}/segmentation`, segmentationCoverageSchema);
    },

    listAudit(page = 1, pageSize = 50) {
      return client.getJson(`${base}/audit`, configurationAuditPageSchema, {
        page,
        pageSize,
      });
    },
  };
}

export function createRuntimeDeviceApi(client: AdmissionQueueClient) {
  return {
    listAvailableWorkstations() {
      return client.getJson(
        "v1/admission-queue/workstations/available",
        availableWorkstationsSchema,
      );
    },

    getWorkstationContext(workstationKey: string) {
      return client.getJson(
        `v1/admission-queue/workstations/${encodeURIComponent(workstationKey)}/context`,
        workstationContextSchema,
      );
    },

    getDisplayBootConfig(displayId: string) {
      return client.getJson(
        `v1/admission-queue/devices/displays/${encodeURIComponent(displayId)}`,
        displayBootConfigSchema,
      );
    },

    getPublicDisplayBootConfig(displayId: string) {
      return client.getPublicJson(
        `v1/admission-queue/devices/displays/${encodeURIComponent(displayId)}`,
        displayBootConfigSchema,
      );
    },

    getPublicDisplaySnapshot(displayId: string) {
      return client.getPublicJson(
        `v1/admission-queue/devices/displays/${encodeURIComponent(displayId)}/snapshot`,
        currentDisplaysSchema,
      );
    },

    listPublicDisplays() {
      return client.getPublicJson(
        "v1/admission-queue/configuration/displays",
        displaysSchema,
      );
    },
  };
}

export type ConfigurationApi = ReturnType<typeof createConfigurationApi>;
export type RuntimeDeviceApi = ReturnType<typeof createRuntimeDeviceApi>;
