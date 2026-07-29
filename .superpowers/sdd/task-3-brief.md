### Task 3: Fix stale `devices.json` reference

**Files:**
- Modify: `apps/display-web/src/views/MissingScreenPicker.vue:44`

- [ ] **Step 1: Change the text**

Change:
```html
Tidak ada entry screen display yang terdaftar di <code>devices.json</code>.
Pastikan Anda telah menambahkan entry dengan <code>role: 'display'</code> terlebih dahulu.
```
To:
```html
Tidak ada screen display yang terdaftar di sistem.
Pastikan admin telah mendaftarkan screen display melalui halaman konfigurasi.
```

- [ ] **Step 2: Commit**
