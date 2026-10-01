// Khusus dashboard-admin.html. Halaman PERTAMA Portal Admin & Developer
// (27) — dipakai bersama oleh kedua role (lihat ROLE_DASHBOARD di auth.js:
// admin dan developer sama-sama diarahkan ke sini). Perbedaan kewenangan
// yang sesungguhnya (mis. akses teknis developer) akan dibedakan lewat
// firestore.rules & UI di halaman 28–30, bukan di dashboard ini — dashboard
// murni menampilkan ringkasan, sama untuk keduanya.
//
// Semua angka di halaman ini BENAR-BENAR dihitung dari Firestore
// (getCountFromServer / onSnapshot), TIDAK ADA angka dummy (§24 & §49
// spek). Jika sebuah collection masih kosong, angkanya tampil 0 — itu
// kondisi sebenarnya sistem yang baru diisi, bukan bug.
//
// Delapan angka yang diminta §24 spek, dan sumber datanya:
//   jumlah siswa   -> collection `students`
//   jumlah guru    -> collection `teachers`
//   jumlah TU      -> collection `staff` (staf administrasi non-guru)
//   jumlah berita  -> collection `news`
//   jumlah pengumuman -> collection `announcements`
//   jumlah agenda  -> collection `events`
//   jumlah ujian   -> collection `exams`
//   statistik CBT  -> collection `results` (peserta & rata-rata nilai
//                     dihitung di client dari SELURUH dokumen — untuk
//                     skala satu sekolah ini masih wajar; jika di masa
//                     depan volume data membesar, agregasi sebaiknya
//                     dipindah ke Cloud Function/nilai teragregasi
//                     tersimpan, bukan dihitung ulang di client setiap saat)

import { requireAuth, logout, ROLE_LABEL } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection,
  onSnapshot,
  getCountFromServer,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function renderSkeleton(el, rows = 2) {
  el.innerHTML = Array.from({ length: rows }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:40%;height:10px;"></div>
      </div>
    </div>`).join("");
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

export function initDashboardAdmin() {
  requireAuth(["admin", "developer"], (user, profile) => {
    document.getElementById("portalTag").textContent = `Portal ${ROLE_LABEL[profile.role] || profile.role}`;

    // ---- Greeting & profil singkat ----
    const firstName = (profile.name || ROLE_LABEL[profile.role] || "Admin").split(" ")[0];
    document.getElementById("greetingName").textContent = `Halo, ${firstName}! 👋`;
    document.getElementById("greetingSub").textContent =
      new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    document.getElementById("profileAvatar").textContent = initials(profile.name);
    document.getElementById("profileName").textContent = profile.name || "—";
    document.getElementById("profileMetaRole").textContent = ROLE_LABEL[profile.role] || profile.role;
    document.getElementById("roleBadge").textContent = ROLE_LABEL[profile.role] || profile.role;

    // ---- Statistik sekolah (7 angka pertama §24, dihitung server-side) ----
    const statsEl = document.getElementById("statsList");
    renderSkeleton(statsEl, 3);
    const statDefs = [
      { key: "students", icon: "🎓", label: "Siswa" },
      { key: "teachers", icon: "🧑‍🏫", label: "Guru" },
      { key: "staff", icon: "🧑‍💼", label: "TU (Staf)" },
      { key: "news", icon: "📰", label: "Berita" },
      { key: "announcements", icon: "📣", label: "Pengumuman" },
      { key: "events", icon: "📅", label: "Agenda" },
      { key: "exams", icon: "📝", label: "Ujian CBT" },
    ];
    Promise.allSettled(statDefs.map(s => getCountFromServer(collection(db, s.key))))
      .then(results => {
        statsEl.innerHTML = statDefs.map((s, i) => {
          const r = results[i];
          const count = r.status === "fulfilled" ? r.value.data().count : null;
          return `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">${s.icon}</div>
            <div class="list-row-body"><h4>${s.label}</h4></div>
            <span class="list-row-score">${count === null ? "—" : count}</span>
          </div>`;
        }).join("");
      });

    // ---- Statistik CBT (angka ke-8 §24: peserta & rata-rata nilai) ----
    const cbtEl = document.getElementById("cbtStatsList");
    renderSkeleton(cbtEl, 2);
    onSnapshot(collection(db, "results"), (snap) => {
      if (snap.empty) {
        cbtEl.innerHTML = `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">📊</div>
            <div class="list-row-body"><h4>Belum ada siswa yang mengerjakan CBT</h4><p>Statistik akan muncul begitu ada hasil ujian tersimpan.</p></div>
          </div>`;
        return;
      }
      const scores = snap.docs.map(d => d.data().score || 0);
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      const rows = [
        { icon: "👥", label: "Total pengerjaan tersimpan", value: snap.size },
        { icon: "📈", label: "Rata-rata nilai keseluruhan", value: avg },
        { icon: "🏆", label: "Nilai tertinggi", value: max },
        { icon: "📉", label: "Nilai terendah", value: min },
      ];
      cbtEl.innerHTML = rows.map(r => `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${r.icon}</div>
          <div class="list-row-body"><h4>${r.label}</h4></div>
          <span class="list-row-score">${r.value}</span>
        </div>`).join("");
    }, () => {
      cbtEl.innerHTML = "";
      cbtEl.parentElement.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div>Gagal memuat statistik CBT. Periksa koneksi lalu muat ulang.</div>`;
    });

    // Manajemen Website, Manajemen Pengguna, dan Pengaturan Sistem (30) kini
    // sudah dibangun semua — tautan langsung ke halaman masing-masing, tidak
    // ditahan guardLinksTo()/HEAD-check lagi (pola sama seperti Kelas & Jadwal
    // di Dashboard Guru setelah halamannya selesai).

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
