# SMA Negeri 1 Gebog — School Information System

Website & sistem informasi sekolah untuk SMA Negeri 1 Gebog. Target: free-first (Firebase free tier), mobile-first, aman, ringan.

## Struktur folder

```
sman1-gebog/
├── index.html        → Halaman Beranda (selesai)
├── profil.html       → Halaman Profil Sekolah (selesai)
├── sejarah.html      → Halaman Sejarah Sekolah (selesai)
├── visi-misi.html    → Halaman Visi & Misi (selesai)
├── guru-staff.html   → Halaman Guru & Staff, dengan pencarian & filter kategori (selesai)
├── akademik.html     → Halaman Akademik: kurikulum, peminatan, ekstrakurikuler (selesai)
├── berita.html       → Halaman daftar Berita, dengan pencarian, filter kategori & paginasi (selesai)
├── detail-berita.html → Halaman Detail Berita (baca via ?id=...), termasuk state "tidak ditemukan" & berita terkait (selesai)
├── pengumuman.html   → Halaman Pengumuman: pencarian, filter kategori, expand/collapse detail (selesai)
├── agenda.html       → Halaman Agenda: pencarian, filter kategori, dikelompokkan per bulan, expand/collapse detail (selesai)
├── galeri.html       → Halaman Galeri: album foto per kategori, filter, lightbox dengan navigasi prev/next & keyboard (selesai)
├── prestasi.html     → Halaman Prestasi: pencarian, filter tingkat (Sekolah/Kabupaten/Provinsi/Nasional/Internasional), grid card dengan dokumentasi (selesai)
├── kontak.html       → Halaman Kontak & Lokasi: kartu info kontak, peta Google Maps (embed gratis tanpa API key), tombol rute & buka di Maps (selesai)
├── login.html        → Halaman Masuk Portal: Firebase Authentication (email/password), session persistence, loading & error state (selesai)
├── lupa-password.html → Halaman Lupa Kata Sandi: kirim email reset password via Firebase Auth (selesai)
├── unauthorized.html → Halaman Akses Ditolak, dipakai guard proteksi halaman portal saat role tidak sesuai (selesai)
├── dashboard-siswa.html → Dashboard Siswa: greeting, profil singkat, jadwal hari ini, pengumuman terbaru, ujian CBT tersedia + countdown, riwayat hasil CBT — SEMUA data live dari Firestore (selesai)
├── jadwal-pelajaran.html → Jadwal Pelajaran: jadwal satu minggu penuh (Senin–Minggu) untuk kelas siswa yang login, dikelompokkan per hari, hari ini ditandai — data live dari Firestore (selesai)
├── pengumuman-siswa.html → Pengumuman (Portal Siswa): seluruh pengumuman published, pencarian, filter kategori, expand/collapse detail — data live dari Firestore, UX konsisten dengan pengumuman.html publik (selesai)
├── daftar-cbt.html → Daftar CBT: seluruh ujian kelas siswa dikelompokkan Berlangsung/Akan Datang/Selesai — data live dari Firestore, tombol "Kerjakan Sekarang"/"Lihat Hasil" mengecek dulu (HEAD request) apakah halaman tujuannya sudah ada sebelum mengarahkan (selesai)
├── hasil-cbt.html → Hasil & Riwayat CBT: seluruh hasil ujian milik siswa yang login (dijamin rules, bukan cuma UI), ringkasan nilai (jumlah/rata-rata/tertinggi/terendah), sorot hasil tertentu via ?examId dari Daftar CBT — data live dari Firestore (selesai)
├── kartu-pelajar.html → Kartu Pelajar Digital ("halaman profil siswa"): foto, nama, NIS, NISN, kelas, dan kode QR siswa — data live dari Firestore, foto & QR jatuh ke fallback jujur (inisial nama / pesan error) kalau belum diatur/gagal dimuat (selesai)
├── dashboard-guru.html → Dashboard Guru: greeting, profil singkat, kelas yang diajar, jadwal mengajar hari ini, ujian CBT milik guru, ringkasan bank soal, pengumuman terbaru — SEMUA data live dari Firestore (selesai)
├── kelas-jadwal.html → Kelas & Jadwal (Portal Guru): daftar kelas yang diajar sebagai filter chip, jadwal mengajar satu minggu penuh (Senin–Minggu) yang bisa disaring per kelas atau dilihat semua sekaligus — data live dari Firestore (selesai)
├── bank-soal.html → Bank Soal (Portal Guru): CRUD PENUH soal pilihan ganda (tambah/edit/hapus via bottom sheet form & dialog konfirmasi), pencarian teks soal, filter mata pelajaran, dukungan jawaban benar tunggal atau lebih dari satu — semua tersimpan/terhapus nyata di Firestore, data isolasi per guru dijamin firestore.rules (selesai)
├── css/
│   └── style.css     → Semua styling (light & dark mode via CSS variables)
├── js/
│   ├── main.js        → Interaktivitas BERSAMA di halaman publik: theme toggle, menu, search
│   ├── home-data.js   → Data contoh & render khusus Beranda (berita/pengumuman/agenda/prestasi/galeri) — HANYA dipakai index.html
│   ├── staff-data.js  → Data contoh & render/filter/search Guru & Staff — HANYA dipakai guru-staff.html
│   ├── berita-data.js → Data contoh & render/filter/paginasi Berita — dipakai berita.html (daftar) & detail-berita.html (render detail via ?id=)
│   ├── pengumuman-data.js → Data contoh & render/filter/expand Pengumuman — HANYA dipakai pengumuman.html
│   ├── agenda-data.js → Data contoh & render/filter/search/expand Agenda (dikelompokkan per bulan) — HANYA dipakai agenda.html
│   ├── gallery-data.js → Data contoh & render album/filter/lightbox Galeri — HANYA dipakai galeri.html
│   ├── prestasi-data.js → Data contoh & render/filter tingkat/search Prestasi — HANYA dipakai prestasi.html
│   ├── firebase-config.js → Config project Firebase — GANTI dengan config project Anda sendiri sebelum deploy
│   ├── firebase-init.js → Inisialisasi Firebase App/Auth/Firestore, dipakai semua halaman berbasis Firebase
│   ├── auth.js         → Modul login/logout/reset password/ambil role/proteksi halaman — dipakai login.html, lupa-password.html, dan portal internal nanti
│   ├── dashboard-siswa.js → Logika Dashboard Siswa: query real-time Firestore (schedules/announcements/exams/results) via onSnapshot, countdown ujian, skeleton & empty state jujur — HANYA dipakai dashboard-siswa.html
│   ├── jadwal-pelajaran.js → Logika Jadwal Pelajaran: satu query Firestore (classId saja, tanpa composite index), dikelompokkan & diurutkan per hari di sisi client — HANYA dipakai jadwal-pelajaran.html
│   ├── pengumuman-siswa.js → Logika Pengumuman Portal Siswa: satu query live Firestore (published==true, orderBy createdAt), lalu pencarian/filter kategori/expand-collapse di sisi client dari data yang sudah diterima — HANYA dipakai pengumuman-siswa.html
│   ├── daftar-cbt.js → Logika Daftar CBT: query live Firestore (classId, orderBy startTime), dikelompokkan menurut status waktu saat ini, tombol aksi mengecek keberadaan halaman tujuan (HEAD request) sebelum redirect — HANYA dipakai daftar-cbt.html
│   ├── hasil-cbt.js → Logika Hasil & Riwayat CBT: query live Firestore (studentId==uid, orderBy createdAt), hitung ringkasan nilai di client, sorot hasil tertentu via parameter ?examId — HANYA dipakai hasil-cbt.html
│   ├── kartu-pelajar.js → Logika Kartu Pelajar Digital: baca profil dari dokumen yang sama dengan Dashboard Siswa (users/{uid}, TIDAK ada collection baru), render foto (URL opsional, fallback inisial) & kode QR dari uid yang login (library QRCode.js, payload SAMA dengan absensi-siswa.js) — HANYA dipakai kartu-pelajar.html
│   └── dashboard-guru.js → Logika Dashboard Guru: kelas diajar & jadwal hari ini dari satu query Firestore (teacherId, disaring per hari di client agar tidak perlu index tambahan), ujian CBT (teacherId, orderBy startTime), hitung jumlah bank soal (createdBy) via getCountFromServer, pengumuman published — tautan ke halaman Portal Guru lain yang belum dibangun (Bank Soal, Manajemen CBT & Hasil) dicek dulu keberadaannya (HEAD request) sebelum redirect — HANYA dipakai dashboard-guru.html
│   └── kelas-jadwal.js → Logika Kelas & Jadwal: satu query Firestore (teacherId, tanpa orderBy — sama seperti jadwal-pelajaran.js — supaya tidak butuh composite index tambahan), daftar kelas unik dijadikan filter chip, jadwal dikelompokkan per hari & diurutkan jam di client, filter kelas terpilih juga di client dari data yang sama — HANYA dipakai kelas-jadwal.html
│   └── bank-soal.js → Logika Bank Soal: CRUD penuh (addDoc/updateDoc/deleteDoc) ke collection questions, satu query Firestore (createdBy, tanpa orderBy — pengurutan terbaru dulu di client), pencarian teks & filter mata pelajaran di client, bottom sheet form dengan dukungan jawaban tunggal (radio) atau lebih dari satu (checkbox), dialog konfirmasi hapus (bukan window.confirm) — HANYA dipakai bank-soal.html
├── assets/            → Logo & foto asli sekolah (taruh di sini)
└── README.md

Di root project (satu level di atas folder ini):
├── firebase.json        → Konfigurasi Firebase Hosting + Firestore
├── firestore.rules       → Security Rules Firestore (deny-by-default, role-based)
├── firestore.indexes.json → Composite index Firestore (kosong dulu, bertambah otomatis sesuai kebutuhan query)
└── .firebaserc.example    → Salin jadi `.firebaserc` lalu isi project ID Firebase Anda
```

## Setup Firebase (wajib sebelum Login berfungsi)

1. Buat project di https://console.firebase.google.com (gratis, tanpa kartu kredit)
2. Authentication → Sign-in method → aktifkan **Email/Password**
3. Firestore Database → buat database (mode production) di region terdekat (mis. `asia-southeast2`)
4. Project settings → Your apps → tambah Web App → salin `firebaseConfig` ke `js/firebase-config.js`
5. Buat dokumen pertama secara manual di koleksi `users` (uid dokumen HARUS SAMA dengan UID akun yang dibuat di tab Authentication), contoh field: `{ role: "admin", name: "Nama Admin" }` — ini akun admin pertama, langkah manual satu kali sebelum halaman Manajemen Pengguna (fase Admin) tersedia untuk membuat akun berikutnya
6. Install Firebase CLI (`npm install -g firebase-tools`), lalu dari root project: `firebase login`, salin `.firebaserc.example` → `.firebaserc` dan isi project ID, lalu `firebase deploy`

## Cara membuka

Buka `index.html` langsung di browser (double click), atau jalankan local server ringan:

```
npx serve .
```

## Status pengerjaan

- [x] 1. Beranda
- [x] 2. Profil Sekolah
- [x] 3. Sejarah
- [x] 4. Visi & Misi
- [x] 5. Guru & Staff
- [x] 6. Akademik
- [x] 7. Berita
- [x] 8. Detail Berita
- [x] 9. Pengumuman
- [x] 10. Agenda
- [x] 11. Galeri
- [x] 12. Prestasi
- [x] 13. Kontak & Lokasi
- [x] 14–15. Login & Lupa Password
- [x] 16. Dashboard Siswa
- [x] 17. Jadwal Pelajaran
- [x] 18. Pengumuman Siswa
- [x] 19. Daftar CBT
- [x] 20. Hasil & Riwayat CBT
- [x] 21. Dashboard Guru
- [x] 22. Kelas & Jadwal
- [x] 23. Bank Soal
- [ ] 24. Manajemen CBT & Hasil
- [ ] 25–26. Portal Tata Usaha
- [ ] 27–30. Admin & Developer
- [ ] Sistem CBT (40+ tampilan)
- [x] Firebase config (Hosting, Auth, Firestore, Security Rules) — dasar sudah terpasang, akan bertambah seiring fitur baru

## Catatan

- Data berita/pengumuman/agenda/prestasi/statistik di Beranda masih **contoh**, menunggu Firestore terhubung.
- Belum ada koneksi Firebase — halaman-halaman ini masih statis (HTML/CSS/JS murni).
- `js/main.js` kini hanya berisi logika bersama (theme, menu, search) supaya aman dipakai di semua halaman. Logika + data khusus Beranda dipindah ke `js/home-data.js` — sertakan file itu HANYA di halaman yang punya elemen `#newsList`, `#annList`, dst.
- Kartu "Sejarah Sekolah" di Profil kini menaut ke `sejarah.html` yang sudah jadi (linimasa 1992–sekarang, kepemimpinan, kutipan). Isi tahun/detail masih perlu diverifikasi ke pihak sekolah — sudah ditandai sebagai data yang perlu dikonfirmasi, bukan diklaim final.
- Riwayat kepala sekolah dari masa ke masa di halaman Sejarah baru memuat kepala sekolah saat ini (Sukarno) — data periode sebelumnya menyusul dari admin sekolah.
- Kartu "Halaman Terkait" di Profil kini menautkan ke `sejarah.html` dan `visi-misi.html`.
- Data guru & staff di `js/staff-data.js` masih **contoh** (nama, mapel, jabatan) — ganti dengan data asli sekolah atau hubungkan ke Firestore (collection `teachers`/`staff`). Pencarian nama/mapel dan filter kategori (Pimpinan/Guru/Tata Usaha) sudah berfungsi penuh di sisi client.
- Semua link "Akademik" di navbar/footer/menu sekarang menuju `akademik.html` yang sudah jadi. Daftar mapel peminatan & ekstrakurikuler masih data contoh, sesuaikan dengan data sekolah sebenarnya.
- Link "Berita" di navbar, menu, dan quick access Beranda sekarang menuju `berita.html` (bukan lagi scroll ke bagian Beranda). Data berita di `js/berita-data.js` masih **contoh** (menunggu Firestore, collection `news`) — setiap kartu sudah menaut ke `detail-berita.html?id=...` yang kini sudah berfungsi penuh (bukan lagi 404), lengkap dengan state "berita tidak ditemukan" untuk id yang salah/tidak ada, serta bagian "Berita Terkait" otomatis dari kategori yang sama. Pencarian, filter kategori, dan paginasi di daftar sudah berfungsi penuh di sisi client.
- Link "Pengumuman" di navbar, menu, quick access, dan bottom nav di semua halaman sekarang menuju `pengumuman.html` (bukan lagi scroll ke bagian Beranda). Data di `js/pengumuman-data.js` masih **contoh** (menunggu Firestore, collection `announcements`) — pengumuman "Penting" otomatis tampil di atas, dan setiap item bisa di-expand/collapse untuk membaca detail tanpa pindah halaman.
- Nomor telepon di footer Beranda (`(0291) 000-000`) masih contoh — ganti dengan nomor asli sekolah begitu tersedia, atau hapus dulu agar tidak disangka nomor resmi.
- Link "Agenda" di navbar, menu, quick access, dan tombol "Lihat Semua" di Beranda sekarang menuju `agenda.html` (bukan lagi scroll ke bagian Beranda). Data di `js/agenda-data.js` masih **contoh** (menunggu Firestore, collection `events`) — kegiatan dikelompokkan otomatis per label bulan, dapat dicari per nama kegiatan, difilter per kategori (Akademik/Kegiatan/Rapat/Libur), dan setiap item bisa di-expand/collapse untuk melihat waktu, lokasi, dan deskripsi lengkap.
- Link "Galeri" di navbar, menu, quick access, dan tombol "Lihat Semua" di Beranda sekarang menuju `galeri.html` (bukan lagi scroll ke bagian Beranda). Data di `js/gallery-data.js` masih **contoh** (menunggu Firestore + Storage, collection `gallery`) — foto dikelompokkan per album, dapat difilter per kategori (Kegiatan/Fasilitas/Wisuda/Prestasi), dan setiap foto bisa dibuka dalam lightbox dengan navigasi sebelumnya/berikutnya (tombol maupun tombol panah keyboard) serta tombol Escape untuk menutup. Foto saat ini masih placeholder emoji/gradient karena belum ada file foto asli; begitu foto asli diupload ke `assets/`, ganti elemen `.gal-photo` (div) menjadi `<img loading="lazy">` agar lazy loading native browser langsung aktif.
- Link "Prestasi" di navbar, menu, quick access, dan tombol "Lihat Semua" di semua halaman (termasuk Beranda) sekarang menuju `prestasi.html` (bukan lagi anchor kosong `#prestasi`). Data di `js/prestasi-data.js` masih **contoh** (menunggu Firestore, collection `achievements`) — setiap prestasi punya tingkat (Sekolah/Kabupaten/Provinsi/Nasional/Internasional), tahun, nama siswa/tim, dan dokumentasi singkat. Pencarian (nama prestasi & siswa/tim) dan filter tingkat sudah berfungsi penuh di sisi client. Ikon dokumentasi (medali) masih placeholder gradient — begitu foto dokumentasi asli tersedia, ganti `.prestasi-doc` (div) menjadi `<img loading="lazy">`.
- Link "Kontak" di navbar, menu, dan footer semua halaman sekarang menuju `kontak.html` (bukan lagi anchor `#kontak`/`index.html#kontak`). Alamat sekolah (Jl. PR Sukun, Gondosari, Kecamatan Gebog, Kabupaten Kudus, Jawa Tengah) sudah diverifikasi dari sumber publik dan dipakai konsisten di semua halaman. Peta lokasi memakai Google Maps embed gratis (`output=embed`, tanpa API key/billing) beserta tombol "Buka Rute" dan "Lihat di Google Maps" yang benar-benar berfungsi membuka Google Maps dengan lokasi sekolah. Nomor telepon, email, dan jam operasional **belum ditampilkan sebagai data pasti** karena belum ada sumber resmi terverifikasi — ditandai jujur sebagai "menunggu konfirmasi pihak sekolah", bukan diisi angka/alamat contoh yang bisa disalahartikan sebagai kontak resmi. Update ke data asli begitu tersedia dari pihak sekolah.

**Website Publik (13/13 halaman) — SELESAI.** Fase berikutnya: Authentication (Login & Lupa Password) menggunakan Firebase Authentication.

- **Authentication (14–15) — SELESAI**, dengan catatan penting: fitur ini baru bisa dites/dipakai setelah Anda mengisi `js/firebase-config.js` dengan config project Firebase asli dan mengikuti langkah di bagian "Setup Firebase" di atas. Sebelum config diisi, `login.html` akan gagal terhubung (error jaringan) — ini BUKAN bug, melainkan kondisi wajar karena belum ada project Firebase yang terhubung.
  - `login.html`: form email/password nyata via `signInWithEmailAndPassword`, session persistence (checkbox "Ingat saya" — local vs session persistence), tombol tampilkan/sembunyikan kata sandi, loading state dengan spinner, dan pesan error berbahasa Indonesia untuk setiap kode error Firebase Auth (email/sandi salah, akun dinonaktifkan, dsb.) — tanpa membocorkan detail sensitif.
  - `lupa-password.html`: reset password nyata via `sendPasswordResetEmail`. Pesan sukses SELALU sama baik email terdaftar maupun tidak (mencegah orang luar menebak email mana yang punya akun di sistem — praktik keamanan standar).
  - Setelah login berhasil, role pengguna diambil dari dokumen Firestore `users/{uid}` (bukan dari input client) lalu dicoba redirect ke dashboard sesuai role (`dashboard-siswa.html`, dst). Karena dashboard belum dibangun (menyusul di fase RBAC & Portal), halaman ini mendeteksi dashboard belum ada dan menampilkan panel "Berhasil Masuk" sementara — sesi login tetap benar-benar aktif dan tersimpan, bisa dites logout juga.
  - `unauthorized.html`: halaman akses ditolak, dipakai fungsi `requireAuth()` di `js/auth.js` yang sudah disiapkan untuk dipakai semua halaman portal internal nanti — otomatis redirect ke sini jika role tidak sesuai, atau ke `login.html` jika belum login sama sekali.
  - `firestore.rules` (di root project) sudah mencakup seluruh 19 collection sesuai desain database (users, news, announcements, events, gallery, achievements, classes, subjects, schedules, students, teachers, staff, exams, questions, attempts, answers, results, settings, activityLogs) — prinsip deny-by-default, role SELALU divalidasi dari dokumen server `users/{uid}`, dan pengguna tidak bisa menaikkan role sendiri (field `role` dikunci saat update oleh pemilik akun). Aturan akses CBT (exams/questions/attempts/results) akan disempurnakan lebih detail (jendela waktu ujian, dsb.) begitu Sistem CBT dibangun — untuk saat ini sengaja dibatasi ketat ke guru & manajemen saja.
  - **Update: pendaftaran mandiri Siswa (`daftar.html`) ditambahkan** — siswa bisa membuat akun sendiri (nama, email, kata sandi, kelas, NIS, NISN), tapi akun baru selalu dibuat berstatus `status:'pending'` & `disabled:true` sehingga BELUM bisa masuk portal sampai di-ACC Admin. `login.html` mendeteksi status ini dan menampilkan pesan "menunggu persetujuan Admin" (bukan pesan generik "akun dinonaktifkan"). Akun Guru/Tata Usaha/Admin TETAP dibuat langsung oleh Admin (Manajemen Pengguna) seperti semula, bukan self-signup — hanya Siswa yang boleh mendaftar sendiri. `firestore.rules` mengunci kombinasi ini di server (`create` hanya boleh utk `role:'siswa'` + `status:'pending'` + `disabled:true`, dan `update` oleh pemilik akun sendiri tidak boleh mengubah `role`/`status`/`disabled` — mencegah siswa meng-ACC dirinya sendiri lewat panggilan Firestore langsung). ACC dilakukan Admin di `manajemen-pengguna.html` lewat tab/chip baru "Menunggu ACC" dengan tombol Setujui (mengaktifkan akun + membuat dokumen cermin `students`) atau Tolak (menghapus dokumen pendaftaran, sama seperti hapus pengguna biasa).

- **Dashboard Siswa (16) — SELESAI.** Ini halaman pertama Portal Siswa, dan begitu file ini ada, `login.html` otomatis mengarahkan siswa ke sini setelah login berhasil (tidak perlu ubah kode login — sudah disiapkan sejak fase Authentication).
  - Semua data (jadwal, pengumuman, ujian CBT, riwayat hasil) diambil **live** dari Firestore lewat `onSnapshot` — bukan data contoh. Jika koleksi terkait masih kosong di Firestore, setiap bagian menampilkan empty state yang jujur (mis. "Belum ada pengumuman baru"), bukan angka/isi palsu. Skeleton loading tampil sebelum data pertama datang.
  - Greeting, avatar berinisial, kelas, dan NIS diambil dari dokumen `users/{uid}` milik siswa yang login. Jika field `classId` belum diatur Admin/TU, jadwal dan daftar CBT menampilkan pesan bahwa kelas belum diatur (bukan error/kosong tanpa penjelasan).
  - Countdown ujian di bagian atas dashboard bersifat **informatif** (preview jadwal, memakai jam browser) dan otomatis muncul untuk ujian terdekat siswa yang belum berakhir. Timer resmi anti-kecurangan yang wajib memakai waktu server (§30 spek) baru dibangun di halaman pengerjaan CBT sungguhan pada fase Sistem CBT.
  - Akses cepat (Jadwal/CBT/Pengumuman/Hasil) dan bottom navigation portal untuk sementara mengarah ke *anchor* di dalam dashboard ini sendiri (bukan tautan palsu ke halaman yang belum ada) — akan diarahkan ke halaman penuh masing-masing begitu `jadwal-pelajaran.html`, `pengumuman-siswa.html`, `daftar-cbt.html`, dan `hasil-cbt.html` dibangun pada langkah-langkah berikutnya.
  - **Perbaikan security rules yang ditemukan saat fase ini**: `firestore.rules` sebelumnya membatasi collection `exams` hanya bisa dibaca staff (guru/TU/admin/developer), sehingga siswa tidak akan bisa melihat daftar ujiannya sendiri. Sudah diperbaiki agar siswa boleh membaca **metadata** ujian (judul, mapel, waktu, durasi) untuk kelasnya sendiri saja (`resource.data.classId == myProfile().classId`) — jawaban benar tetap selamanya terkunci di collection `questions` yang tetap staff-only, tidak berubah.
  - `firestore.indexes.json` ditambahkan 4 composite index (schedules, announcements, exams, results) yang benar-benar dibutuhkan oleh query dashboard ini, supaya tidak gagal di percobaan pertama setelah deploy karena index belum ada.

- **Jadwal Pelajaran (17) — SELESAI.** Menampilkan jadwal satu minggu penuh (Senin–Minggu) untuk kelas siswa yang login, dikelompokkan per hari dengan label "Hari ini" pada hari yang sedang berjalan.
  - Query Firestore-nya sengaja hanya satu filter kesetaraan (`classId`) tanpa `orderBy` di query, supaya **tidak butuh composite index tambahan** — pengelompokan per hari (urutan Senin→Minggu, bukan urutan Firestore) dan pengurutan jam dalam satu hari dilakukan di sisi client setelah data diterima. Ini beda pendekatan dari query "hari ini" di Dashboard yang memang butuh composite index karena ada `where` ganda + `orderBy`.
  - Tidak butuh perubahan `firestore.rules` — collection `schedules` sudah mengizinkan baca untuk siapa pun yang sudah login sejak fase Authentication.
  - Kartu quick access "Jadwal" dan bottom navigation "Jadwal" di Dashboard Siswa sekarang menuju halaman ini (bukan lagi anchor di dalam Dashboard). Bagian "Jadwal Hari Ini" di Dashboard juga dapat tautan "Lihat semua" ke halaman ini.

- **Pengumuman Siswa (18) — SELESAI.** Menampilkan seluruh pengumuman `published == true` dari Firestore (bukan data contoh), dengan pencarian judul, filter kategori (Akademik/Kegiatan/Umum), dan expand/collapse detail — UX-nya sengaja dibuat konsisten dengan halaman publik `pengumuman.html`, hanya kali ini datanya nyata dan dibungkus chrome portal (header + bottom nav siswa).
  - Query ke Firestore hanya dilakukan sekali lewat listener real-time (`onSnapshot`); pencarian dan filter kategori berikutnya berjalan di sisi client dari data yang sudah diterima, jadi terasa instan tanpa query berulang ke server.
  - Field `category` pada dokumen `announcements` bersifat opsional — item tanpa kategori tetap tampil di filter "Semua" tanpa badge kategori, bukan error atau hilang dari daftar.
  - Memakai index Firestore `announcements (published, createdAt)` yang sama dengan yang sudah dideklarasikan untuk Dashboard — tidak perlu index baru.
  - Kartu quick access, tautan "Lihat semua" di Dashboard, dan bottom navigation "Pengumuman" di semua halaman portal (Dashboard, Jadwal) sekarang menuju halaman ini.

- **Daftar CBT (19) — SELESAI.** Menampilkan seluruh ujian CBT untuk kelas siswa dari Firestore (bukan data contoh), dikelompokkan otomatis menurut status waktu saat ini: 🟢 Sedang Berlangsung, 🕒 Akan Datang, ✅ Selesai — pengelompokan dihitung ulang setiap kali data berubah (real-time), bukan status statis.
  - **Tidak ada tombol palsu.** Ujian yang sedang berlangsung punya tombol "Kerjakan Sekarang" dan ujian yang sudah selesai punya tombol "Lihat Hasil" — tapi sebelum benar-benar mengarahkan siswa, kedua tombol ini mengecek dulu (HEAD request) apakah halaman tujuannya (`cbt-pengerjaan.html`, `hasil-cbt.html`) sudah benar-benar ada. Karena kedua halaman itu memang belum dibangun (menyusul: Hasil & Riwayat CBT di halaman berikutnya, dan halaman pengerjaan CBT sungguhan di fase Sistem CBT), tombol menampilkan catatan jujur bahwa fiturnya sedang dibangun — persis pola yang sama seperti `login.html` saat mengecek dashboard sebelum tersedia, bukan tautan mati atau redirect ke 404.
  - Tidak perlu index Firestore baru — memakai index `exams (classId, startTime)` yang sudah dideklarasikan sejak fase Dashboard.
  - Kartu quick access "CBT", tautan "Lihat semua" di Dashboard, dan bottom navigation "CBT" di semua halaman portal sekarang menuju halaman ini.

- **Hasil & Riwayat CBT (20) — SELESAI.** Ini halaman terakhir Portal Siswa. Menampilkan seluruh hasil ujian milik siswa yang login dari collection `results`, dilengkapi ringkasan nilai (jumlah ujian diikuti, rata-rata, nilai tertinggi, nilai terendah) yang dihitung di client dari hasil yang sama — bukan angka terpisah yang bisa berbeda dari daftar di bawahnya.
  - Isolasi data dijamin di `firestore.rules` (`resource.data.studentId == request.auth.uid`), bukan cuma disembunyikan di UI — sesuai §32 spek, siswa tidak mungkin melihat hasil siswa lain walau mencoba memanipulasi query dari console browser sekalipun.
  - Field `examId` (opsional) ditambahkan ke skema `results` supaya tombol "Lihat Hasil" di Daftar CBT bisa menautkan balik dan menyorot baris hasil yang relevan lewat parameter `?examId=...` — dokumen lama tanpa field ini tetap tampil normal, hanya tanpa efek sorot.
  - Tidak perlu index Firestore baru — memakai index `results (studentId, createdAt)` yang sudah dideklarasikan sejak fase Dashboard.
  - Dengan halaman ini tersedia, tombol "Lihat Hasil" di Daftar CBT yang sebelumnya menampilkan catatan "sedang dibangun" sekarang otomatis aktif mengarahkan ke sini (mekanisme HEAD-check-nya tidak perlu diubah sama sekali).

**Portal Siswa (5/5 halaman) — SELESAI.**

- **Dashboard Guru (21) — SELESAI.** Halaman pertama Portal Guru. Begitu file ini ada, `login.html` otomatis mengarahkan guru ke sini setelah login berhasil (tidak perlu ubah kode login — sudah disiapkan sejak fase Authentication).
  - **Perluasan skema**: field `teacherId` (uid guru) ditambahkan ke `schedules` dan `exams`, serta `createdBy` (uid guru) ke `questions`, supaya data seorang guru bisa difilter langsung dari Firestore, bukan dari seluruh koleksi sekolah. Dokumen lama yang dibuat sebelum field ini ada tidak akan muncul di dashboard guru manapun sampai dilengkapi via Manajemen Website (fase Admin) — ditandai jujur di komentar kode, bukan diam-diam diabaikan.
  - "Kelas yang Saya Ajar" **tidak** memakai collection baru — diturunkan dari hasil query `schedules` (teacherId==uid) yang sama dengan yang dipakai bagian "Jadwal Mengajar Hari Ini", dideduplikasi di client. Query ini sengaja hanya satu filter kesetaraan tanpa `orderBy` (pola sama seperti `jadwal-pelajaran.js`), sehingga **tidak butuh composite index tambahan**; pengelompokan per hari dilakukan di client.
  - "Ujian CBT Saya" memakai query `exams` (teacherId, orderBy startTime) — composite index barunya sudah ditambahkan ke `firestore.indexes.json`.
  - "Bank Soal Saya" menampilkan ringkasan jumlah soal (`questions` where createdBy==uid) via `getCountFromServer` — hanya angka ringkasan, pengelolaan penuh (tambah/edit/hapus soal) menyusul di halaman `bank-soal.html`.
  - **Tidak ada tautan palsu**: quick access, section header, dan bottom navigation ke `kelas-jadwal.html`, `manajemen-cbt-hasil.html`, dan `bank-soal.html` (halaman 22–24, belum dibangun) sama-sama dijaga satu fungsi `guardLinksTo()` yang mengecek keberadaan halaman (HEAD request) sebelum redirect — jika belum ada, tampil catatan jujur "sedang dibangun" (toast), bukan pindah ke halaman 404. Pola ini konsisten dengan `daftar-cbt.js` di Portal Siswa.
  - Tidak perlu perubahan `firestore.rules` — `schedules`/`exams` sudah bisa dibaca siapa pun yang login sejak fase Authentication, dan `questions` sudah staff-only (termasuk guru) dengan akses penuh.

- **Kelas & Jadwal (22) — SELESAI.** Menampilkan seluruh jam mengajar guru yang login untuk satu minggu penuh (Senin–Minggu), dari query Firestore yang sama persis dengan yang dipakai Dashboard Guru untuk "Kelas yang Saya Ajar" (`schedules` where teacherId==uid) — **tidak ada query atau collection baru**.
  - Daftar kelas unik dari hasil query yang sama dijadikan filter chip (pola & class CSS `filter-chip`/`staff-filters` disalin dari halaman Guru & Staff) — memilih "Semua Kelas" atau satu kelas tertentu menyaring jadwal di bawahnya secara instan di client, tanpa query ulang ke server.
  - Sama seperti `jadwal-pelajaran.js` (Portal Siswa): query sengaja hanya satu filter kesetaraan (`teacherId`) tanpa `orderBy`, sehingga **tidak butuh composite index tambahan** — pengelompokan per hari (urutan Senin→Minggu, hari ini ditandai) dan pengurutan jam dilakukan di client.
  - Kartu quick access "Kelas" di Dashboard Guru dan bottom navigation "Kelas" di semua halaman Portal Guru sekarang menuju halaman ini (bukan lagi ditahan HEAD-check). Tautan ke `manajemen-cbt-hasil.html`/`bank-soal.html` (belum dibangun) di halaman ini sendiri tetap dijaga `guardLinksTo()`, konsisten dengan Dashboard Guru.

- **Bank Soal (23) — SELESAI.** Halaman pertama di project ini dengan **CRUD penuh** (Create, Read, Update, Delete) yang benar-benar tersambung ke Firestore — bukan tombol palsu, bukan data contoh.
  - Form tambah/edit soal tampil sebagai **bottom sheet** (komponen CSS baru: `.sheet-overlay`/`.sheet-panel`, dipilih karena pola ini paling nyaman di smartphone dibanding modal tengah layar) — dipakai untuk membuat soal baru maupun mengedit soal yang sudah ada (form yang sama, judul & tombol submit berubah sesuai mode).
  - Setiap soal punya: mata pelajaran, kategori/materi (opsional), tingkat kesulitan (Mudah/Sedang/Sulit), poin, teks pertanyaan, 4 pilihan jawaban (A–D, minimal 2 harus diisi), dan pembahasan (opsional). Checkbox "lebih dari satu jawaban benar" mengganti input jawaban dari radio (satu jawaban) menjadi checkbox (banyak jawaban) — sesuai §28 spek yang menyebut tipe pilihan ganda multiple-answer sebagai opsi.
  - **Validasi nyata** sebelum simpan: mata pelajaran & teks pertanyaan wajib diisi, minimal 2 pilihan terisi, minimal 1 jawaban benar ditandai, poin harus angka > 0 — pesan error ditampilkan di dalam form (`.auth-alert`), bukan `alert()` browser.
  - **Hapus soal** memakai dialog konfirmasi khusus (`.confirm-overlay`, komponen CSS baru) yang mengingatkan bahwa soal yang sedang dipakai ujian aktif sebaiknya tidak dihapus — bukan `window.confirm()` bawaan browser, supaya bisa diberi konteks & gaya yang konsisten dengan desain portal.
  - Pencarian teks soal dan filter chip mata pelajaran (memakai `filter-chip`/`staff-filters`, class yang sama dengan Guru & Staff dan Kelas & Jadwal) sepenuhnya di client dari satu query real-time (`onSnapshot`, filter `createdBy==uid` tanpa `orderBy` — pengurutan "terbaru dulu" dihitung di client dari `createdAt`) — **tidak butuh composite index tambahan**.
  - **Perketatan `firestore.rules` yang ditemukan saat fase ini**: sebelumnya `questions` bisa dibaca/ditulis oleh SEMUA guru tanpa batas (`hasRole('guru')` saja) — artinya seorang guru bisa membaca bahkan menghapus soal milik guru lain. Diperbaiki agar guru hanya bisa mengakses (`read`/`update`/`delete`) dokumen `questions` milik sendiri (`resource.data.createdBy == request.auth.uid`) dan hanya bisa `create` dengan `createdBy` yang sama dengan uid dirinya sendiri — sesuai prinsip §35 spek "guru hanya mengakses ujian/soal yang menjadi tanggung jawabnya". Admin/developer tetap punya akses penuh untuk pengawasan.
  - Belum ada upload gambar soal (§28 spek: "soal dengan gambar jika diperlukan") — sengaja **tidak dibuat versi palsunya**. Fitur ini butuh Firebase Storage (validasi tipe/ukuran file, upload progress, kompresi gambar sesuai §36 spek) yang belum dibangun di project ini; akan menyusul bersamaan dengan `storage.rules` pada fase yang membutuhkan Storage secara nyata, bukan dipaksakan sekarang sebagai placeholder kosong.

**Portal Guru (4/4), Portal Tata Usaha (2/2), dan Dashboard Admin (27) — SELESAI** (lihat file `manajemen-cbt-hasil.html`, `dashboard-tu.html`, `manajemen-informasi-administrasi.html`, `dashboard-admin.html` beserta pasangan `js/`-nya di folder ini — catatan detail per halaman belum ditulis ulang di README ini, menyusul).

- **Manajemen Website (28) — SELESAI.** Halaman kedua Portal Admin & Developer: satu halaman dengan 7 tab (chip) untuk mengelola SELURUH konten website publik.
  - **5 tab daftar dengan CRUD penuh** (bottom sheet, sama seperti pola `bank-soal.html`): Berita (`news`), Galeri (`gallery`), Prestasi (`achievements`), Pengumuman (`announcements`), Agenda (`events`). Tambah/edit/hapus semuanya tersimpan/terhapus nyata di Firestore — dialog konfirmasi hapus dipakai bersama kelima tab (bukan `window.confirm()`), dan menampilkan judul item yang akan dihapus supaya admin tidak salah hapus.
  - **2 tab dokumen tunggal**: Profil & Akademik (`schoolProfile/main`) dan PPDB (`ppdb/main`) — form panjang dengan textarea berformat (`Label: Isi`, `Judul: Deskripsi`, `Pertanyaan :: Jawaban`) yang di-parse jadi array/objek terstruktur saat disimpan, dan di-format balik jadi teks saat dimuat untuk diedit lagi. Disimpan lewat `setDoc(..., {merge:true})`, bukan `addDoc`, karena dokumennya memang satu-satunya (id tetap `main`).
  - **Halaman publik BELUM membaca dari Firestore** — ditandai jujur lewat `auth-alert` di tab Profil & PPDB. `berita.html`, `galeri.html`, `prestasi.html`, `pengumuman.html`, `agenda.html` publik masih memakai data contoh di `js/*-data.js` sampai fase migrasi konten terpisah menyambungkannya ke collection yang sekarang sudah bisa diisi admin dari halaman ini.
  - Query kelima collection sengaja **tanpa `where`/`orderBy`** (admin boleh melihat SEMUA dokumen, termasuk draf/`published:false`, sesuai `isManagement()` di `firestore.rules`) — pengurutan "terbaru dulu" dihitung di client dari `createdAt`, jadi **tidak butuh composite index tambahan**.
  - **Perubahan `firestore.rules`**: ditambahkan collection baru `ppdb` (read: publik, write: `isManagement()`) — lima collection lain (`news`, `announcements`, `events`, `gallery`, `achievements`, `schoolProfile`) sudah mengizinkan tulis admin/developer sejak fase Authentication, tidak perlu diubah.
  - Tombol "Tambah" (FAB) otomatis tersembunyi di tab Profil & PPDB (dokumen tunggal disimpan lewat tombol submit form itu sendiri, bukan lewat sheet tambah).

**Portal Admin & Developer (2/4 halaman).** Fase berikutnya: Manajemen Pengguna (29), lalu Pengaturan Sistem (30).

- **Manajemen Pengguna (29) — SELESAI.** Halaman ketiga Portal Admin & Developer: CRUD akun untuk kelima role (Siswa/Guru/Tata Usaha/Admin/Developer), sesuai §26 spek.
  - **Pembuatan akun nyata di Firebase Authentication**, bukan hanya dokumen Firestore, TANPA Cloud Functions/Admin SDK (§1 spek: tidak boleh memaksa layanan berbayar seperti paket Blaze). Triknya: instance Firebase KEDUA (`initializeApp(firebaseConfig, "AdminUserCreation")`) dipakai khusus untuk `createUserWithEmailAndPassword`, supaya sesi login admin di instance pertama tidak ikut tergantikan — lalu langsung `signOut` dari instance kedua begitu selesai.
  - **Admin tidak pernah menentukan/melihat kata sandi pengguna baru** — begitu akun dibuat, sistem otomatis mengirim email "Atur Kata Sandi" (`sendPasswordResetEmail`, mekanisme sama dengan halaman Lupa Kata Sandi) ke email pengguna baru. Kata sandi sementara dibuat acak di client dan tidak pernah disimpan/ditampilkan.
  - Setiap akun siswa/guru/TU otomatis mendapat **dokumen cermin** di collection `students`/`teachers`/`staff` (field ringkas: nama, email, dan field khusus role seperti kelas/NIS, mata pelajaran, atau jabatan) — ini yang sebelumnya membuat statistik Dashboard Admin & Dashboard TU (§24 spek) selalu menunjukkan 0, karena belum ada yang mengisi ketiga collection itu. Kalau role seorang pengguna diubah, dokumen cermin lama dihapus dan dibuat ulang sesuai role baru.
  - **Nonaktifkan akun** (toggle cepat dari kartu, tanpa buka form) hanya menyetel field `disabled` di `users/{uid}` — `requireAuth()` (`js/auth.js`) dan `login.html` sekarang memeriksa field ini dan langsung menolak akses/menampilkan pesan "akun dinonaktifkan" walau kata sandinya benar. **Diakui jujur di UI** (teks alert & dialog konfirmasi) bahwa ini BUKAN menonaktifkan akun Firebase Authentication yang sesungguhnya (itu butuh Admin SDK berbayar) — hanya memblokir di level aplikasi, yang tetap efektif menutup semua halaman portal di sistem ini.
  - **Hapus pengguna** menghapus dokumen `users/{uid}` + dokumen cerminnya — dengan keterbatasan yang sama diakui jujur di dialog konfirmasi (akun Auth-nya sendiri tidak ikut terhapus, tapi tidak bisa lagi lolos `requireAuth()` di halaman manapun karena dokumen profilnya sudah hilang).
  - **Proteksi anti-lockout**: admin tidak bisa mengubah role diri sendiri (dropdown role terkunci saat mengedit akun sendiri), tidak bisa menonaktifkan diri sendiri, dan tidak bisa menghapus akun sendiri (tombol nonaktifkan/hapus otomatis disabled di kartu miliknya sendiri).
  - Pencarian nama/email dan filter chip role (Semua/Siswa/Guru/TU/Admin/Developer) sepenuhnya di client dari satu query real-time (`onSnapshot`, tanpa `where`/`orderBy` — cocok karena admin memang perlu melihat SEMUA pengguna) — tidak butuh composite index tambahan.
  - Tidak ada perubahan `firestore.rules` — aturan `users` (create/update/delete hanya `isManagement()`, dan pengguna tidak bisa mengubah `role` miliknya sendiri) sudah cukup sejak fase Authentication.

- **Pengaturan Sistem (30) — SELESAI.** Halaman TERAKHIR dari 30 halaman utama spek. Tiga tab (chip), semuanya nyata:
  - **Tab Umum**: dokumen tunggal `settings/general` (tahun ajaran & semester aktif — murni informasi, belum dibaca halaman lain, jujur dinyatakan di UI) plus **mode pemeliharaan yang benar-benar aktif** (bukan sekadar checkbox dekoratif): `requireAuth()` di `js/auth.js` sekarang mengecek `settings/general.maintenanceMode` di SETIAP halaman portal internal setiap kali dibuka — saat aktif, Siswa/Guru/TU diarahkan ke `unauthorized.html?reason=maintenance` (pesan & tombol keluar khusus, bukan teks "akses ditolak" biasa), sementara Admin/Developer tetap bisa masuk. Website publik sama sekali tidak terpengaruh.
  - **Tab Log Aktivitas**: menampilkan collection `activityLogs` real-time (`onSnapshot`, `orderBy(createdAt, desc)`, `limit(30)` — satu filter urutan saja jadi **tidak butuh composite index tambahan**), read-only karena `firestore.rules` memang mengunci `update`/`delete` (`if false`) untuk siapa pun termasuk admin. **Diakui jujur di UI**: log baru mencatat dua jenis aktivitas nyata pada fase ini — login berhasil ke portal (dicatat `login.html`) dan perubahan Pengaturan Sistem (dicatat halaman ini sendiri) — lewat fungsi baru `logActivity()` di `js/auth.js`. CRUD di halaman lain (Manajemen Website, Bank Soal, dst.) belum diinstrumentasi ke log ini; ini bukan data palsu, hanya cakupan yang belum lengkap dan dinyatakan apa adanya, bukan disembunyikan.
  - **Tab Info Teknis**: HANYA tampil untuk role **developer** (§20 spek — admin tidak melihat tab ini sama sekali, elemen tab dihapus dari DOM, bukan cuma disembunyikan CSS). Menampilkan identitas project Firebase (projectId/authDomain/storageBucket — bukan rahasia, sudah ada di bundle client manapun) dengan `apiKey` yang **disamarkan** (bukan ditampilkan penuh), versi SDK, dan info runtime browser. Tidak pernah ada service account/secret di kode client (§46 spek tetap dipatuhi).
  - Tautan ke halaman ini dari Dashboard Admin (quick access & bottom navigation) sekarang langsung tanpa `guardLinksTo()`/HEAD-check lagi — fungsi guard tersebut sekaligus dihapus dari `js/dashboard-admin.js` karena sudah tidak dipakai (§47 spek: tidak boleh dead code).
  - Tidak ada perubahan skema `firestore.rules` — aturan `settings` (`read: isSignedIn()`, `write: isManagement()`) dan `activityLogs` (`create: isSignedIn()`, `update`/`delete: if false`, `read: isManagement()`) sudah disiapkan sejak fase Authentication dan sudah cukup ketat.

## Status: SELURUH 30 HALAMAN UTAMA SPEK SUDAH DIBANGUN

Website Publik (13) + Authentication (2) + Portal Siswa (5) + Portal Guru (4) + Portal Tata Usaha (2) + Portal Admin & Developer (4) — semuanya nyata, bukan mockup, tanpa TODO. Keterbatasan yang masih ada (data contoh di halaman publik yang belum dipindah ke Firestore, log aktivitas yang belum mencakup semua aksi, dsb.) selalu dinyatakan jujur di README ini dan di UI terkait, bukan disembunyikan atau diklaim selesai. Fase lanjutan yang wajar untuk project ini: migrasi konten publik ke Firestore, upload gambar soal CBT (§28, butuh Firebase Storage), dan subpage khusus CBT (§5 spek: buat/edit ujian, pengerjaan, hasil, analisis) yang belum dibangun sebagai tampilan terpisah dari halaman utama yang sudah ada.

## Fitur Tambahan: Absensi QR Code

Di luar 30 halaman utama spek, ditambahkan fitur Absensi QR Code (3 halaman baru + 1 modul bersama):

- **`absensi-siswa.html` (Portal Siswa)** — Kartu QR absensi pribadi, dibuat 100% di client dari uid siswa yang login (library QRCode.js via CDN) — tidak ada gambar QR yang disimpan di server, jadi selalu bisa dibuat ulang kapan saja tanpa risiko kedaluwarsa. Halaman ini juga menampilkan status absensi hari ini, ringkasan Hadir/Izin/Sakit/Alpa bulan berjalan, dan riwayat absensi (30 entri terbaru) — semuanya live dari Firestore. Status hari ini juga muncul ringkas di Dashboard Siswa.
- **`absensi-scan.html` (Portal Guru)** — Guru memilih kelas (diturunkan dari kelas yang benar-benar diajarnya di collection `schedules`, sama seperti Kelas & Jadwal) dan tanggal, lalu memindai QR siswa lewat kamera (library html5-qrcode via CDN) untuk otomatis mencatat status **Hadir**. Ada cooldown per kode (4 detik) supaya satu siswa tidak tercatat berkali-kali saat kodenya masih di depan kamera, dan daftar "Baru Dipindai" live untuk kelas & tanggal terpilih.
- **`absensi-rekap.html` (Portal Guru/TU/Admin/Developer)** — Dua tab: **Harian** (roster penuh satu kelas untuk satu tanggal, status bisa diisi/dikoreksi manual lewat dropdown — dipakai untuk Izin/Sakit/Alpa yang wajar tidak lewat scan QR) dan **Bulanan** (rekap jumlah Hadir/Izin/Sakit/Alpa per siswa dalam satu bulan). Kedua tab bisa diekspor ke **Excel** (SheetJS) maupun **PDF** (jsPDF + autotable).
- **Skema Firestore**: collection baru `attendance/{id}` dengan **docId deterministik** (`classId__date__studentId`) — satu siswa hanya punya satu dokumen absensi per kelas per hari, sehingga scan/edit ulang di hari yang sama otomatis menimpa (setDoc merge) alih-alih membuat data dobel. Detail skema & alasan desain query (index mana yang butuh/tidak butuh) didokumentasikan di komentar `js/attendance-shared.js`.
- **`firestore.rules`**: collection `attendance` ditambahkan — siswa hanya bisa **membaca** riwayat absensinya sendiri (tidak pernah bisa menulis/mengubah statusnya sendiri); guru & TU boleh mencatat/mengoreksi absensi kelas mana pun (penyederhanaan yang sama seperti pola write ke `schedules` — tidak dicek kepemilikan jadwal per guru); hapus dokumen absensi dibatasi ke admin/developer saja.
- **`firestore.indexes.json`**: ditambahkan 1 composite index baru (`attendance`: classId + date) — khusus dipakai query rentang tanggal di tab Bulanan. Query lain di fitur ini (harian, riwayat siswa, daftar baru dipindai) sengaja disusun dengan pola yang sama seperti `jadwal-pelajaran.js`/`kelas-jadwal.js` supaya **tidak butuh index tambahan**.
- **Keterbatasan yang diakui jujur**: siswa yang tidak tercatat sama sekali pada suatu tanggal ditampilkan sebagai "Belum Diisi", **bukan otomatis dianggap Alpa** — status Alpa hanya tersimpan kalau memang dipilih manual oleh guru/TU di tab Harian. Rekap Bulanan juga hanya menjumlahkan dari data yang benar-benar tercatat, tidak mengasumsikan hari tanpa catatan sebagai status tertentu.

## Fitur Tambahan: Kartu Pelajar Digital

Di luar 30 halaman utama spek, ditambahkan **Kartu Pelajar Digital** (1 halaman baru) sebagai "halaman profil siswa" — kartu identitas dengan foto, nama, NIS/NISN, kelas, dan kode QR.

- **`kartu-pelajar.html` (Portal Siswa)** — Tidak ada collection Firestore baru: seluruh isi kartu dibaca dari dokumen `users/{uid}` yang sama dipakai Dashboard Siswa. Kartu profil ringkas di `dashboard-siswa.html` (`#profileCard`) sekarang jadi tautan langsung ke halaman ini, begitu juga item "Profil" di bottom navigation seluruh halaman Portal Siswa (sebelumnya mengarah ke `dashboard-siswa.html#profileCard`).
- **Field baru pada `users/{uid}` (role `siswa`), keduanya OPSIONAL**:
  - `nisn` — Nomor Induk Siswa Nasional, terpisah dari `nis` (Nomor Induk Sekolah) yang sudah ada sejak fase Authentication.
  - `photoURL` — tautan gambar (bukan upload file ke Firebase Storage, supaya sistem tetap Rp0 — keputusan sadar yang sama seperti pola tugas-siswa/tautan pengumpulan tugas di `js/tugas-shared.js`). Dipakai juga sebagai foto profil kecil di `#profileCard` Dashboard Siswa.
  - Keduanya diisi TU/Admin lewat `manajemen-pengguna.html` (field baru "NISN" & "Foto (tautan gambar, opsional)" pada form Tambah/Edit Pengguna, hanya muncul untuk role Siswa). Kalau belum diisi, kartu jujur menampilkan "Belum diatur" (NIS/NISN) atau inisial nama sebagai avatar (foto) — bukan data contoh/placeholder palsu, konsisten dengan pola empty-state di seluruh project ini.
- **Kode QR**: memakai payload **yang sama persis** (`SMAN1GEBOG-ABSEN:<uid>`, lihat `js/attendance-shared.js`) dengan kartu QR di `absensi-siswa.html` — dibuat ulang 100% di client dari uid siswa yang login (library QRCode.js via CDN), bukan gambar yang disimpan di server. Sengaja disatukan (bukan skema QR terpisah) supaya guru yang sudah bisa memindai kode absensi di `absensi-scan.html` otomatis juga bisa memverifikasi identitas siswa lewat kartu ini, tanpa logika scan baru.
- **`firestore.rules`**: tidak ada perubahan skema — `nisn` & `photoURL` hanyalah field tambahan pada dokumen `users/{uid}` yang aturannya (siswa baca dokumennya sendiri; tulis hanya oleh TU/Admin lewat Manajemen Pengguna) sudah berlaku sejak fase Authentication/Manajemen Pengguna.
- **Keterbatasan yang diakui jujur**: karena `photoURL` adalah tautan yang ditempel manual (bukan upload terverifikasi), sistem tidak bisa memastikan gambar di baliknya benar-benar foto siswa yang bersangkutan atau bahwa tautannya akan tetap bisa diakses selamanya — kalau tautan mati/gagal dimuat, kartu otomatis jatuh ke avatar inisial (`onerror`), bukan ikon gambar rusak.

## Fitur Tambahan: Tugas Online

Di luar 30 halaman utama spek, ditambahkan fitur Tugas Online (2 halaman baru + 1 modul bersama): guru membuat tugas, siswa mengumpulkan, deadline, status sudah/belum kumpul, serta nilai & feedback guru — **SELESAI**, termasuk ringkasannya di Dashboard Guru.

- **`tugas-guru.html` (Portal Guru)** — CRUD penuh tugas (judul, kelas yang benar-benar diajar guru tsb., mapel opsional, deadline, deskripsi). Tombol "Pengumpulan & Nilai" membuka panel berisi **roster lengkap** kelas (diambil dari collection `students`, bukan cuma yang sudah kumpul) sehingga status "Belum Kumpul" tetap terlihat untuk siswa yang belum mengirim apa pun. Guru memberi **nilai (0–100)** dan **feedback teks** langsung per siswa dari panel yang sama.
- **`tugas-siswa.html` (Portal Siswa)** — Daftar tugas kelas siswa, dikelompokkan Aktif/Lewat Deadline. Siswa mengumpulkan lewat **tautan** (Google Drive/OneDrive/dst.), **bukan** unggah file ke Firebase Storage — keputusan sadar supaya sistem tetap Rp0 (lihat komentar skema di `js/tugas-shared.js`). Form pengumpulan **otomatis terkunci** begitu deadline lewat (input & tombol disabled; siswa yang sudah kumpul sebelum deadline tetap bisa melihat tautannya, siswa yang belum kumpul tidak bisa kumpul lagi) — halaman merender ulang otomatis tepat saat deadline lewat. Nilai & feedback guru tampil begitu tersedia.
- **Skema Firestore**: `assignments/{id}` (tugas) dan `submissions/{docId}` (pengumpulan, docId deterministik `assignmentId__studentId` — kirim ulang/ubah menimpa via `setDoc` merge, bukan data dobel). Query di kedua halaman sengaja hanya SATU filter kesetaraan tanpa `orderBy` — **tidak butuh composite index tambahan** (urutan dihitung di client), pola yang sama seperti `attendance-shared.js`.
- **`firestore.rules`**: collection `assignments` & `submissions` ditambahkan — siswa hanya baca tugas kelasnya sendiri & baca/tulis pengumpulan miliknya sendiri; guru baca/tulis semua pengumpulan (supaya bisa menilai) tapi hanya kelola (edit/hapus) tugas buatannya sendiri; hapus pengumpulan dibatasi admin/developer.
- **Ringkasan "📚 Tugas Saya" di Dashboard Guru** (`dashboard-guru.html`, menyusul setelah halaman Tugas sendiri dibangun) — menampilkan jumlah tugas aktif dan, yang lebih penting, **jumlah pengumpulan yang belum dinilai** di seluruh tugas guru tsb. (badge "Perlu Dinilai" saat > 0), supaya guru tidak perlu membuka tugas satu-satu untuk tahu ada pekerjaan menilai yang menunggu — pasangan dari ringkasan "Reminder Tugas" yang sudah lebih dulu ada di Dashboard Siswa. Dihitung lewat query `submissions` dengan `assignmentId in [...]` dari daftar id tugas milik guru (masih satu filter kesetaraan, tidak butuh index tambahan). **Keterbatasan yang diakui jujur**: operator `in` Firestore dibatasi maksimal 30 nilai sekaligus — jika seorang guru punya lebih dari 30 tugas sepanjang masa, hanya 30 tugas pertama yang ikut dihitung di ringkasan ini (bukan bug, keterbatasan API; ringkasan lengkap per tugas tetap selalu benar di `tugas-guru.html`).
