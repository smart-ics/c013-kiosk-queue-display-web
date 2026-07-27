.../__tests__/autoLoginAuthTokenProvider.spec.ts   |  4 ----
 packages/auth/src/autoLoginAuthTokenProvider.ts    | 23 +++++++++++-----------
 2 files changed, 12 insertions(+), 15 deletions(-)

diff --git a/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts b/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
index 8036f7d..7b1175a 100644
--- a/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
+++ b/packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
@@ -25,24 +25,20 @@ function createOkLogin(
     pegId: 'PEG1',
     userName: 'Display User',
     userLogin: 'display',
     email: 'display@example.com',
     expiredDate,
     tokenAuth: token,
     listRole: [],
   }))
 }
 
-function flushMicrotasks(): Promise<void> {
-  return new Promise(resolve => setTimeout(resolve, 0))
-}
-
 function createOptions(
   overrides: Partial<AutoLoginAuthTokenProviderOptions> = {},
 ): AutoLoginAuthTokenProviderOptions {
   return {
     apiBase: 'http://localhost:5000/api',
     loginImpl: createOkLogin(),
     storage: createMemoryStorage(),
     clock: () => new Date('2026-07-25T10:00:00.000Z'),
     ...overrides,
   }
diff --git a/packages/auth/src/autoLoginAuthTokenProvider.ts b/packages/auth/src/autoLoginAuthTokenProvider.ts
index 20f169c..59fbb87 100644
--- a/packages/auth/src/autoLoginAuthTokenProvider.ts
+++ b/packages/auth/src/autoLoginAuthTokenProvider.ts
@@ -27,21 +27,22 @@ const CRED_KEY = 'aq.display.credentials'
 type StoredCredentials = { email: string; pass: string }
 
 export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
   readonly phase: Ref<AutoLoginPhase>
   private readonly apiBase: string
   private readonly loginImpl: LoginImpl
   private readonly storage: Storage
   private readonly clock: () => Date
   private readonly defaultLifetimeMs: number
   private readonly expirySkewMs: number
-  private inFlight: Promise<void> | null = null
+  private loginInFlight: Promise<void> | null = null
+  private silentLoginInFlight: Promise<void> | null = null
   private readonly handleStorageEvent = (event: StorageEvent) => {
     if (event.key !== null && event.key !== CRED_KEY) return
     if (!this.readCredentials()) {
       this.phase.value = { kind: 'idle' }
     } else if (this.phase.value.kind === 'idle') {
       const credentials = this.readCredentials()!
       void this.silentLogin(credentials.email, credentials.pass)
     }
   }
 
@@ -77,65 +78,65 @@ export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
       return null
     }
     return current.token
   }
 
   async awaitAuthenticated(): Promise<void> {
     const current = this.phase.value
     if (current.kind === 'authenticated' && !this.isExpired(current.expiredAt)) {
       return
     }
-    if (this.inFlight) {
-      await this.inFlight
+    const inFlight = this.loginInFlight ?? this.silentLoginInFlight
+    if (inFlight) {
+      await inFlight
       const after = this.phase.value
       if (after.kind === 'authenticated') return
       const { MissingAuthTokenError } = await import('./index')
       throw new MissingAuthTokenError(
         after.kind === 'error' ? after.message : undefined,
       )
     }
     const { MissingAuthTokenError } = await import('./index')
     throw new MissingAuthTokenError(
       current.kind === 'error' ? current.message : undefined,
     )
   }
 
   async login(email: string, pass: string): Promise<void> {
-    if (this.inFlight) return this.inFlight
     this.phase.value = { kind: 'logging-in' }
-    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
+    this.loginInFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
     try {
-      await this.inFlight
+      await this.loginInFlight
     } finally {
-      this.inFlight = null
+      this.loginInFlight = null
     }
   }
 
   logout(): void {
     try { this.storage.removeItem(CRED_KEY) } catch {}
     this.phase.value = { kind: 'idle' }
   }
 
   destroy(): void {
     if (typeof window !== 'undefined') {
       window.removeEventListener('storage', this.handleStorageEvent)
     }
   }
 
   private async silentLogin(email: string, pass: string): Promise<void> {
-    if (this.inFlight) return this.inFlight
+    if (this.silentLoginInFlight) return this.silentLoginInFlight
     this.phase.value = { kind: 'logging-in' }
-    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
+    this.silentLoginInFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
     try {
-      await this.inFlight
+      await this.silentLoginInFlight
     } finally {
-      this.inFlight = null
+      this.silentLoginInFlight = null
     }
   }
 
   private async doLogin(
     email: string,
     pass: string,
     clearOnAuthFail: boolean,
   ): Promise<void> {
     try {
       const response = await this.loginImpl(this.apiBase, { email, pass })

--- Changes ---

packages/auth/src/__tests__/autoLoginAuthTokenProvider.spec.ts
  @@ -25,24 +25,20 @@ function createOkLogin(
  -function flushMicrotasks(): Promise<void> {
  -  return new Promise(resolve => setTimeout(resolve, 0))
  -}
  -
   function createOptions(
     overrides: Partial<AutoLoginAuthTokenProviderOptions> = {},
   ): AutoLoginAuthTokenProviderOptions {
     return {
       apiBase: 'http://localhost:5000/api',
       loginImpl: createOkLogin(),
       storage: createMemoryStorage(),
       clock: () => new Date('2026-07-25T10:00:00.000Z'),
       ...overrides,
     }
  +0 -4

packages/auth/src/autoLoginAuthTokenProvider.ts
  @@ -27,21 +27,22 @@ const CRED_KEY = 'aq.display.credentials'
  -  private inFlight: Promise<void> | null = null
  +  private loginInFlight: Promise<void> | null = null
  +  private silentLoginInFlight: Promise<void> | null = null
     private readonly handleStorageEvent = (event: StorageEvent) => {
       if (event.key !== null && event.key !== CRED_KEY) return
       if (!this.readCredentials()) {
         this.phase.value = { kind: 'idle' }
       } else if (this.phase.value.kind === 'idle') {
         const credentials = this.readCredentials()!
         void this.silentLogin(credentials.email, credentials.pass)
       }
     }
   
  @@ -77,65 +78,65 @@ export class AutoLoginAuthTokenProvider implements IAuthTokenProvider {
  -    if (this.inFlight) {
  -      await this.inFlight
  +    const inFlight = this.loginInFlight ?? this.silentLoginInFlight
  +    if (inFlight) {
  +      await inFlight
         const after = this.phase.value
         if (after.kind === 'authenticated') return
         const { MissingAuthTokenError } = await import('./index')
         throw new MissingAuthTokenError(
           after.kind === 'error' ? after.message : undefined,
         )
       }
       const { MissingAuthTokenError } = await import('./index')
       throw new MissingAuthTokenError(
         current.kind === 'error' ? current.message : undefined,
       )
     }
   
     async login(email: string, pass: string): Promise<void> {
  -    if (this.inFlight) return this.inFlight
       this.phase.value = { kind: 'logging-in' }
  -    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
  +    this.loginInFlight = this.doLogin(email, pass, /* clearOnAuthFail */ true)
       try {
  -      await this.inFlight
  +      await this.loginInFlight
       } finally {
  -      this.inFlight = null
  +      this.loginInFlight = null
       }
     }
   
     logout(): void {
       try { this.storage.removeItem(CRED_KEY) } catch {}
       this.phase.value = { kind: 'idle' }
     }
   
     destroy(): void {
       if (typeof window !== 'undefined') {
         window.removeEventListener('storage', this.handleStorageEvent)
       }
     }
   
     private async silentLogin(email: string, pass: string): Promise<void> {
  -    if (this.inFlight) return this.inFlight
  +    if (this.silentLoginInFlight) return this.silentLoginInFlight
       this.phase.value = { kind: 'logging-in' }
  -    this.inFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
  +    this.silentLoginInFlight = this.doLogin(email, pass, /* clearOnAuthFail */ false)
       try {
  -      await this.inFlight
  +      await this.silentLoginInFlight
       } finally {
  -      this.inFlight = null
  +      this.silentLoginInFlight = null
       }
     }
   
     private async doLogin(
       email: string,
       pass: string,
       clearOnAuthFail: boolean,
     ): Promise<void> {
       try {
         const response = await this.loginImpl(this.apiBase, { email, pass })
  +12 -11
