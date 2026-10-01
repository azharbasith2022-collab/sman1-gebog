// Khusus jadwal-pelajaran.html. Mengambil SELURUH jadwal pelajaran satu
// minggu untuk kelas siswa yang login, langsung dari Firestore (bukan data
// contoh) — dikelompokkan per hari dan diurutkan berdasarkan jam.
//
// Sengaja hanya memakai SATU filter kesetaraan (classId) tanpa orderBy di
// query itu sendiri, supaya tidak membutuhkan composite index tambahan —
// pengelompokan per hari (urutan Senin→Minggu) dan pengurutan jam dilakukan
// di sisi client setelah data diterima.
//
// Skema: schedules/{id} : { classId, day, time, subject, teacher, room }
//   day  : salah satu dari "Senin".."Minggu"
//   time : string jam mulai, format "HH:MM" (mis. "07:30"), agar bisa
//          diurutkan leksikografis dengan aman.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import { collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const DAY_NAMES_BY_JS_INDEX = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function renderEmptyPage(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

function renderSkeletonPage(el, rows = 4) {
  el.innerHTML = Array.from({ length: rows }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:75%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:45%;height:10px;"></div>
      </div>
    </div>`).join("");
}

export function initJadwalPelajaran() {
  requireAuth(["siswa"], (user, profile) => {
    document.getElementById("classLabel").textContent = profile.classLabel || profile.classId || "Kelas belum diatur";

    const wrapEl = document.getElementById("jadwalWrap");
    const classId = profile.classId || null;
    const todayName = DAY_NAMES_BY_JS_INDEX[new Date().getDay()];

    if (!classId) {
      renderEmptyPage(wrapEl, "📅", "Kelas Anda belum diatur oleh Tata Usaha/Admin, jadwal belum bisa ditampilkan. Hubungi Tata Usaha sekolah.");
    } else {
      renderSkeletonPage(wrapEl);
      const qSchedule = query(collection(db, "schedules"), where("classId", "==", classId));
      onSnapshot(qSchedule, (snap) => {
        if (snap.empty) {
          renderEmptyPage(wrapEl, "📅", "Belum ada jadwal pelajaran untuk kelas Anda. Hubungi Tata Usaha/Admin.");
          return;
        }

        const byDay = Object.fromEntries(DAY_ORDER.map(d => [d, []]));
        snap.docs.forEach(d => {
          const s = d.data();
          if (byDay[s.day]) byDay[s.day].push(s);
        });
        Object.values(byDay).forEach(list => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));

        wrapEl.innerHTML = DAY_ORDER.map(day => {
          const items = byDay[day];
          const isToday = day === todayName;
          const rows = items.length
            ? items.map(s => `
              <div class="list-row">
                <div class="list-row-icon" aria-hidden="true">📘</div>
                <div class="list-row-body">
                  <h4>${s.subject || "—"}</h4>
                  <p>🕒 ${s.time || "—"} · 👤 ${s.teacher || "—"} · 🚪 ${s.room || "—"}</p>
                </div>
              </div>`).join("")
            : `<div class="empty-state" style="padding:14px 0;"><div class="es-icon">🌿</div>Tidak ada pelajaran.</div>`;

          return `
          <section class="dash-section">
            <div class="dash-section-head">
              <h2>${day} ${isToday ? '<span class="list-row-tag active">Hari ini</span>' : ""}</h2>
            </div>
            <div class="card-surface" style="padding:4px 14px;">${rows}</div>
          </section>`;
        }).join("");
      }, () => renderEmptyPage(wrapEl, "⚠️", "Gagal memuat jadwal. Periksa koneksi lalu muat ulang."));
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
