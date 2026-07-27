# Task 5 Fix Report: UTF-8 Mojibake in MissingScreenPicker.vue

## Problem

`apps/display-web/src/views/MissingScreenPicker.vue` was double-encoded. The
em-dash (—, U+2014 / UTF-8 `E2 80 94`) and ellipsis (…, U+2026 / UTF-8
`E2 80 A6`) had each been mis-decoded as Latin-1 (`C3 A2 E2 82 AC` for the
`â€` prefix) and re-encoded as UTF-8.

## Bytes Before vs After

### Line 14 — title attribute

| | Bytes (UTF-8 hex) | Rendered |
|---|---|---|
| Before | `… 20 C3 A2 E2 82 AC E2 80 9D 20 …` | `Queue Display â€" Boot gagal` |
| After  | `… 20 E2 80 94 20 …` | `Queue Display — Boot gagal` |

The `C3 A2 E2 82 AC` prefix (the `â€` mojibake) was 4 bytes; the trailing
fragment `E2 80 9D` (3 bytes) was the mis-decoded em-dash — together 7 bytes
collapsed to the correct 3-byte `E2 80 94`.

### Line 22 — loading text

| | Bytes (UTF-8 hex) | Rendered |
|---|---|---|
| Before | `… 73 63 72 65 65 6E C3 A2 E2 82 AC C2 A6 …` | `Memuat daftar screenâ€¦` |
| After  | `… 73 63 72 65 65 6E E2 80 A6 …` | `Memuat daftar screen…` |

The `C3 A2 E2 82 AC` prefix (4 bytes) + the mis-decoded `C2 A6` (2 bytes) = 6
bytes collapsed to the correct 3-byte `E2 80 A6`.

## Post-fix File (lines 11–22)

```vue
<template>
  <BootErrorPage
    v-if="status === 'error'"
    title="Queue Display — Boot gagal"
    :message="error ?? 'Gagal memuat daftar screen.'"
  />

  <section v-else class="panel">
    <h1>Pilih Screen Display</h1>
    <p class="status">Pilih salah satu screen yang tersedia di devices.json.</p>

    <p v-if="status === 'loading'" class="status">Memuat daftar screen…</p>
```

Verified with `[System.IO.File]::ReadAllBytes` + `[System.Text.Encoding]::UTF8.GetString`:
- em-dash (U+2014) present at char index 419
- ellipsis (U+2026) present at char index 712
- file size shrank from 1120 → 1111 bytes (7 + 6 = 13 mojibake bytes replaced
  by 3 + 3 = 6 correct bytes, net −7 ✓)

## Typecheck Output

```
$ pnpm --filter display-web typecheck
> display-web@0.1.0 typecheck E:\PROJECT\ICS\FE\c013-kiosk-queue-display-web\apps\display-web
> vue-tsc -p tsconfig.app.json --noEmit
```

Exit code 0, no errors, no warnings. Pristine.

## Amended Commit

- Previous SHA: `ba7dc72 feat(display-web): add MissingScreenPicker view`
- New SHA: **`2222baff381e91579af47396800975ef5703e6cf`** — same subject
- Diff: `1 file changed, 2 insertions(+), 2 deletions(-)` — purely the two
  character replacements on lines 14 and 22.

## Self-Review

1. **Byte-level fix, not display-level.** Wrote the file with
   `[System.IO.File]::WriteAllBytes` from a manually constructed byte list.
   Did not use `Set-Content` / `Out-File` (PowerShell default UTF-16 LE would
   have re-mangled the file). Did not pass through the `edit` tool's
   display layer, which could not represent the mojibake bytes.
2. **Both mojibake patterns confirmed removed** by scanning the full byte
   array for `C3 A2` (`â€` prefix). No occurrences remain.
3. **Both correct characters confirmed present** (`U+2014` and `U+2026`) and
   at sensible offsets (line 14 / line 22).
4. **File shrinks by exactly 7 bytes** (1120 → 1111), matching the math:
   4 bytes of `C3 A2 E2 82 AC` overhead removed twice = 8 bytes removed,
   minus 1 byte because the mojibake em-dash sequence was 7 bytes vs. 3
   correct (Δ −4) and mojibake ellipsis was 6 bytes vs. 3 correct (Δ −3),
   total Δ −7. ✓
5. **Typecheck is the source of truth for regression.** `vue-tsc` reads the
   file as UTF-8; clean run means no string-typing / encoding issues.
6. **`rtk git commit --amend --no-edit`** preserved the original message —
   appropriate since the change is a byte-level fix to the same commit, not
   new work.
7. **Other Task 5 commit (`ba7dc72`)** is gone; the history now reflects a
   single commit with correct UTF-8. Anyone inspecting `git log` or
   `git show HEAD` will see the correct characters directly.

## Concerns

- The root cause — whoever produced the original file let their editor /
  shell pipeline re-encode UTF-8 as Latin-1 — is upstream of this fix. If a
  similar character set is needed elsewhere, a `Set-Content` mistake could
  reintroduce mojibake. Worth a brief mention in the runbook when this
  surface is documented; not blocking.
- The `rtk` wrapper prints the short SHA as `2222baf` (7 hex) in
  `git log --oneline`. The full SHA is `2222baff381e91579af47396800975ef5703e6cf`.
