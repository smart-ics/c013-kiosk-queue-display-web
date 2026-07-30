# Post-Deploy Config Pattern for Vue SPA

## Problem

.env variables are baked into JS bundles at build time. Changing API URLs, feature toggles, or any runtime config requires rebuild + redeploy. In hospital deployments where each client has different API endpoints, this is impractical.

## Solution: Static JSON Config Loaded at Runtime

```
public/global_config.json   ← deployed alongside index.html, editable post-deploy
        ↓ fetch on app init
src/core/configs/config.ts  ← ConfigService singleton
        ↓ consumed by
ApiService, Router, features, printing, etc.
```

## How It Works

### 1. Config File

`public/global_config.json` is a plain static file deployed to the web server alongside `index.html`. No build step — edit it directly on the server.

Location is derived from Vite's `base` path:
```ts
// config.ts
this.configUrl = `${import.meta.env.BASE_URL}global_config.json`
// resolves to /MyHospital/global_config.json in production
```

### 2. App Initialization (main.ts)

App bootstrap **waits** for config before mounting:

```ts
async function initializeApp() {
  const _config = await configService.initialize()  // fetch + validate
  const app = createApp(App)
  // ... register plugins, router, etc.
  ApiService.init(app)   // reads config internally
  app.mount('#app')
}
```

### 3. ConfigService Singleton

```ts
class ConfigService {
  private config: AppConfig | null = null

  async initialize(): Promise<AppConfig> {
    // fetch with cache-bust (?t=<counter>)
    // validate required fields
    // return parsed config
  }

  getConfig(): AppConfig           // full config object
  getApiUrl(apiName): string       // e.g. 'bilregApi' → baseUrl
  isFeatureEnabled(feature): boolean
  getApiConfig(apiName)            // full api config (credentials etc.)
}
```

### 4. API Service Integration

```ts
// ApiService.useUrlApi('bilregApi')
// Internally:
const apiConfig = configService.getApiConfig(apiName)
this.axios.defaults.baseURL = apiConfig.baseUrl
this.axios.defaults.timeout = apiConfig.timeout
```

No `.env` needed — API URLs come from the JSON file at runtime.

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Static JSON, not `.env` | Editable after deploy, no rebuild |
| `public/` directory | Vite copies as-is to dist; no bundling |
| Cache-bust query param | `?t=<counter>` prevents browser caching |
| Async init before mount | Components never see uninitialized state |
| Singleton pattern | One config object, consumed everywhere |
| Zod validation | Catch misconfigured JSON at startup, not silently |
| Typed `AppConfig` interface | Full IntelliSense in dev; catches structural changes |
| `credentials` per API | Some APIs need consumer-id/secret — co-located with URL |

## File Layout

```
public/
  global_config.json              ← deploy-time config
src/
  core/
    configs/
      config.ts                   ← ConfigService class + AppConfig type
      __tests__/
        config.spec.ts            ← unit tests
    types/
      admissionQueueConfig.ts     ← sub-config schema (example)
      print.ts                    ← print config schema (example)
    services/
      ApiService.ts               ← useUrlApi(apiName) reads ConfigService
      AuthService.ts              ← getLoginUrl(apiName) from ConfigService
  main.ts                         ← await configService.initialize() first
  router/
    index.ts                      ← reads basePath, appName from config
```

## Configuration Sections (from real project)

| Section | Purpose |
|---------|---------|
| `client` | Branding: company name, app name, logo, theme colors |
| `deployment` | `basePath` (IIS path), `environment`, `publicUrl` |
| `api` | Multiple API endpoints: each with `baseUrl`, `timeout`, `retries`, `credentials` |
| `features` | Feature toggles — disable UI elements without deploy |
| `security` | Session timeout, login attempts, MFA |
| `ui` | Pagination, date format, time format |
| `logging` | Log level, console vs remote |
| `printing` | Printer targets, templates, paper sizes |
| `admissionQueue` | Workstation config (sub-module specific) |

## Minimal Template for Other Projects

### `public/app-config.json`

```json
{
  "api": {
    "mainApi": {
      "baseUrl": "http://localhost:3000/api",
      "timeout": 15000,
      "retries": 3
    }
  },
  "features": {
    "analytics": false
  }
}
```

### `src/core/config.ts`

```ts
interface AppConfig {
  api: Record<string, { baseUrl: string; timeout: number; retries: number }>
  features: Record<string, boolean>
}

class ConfigService {
  private config: AppConfig | null = null

  async initialize(): Promise<AppConfig> {
    const base = import.meta.env.BASE_URL
    const res = await fetch(`${base}app-config.json?t=${Date.now()}`, { cache: 'no-store' })
    this.config = await res.json()
    return this.config
  }

  getConfig(): AppConfig {
    if (!this.config) throw new Error('Not initialized')
    return this.config
  }

  getApiUrl(name: string): string {
    return this.config.api[name]?.baseUrl ?? ''
  }
}

export const configService = new ConfigService()
```

### `src/main.ts`

```ts
import { configService } from './core/config'

async function bootstrap() {
  await configService.initialize()
  createApp(App).mount('#app')
}

bootstrap()
```

## Gotchas

- **JSON must be valid** — a trailing comma crashes `JSON.parse`
- **Browser caching** — always use cache-bust or `no-cache` headers
- **Credentials in public file** — `global_config.json` is served to all clients; never store server secrets (only API keys/consumer-id that the frontend needs)
- **Vite base path** — `import.meta.env.BASE_URL` must match the IIS/applications path. Set via `vite.config.ts` `base` option or `VITE_APP_BASE` env at build time
- **Validation** — validate at startup, not lazily. A bad config should fail fast