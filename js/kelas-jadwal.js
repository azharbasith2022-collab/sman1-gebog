// Khusus kelas-jadwal.html (Portal Guru, halaman 22). Menampilkan SELURUH
// jam mengajar guru yang login untuk satu minggu penuh, langsung dari
// Firestore (bukan data contoh) — dikelompokkan per hari, dengan filter
// per kelas di atasnya.
//
// Sama seperti jadwal-pelajaran.js (Portal Siswa): sengaja hanya memakai
// SATU filter kesetaraan (teacherId) tanpa orderBy di query itu sendiri,
// supaya tidak butuh composite index tambahan — pengelompokan per hari
// (urutan Senin→Minggu), pengurutan jam, daftar kelas unik, dan filter
// kelas terpilih semuanya dilakukan di sisi client dari data yang sama.
//
// Skema: schedules/{id} : { classId, classLabel, day, time, subject,
//                            teacher, teacherId, room }
// Dokumen yang belum punya field `teacherId` (dibuat sebelum fase Dashboard
// Guru) tidak akan muncul di halaman ini sampai dilengkapi Admin/TU.

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

/** Cek apakah sebuah halaman Portal Guru lain sudah benar-benar ada sebelum
 * mengarahkan guru ke sana (pola sama seperti dashboard-guru.js). */
async function pageExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

let toastTimer = null;
function showComingSoonToast(text) {
  let toast = document.getElementById("comingSoonToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "comingSoonToast";
    toast.className = "auth-alert success";
    toast.style.position = "fixed";
    toast.style.left = "16px";
    toast.style.right = "16px";
    toast.style.bottom = "84px";
    toast.style.zIndex = "50";
    toast.innerHTML = `<span aria-hidden="true">🚧</span><span></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector("span:last-child").textContent = text;
  toast.style.display = "flex";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.style.display = "none"; }, 4000);
}

function guardLinksTo(url, comingSoonText) {
  document.querySelectorAll(`a[href="${url}"]`).forEach(link => {
    link.addEventListener("click", async (ev) => {
      ev.preventDefault();
      if (await pageExists(url)) {
        location.href = url;
      } else {
        showComingSoonToast(comingSoonText);
      }
    });
  });
}

export function initKelasJadwal() {
  requireAuth(["guru"], (user) => {
    const chipsEl = document.getElementById("classChips");
    const wrapEl = document.getElementById("jadwalWrap");
    const countLabel = document.getElementById("classCountLabel");
    const todayName = DAY_NAMES_BY_JS_INDEX[new Date().getDay()];

    renderSkeletonPage(wrapEl);
    chipsEl.innerHTML = "";

    let allSchedules = [];
    let activeClassId = "all";

    function renderChips() {
      const seen = new Map();
      allSchedules.forEach(s => {
        const key = s.classId || s.classLabel;
        if (key && !seen.has(key)) seen.set(key, s.classLabel || s.classId);
      });
      countLabel.textContent = seen.size ? `${seen.size} kelas` : "Belum ada kelas";

      const chips = [{ id: "all", label: "Semua Kelas" }, ...[...seen.entries()].map(([id, label]) => ({ id, label }))];
      chipsEl.innerHTML = chips.map(c => `
        <button type="button" class="filter-chip ${c.id === activeClassId ? "active" : ""}" data-class="${c.id}">${c.label}</button>
      `).join("");
      chipsEl.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          activeClassId = btn.dataset.class;
          renderChips();
          renderSchedule();
        });
      });
    }

    function renderSchedule() {
      const filtered = activeClassId === "all"
        ? allSchedules
        : allSchedules.filter(s => (s.classId || s.classLabel) === activeClassId);

      if (!filtered.length) {
        renderEmptyPage(wrapEl, "📅",
          allSchedules.length
            ? "Tidak ada jam mengajar untuk kelas ini."
            : "Anda belum memiliki jadwal mengajar. Hubungi Tata Usaha/Admin.");
        return;
      }

      const byDay = Object.fromEntries(DAY_ORDER.map(d => [d, []]));
      filtered.forEach(s => { if (byDay[s.day]) byDay[s.day].push(s); });
      Object.values(byDay).forEach(list => list.sort((a, b) => (a.time || "").localeCompare(b.time || "")));

      wrapEl.innerHTML = DAY_ORDER.map(day => {
        const items = byDay[day];
        const isToday = day === todayName;
        const rows = items.length
          ? items.map(s => `
            <div class="list-row">
              <div class="list-row-icon" aria-hidden="true">📘</div>
              <div class="list-row-body">
                <h4>${s.subject || "—"} — ${s.classLabel || s.classId || "—"}</h4>
                <p>🕒 ${s.time || "—"} · 🚪 ${s.room || "—"}</p>
              </div>
            </div>`).join("")
          : `<div class="empty-state" style="padding:14px 0;"><div class="es-icon">🌿</div>Tidak ada jam mengajar.</div>`;

        return `
        <section class="dash-section">
          <div class="dash-section-head">
            <h2>${day} ${isToday ? '<span class="list-row-tag active">Hari ini</span>' : ""}</h2>
          </div>
          <div class="card-surface" style="padding:4px 14px;">${rows}</div>
        </section>`;
      }).join("");
    }

    const qMySchedules = query(collection(db, "schedules"), where("teacherId", "==", user.uid));
    onSnapshot(qMySchedules, (snap) => {
      allSchedules = snap.docs.map(d => d.data());
      renderChips();
      renderSchedule();
    }, () => {
      countLabel.textContent = "Gagal memuat";
      renderEmptyPage(wrapEl, "⚠️", "Gagal memuat jadwal. Periksa koneksi lalu muat ulang.");
    });

    guardLinksTo("manajemen-cbt-hasil.html", "Halaman Manajemen CBT & Hasil sedang dibangun pada fase Portal Guru berikutnya.");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
