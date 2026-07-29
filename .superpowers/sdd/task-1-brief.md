### Task 1: Fix `listPublicKiosks` → `getPublicJson`

**Files:**
- Modify: `packages/api-client/src/configuration.ts:337-341`

**Interfaces:**
- Consumes: `AdmissionQueueClient` (existing)
- Produces: `listPublicKiosks()` now calls `getPublicJson` (same return type)

- [ ] **Step 1: Apply the change**

Change:
```ts
listPublicKiosks() {
  return client.getJson(
    "v1/admission-queue/configuration/kiosks",
    kiosksSchema,
  )
},
```
To:
```ts
listPublicKiosks() {
  return client.getPublicJson(
    "v1/admission-queue/configuration/kiosks",
    kiosksSchema,
  )
},
```

- [ ] **Step 2: Run typecheck**

`pnpm typecheck` from `packages/api-client/`

- [ ] **Step 3: Commit**

Use conventional commit message.
