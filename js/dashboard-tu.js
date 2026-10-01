// Khusus dashboard-tu.html. Ini halaman PERTAMA Portal Tata Usaha (25) —
// begitu file ini ada, login.html otomatis mengarahkan akun ber-role "tu"
// ke sini setelah login berhasil (lihat ROLE_DASHBOARD di auth.js, sudah
// disiapkan sejak fase Authentication, tidak perlu diubah).
//
// Semua data di bawah ini diambil LANGSUNG dari Firestore (bukan data
// contoh) — jika koleksi masih kosong, setiap bagian menampilkan empty
// state yang jujur, bukan angka/isi palsu (§49 spek).
//
// Skema yang dipakai di halaman ini:
//   users/{uid}        : { role:"tu", name, nip }
//   students/{uid}      : dihitung (getCountFromServer) untuk Ringkasan —
//                          TU punya akses baca penuh (lihat firestore.rules:
//                          isStaff() mencakup role tu).
//   teachers/{id}, staff/{id}, classes/{id} : sama, dihitung untuk Ringkasan.
//   announcements/{id} : { title, published, urgent, createdAt (Timestamp) }
//                          — hanya yang published==true yang ditampilkan;
//                          draft/unpublished baru bisa dikelola TU setelah
//                          halaman Manajemen Informasi & Administrasi (26)
//                          dibangun & firestore.rules diperluas untuk itu.
//   events/{id}         : { title, category, date (Timestamp), location,
//                          description, createdAt } — SKEMA BARU yang
//                          didefinisikan di halaman ini (sebelumnya agenda
//                          publik (agenda.html) masih memakai data contoh
//                          statis di agenda-data.js). Migrasi agenda.html
//                          ke Firestore sungguhan menyusul di fase Admin —
//                          Manajemen Website (28), begitu Admin punya form
//                          CRUD untuk mengisi collection ini.
//
// Query events HANYA satu filter kesetaraan-rentang (date >= sekarang)
// dengan orderBy pada field yang sama (date) — ini valid tanpa composite
// index karena hanya melibatkan satu field.

import { requireAuth, logout, ROLE_LABEL } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getCountFromServer,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function fmtDate(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time} WIB`;
}

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

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

/** Cek apakah sebuah halaman Portal TU lain sudah benar-benar ada sebelum
 * mengarahkan pengguna ke sana — mencegah tautan yang terlihat aktif tapi
 * sebenarnya menuju 404 (halaman 26, Manajemen Informasi & Administrasi,
 * menyusul). Pola sama persis dengan dashboard-guru.js. */
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

export function initDashboardTu() {
  requireAuth(["tu"], (user, profile) => {
    // ---- Greeting & profil singkat ----
    const firstName = (profile.name || "Tata Usaha").split(" ")[0];
    document.getElementById("greetingName").textContent = `Halo, ${firstName}! 👋`;
    document.getElementById("greetingSub").textContent =
      new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    document.getElementById("profileAvatar").textContent = initials(profile.name);
    document.getElementById("profileName").textContent = profile.name || "—";
    document.getElementById("profileMetaNip").textContent = profile.nip ? `NIP ${profile.nip}` : "NIP belum diatur";
    document.getElementById("roleBadge").textContent = ROLE_LABEL[profile.role] || profile.role;

    // ---- Ringkasan sekolah (angka sebenarnya dari Firestore, §24/§49) ----
    const summaryEl = document.getElementById("summaryList");
    renderSkeleton(summaryEl, 1);
    Promise.allSettled([
      getCountFromServer(collection(db, "students")),
      getCountFromServer(collection(db, "teachers")),
      getCountFromServer(collection(db, "staff")),
      getCountFromServer(collection(db, "classes")),
    ]).then(([students, teachers, staff, classes]) => {
      const val = r => (r.status === "fulfilled" ? r.value.data().count : null);
      const rows = [
        { icon: "🎓", label: "Siswa", count: val(students) },
        { icon: "🧑‍🏫", label: "Guru", count: val(teachers) },
        { icon: "🧑‍💼", label: "Staff", count: val(staff) },
        { icon: "🏫", label: "Kelas", count: val(classes) },
      ];
      summaryEl.innerHTML = rows.map(r => `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${r.icon}</div>
          <div class="list-row-body"><h4>${r.label}</h4></div>
          <span class="list-row-score">${r.count === null ? "—" : r.count}</span>
        </div>`).join("");
    });

    // ---- Pengumuman terbaru (published saja, sama seperti Portal Guru/Siswa) ----
    const annEl = document.getElementById("announcementList");
    renderSkeleton(annEl);
    const qAnn = query(
      collection(db, "announcements"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    onSnapshot(qAnn, (snap) => {
      if (snap.empty) {
        renderEmpty(annEl, "📣", "Belum ada pengumuman yang dipublikasikan.");
        return;
      }
      annEl.innerHTML = snap.docs.map(d => {
        const a = d.data();
        return `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${a.urgent ? "📌" : "📄"}</div>
          <div class="list-row-body">
            <h4>${a.title || "—"}</h4>
            <p>${fmtDate(a.createdAt)}</p>
          </div>
        </div>`;
      }).join("");
    }, () => renderEmpty(annEl, "⚠️", "Gagal memuat pengumuman. Periksa koneksi lalu muat ulang."));

    // ---- Agenda terdekat (events, hanya yang belum lewat) ----
    const agendaEl = document.getElementById("agendaList");
    renderSkeleton(agendaEl);
    const qAgenda = query(
      collection(db, "events"),
      where("date", ">=", Timestamp.now()),
      orderBy("date", "asc"),
      limit(5)
    );
    onSnapshot(qAgenda, (snap) => {
      if (snap.empty) {
        renderEmpty(agendaEl, "📅", "Belum ada agenda mendatang yang terjadwal.");
        return;
      }
      agendaEl.innerHTML = snap.docs.map(d => {
        const e = d.data();
        return `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">📅</div>
          <div class="list-row-body">
            <h4>${e.title || "—"}</h4>
            <p>🕒 ${fmtDateTime(e.date)}${e.location ? ` · 📍 ${e.location}` : ""}</p>
          </div>
        </div>`;
      }).join("");
    }, () => renderEmpty(agendaEl, "⚠️", "Gagal memuat agenda. Periksa koneksi lalu muat ulang."));

    // ---- Informasi & administrasi (ringkasan, dikelola penuh di halaman 26) ----
    renderEmpty(
      document.getElementById("adminSummary"),
      "🗄️",
      "Pengelolaan dokumen & informasi administrasi tersedia di halaman Informasi & Administrasi."
    );

    // ---- Guard tautan ke halaman Portal TU yang belum dibangun ----
    guardLinksTo("manajemen-informasi-administrasi.html", "Halaman Informasi & Administrasi sedang dibangun pada fase Portal Tata Usaha berikutnya.");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
