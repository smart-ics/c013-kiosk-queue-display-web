apps/display-web/src/views/DisplayPage.vue | 1 -
 1 file changed, 1 deletion(-)

diff --git a/apps/display-web/src/views/DisplayPage.vue b/apps/display-web/src/views/DisplayPage.vue
index cb8ae07..4cb1711 100644
--- a/apps/display-web/src/views/DisplayPage.vue
+++ b/apps/display-web/src/views/DisplayPage.vue
@@ -35,21 +35,20 @@ watch(
   async (rawScreenId, _prev, onCleanup) => {
     let cancelled = false
     onCleanup(() => {
       cancelled = true
     })
 
     bootError.value = null
     deviceConfig.value = null
     const screenId = rawScreenId?.trim()
     if (!screenId) {
-      bootError.value = 'Screen ID kosong. Buka dengan path /display/{screenId}.'
       return
     }
 
     try {
       const token = getAuthTokenProvider().getToken()
       if (!token) throw new MissingAuthTokenError()
 
       const provider = await getDeviceConfigProvider()
       const config = await provider.getConfig(screenId)
       if (cancelled) return

--- Changes ---

apps/display-web/src/views/DisplayPage.vue
  @@ -35,21 +35,20 @@ watch(
  -      bootError.value = 'Screen ID kosong. Buka dengan path /display/{screenId}.'
         return
       }
   
       try {
         const token = getAuthTokenProvider().getToken()
         if (!token) throw new MissingAuthTokenError()
   
         const provider = await getDeviceConfigProvider()
         const config = await provider.getConfig(screenId)
         if (cancelled) return
  +0 -1
d418e62 refactor(display-web): drop dead empty-screenId branch in DisplayPage
