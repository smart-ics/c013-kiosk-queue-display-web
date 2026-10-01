RELEASE NOTE — v0.2.12 (kiosk-web, 2026-10-01)

# Fixed
- Alur kiosk tidak lagi macet: pencarian pasien bisa dibatalkan, verifikasi biometrik ada tombol Batal, hasil basi setelah batal/home diabaikan.
- SEP BPJS kini berhasil dibuat (format tanggal sesuai kontrak Jetli), tidak lagi 400 Invalid string date.

# Changed
- Identitas eligibility mengikuti hasil SEP/upload; endpoint Jetli mengarah ke deployment JknTrustedLink.
- Hasil test akhir: 10 lolos, 0 gagal, 2 tertunda (data SKDP dev belum tersedia, bukan defect).
