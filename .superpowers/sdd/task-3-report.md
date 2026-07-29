# Task 3 Report: Fix stale `devices.json` reference

## Changes Made

**File:** `apps/display-web/src/views/MissingScreenPicker.vue:44-45`

Replaced the empty-state message referencing the deleted `devices.json` with generic text referencing the backend system.

**Before:**
```html
Tidak ada entry screen display yang terdaftar di <code>devices.json</code>.
Pastikan Anda telah menambahkan entry dengan <code>role: 'display'</code> terlebih dahulu.
```

**After:**
```html
Tidak ada screen display yang terdaftar di sistem.
Pastikan admin telah mendaftarkan screen display melalui halaman konfigurasi.
```

## Commit

```
863ee22 fix(display-web): remove stale devices.json reference in MissingScreenPicker
```

## Notes

Only the empty-state `<p>` block was changed per the brief. The subtitle on line 28 (`"Silakan pilih salah satu screen aktif dari devices.json..."`) still references `devices.json` — it was not mentioned in the task brief but may need a follow-up if the goal is full removal of the term from this file.
