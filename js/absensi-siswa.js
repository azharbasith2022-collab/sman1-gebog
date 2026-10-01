// Khusus absensi-siswa.html (Portal Siswa). Dua bagian dalam satu halaman:
// 1) Kartu QR absensi milik siswa yang login sendiri (dibuat di CLIENT dari
//    uid-nya sendiri via library QRCode.js — tidak ada gambar QR yang
//    disimpan di server, jadi selalu bisa dibuat ulang kapan saja).
// 2) Riwayat + ringkasan absensi miliknya sendiri, live dari Firestore.
//
// Isi QR: `SMAN1GEBOG-ABSEN:<uid>` (lihat js/attendance-shared.js). uid saja
// BUKAN rahasia (guru butuh bisa membacanya untuk absen) — yang tetap
// terjaga di firestore.rules adalah siswa lain/guru TIDAK bisa menulis atas
// nama siswa ini kecuali guru (§ kontrol akses attendance), dan siswa hanya
// bisa MEMBACA riwayat absensinya sendiri, tidak bisa mengubah statusnya
// sendiri.
//
// Query riwayat: attendance where studentId==uid SAJA (tanpa orderBy),
// diurutkan "tanggal terbaru dulu" di client — tidak butuh composite index,
// sama seperti pola hasil-cbt.js/jadwal-pelajaran.js di project ini.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { STATUS_LABEL, STATUS_ICON, todayStr, makeQrPayload, escapeHtml } from "./attendance-shared.js";

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

function renderSkeleton(el, rows = 3) {
  el.innerHTML = Array.from({ length: rows }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:40%;height:10px;"></div>
      </div>
    </div>`).join("");
}

function fmtDateLabel(dateStr) {
  // dateStr: "YYYY-MM-DD" → "Senin, 15 Sep 2026"
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
}

export function initAbsensiSiswa() {
  requireAuth(["siswa"], (user, profile) => {
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.href = "login.html";
    });

    document.getElementById("qrName").textContent = profile.name || "—";
    document.getElementById("qrMeta").textContent =
      [profile.classLabel || profile.classId || "Kelas belum diatur", profile.nis].filter(Boolean).join(" · ");

    // ---- 1) Render QR code di client (library QRCode.js dari CDN) ----
    const qrBox = document.getElementById("qrBox");
    if (window.QRCode) {
      // eslint-disable-next-line no-new
      new window.QRCode(qrBox, {
        text: makeQrPayload(user.uid),
        width: 190,
        height: 190,
        correctLevel: window.QRCode.CorrectLevel.M,
      });
    } else {
      qrBox.innerHTML = `<p style="font-size:12px;color:#8a2c2c;padding:20px;">Gagal memuat pembuat QR. Periksa koneksi internet lalu muat ulang halaman.</p>`;
    }

    // ---- 2) Riwayat & ringkasan absensi milik sendiri ----
    const todayBox = document.getElementById("todayStatusBox");
    const summaryEl = document.getElementById("attSummary");
    const historyEl = document.getElementById("attHistory");
    renderSkeleton(historyEl);

    const today = todayStr();
    const qAtt = query(collection(db, "attendance"), where("studentId", "==", user.uid));

    onSnapshot(qAtt, (snap) => {
      const records = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      records.sort((a, b) => (b.date || "").localeCompare(a.date || ""));

      // Status hari ini
      const todayRecord = records.find(r => r.date === today);
      if (todayRecord) {
        todayBox.innerHTML = `${STATUS_ICON[todayRecord.status] || "📍"} Hari ini: <strong>${STATUS_LABEL[todayRecord.status] || todayRecord.status}</strong>`;
      } else {
        todayBox.textContent = "📍 Belum ada catatan absensi untuk hari ini.";
      }

      // Ringkasan bulan berjalan (dihitung di client dari data yang sama —
      // tidak query terpisah ke server)
      const monthPrefix = today.slice(0, 7); // "YYYY-MM"
      const monthRecords = records.filter(r => (r.date || "").startsWith(monthPrefix));
      const counts = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      monthRecords.forEach(r => { if (counts[r.status] !== undefined) counts[r.status]++; });
      summaryEl.innerHTML = ["hadir", "izin", "sakit", "alpa"].map(s => `
        <div class="att-summary-item">
          <strong>${counts[s]}</strong>
          <span>${STATUS_LABEL[s]}</span>
        </div>`).join("");

      // Riwayat (maks 30 terbaru, cukup untuk kebutuhan siswa melihat riwayat)
      if (records.length === 0) {
        renderEmpty(historyEl, "🗓️", "Belum ada riwayat absensi.");
        return;
      }
      historyEl.innerHTML = records.slice(0, 30).map(r => `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${STATUS_ICON[r.status] || "📍"}</div>
          <div class="list-row-body">
            <h4>${escapeHtml(fmtDateLabel(r.date))}</h4>
            <p>${r.time ? `🕒 ${escapeHtml(r.time)} · ` : ""}${r.method === "qr" ? "Scan QR" : "Dicatat manual"}${r.recordedByName ? ` oleh ${escapeHtml(r.recordedByName)}` : ""}</p>
          </div>
          <span class="att-badge att-${r.status}">${STATUS_LABEL[r.status] || r.status}</span>
        </div>`).join("");
    }, () => {
      renderEmpty(historyEl, "⚠️", "Gagal memuat riwayat absensi. Periksa koneksi lalu muat ulang halaman.");
    });
  });
}
