# UPGRADE CLICKER

Game clicker neon untuk HP, tablet, dan desktop. Tekan reactor untuk menghasilkan **Energy**, beli upgrade, naikkan level, berevolusi, lalu lakukan **Rebirth** untuk mengumpulkan **Infinity**.

Dibuat oleh **Nur Mahmudi** · ©2026 Nur Mahmudi.

## Fitur

- **100 level** dengan 10 tahap evolusi: Beginner, Advanced, Super, Ultra, Master, Legendary, Mythical, Cosmic, Universal, dan Ultimate.
- **5 mata uang**: Energy, Gold, Diamond, Crystal, dan Infinity.
- **Upgrade berlapis**: energy upgrades, Gold technologies, Diamond specials, dan Infinity permanent upgrades.
- **Click, crit, combo, supply drop**, serta produksi idle/offline.
- **Rebirth** mulai Level 20 untuk bonus permanen dan multiplier global.
- **100 achievement** dengan hadiah Diamond dan Infinity.
- **Kontrol sentuh** untuk HP/tablet, keyboard `Space`/`Enter` untuk desktop.
- **Tilt opsional** memakai accelerometer (bonus hingga +20%), lengkap dengan permintaan izin motion di iOS.
- **Efek suara sintetis**, haptic, partikel canvas, dan tema warna per tahap evolusi.
- **PWA/offline-ready** lewat manifest dan service worker.
- Progres tersimpan otomatis di `localStorage` (`upgradeClicker.save.v2`).

## Cara Bermain

1. Buka game, lalu tekan **POWER CLICK** atau tombol `Space` untuk menghasilkan Energy.
2. Buka tab **LAB** dan beli upgrade. Gunakan mode beli `+1`, `+10`, atau `MAX`.
3. Naikkan level untuk mendapatkan Gold, Crystal, dan Diamond.
4. Buka tab **EVOLVE** saat level dan Crystal mencukupi untuk berganti form.
5. Setelah Level 20, buka tab **REBIRTH** untuk menukar progres menjadi Infinity.
6. Belanja Infinity di **PERMANENT UPGRADES**; achievement dan Infinity tetap tersimpan setelah rebirth.
7. Cek **AWARDS** untuk melihat 100 achievement dan progresnya.

### Kontrol

| Aksi | Kontrol |
| --- | --- |
| Menghasilkan Energy | Tap/klik core, `Space`, atau `Enter` |
| Ganti tab | Tombol navigasi bawah (mobile) atau tab deck (desktop) |
| Aktifkan tilt | Pengaturan → Tilt (iOS akan meminta izin motion) |
| Reset progres | Pengaturan → Reset |

## Menjalankan

Game ini statis dan tidak membutuhkan dependency atau build step.

```bash
# dari root repo
python3 -m http.server 3002
```

Buka `http://localhost:3002/`.

Untuk mencoba mode offline/PWA, gunakan `localhost` atau HTTPS agar service worker aktif.

## Struktur File

```
index.html              Markup utama dan urutan script
styles.css              Tema neon, layout responsif, animasi
js/data.js              Stage, definisi upgrade, 100 achievement
js/engine.js            State, formula, level, evolusi, rebirth, save/offline
js/fx.js                Web Audio synth, bintang, partikel klik
js/ui.js                Render DOM, toast, tab, filter achievement
js/app.js               Event, klik/drop, tilt, game loop, offline report
manifest.webmanifest    Metadata PWA
sw.js                   Cache offline
icon.svg                Ikon utama
icon-192.png            Ikon PWA/apple-touch
icon-512.png            Ikon PWA
```

## Catatan Teknis

- Tidak ada aset gambar eksternal; seluruh visual dibuat dengan CSS, SVG, dan canvas.
- Save dimigrasikan dengan aman: field baru memakai default, sedangkan achievement disaring berdasarkan ID yang valid.
- Reset progres menonaktifkan save sementara sebelum reload agar state lama tidak ditulis kembali oleh event `beforeunload`/`pagehide`.
- Offline gain dibatasi maksimal 8 jam dan efisiensinya dapat ditingkatkan lewat upgrade **Time Warp**.
- Tilt hanya aktif setelah diizinkan pengguna; tanpa izin, game tetap dapat dimainkan dengan sentuh.

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/mahmudinur475-maker/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/mahmudinur475-maker/PlayGround)

- 🎮 [Open the project](https://omgithub.com/mahmudinur475-maker/PlayGround).
- ✨ [Remix this project](https://omgithub.com/?remix=mahmudinur475-maker%2FPlayGround).
- 💻 [Explore the source](https://github.com/mahmudinur475-maker/PlayGround).
- 🛠️ [Check build runs](https://github.com/mahmudinur475-maker/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/mahmudinur475-maker/PlayGround/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/mahmudinur475-maker).
- 🌍 [Create with OMGithub](https://omgithub.com).
<!-- omgithub:readme:end -->
