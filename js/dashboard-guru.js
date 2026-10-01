// Khusus dashboard-guru.html. Ini halaman PERTAMA Portal Guru — begitu file
// ini ada, login.html otomatis mengarahkan guru ke sini setelah login
// berhasil (tidak perlu ubah kode login, lihat ROLE_DASHBOARD di auth.js).
//
// Semua data di bawah ini diambil LANGSUNG dari Firestore (bukan data
// contoh) — jika koleksi masih kosong/field belum diisi Admin, setiap bagian
// menampilkan empty state yang jujur, bukan angka/isi palsu.
//
// Skema Firestore (perluasan dari skema Portal Siswa, lihat juga firestore.rules):
//   users/{uid}    : { role:"guru", name, nip, subject }
//   schedules/{id} : { classId, classLabel, day, time, subject, teacher,
//                        teacherId, room }
//                     teacherId BARU ditambah di fase ini supaya jadwal
//                     seorang guru bisa difilter langsung dari sisi
//                     Firestore (query where teacherId==uid), bukan
//                     disaring dari seluruh koleksi di sisi client.
//                     Dokumen lama tanpa teacherId (dibuat sebelum fase ini)
//                     tidak akan muncul di dashboard guru manapun sampai
//                     Admin/TU melengkapi field ini lewat Manajemen Website —
//                     bukan bug, hanya data yang belum lengkap.
//   exams/{id}     : { title, subject, classId, classLabel, teacherId,
//                        durationMinutes, startTime (Timestamp),
//                        endTime (Timestamp) } — TIDAK berisi kunci jawaban,
//                     tetap di collection `questions`.
//   questions/{id} : { examId, createdBy (uid guru pembuat), ... }
//   announcements/{id} : { title, published, urgent, createdAt (Timestamp) }
//
// Halaman tujuan quick access manajemen-cbt-hasil.html BELUM dibangun pada
// fase ini (menyusul: 24) — kelas-jadwal.html (22) dan bank-soal.html (23)
// sudah dibangun. Supaya tidak ada tautan yang terlihat aktif tapi
// sebenarnya menuju 404, tautan ke halaman yang belum ada dicek dulu
// keberadaannya (HEAD request) — persis pola yang sama seperti login.html &
// daftar-cbt.html.

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
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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

/** Cek apakah sebuah halaman Portal Guru lain sudah benar-benar ada sebelum
 * mengarahkan guru ke sana — mencegah tautan yang terlihat aktif tapi
 * sebenarnya menuju 404 (fase Portal Guru masih berjalan: 22–24 menyusul). */
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

/** Pasang guard HEAD-check ke semua tautan yang menuju `url` di halaman ini
 * (quick access + section header + bottom nav sama-sama memakai href yang
 * sama), supaya perilakunya konsisten di mana pun tautan itu diklik. */
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

export function initDashboardGuru() {
  requireAuth(["guru"], (user, profile) => {
    // ---- Greeting & profil singkat ----
    const firstName = (profile.name || "Guru").split(" ")[0];
    document.getElementById("greetingName").textContent = `Halo, ${firstName}! 👋`;
    document.getElementById("greetingSub").textContent =
      new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    document.getElementById("profileAvatar").textContent = initials(profile.name);
    document.getElementById("profileName").textContent = profile.name || "—";
    document.getElementById("profileMetaSubject").textContent = profile.subject || "Mapel belum diatur";
    document.getElementById("profileMetaNip").textContent = profile.nip ? `NIP ${profile.nip}` : "NIP belum diatur";
    document.getElementById("roleBadge").textContent = ROLE_LABEL[profile.role] || profile.role;

    const todayName = DAY_NAMES[new Date().getDay()];

    // ---- Kelas yang diajar (diturunkan dari jadwal, tanpa collection baru) ----
    const classEl = document.getElementById("classList");
    renderSkeleton(classEl, 1);
    const qMyClasses = query(collection(db, "schedules"), where("teacherId", "==", user.uid));
    let latestSchedules = [];
    onSnapshot(qMyClasses, (snap) => {
      latestSchedules = snap.docs.map(d => d.data());
      if (!latestSchedules.length) {
        renderEmpty(classEl, "📘", "Anda belum ditugaskan ke kelas mana pun. Hubungi Tata Usaha/Admin.");
      } else {
        const seen = new Map();
        latestSchedules.forEach(s => {
          const key = s.classId || s.classLabel;
          if (key && !seen.has(key)) seen.set(key, s.classLabel || s.classId);
        });
        classEl.innerHTML = [...seen.values()].map(label => `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">🏫</div>
            <div class="list-row-body"><h4>${label}</h4></div>
          </div>`).join("");
      }
      renderTodaySchedule();
    }, () => { renderEmpty(classEl, "⚠️", "Gagal memuat kelas. Periksa koneksi lalu muat ulang."); renderTodaySchedule(); });

    // ---- Jadwal mengajar hari ini (disaring dari data yang sama) ----
    const scheduleEl = document.getElementById("scheduleList");
    renderSkeleton(scheduleEl);
    function renderTodaySchedule() {
      const today = latestSchedules
        .filter(s => s.day === todayName)
        .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
      if (!today.length) {
        renderEmpty(scheduleEl, "🕒", `Tidak ada jadwal mengajar untuk hari ${todayName}.`);
        return;
      }
      scheduleEl.innerHTML = today.map(s => `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">📘</div>
          <div class="list-row-body">
            <h4>${s.subject || "—"} — ${s.classLabel || s.classId || "—"}</h4>
            <p>🕒 ${s.time || "—"} · 🚪 ${s.room || "—"}</p>
          </div>
        </div>`).join("");
    }

    // ---- Ujian CBT saya ----
    const examEl = document.getElementById("examList");
    renderSkeleton(examEl);
    const qMyExams = query(
      collection(db, "exams"),
      where("teacherId", "==", user.uid),
      orderBy("startTime", "asc"),
      limit(5)
    );
    onSnapshot(qMyExams, (snap) => {
      if (snap.empty) {
        renderEmpty(examEl, "📝", "Anda belum membuat ujian CBT.");
        return;
      }
      const now = Date.now();
      examEl.innerHTML = snap.docs.map(d => {
        const e = d.data();
        const start = e.startTime?.toDate?.().getTime();
        const end = e.endTime?.toDate?.().getTime();
        let status = "Terjadwal";
        if (end && end <= now) status = "Selesai";
        else if (start && start <= now) status = "Berlangsung";
        return `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">📝</div>
          <div class="list-row-body">
            <h4>${e.title || "Ujian"} — ${e.classLabel || e.classId || ""}</h4>
            <p>🕒 ${fmtDateTime(e.startTime)} · ⏱️ ${e.durationMinutes || "—"} menit</p>
          </div>
          <span class="list-row-tag ${status === "Berlangsung" ? "active" : ""}">${status}</span>
        </div>`;
      }).join("");
    }, () => renderEmpty(examEl, "⚠️", "Gagal memuat ujian. Periksa koneksi lalu muat ulang."));

    // ---- Bank soal saya (ringkasan jumlah, dikelola penuh di bank-soal.html) ----
    const bankEl = document.getElementById("bankSummary");
    renderSkeleton(bankEl, 1);
    getCountFromServer(query(collection(db, "questions"), where("createdBy", "==", user.uid)))
      .then(snap => {
        const total = snap.data().count;
        if (!total) {
          renderEmpty(bankEl, "🗂️", "Anda belum menambahkan soal ke Bank Soal.");
        } else {
          bankEl.innerHTML = `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">🗂️</div>
            <div class="list-row-body">
              <h4>${total} soal tersimpan</h4>
              <p>Dikelola penuh di halaman Bank Soal</p>
            </div>
          </div>`;
        }
      })
      .catch(() => renderEmpty(bankEl, "⚠️", "Gagal memuat ringkasan bank soal."));

    // ---- Tugas saya (ringkasan: tugas aktif + pengumuman belum dinilai) ----
    // Dikelola penuh di tugas-guru.html — di sini hanya ringkasan supaya guru
    // langsung tahu ada pekerjaan menilai yang menunggu tanpa buka satu-satu.
    const tugasEl = document.getElementById("tugasSummary");
    renderSkeleton(tugasEl, 1);

    let myAssignments      = [];
    let ungradedCount      = null; // null = belum selesai dihitung
    let ungradedUnsub      = null;

    function renderTugasSummary() {
      if (!myAssignments.length) {
        renderEmpty(tugasEl, "📚", "Anda belum membuat tugas.");
        return;
      }
      const now = Date.now();
      const activeCount = myAssignments.filter(a => {
        const ms = a.deadline?.toDate?.().getTime();
        return !ms || ms > now;
      }).length;

      const rows = [`
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">📚</div>
          <div class="list-row-body">
            <h4>${activeCount} tugas aktif</h4>
            <p>${myAssignments.length} total tugas dibuat</p>
          </div>
        </div>`];

      if (ungradedCount === null) {
        rows.push(`
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">⭐</div>
          <div class="list-row-body"><h4>Memuat pengumpulan…</h4><p>—</p></div>
        </div>`);
      } else if (ungradedCount > 0) {
        rows.push(`
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">⭐</div>
          <div class="list-row-body">
            <h4>${ungradedCount} pengumpulan belum dinilai</h4>
            <p>Buka "Pengumpulan & Nilai" pada tugas terkait</p>
          </div>
          <span class="qb-badge diff-sedang" style="flex-shrink:0;">Perlu Dinilai</span>
        </div>`);
      } else {
        rows.push(`
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">✅</div>
          <div class="list-row-body"><h4>Semua pengumpulan sudah dinilai</h4><p>—</p></div>
        </div>`);
      }
      tugasEl.innerHTML = rows.join("");
    }

    // Dihitung lewat query `assignmentId in [...]` dari id tugas milik guru —
    // satu filter kesetaraan saja, TIDAK butuh composite index tambahan
    // (pola sama seperti query lain di file ini). Operator `in` Firestore
    // dibatasi maks 30 nilai: jika guru punya lebih dari 30 tugas sepanjang
    // masa, hanya 30 pertama yang ikut dihitung di sini — bukan bug, hanya
    // keterbatasan API yang diakui, dan realistis cukup untuk penggunaan
    // sehari-hari (ringkasan lengkap per tugas tetap ada di tugas-guru.html).
    function watchUngraded() {
      if (ungradedUnsub) { ungradedUnsub(); ungradedUnsub = null; }
      const ids = myAssignments.map(a => a.id).slice(0, 30);
      if (!ids.length) { ungradedCount = 0; renderTugasSummary(); return; }
      ungradedUnsub = onSnapshot(
        query(collection(db, "submissions"), where("assignmentId", "in", ids)),
        snap => {
          ungradedCount = snap.docs.filter(d => {
            const g = d.data().grade;
            return g === undefined || g === null;
          }).length;
          renderTugasSummary();
        },
        () => { ungradedCount = null; renderTugasSummary(); }
      );
    }

    onSnapshot(
      query(collection(db, "assignments"), where("teacherId", "==", user.uid)),
      (snap) => {
        myAssignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderTugasSummary();
        watchUngraded();
      },
      () => renderEmpty(tugasEl, "⚠️", "Gagal memuat ringkasan tugas.")
    );

    // ---- Pengumuman terbaru (sama seperti Portal Siswa: published saja) ----
    const annEl = document.getElementById("announcementList");
    renderSkeleton(annEl);
    const qAnn = query(
      collection(db, "announcements"),
      where("published", "==", true),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    onSnapshot(qAnn, (snap) => {
      if (snap.empty) {
        renderEmpty(annEl, "📣", "Belum ada pengumuman baru.");
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

    // ---- Guard tautan ke halaman Portal Guru yang belum dibangun ----
    // kelas-jadwal.html (22) dan bank-soal.html (23) sudah dibangun — tidak
    // perlu guard lagi. Hanya manajemen-cbt-hasil.html (24) yang menyusul.
    guardLinksTo("manajemen-cbt-hasil.html", "Halaman Manajemen CBT & Hasil sedang dibangun pada fase Portal Guru berikutnya.");
    guardLinksTo("bank-soal.html", "Halaman Bank Soal sedang dibangun pada fase Portal Guru berikutnya.");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
