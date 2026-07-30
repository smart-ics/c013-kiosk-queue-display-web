# Post-Deploy Config Pattern for Monorepo Apps

## Problem

`.env` variables (e.g. `VITE_BILREG_API_BASE`) are baked into JS bundles at build time. Changing API URLs requires rebuilding and redeploying the client. In hospital deployments where each site has different endpoints, this is impractical.

## Solution: Static JSON Config Loaded at Runtime

```text
apps/*/public/global_config.json   ← deployed alongside index.html, editable post-deploy
        ↓ fetch on app init
packages/app-config                ← Shared ConfigService singleton
        ↓ consumed by
apps/*/src/infrastructure.ts       ← API Client Initialization
```

## How It Works

### 1. The Shared Package (`packages/app-config`)

We define a shared service in `packages/app-config` so that all client applications (`kiosk-web`, `display-web`, `config-web`) have a unified way to fetch and read the global configuration.

```ts
// packages/app-config/src/index.ts
export interface AppConfig {
  bilregApiBase: string;
}

class ConfigService {
  private config: AppConfig | null = null;
  
  async initialize(): Promise<AppConfig> {
    const base = import.meta.env.BASE_URL;
    const res = await fetch(`${base}global_config.json?t=${Date.now()}`, { cache: 'no-store' });
    this.config = await res.json();
    return this.config;
  }
  // ... getters
}
```

### 2. Config File

Each application has its own `public/global_config.json` that is copied as-is by Vite to the deployment output.

```json
{
  "bilregApiBase": "http://localhost:5242"
}
```

### 3. App Initialization (main.ts)

The app bootstrap waits for the config to load before mounting the Vue app.

```ts
// apps/*/src/main.ts
import { configService } from '@aq/app-config'

await configService.initialize()
createApp(App).use(router).use(VueQueryPlugin, { queryClient }).mount('#app')
```

### 4. API Infrastructure Integration

The client API services are configured using the value from the config service instead of `import.meta.env`.

```ts
// apps/*/src/infrastructure.ts
import { configService } from '@aq/app-config'

export function getAdmissionQueueApi(): AdmissionQueueApi {
  const baseUrl = configService.getConfig().bilregApiBase
  if (!baseUrl) throw new Error('bilregApiBase is not configured')
  // ...
}
```

## Benefits for this Monorepo
- **No Build Steps on Deploy**: IT Administrators can change API URLs and refresh the browser.
- **Shared Type Safety**: `packages/app-config` ensures all apps conform to the same configuration interface.
- **Consistent Initialization**: The pattern is enforced across all apps in the monorepo.
