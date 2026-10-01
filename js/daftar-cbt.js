// Khusus daftar-cbt.html. Menampilkan SELURUH ujian CBT untuk kelas siswa
// yang login, langsung dari Firestore (bukan data contoh), dikelompokkan
// menurut status waktu SAAT INI: Berlangsung → Akan Datang → Selesai.
//
// PENTING soal keamanan (lihat juga §31 spek & firestore.rules): dokumen
// `exams` yang dibaca di sini HANYA berisi metadata (judul, mapel, waktu,
// durasi) — TIDAK PERNAH berisi soal maupun kunci jawaban. Soal & kunci
// jawaban tinggal di collection `questions` yang tetap terkunci untuk staff
// saja sampai halaman "Pengerjaan CBT" sungguhan dibangun pada fase Sistem
// CBT — begitu juga tombol "Kerjakan Sekarang" di halaman ini: sebelum
// mengarahkan siswa, kita cek dulu apakah halaman tujuannya sudah benar-benar
// ada (bukan tautan mati), persis pola yang sudah dipakai login.html saat
// mengecek dashboard.
//
// Skema: exams/{id} : { title, subject, classId, durationMinutes,
//                        startTime (Timestamp), endTime (Timestamp) }

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function fmtDateTime(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time} WIB`;
}

function fmtTime(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) + " WIB";
}

/** Cek apakah sebuah halaman sudah benar-benar ada (bukan asumsi/klaim kosong)
 * sebelum mengarahkan siswa ke sana — mencegah tombol yang terlihat aktif
 * tapi sebenarnya menuju 404. */
async function pageExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

function showComingSoonNote(container, text) {
  let note = container.querySelector(".cbt-note");
  if (!note) {
    note = document.createElement("div");
    note.className = "auth-alert success cbt-note";
    note.style.marginTop = "10px";
    note.innerHTML = `<span aria-hidden="true">🚧</span><span></span>`;
    container.appendChild(note);
  }
  note.querySelector("span:last-child").textContent = text;
}

function renderSkeleton(el) {
  el.innerHTML = Array.from({ length: 2 }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:40%;height:10px;"></div>
      </div>
    </div>`).join("");
}

function renderEmptyPage(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

export function initDaftarCbt() {
  requireAuth(["siswa"], (user, profile) => {
    const wrapEl = document.getElementById("cbtWrap");
    const classId = profile.classId || null;

    if (!classId) {
      renderEmptyPage(wrapEl, "📝", "Kelas Anda belum diatur oleh Tata Usaha/Admin, daftar ujian belum bisa ditampilkan.");
    } else {
      renderSkeleton(wrapEl);
      const qExam = query(
        collection(db, "exams"),
        where("classId", "==", classId),
        orderBy("startTime", "asc")
      );
      onSnapshot(qExam, (snap) => {
        if (snap.empty) {
          renderEmptyPage(wrapEl, "📝", "Belum ada ujian CBT untuk kelas Anda.");
          return;
        }

        const now = Date.now();
        const groups = { berlangsung: [], akanDatang: [], selesai: [] };
        snap.docs.forEach(d => {
          const e = { id: d.id, ...d.data() };
          const start = e.startTime?.toDate?.().getTime();
          const end = e.endTime?.toDate?.().getTime();
          if (end && end <= now) groups.selesai.push(e);
          else if (start && start <= now) groups.berlangsung.push(e);
          else groups.akanDatang.push(e);
        });
        groups.selesai.reverse(); // yang paling baru selesai muncul duluan

        const sections = [
          { key: "berlangsung", label: "🟢 Sedang Berlangsung", items: groups.berlangsung },
          { key: "akanDatang", label: "🕒 Akan Datang", items: groups.akanDatang },
          { key: "selesai", label: "✅ Selesai", items: groups.selesai },
        ].filter(s => s.items.length);

        if (!sections.length) {
          renderEmptyPage(wrapEl, "📝", "Belum ada ujian CBT untuk kelas Anda.");
          return;
        }

        wrapEl.innerHTML = sections.map(sec => `
          <div class="agd-month-label">${sec.label}</div>
          <div class="card-surface" style="padding:4px 14px;margin-bottom:16px;">
            ${sec.items.map(e => {
              let meta, actionHtml = "";
              if (sec.key === "berlangsung") {
                meta = `Berakhir ${fmtTime(e.endTime)} · ⏱️ ${e.durationMinutes || "—"} menit`;
                actionHtml = `<button type="button" class="btn-primary" style="margin-top:8px;" data-action="start" data-id="${e.id}">Kerjakan Sekarang</button>`;
              } else if (sec.key === "akanDatang") {
                meta = `Mulai ${fmtDateTime(e.startTime)} · ⏱️ ${e.durationMinutes || "—"} menit`;
              } else {
                meta = `Selesai ${fmtDateTime(e.endTime)}`;
                actionHtml = `<button type="button" class="btn-secondary" style="margin-top:8px;" data-action="result" data-id="${e.id}">Lihat Hasil</button>`;
              }
              return `
              <div class="list-row" style="flex-direction:column;align-items:flex-start;gap:6px;">
                <div style="display:flex;gap:12px;align-items:center;width:100%;">
                  <div class="list-row-icon" aria-hidden="true">📝</div>
                  <div class="list-row-body">
                    <h4>${e.title || "Ujian"} — ${e.subject || ""}</h4>
                    <p>${meta}</p>
                  </div>
                </div>
                ${actionHtml}
              </div>`;
            }).join("")}
          </div>
        `).join("");

        wrapEl.querySelectorAll('[data-action="start"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            const target = `cbt-pengerjaan.html?examId=${btn.dataset.id}`;
            if (await pageExists(target)) {
              location.href = target;
            } else {
              showComingSoonNote(btn.closest(".list-row"),
                "Halaman pengerjaan CBT sedang dibangun pada fase Sistem CBT berikutnya. Sesi Anda tetap aman — kembali lagi saat ujian ini masih berlangsung.");
              btn.disabled = false;
            }
          });
        });
        wrapEl.querySelectorAll('[data-action="result"]').forEach(btn => {
          btn.addEventListener("click", async () => {
            btn.disabled = true;
            const target = `hasil-cbt.html?examId=${btn.dataset.id}`;
            if (await pageExists(target)) {
              location.href = target;
            } else {
              showComingSoonNote(btn.closest(".list-row"),
                "Halaman Hasil & Riwayat CBT sedang dibangun. Sebentar lagi hasil ujian ini bisa dilihat di sini.");
              btn.disabled = false;
            }
          });
        });
      }, () => renderEmptyPage(wrapEl, "⚠️", "Gagal memuat daftar ujian. Periksa koneksi lalu muat ulang."));
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
