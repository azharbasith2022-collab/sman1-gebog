// Khusus absensi-scan.html (Portal Guru). Guru memilih kelas (dari kelas yang
// benar-benar diajarnya, diturunkan dari collection `schedules` — pola sama
// seperti kelas-jadwal.js) dan tanggal, lalu memindai QR kartu absensi siswa
// lewat kamera (library html5-qrcode dari CDN) untuk menandai HADIR secara
// otomatis dan real-time ke Firestore.
//
// Catatan penting soal kelas yang dipilih di halaman ini: itu HANYA dipakai
// untuk menyaring daftar "baru dipindai hari ini" di layar. Setiap absensi
// tetap disimpan di BAWAH classId ASLI milik siswa (diambil dari dokumen
// students/{uid} miliknya sendiri, bukan dari kelas yang sedang dipilih guru)
// — supaya kalau guru salah pilih kelas atau memindai siswa dari kelas lain,
// data tetap tercatat benar di riwayat/rekap kelas siswa tersebut, hanya saja
// tidak ikut muncul di daftar "baru dipindai" pada sesi ini (ditandai lewat
// peringatan toast saat itu terjadi).
//
// firestore.rules: create/update ke `attendance` dibuka untuk role guru
// secara umum (pola sama seperti write ke `schedules`) — TIDAK dibatasi per
// guru pengampu kelas tertentu, karena mengecek kepemilikan jadwal di rules
// butuh lookup lintas collection yang tidak sepadan manfaatnya untuk fase ini
// (diakui sebagai keterbatasan, sama seperti pola `schedules`).

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot, doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  attendanceDocId, parseQrPayload, todayStr, nowTimeStr, STATUS_LABEL, escapeHtml,
} from "./attendance-shared.js";

const SCAN_COOLDOWN_MS = 4000; // cegah satu kode yang sama tercatat berkali-kali dalam beberapa detik

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

export function initAbsensiScan() {
  requireAuth(["guru"], (user, profile) => {
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.href = "login.html";
    });

    const chipsEl = document.getElementById("classChips");
    const dateInput = document.getElementById("scanDate");
    const startBtn = document.getElementById("startScanBtn");
    const readerBox = document.getElementById("attQrReader");
    const readerWrap = document.getElementById("scanBoxWrap");
    const resultBox = document.getElementById("scanResult");
    const feedEl = document.getElementById("scanFeed");
    const feedCountEl = document.getElementById("feedCount");

    dateInput.value = todayStr();
    dateInput.max = todayStr(); // tidak bisa mencatat absensi untuk tanggal yang belum terjadi

    let activeClassId = null;
    let html5Qr = null;
    let scanning = false;
    const lastScanAt = new Map(); // uid -> timestamp ms, untuk cooldown

    // ---- 1) Kelas yang saya ajar (sama seperti kelas-jadwal.js) ----
    const qSchedule = query(collection(db, "schedules"), where("teacherId", "==", user.uid));
    onSnapshot(qSchedule, (snap) => {
      const seen = new Map();
      snap.forEach(d => {
        const s = d.data();
        const key = s.classId || s.classLabel;
        if (key && !seen.has(key)) seen.set(key, s.classLabel || s.classId);
      });
      if (seen.size === 0) {
        chipsEl.innerHTML = `<span style="font-size:12px;color:var(--text-soft);">Belum ada kelas yang terdaftar mengajar untuk akun Anda. Hubungi Admin/TU.</span>`;
        return;
      }
      const entries = Array.from(seen.entries());
      chipsEl.innerHTML = entries.map(([id, label], i) => `
        <button type="button" class="filter-chip${i === 0 ? " active" : ""}" data-class="${escapeHtml(id)}">${escapeHtml(label)}</button>
      `).join("");
      if (!activeClassId) activeClassId = entries[0][0];
      watchTodayFeed();

      chipsEl.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          chipsEl.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeClassId = btn.dataset.class;
          watchTodayFeed();
        });
      });
    });

    dateInput.addEventListener("change", watchTodayFeed);

    // ---- 2) Daftar "sudah dipindai" untuk kelas + tanggal terpilih (live) ----
    let unsubFeed = null;
    function watchTodayFeed() {
      if (!activeClassId) return;
      if (unsubFeed) unsubFeed();
      renderEmpty(feedEl, "📷", "Belum ada siswa yang dipindai untuk kelas & tanggal ini.");
      feedCountEl.textContent = "0 siswa";
      const qFeed = query(
        collection(db, "attendance"),
        where("classId", "==", activeClassId),
        where("date", "==", dateInput.value)
      );
      unsubFeed = onSnapshot(qFeed, (snap) => {
        const rows = snap.docs.map(d => d.data());
        rows.sort((a, b) => (b.time || "").localeCompare(a.time || ""));
        feedCountEl.textContent = `${rows.length} siswa`;
        if (rows.length === 0) {
          renderEmpty(feedEl, "📷", "Belum ada siswa yang dipindai untuk kelas & tanggal ini.");
          return;
        }
        feedEl.innerHTML = rows.map(r => `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">${r.method === "qr" ? "📷" : "✍️"}</div>
            <div class="list-row-body">
              <h4>${escapeHtml(r.studentName || "—")}</h4>
              <p>${r.nis ? `NIS ${escapeHtml(r.nis)} · ` : ""}🕒 ${escapeHtml(r.time || "—")}</p>
            </div>
            <span class="att-badge att-${r.status}">${STATUS_LABEL[r.status] || r.status}</span>
          </div>`).join("");
      });
    }

    // ---- 3) Kamera & pemindaian QR ----
    function showResult(kind, html) {
      resultBox.style.display = "flex";
      resultBox.className = `att-scan-result${kind === "error" ? "" : ""}`;
      resultBox.innerHTML = html;
    }

    async function handleDecodedText(text) {
      const studentId = parseQrPayload(text);
      if (!studentId) {
        showResult("error", `<span class="es-icon">⚠️</span><div><strong>QR tidak dikenali.</strong><br>Ini bukan kartu absensi SMA Negeri 1 Gebog.</div>`);
        return;
      }
      const last = lastScanAt.get(studentId) || 0;
      if (Date.now() - last < SCAN_COOLDOWN_MS) return; // masih dalam cooldown, abaikan diam-diam
      lastScanAt.set(studentId, Date.now());

      try {
        const studentSnap = await getDoc(doc(db, "students", studentId));
        if (!studentSnap.exists()) {
          showResult("error", `<span class="es-icon">⚠️</span><div><strong>Siswa tidak ditemukan.</strong><br>QR valid tapi data siswa tidak ada di sistem.</div>`);
          return;
        }
        const student = studentSnap.data();
        const date = dateInput.value || todayStr();
        const classIdForRecord = student.classId || activeClassId;
        const id = attendanceDocId(classIdForRecord, date, studentId);
        await setDoc(doc(db, "attendance", id), {
          studentId,
          studentName: student.name || "—",
          nis: student.nis || "",
          classId: classIdForRecord,
          date,
          status: "hadir",
          method: "qr",
          time: nowTimeStr(),
          recordedBy: user.uid,
          recordedByName: profile.name || "-",
          updatedAt: serverTimestamp(),
        }, { merge: true });

        const mismatch = activeClassId && classIdForRecord !== activeClassId;
        showResult("ok", `<span class="es-icon">✅</span><div><strong>${escapeHtml(student.name || "Siswa")}</strong> — Hadir tercatat.
          ${mismatch ? `<br><span style="color:#8a6416;">⚠️ Kelas siswa ini (${escapeHtml(classIdForRecord)}) berbeda dari kelas yang dipilih — tetap tersimpan di kelas aslinya.</span>` : ""}</div>`);
      } catch {
        showResult("error", `<span class="es-icon">⚠️</span><div><strong>Gagal menyimpan.</strong><br>Periksa koneksi internet lalu coba pindai lagi.</div>`);
      }
    }

    async function startScanning() {
      if (!window.Html5Qrcode) {
        showResult("error", `<span class="es-icon">⚠️</span><div>Gagal memuat pemindai QR. Periksa koneksi internet lalu muat ulang halaman.</div>`);
        return;
      }
      readerWrap.style.display = "block";
      html5Qr = new window.Html5Qrcode(readerBox.id);
      try {
        await html5Qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          (decodedText) => handleDecodedText(decodedText),
          () => { /* frame tanpa QR terdeteksi — diamkan, ini normal & sering terjadi */ }
        );
        scanning = true;
        startBtn.textContent = "⏹️ Hentikan Pemindaian";
      } catch {
        readerWrap.style.display = "none";
        showResult("error", `<span class="es-icon">🚫</span><div><strong>Tidak bisa mengakses kamera.</strong><br>Pastikan izin kamera diberikan ke browser ini, lalu coba lagi.</div>`);
      }
    }

    async function stopScanning() {
      if (html5Qr && scanning) {
        try { await html5Qr.stop(); html5Qr.clear(); } catch { /* kamera mungkin sudah berhenti sendiri */ }
      }
      scanning = false;
      readerWrap.style.display = "none";
      startBtn.textContent = "📷 Mulai Pindai";
    }

    startBtn.addEventListener("click", () => {
      if (scanning) stopScanning(); else startScanning();
    });

    window.addEventListener("beforeunload", () => { if (scanning) stopScanning(); });
  });
}
