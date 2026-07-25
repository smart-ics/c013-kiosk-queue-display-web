packages/device-config/src/jsonProvider.ts | 4 ++++
 packages/device-config/src/provider.ts     | 1 +
 2 files changed, 5 insertions(+)

diff --git a/packages/device-config/src/jsonProvider.ts b/packages/device-config/src/jsonProvider.ts
index 85070a8..e348286 100644
--- a/packages/device-config/src/jsonProvider.ts
+++ b/packages/device-config/src/jsonProvider.ts
@@ -14,20 +14,24 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
     this.catalog = catalog
   }
 
   static fromJson(json: unknown): JsonDeviceConfigurationProvider {
     if (!json || typeof json !== 'object' || Array.isArray(json)) {
       throw new DeviceConfigInvalidError('*', 'Device catalog must be a JSON object keyed by deviceId')
     }
     return new JsonDeviceConfigurationProvider(json as DeviceConfigCatalog)
   }
 
+  async listDisplayScreenIds(): Promise<string[]> {
+    return []
+  }
+
   async getConfig(deviceId: string): Promise<DeviceConfig> {
     const key = deviceId.trim()
     if (!key) throw new DeviceConfigNotFoundError(deviceId)
 
     const raw = this.catalog[key]
     if (!raw) throw new DeviceConfigNotFoundError(key)
 
     const parsed = deviceConfigSchema.safeParse({
       ...raw,
       deviceId: raw.deviceId ?? key,
diff --git a/packages/device-config/src/provider.ts b/packages/device-config/src/provider.ts
index 7b7dd8b..ad87aa3 100644
--- a/packages/device-config/src/provider.ts
+++ b/packages/device-config/src/provider.ts
@@ -1,14 +1,15 @@
 import type { DeviceConfig } from '@aq/shared-types'
 
 export interface IDeviceConfigurationProvider {
   getConfig(deviceId: string): Promise<DeviceConfig>
+  listDisplayScreenIds(): Promise<string[]>
 }
 
 export class DeviceConfigNotFoundError extends Error {
   readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
   readonly deviceId: string
 
   constructor(deviceId: string) {
     super(`Unknown device configuration for '${deviceId}'`)
     this.name = 'DeviceConfigNotFoundError'
     this.deviceId = deviceId

--- Changes ---

packages/device-config/src/jsonProvider.ts
  @@ -14,20 +14,24 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
  +  async listDisplayScreenIds(): Promise<string[]> {
  +    return []
  +  }
  +
     async getConfig(deviceId: string): Promise<DeviceConfig> {
       const key = deviceId.trim()
       if (!key) throw new DeviceConfigNotFoundError(deviceId)
   
       const raw = this.catalog[key]
       if (!raw) throw new DeviceConfigNotFoundError(key)
   
       const parsed = deviceConfigSchema.safeParse({
         ...raw,
         deviceId: raw.deviceId ?? key,
  +4 -0

packages/device-config/src/provider.ts
  @@ -1,14 +1,15 @@
  +  listDisplayScreenIds(): Promise<string[]>
   }
   
   export class DeviceConfigNotFoundError extends Error {
     readonly code = 'DEVICE_CONFIG_NOT_FOUND' as const
     readonly deviceId: string
   
     constructor(deviceId: string) {
       super(`Unknown device configuration for '${deviceId}'`)
       this.name = 'DeviceConfigNotFoundError'
       this.deviceId = deviceId
  +1 -0


## Commits
d28448d feat(device-config): add listDisplayScreenIds to provider interface
d28448d feat(device-config): add listDisplayScreenIds to provider interface
