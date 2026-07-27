packages/device-config/src/jsonProvider.ts | 11 +++++++----
 1 file changed, 7 insertions(+), 4 deletions(-)

diff --git a/packages/device-config/src/jsonProvider.ts b/packages/device-config/src/jsonProvider.ts
index e348286..135c981 100644
--- a/packages/device-config/src/jsonProvider.ts
+++ b/packages/device-config/src/jsonProvider.ts
@@ -14,24 +14,20 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
     this.catalog = catalog
   }
 
   static fromJson(json: unknown): JsonDeviceConfigurationProvider {
     if (!json || typeof json !== 'object' || Array.isArray(json)) {
       throw new DeviceConfigInvalidError('*', 'Device catalog must be a JSON object keyed by deviceId')
     }
     return new JsonDeviceConfigurationProvider(json as DeviceConfigCatalog)
   }
 
-  async listDisplayScreenIds(): Promise<string[]> {
-    return []
-  }
-
   async getConfig(deviceId: string): Promise<DeviceConfig> {
     const key = deviceId.trim()
     if (!key) throw new DeviceConfigNotFoundError(deviceId)
 
     const raw = this.catalog[key]
     if (!raw) throw new DeviceConfigNotFoundError(key)
 
     const parsed = deviceConfigSchema.safeParse({
       ...raw,
       deviceId: raw.deviceId ?? key,
@@ -43,11 +39,18 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
 
     if (parsed.data.deviceId !== key) {
       throw new DeviceConfigInvalidError(
         key,
         `Catalog entry deviceId '${parsed.data.deviceId}' does not match key '${key}'`,
       )
     }
 
     return parsed.data
   }
+
+  async listDisplayScreenIds(): Promise<string[]> {
+    return Object.entries(this.catalog)
+      .filter(([, raw]) => raw?.role === 'display')
+      .map(([id]) => id)
+      .sort((a, b) => a.localeCompare(b))
+  }
 }

--- Changes ---

packages/device-config/src/jsonProvider.ts
  @@ -14,24 +14,20 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
  -  async listDisplayScreenIds(): Promise<string[]> {
  -    return []
  -  }
  -
     async getConfig(deviceId: string): Promise<DeviceConfig> {
       const key = deviceId.trim()
       if (!key) throw new DeviceConfigNotFoundError(deviceId)
   
       const raw = this.catalog[key]
       if (!raw) throw new DeviceConfigNotFoundError(key)
   
       const parsed = deviceConfigSchema.safeParse({
         ...raw,
         deviceId: raw.deviceId ?? key,
  @@ -43,11 +39,18 @@ export class JsonDeviceConfigurationProvider implements IDeviceConfigurationProv
  +
  +  async listDisplayScreenIds(): Promise<string[]> {
  +    return Object.entries(this.catalog)
  +      .filter(([, raw]) => raw?.role === 'display')
  +      .map(([id]) => id)
  +      .sort((a, b) => a.localeCompare(b))
  +  }
   }
  +7 -4
a7915e6 feat(device-config): implement listDisplayScreenIds on json provider
