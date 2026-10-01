// Khusus dashboard-siswa.html. Semua data di bawah ini diambil LANGSUNG dari
// Firestore (bukan data contoh) — jika koleksi masih kosong, setiap bagian
// akan menampilkan empty state yang jujur, bukan angka/isi palsu.
//
// Skema Firestore yang diasumsikan (lihat juga firestore.rules):
//   users/{uid}        : { role:"siswa", name, nis, nisn, photoURL, classId, classLabel }
//                          nisn & photoURL OPSIONAL — lihat js/kartu-pelajar.js
//   schedules/{id}      : { classId, day, time, subject, teacher, room }
//                          day berisi salah satu: "Senin".."Minggu"
//   announcements/{id}  : { title, published, urgent, createdAt (Timestamp), excerpt }
//   exams/{id}          : { title, subject, classId, durationMinutes,
//                            startTime (Timestamp), endTime (Timestamp), status }
//                          TIDAK berisi kunci jawaban — itu ada di koleksi
//                          `questions` yang tetap terkunci sampai fase CBT selesai.
//   results/{id}        : { studentId, examId (opsional), examTitle, subject,
//                            score, correct, wrong, createdAt (Timestamp) }
//
// Timer countdown di dashboard ini bersifat INFORMATIF (preview jadwal ujian),
// memakai jam browser. Saat halaman pengerjaan CBT sungguhan dibangun (fase
// Sistem CBT), timer resmi WAJIB memakai waktu server/database sesuai §30 spek.

import { requireAuth, logout, ROLE_LABEL } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { todayStr } from "./attendance-shared.js";

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ATT_LABEL = { hadir: "Hadir", izin: "Izin", sakit: "Sakit", alpa: "Alpa" };
const ATT_ICON = { hadir: "✅", izin: "📩", sakit: "🤒", alpa: "❌" };

function fmtDate(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTimeRange(startTs, endTs) {
  if (!startTs?.toDate) return "—";
  const opt = { hour: "2-digit", minute: "2-digit" };
  const start = startTs.toDate().toLocaleTimeString("id-ID", opt);
  const end = endTs?.toDate ? endTs.toDate().toLocaleTimeString("id-ID", opt) : "";
  return end ? `${start} – ${end} WIB` : `${start} WIB`;
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

let countdownInterval = null;

function startCountdown(exam) {
  const box = document.getElementById("examCountdownBox");
  clearInterval(countdownInterval);
  if (!exam) {
    box.style.display = "none";
    return;
  }
  box.style.display = "block";
  const labelEl = document.getElementById("ecLabel");
  const titleEl = document.getElementById("ecTitle");
  const timerEl = document.getElementById("ecTimer");
  titleEl.textContent = `${exam.title || "Ujian"} — ${exam.subject || ""}`;

  function tick() {
    const now = Date.now();
    const start = exam.startTime?.toDate?.().getTime();
    const end = exam.endTime?.toDate?.().getTime();
    let target, label;
    if (start && now < start) {
      target = start;
      label = "Ujian dimulai dalam";
    } else if (end && now < end) {
      target = end;
      label = "Sedang berlangsung — berakhir dalam";
    } else {
      clearInterval(countdownInterval);
      box.style.display = "none";
      return;
    }
    labelEl.textContent = label;
    const diff = Math.max(0, target - now);
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    timerEl.innerHTML = `${h}<span>jam</span> ${m}<span>mnt</span> ${s}<span>dtk</span>`;
  }
  tick();
  countdownInterval = setInterval(tick, 1000);
}

export function initDashboardSiswa() {
  requireAuth(["siswa"], (user, profile) => {
    // ---- Greeting & profil singkat ----
    const firstName = (profile.name || "Siswa").split(" ")[0];
    document.getElementById("greetingName").textContent = `Halo, ${firstName}! 👋`;
    document.getElementById("greetingSub").textContent =
      new Date().toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const profileAvatar = document.getElementById("profileAvatar");
    if (profile.photoURL) {
      profileAvatar.innerHTML = `<img src="${profile.photoURL}" alt="" onerror="this.parentElement.textContent='${initials(profile.name)}';">`;
    } else {
      profileAvatar.textContent = initials(profile.name);
    }
    document.getElementById("profileName").textContent = profile.name || "—";
    document.getElementById("profileMetaClass").textContent = profile.classLabel || profile.classId || "Kelas belum diatur";
    document.getElementById("profileMetaNis").textContent = profile.nis ? `NIS ${profile.nis}` : "NIS belum diatur";
    document.getElementById("roleBadge").textContent = ROLE_LABEL[profile.role] || profile.role;

    const classId = profile.classId || null;
    const todayName = DAY_NAMES[new Date().getDay()];

    // ---- Jadwal hari ini ----
    const scheduleEl = document.getElementById("scheduleList");
    if (!classId) {
      renderEmpty(scheduleEl, "📅", "Kelas Anda belum diatur oleh Tata Usaha/Admin, jadwal belum bisa ditampilkan.");
    } else {
      renderSkeleton(scheduleEl);
      const qSchedule = query(
        collection(db, "schedules"),
        where("classId", "==", classId),
        where("day", "==", todayName),
        orderBy("time", "asc")
      );
      onSnapshot(qSchedule, (snap) => {
        if (snap.empty) {
          renderEmpty(scheduleEl, "📅", `Tidak ada jadwal pelajaran untuk hari ${todayName}.`);
          return;
        }
        scheduleEl.innerHTML = snap.docs.map(d => {
          const s = d.data();
          return `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">📘</div>
            <div class="list-row-body">
              <h4>${s.subject || "—"}</h4>
              <p>🕒 ${s.time || "—"} · 👤 ${s.teacher || "—"} · 🚪 ${s.room || "—"}</p>
            </div>
          </div>`;
        }).join("");
      }, () => renderEmpty(scheduleEl, "⚠️", "Gagal memuat jadwal. Periksa koneksi lalu muat ulang."));
    }

    // ---- Pengumuman terbaru ----
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

    // ---- Ujian CBT tersedia + countdown ----
    const examEl = document.getElementById("examList");
    if (!classId) {
      renderEmpty(examEl, "📝", "Kelas Anda belum diatur, daftar ujian belum bisa ditampilkan.");
      startCountdown(null);
    } else {
      renderSkeleton(examEl);
      const qExam = query(
        collection(db, "exams"),
        where("classId", "==", classId),
        orderBy("startTime", "asc"),
        limit(5)
      );
      onSnapshot(qExam, (snap) => {
        const now = Date.now();
        const exams = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const relevant = exams.filter(e => {
          const end = e.endTime?.toDate?.().getTime();
          return !end || end > now;
        });
        if (!relevant.length) {
          renderEmpty(examEl, "📝", "Tidak ada ujian CBT yang tersedia saat ini.");
          startCountdown(null);
          return;
        }
        examEl.innerHTML = relevant.map(e => {
          const start = e.startTime?.toDate?.().getTime();
          const isActive = start && start <= now;
          return `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">📝</div>
            <div class="list-row-body">
              <h4>${e.title || "Ujian"} — ${e.subject || ""}</h4>
              <p>🕒 ${fmtTimeRange(e.startTime, e.endTime)} · ⏱️ ${e.durationMinutes || "—"} menit</p>
            </div>
            <span class="list-row-tag ${isActive ? "active" : ""}">${isActive ? "Berlangsung" : "Terjadwal"}</span>
          </div>`;
        }).join("");
        startCountdown(relevant[0]);
      }, () => {
        renderEmpty(examEl, "⚠️", "Gagal memuat daftar ujian. Periksa koneksi lalu muat ulang.");
        startCountdown(null);
      });
    }

    // ---- Riwayat CBT ----
    const resultEl = document.getElementById("resultList");
    renderSkeleton(resultEl);
    const qResult = query(
      collection(db, "results"),
      where("studentId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(5)
    );
    onSnapshot(qResult, (snap) => {
      if (snap.empty) {
        renderEmpty(resultEl, "📊", "Belum ada riwayat hasil CBT.");
        return;
      }
      resultEl.innerHTML = snap.docs.map(d => {
        const r = d.data();
        return `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">📊</div>
          <div class="list-row-body">
            <h4>${r.examTitle || "—"}</h4>
            <p>${r.subject || ""} · ${fmtDate(r.createdAt)}</p>
          </div>
          <span class="list-row-score">${r.score ?? "—"}</span>
        </div>`;
      }).join("");
    }, () => renderEmpty(resultEl, "⚠️", "Gagal memuat riwayat. Periksa koneksi lalu muat ulang."));

    // ---- Status absensi hari ini (ringkasan kecil, detail & QR di absensi-siswa.html) ----
    const attBox = document.getElementById("dashAttStatus");
    if (attBox) {
      const today = todayStr();
      const qAttToday = query(collection(db, "attendance"), where("studentId", "==", user.uid));
      onSnapshot(qAttToday, (snap) => {
        const todayDoc = snap.docs.map(d => d.data()).find(r => r.date === today);
        attBox.innerHTML = todayDoc
          ? `${ATT_ICON[todayDoc.status] || "📍"} Hari ini: <strong>${ATT_LABEL[todayDoc.status] || todayDoc.status}</strong>`
          : "📍 Belum ada catatan absensi untuk hari ini.";
      }, () => { attBox.textContent = "⚠️ Gagal memuat status absensi."; });
    }

    // ---- Reminder deadline tugas ----
    // Tampilkan banner di dashboard jika ada tugas yang:
    //   1. Belum dikumpulkan + deadline dalam 3 hari ke depan (mendesak)
    //   2. Sudah lewat deadline + belum dikumpulkan (terlewat)
    // Menggunakan dua listener paralel (assignments + submissions) persis
    // seperti pola di tugas-siswa.js.
    const reminderSection = document.getElementById("tugasReminderSection");
    const reminderList    = document.getElementById("tugasReminderList");

    if (classId && reminderSection && reminderList) {
      let allTugas       = [];
      let mySubmissions  = new Map(); // assignmentId -> submitted

      function renderReminder() {
        const now        = Date.now();
        const in3Days    = now + 3 * 24 * 60 * 60 * 1000;

        // Filter tugas yang belum dikumpulkan
        const belumKumpul = allTugas.filter(t => !mySubmissions.has(t.id));

        const mendesak  = belumKumpul.filter(t => {
          const ms = t.deadline?.toDate?.().getTime();
          return ms && ms > now && ms <= in3Days;
        }).sort((a, b) => (a.deadline?.toMillis?.() || 0) - (b.deadline?.toMillis?.() || 0));

        const terlewat  = belumKumpul.filter(t => {
          const ms = t.deadline?.toDate?.().getTime();
          return ms && ms <= now;
        }).sort((a, b) => (b.deadline?.toMillis?.() || 0) - (a.deadline?.toMillis?.() || 0));

        const items = [...mendesak, ...terlewat];

        if (!items.length) {
          reminderSection.style.display = "none";
          return;
        }
        reminderSection.style.display = "";

        reminderList.innerHTML = items.map(t => {
          const deadlineMs  = t.deadline?.toDate?.().getTime();
          const isOverdue   = deadlineMs && deadlineMs <= now;
          const msLeft      = deadlineMs ? deadlineMs - now : null;

          // Hitung sisa waktu yang mudah dibaca
          let sisaWaktu = "";
          if (!isOverdue && msLeft !== null) {
            const jamLeft  = Math.floor(msLeft / 3600000);
            const hariLeft = Math.floor(msLeft / 86400000);
            sisaWaktu = hariLeft >= 1
              ? `${hariLeft} hari lagi`
              : `${jamLeft} jam lagi`;
          }

          const isUrgent = !isOverdue && msLeft !== null && msLeft <= 24 * 60 * 60 * 1000;
          const bgColor  = isOverdue  ? "var(--surface)"
                         : isUrgent   ? "#fff8e1"
                         :              "var(--surface)";
          const borderColor = isOverdue ? "#f0a5a5"
                            : isUrgent  ? "#f0cf8a"
                            :             "var(--border)";

          return `
            <a href="tugas-siswa.html" style="text-decoration:none;display:block;margin-bottom:8px;">
              <div style="
                background:${bgColor};
                border:1.5px solid ${borderColor};
                border-radius:12px;
                padding:11px 14px;
                display:flex;
                gap:10px;
                align-items:flex-start;
              ">
                <span style="font-size:20px;flex-shrink:0;">${isOverdue ? "🔴" : isUrgent ? "🟡" : "🟢"}</span>
                <div style="flex:1;min-width:0;">
                  <div style="font-size:13.5px;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                    ${escapeHtml(t.title)}
                  </div>
                  <div style="font-size:11.5px;color:var(--text-soft);margin-top:2px;">
                    ${t.subject ? escapeHtml(t.subject) + " · " : ""}
                    ${isOverdue
                      ? `<span style="color:#c0392b;font-weight:600;">Lewat deadline — belum dikumpulkan</span>`
                      : `<span style="font-weight:600;color:${isUrgent ? "#8a6416" : "var(--text-soft)"};">⏰ ${sisaWaktu}</span>`
                    }
                  </div>
                </div>
                <span style="font-size:11px;color:var(--text-soft);flex-shrink:0;align-self:center;">›</span>
              </div>
            </a>`;
        }).join("");
      }

      function escapeHtml(s) {
        return String(s ?? "").replace(/[&<>"']/g, m =>
          ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
        );
      }

      onSnapshot(
        query(collection(db, "assignments"), where("classId", "==", classId)),
        snap => { allTugas = snap.docs.map(d => ({ id: d.id, ...d.data() })); renderReminder(); }
      );
      onSnapshot(
        query(collection(db, "submissions"), where("studentId", "==", user.uid)),
        snap => {
          mySubmissions = new Map(snap.docs.map(d => [d.data().assignmentId, true]));
          renderReminder();
        }
      );
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      clearInterval(countdownInterval);
      await logout();
      location.replace("login.html");
    });
  });
}
