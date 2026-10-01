// Portal Siswa — Tugas Online.
// Menampilkan SELURUH tugas untuk kelas siswa, form pengumpulan link,
// serta nilai & feedback dari guru (read-only di sisi siswa).
//
// CAKUPAN:
//   ✅ Daftar tugas (aktif / lewat deadline)
//   ✅ Status sudah/belum mengumpulkan + link yang sudah dikirim
//   ✅ Deadline & penanda "Terlambat"
//   ✅ Nilai & feedback guru ditampilkan jika sudah dinilai
//   ✅ Penguncian form setelah lewat deadline — input & tombol disabled,
//      pesan "Pengumpulan ditutup"; auto-rerender saat deadline terlewati

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot, doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { escapeHtml, fmtDateTime, submissionDocId, looksLikeUrl, gradeBadge } from "./tugas-shared.js";

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
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

export function initTugasSiswa() {
  requireAuth(["siswa"], (user, profile) => {
    const wrapEl     = document.getElementById("tugasWrap");
    const totalLabel = document.getElementById("totalLabel");
    const classId    = profile.classId || null;

    let myTugas       = [];
    let mySubmissions = new Map(); // assignmentId -> submission data
    let deadlineTimers = [];       // setTimeout IDs — dibersihkan tiap render

    function clearDeadlineTimers() {
      deadlineTimers.forEach(id => clearTimeout(id));
      deadlineTimers = [];
    }

    function render() {
      clearDeadlineTimers();

      if (!classId) {
        renderEmpty(wrapEl, "📚", "Kelas Anda belum diatur oleh Tata Usaha/Admin, daftar tugas belum bisa ditampilkan.");
        return;
      }
      totalLabel.textContent = `${myTugas.length} tugas`;
      if (!myTugas.length) {
        renderEmpty(wrapEl, "📚", "Belum ada tugas untuk kelas Anda.");
        return;
      }

      const now    = Date.now();
      const groups = { aktif: [], lewat: [] };
      myTugas.forEach(t => {
        const deadlineMs = t.deadline?.toDate?.().getTime();
        if (deadlineMs && deadlineMs <= now) groups.lewat.push(t); else groups.aktif.push(t);
      });
      groups.aktif.sort((a, b) => (a.deadline?.toMillis?.() || 0) - (b.deadline?.toMillis?.() || 0));
      groups.lewat.sort((a, b) => (b.deadline?.toMillis?.() || 0) - (a.deadline?.toMillis?.() || 0));

      const sections = [
        { key: "aktif", label: "🟢 Aktif", items: groups.aktif },
        { key: "lewat", label: "🔴 Lewat Deadline", items: groups.lewat },
      ].filter(s => s.items.length);

      wrapEl.innerHTML = sections.map(sec => `
        <div class="agd-month-label">${sec.label}</div>
        <div class="list-grid" style="margin-bottom:16px;">
          ${sec.items.map(t => renderCard(t, sec.key === "lewat")).join("")}
        </div>
      `).join("");

      // Pasang event submit hanya pada tombol yang tidak disabled
      wrapEl.querySelectorAll("[data-submit-id]").forEach(btn => {
        if (!btn.disabled) {
          btn.addEventListener("click", () => handleSubmit(btn.dataset.submitId));
        }
      });

      // Auto-rerender saat deadline tugas aktif terlewati
      groups.aktif.forEach(t => {
        const deadlineMs = t.deadline?.toDate?.().getTime();
        if (!deadlineMs) return;
        const msUntil = deadlineMs - Date.now();
        if (msUntil > 0 && msUntil < 24 * 60 * 60 * 1000) {
          // Hanya pasang timer jika deadline dalam 24 jam (hindari timer sangat panjang)
          const timerId = setTimeout(() => render(), msUntil + 500);
          deadlineTimers.push(timerId);
        }
      });
    }

    function renderCard(t, isOverdue) {
      const sub      = mySubmissions.get(t.id);
      const locked   = isOverdue; // form dikunci jika sudah lewat deadline

      // Badge status pengumpulan
      let statusBadge;
      if (sub) {
        statusBadge = sub.late
          ? `<span class="qb-badge diff-sulit">⚠️ Terlambat</span>`
          : `<span class="qb-badge diff-mudah">✅ Sudah Dikumpulkan</span>`;
      } else {
        statusBadge = `<span class="qb-badge ${isOverdue ? "diff-sulit" : ""}">❌ Belum Dikumpulkan</span>`;
      }

      // Badge nilai (jika sudah dinilai guru)
      const nilaiSection = (sub && sub.grade !== undefined && sub.grade !== null) ? `
        <div style="margin:8px 0;padding:10px 12px;background:var(--surface-2,var(--surface));border-radius:10px;border:1px solid var(--border);">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${gradeBadge(sub.grade)}
            ${sub.feedback ? `<span style="font-size:12px;color:var(--text-soft);">💬 ${escapeHtml(sub.feedback)}</span>` : ""}
          </div>
          ${sub.gradedAt ? `<div style="font-size:11px;color:var(--text-soft);margin-top:4px;">Dinilai oleh ${escapeHtml(sub.gradedByName || "Guru")} · ${fmtDateTime(sub.gradedAt)}</div>` : ""}
        </div>` : "";

      // Info link yang sudah dikumpulkan
      const submittedInfo = sub ? `
        <div style="font-size:11.5px;color:var(--text-soft);margin-bottom:8px;">
          🔗 Link terkirim: <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">${escapeHtml(sub.link)}</a><br>
          Dikumpulkan ${fmtDateTime(sub.submittedAt)}
        </div>` : "";

      // Blok form / kunci
      let formBlock;
      if (locked) {
        if (sub) {
          // Sudah kumpul, lewat deadline — tampilkan link saja, tidak ada form
          formBlock = `
            <div class="auth-alert" style="background:var(--surface-2,var(--surface));border:1px solid var(--border);border-radius:10px;padding:10px 12px;display:flex;gap:8px;align-items:flex-start;margin-top:4px;">
              <span aria-hidden="true">🔒</span>
              <span style="font-size:12.5px;color:var(--text-soft);">Deadline sudah lewat — pengumpulan dikunci. Tugas Anda sudah tercatat.</span>
            </div>`;
        } else {
          // Belum kumpul, lewat deadline — form disabled total
          formBlock = `
            <div class="auth-alert error" style="border-radius:10px;padding:10px 12px;display:flex;gap:8px;align-items:flex-start;margin-top:4px;">
              <span aria-hidden="true">🔒</span>
              <span style="font-size:12.5px;">Deadline sudah lewat — pengumpulan ditutup. Hubungi guru jika ada kendala.</span>
            </div>
            <div class="form-input-wrap" style="margin-bottom:8px;opacity:0.45;pointer-events:none;">
              <span aria-hidden="true">🔗</span>
              <input type="url" disabled placeholder="Pengumpulan ditutup" style="cursor:not-allowed;">
            </div>
            <button type="button" class="btn-primary btn-block" disabled style="opacity:0.45;cursor:not-allowed;">
              🔒 Pengumpulan Ditutup
            </button>`;
        }
      } else {
        // Aktif — form normal
        formBlock = `
          <div class="form-input-wrap" style="margin-bottom:8px;">
            <span aria-hidden="true">🔗</span>
            <input type="url" id="link-${t.id}"
              placeholder="Tempel tautan Google Drive / OneDrive di sini"
              value="${sub ? escapeHtml(sub.link) : ""}">
          </div>
          <p class="form-hint" id="err-${t.id}" style="display:none;color:#c0392b;margin-top:-4px;"></p>
          <button type="button" class="btn-primary btn-block" data-submit-id="${t.id}">
            ${sub ? "🔄 Perbarui Pengumpulan" : "📤 Kumpulkan"}
          </button>`;
      }

      return `
        <div class="qb-card">
          <div class="qb-badges">
            ${t.subject ? `<span class="qb-badge">${escapeHtml(t.subject)}</span>` : ""}
            ${statusBadge}
          </div>
          <p class="qb-text">${escapeHtml(t.title)}</p>
          <ul class="qb-options">
            <li>⏰ Deadline: ${fmtDateTime(t.deadline)}</li>
            ${t.description ? `<li>${escapeHtml(t.description)}</li>` : ""}
            ${t.teacherName ? `<li>👤 ${escapeHtml(t.teacherName)}</li>` : ""}
          </ul>
          ${nilaiSection}
          ${submittedInfo}
          ${formBlock}
        </div>`;
    }

    async function handleSubmit(assignmentId) {
      // Cek deadline sekali lagi di sisi JS sebelum kirim — defense in depth
      const t          = myTugas.find(x => x.id === assignmentId);
      const deadlineMs = t?.deadline?.toDate?.().getTime();
      if (deadlineMs && Date.now() > deadlineMs) {
        // Deadline sudah lewat sejak terakhir render; re-render untuk kunci form
        render();
        return;
      }

      const input = document.getElementById(`link-${assignmentId}`);
      const errEl = document.getElementById(`err-${assignmentId}`);
      const btn   = document.querySelector(`[data-submit-id="${assignmentId}"]`);
      const link  = input.value.trim();
      errEl.style.display = "none";

      if (!looksLikeUrl(link)) {
        errEl.textContent   = "Masukkan tautan yang valid (diawali http:// atau https://).";
        errEl.style.display = "block";
        return;
      }

      const late  = !!(deadlineMs && Date.now() > deadlineMs);
      const docId = submissionDocId(assignmentId, user.uid);

      btn.disabled = true;
      try {
        await setDoc(doc(db, "submissions", docId), {
          assignmentId,
          studentId:   user.uid,
          studentName: profile.name || "-",
          nis:         profile.nis  || "",
          classId,
          link,
          late,
          submittedAt: serverTimestamp(),
        }, { merge: true });
      } catch {
        errEl.textContent   = "Gagal mengirim. Periksa koneksi lalu coba lagi.";
        errEl.style.display = "block";
      } finally {
        btn.disabled = false;
      }
    }

    if (classId) {
      renderSkeleton(wrapEl);
      onSnapshot(
        query(collection(db, "assignments"), where("classId", "==", classId)),
        snap => { myTugas = snap.docs.map(d => ({ id: d.id, ...d.data() })); render(); },
        ()   => renderEmpty(wrapEl, "⚠️", "Gagal memuat daftar tugas. Periksa koneksi lalu muat ulang.")
      );
      onSnapshot(
        query(collection(db, "submissions"), where("studentId", "==", user.uid)),
        snap => {
          mySubmissions = new Map(snap.docs.map(d => [d.data().assignmentId, d.data()]));
          render();
        }
      );
    } else {
      render();
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      clearDeadlineTimers();
      await logout();
      location.replace("login.html");
    });
  });
}
