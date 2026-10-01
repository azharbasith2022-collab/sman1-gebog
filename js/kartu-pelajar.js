// Khusus kartu-pelajar.html (Portal Siswa) — "halaman profil siswa".
//
// Menampilkan Kartu Pelajar Digital: foto, nama, NIS/NISN, kelas, dan kode
// QR siswa — semua dari dokumen profil yang SAMA dengan yang dipakai
// dashboard-siswa.html (users/{uid}), tidak ada collection/skema baru.
//
// Foto (photoURL): field OPSIONAL berisi URL gambar (bukan upload file ke
// Firebase Storage — project ini sengaja Rp0/free-tier, pola sama seperti
// keputusan "tautan, bukan upload" di js/tugas-shared.js). Kalau kosong,
// kartu jujur menampilkan inisial nama sebagai avatar, sama seperti di
// profileCard Dashboard Siswa — bukan foto generik/placeholder palsu.
//
// NISN: field OPSIONAL terpisah dari NIS (NIS = nomor induk sekolah, NISN =
// nomor induk nasional). Keduanya diisi TU/Admin dari Manajemen Pengguna;
// kalau belum diisi, ditampilkan "Belum diatur" — konsisten dengan pola
// empty-state jujur di seluruh project ini, bukan menyembunyikan baris.
//
// QR: memakai payload YANG SAMA (`SMAN1GEBOG-ABSEN:<uid>`, lihat
// js/attendance-shared.js) dengan kartu QR di absensi-siswa.html — kartu
// pelajar ini dan kartu absensi menunjuk ke satu kode QR yang sama, dibuat
// ulang di client dari uid siswa yang login (library QRCode.js via CDN),
// bukan gambar yang disimpan di server. Guru yang sudah bisa memindai kode
// absensi otomatis juga bisa memverifikasi identitas lewat kartu ini tanpa
// perlu logika scan baru.

import { requireAuth, logout } from "./auth.js";
import { makeQrPayload, escapeHtml } from "./attendance-shared.js";

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

export function initKartuPelajar() {
  requireAuth(["siswa"], (user, profile) => {
    const photoBox = document.getElementById("idCardPhoto");
    if (profile.photoURL) {
      photoBox.innerHTML = `<img src="${escapeHtml(profile.photoURL)}" alt="Foto ${escapeHtml(profile.name || "siswa")}" onerror="this.parentElement.textContent='${initials(profile.name)}';">`;
    } else {
      photoBox.textContent = initials(profile.name);
    }

    document.getElementById("idCardName").textContent = profile.name || "—";
    document.getElementById("idCardClass").textContent = profile.classLabel || profile.classId || "Kelas belum diatur";
    document.getElementById("idCardNis").textContent = profile.nis || "Belum diatur";
    document.getElementById("idCardNisn").textContent = profile.nisn || "Belum diatur";

    // ---- Kode QR (sama persis dengan absensi-siswa.html) ----
    const qrBox = document.getElementById("idCardQrBox");
    if (window.QRCode) {
      // eslint-disable-next-line no-new
      new window.QRCode(qrBox, {
        text: makeQrPayload(user.uid),
        width: 156,
        height: 156,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } else {
      qrBox.innerHTML = `<p style="font-size:12px;color:#8a2c2c;padding:16px;">Gagal memuat pembuat QR. Periksa koneksi internet lalu muat ulang halaman.</p>`;
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.href = "login.html";
    });
  });
}
