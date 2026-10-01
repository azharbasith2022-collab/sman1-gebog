// Portal Guru — Tugas Online (CRUD penuh + daftar pengumpulan dengan roster
// lengkap + penilaian & feedback).
//
// CAKUPAN FITUR "TUGAS ONLINE" — SELESAI (lihat juga js/tugas-siswa.js &
// js/tugas-shared.js untuk sisi siswa + skema bersama):
//   ✅ Guru membuat tugas (judul, kelas, deadline, deskripsi, mapel)
//   ✅ Deadline ditampilkan + badge Aktif/Lewat Deadline
//   ✅ Status sudah/belum mengumpulkan — daftar SEMUA siswa di kelas,
//      bukan hanya yang sudah kumpul (diambil dari collection `students`)
//   ✅ Nilai & feedback guru — form inline per siswa di panel pengumpulan
//   ✅ Penguncian form siswa setelah lewat deadline — diimplementasikan di
//      js/tugas-siswa.js (bukan di file ini, karena murni UI sisi siswa)
//   ✅ Ringkasan "Tugas Saya" (tugas aktif + pengumuman belum dinilai) di
//      Dashboard Guru — lihat js/dashboard-guru.js

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, setDoc, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  escapeHtml, fmtDateTime, toDatetimeLocalValue, gradeBadge, submissionDocId,
} from "./tugas-shared.js";

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

function renderSkeleton(el, rows = 3) {
  el.innerHTML = Array.from({ length: rows }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:85%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:55%;height:10px;"></div>
      </div>
    </div>`).join("");
}

export function initTugasGuru() {
  requireAuth(["guru"], (user, profile) => {
    const listEl      = document.getElementById("tugasList");
    const totalLabel  = document.getElementById("totalLabel");
    const chipsEl     = document.getElementById("classChips");

    // --- Sheet form tugas ---
    const sheetOverlay  = document.getElementById("sheetOverlay");
    const sheetTitle    = document.getElementById("sheetTitle");
    const form          = document.getElementById("tugasForm");
    const noClassNote   = document.getElementById("noClassNote");
    const formErrorBox  = document.getElementById("formError");
    const formErrorText = document.getElementById("formErrorText");
    const submitBtn     = document.getElementById("submitBtn");
    const submitBtnText = document.getElementById("submitBtnText");
    const classSelect   = document.getElementById("fClass");

    // --- Dialog hapus ---
    const confirmOverlay = document.getElementById("confirmOverlay");

    // --- Overlay pengumpulan + penilaian ---
    const submissionsOverlay = document.getElementById("submissionsOverlay");
    const submissionsTitle   = document.getElementById("submissionsTitle");
    const submissionsStats   = document.getElementById("submissionsStats");
    const submissionsList    = document.getElementById("submissionsList");
    let   submissionsUnsub   = null;
    let   rosterUnsub        = null;

    let myClasses         = [];   // [{ id, label }]
    let myTugas           = [];
    let activeClassFilter = "all";
    let editingId         = null;
    let pendingDeleteId   = null;

    // ================================================================
    // Kelas yang saya ajar (dari schedules)
    // ================================================================
    onSnapshot(
      query(collection(db, "schedules"), where("teacherId", "==", user.uid)),
      (snap) => {
        const seen = new Map();
        snap.docs.forEach(d => {
          const s = d.data();
          const key = s.classId || s.classLabel;
          if (key && !seen.has(key)) seen.set(key, s.classLabel || s.classId);
        });
        myClasses = [...seen.entries()].map(([id, label]) => ({ id, label }));
        classSelect.innerHTML = myClasses.map(c =>
          `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`
        ).join("");
        noClassNote.style.display  = myClasses.length ? "none" : "flex";
        submitBtn.disabled         = !myClasses.length;
        renderChipsAndList();
      }
    );

    // ================================================================
    // Sheet form buat / edit tugas
    // ================================================================
    function openSheet(item = null) {
      form.reset();
      formErrorBox.style.display = "none";
      editingId      = item?.id || null;
      sheetTitle.textContent    = editingId ? "Edit Tugas" : "Tambah Tugas";
      submitBtnText.textContent = editingId ? "Simpan Perubahan" : "Simpan Tugas";

      document.getElementById("fTitle").value       = item?.title       || "";
      document.getElementById("fSubject").value     = item?.subject     || "";
      classSelect.value                             = item?.classId     || "";
      document.getElementById("fDeadline").value    = toDatetimeLocalValue(item?.deadline);
      document.getElementById("fDescription").value = item?.description || "";

      sheetOverlay.classList.add("open");
      document.getElementById("fTitle").focus();
    }

    function closeSheet() {
      sheetOverlay.classList.remove("open");
      editingId = null;
    }

    document.getElementById("addBtn").addEventListener("click", () => openSheet(null));
    document.getElementById("sheetCloseBtn").addEventListener("click", closeSheet);
    sheetOverlay.addEventListener("click", ev => { if (ev.target === sheetOverlay) closeSheet(); });

    form.addEventListener("submit", async ev => {
      ev.preventDefault();
      formErrorBox.style.display = "none";

      const title       = document.getElementById("fTitle").value.trim();
      const subject     = document.getElementById("fSubject").value.trim();
      const classId     = classSelect.value;
      const classLabel  = myClasses.find(c => c.id === classId)?.label || classId;
      const deadlineVal = document.getElementById("fDeadline").value;
      const description = document.getElementById("fDescription").value.trim();

      if (!title || !classId) {
        formErrorText.textContent = "Judul dan kelas wajib diisi.";
        formErrorBox.style.display = "flex"; return;
      }
      if (!deadlineVal) {
        formErrorText.textContent = "Deadline wajib diisi.";
        formErrorBox.style.display = "flex"; return;
      }

      const payload = {
        title, subject, classId, classLabel, description,
        teacherId: user.uid,
        teacherName: profile.name || "-",
        deadline: Timestamp.fromDate(new Date(deadlineVal)),
        updatedAt: serverTimestamp(),
      };

      submitBtn.disabled = true;
      try {
        if (editingId) {
          await updateDoc(doc(db, "assignments", editingId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "assignments"), payload);
        }
        closeSheet();
      } catch {
        formErrorText.textContent = "Gagal menyimpan tugas. Periksa koneksi lalu coba lagi.";
        formErrorBox.style.display = "flex";
      } finally {
        submitBtn.disabled = false;
      }
    });

    // ================================================================
    // Hapus tugas
    // ================================================================
    function openConfirm(id) { pendingDeleteId = id; confirmOverlay.classList.add("open"); }
    function closeConfirm()  { confirmOverlay.classList.remove("open"); pendingDeleteId = null; }

    document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
    confirmOverlay.addEventListener("click", ev => { if (ev.target === confirmOverlay) closeConfirm(); });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, "assignments", pendingDeleteId));
        closeConfirm();
      } catch {
        btn.disabled = false;
      }
    });

    // ================================================================
    // Panel pengumpulan — ROSTER LENGKAP + PENILAIAN
    // ================================================================
    function openSubmissions(item) {
      submissionsTitle.textContent = `Pengumpulan — ${item.title}`;
      submissionsStats.innerHTML   = "";
      renderSkeleton(submissionsList, 3);
      submissionsOverlay.classList.add("open");

      // Hentikan listener sebelumnya
      if (submissionsUnsub) { submissionsUnsub(); submissionsUnsub = null; }
      if (rosterUnsub)      { rosterUnsub();      rosterUnsub      = null; }

      let rosterStudents = [];   // semua siswa di kelas ini
      let submissionsMap = new Map(); // studentId -> submissionData

      function renderPanel() {
        const submitted  = rosterStudents.filter(s => submissionsMap.has(s.id));
        const notYet     = rosterStudents.filter(s => !submissionsMap.has(s.id));
        const lateCount  = submitted.filter(s => submissionsMap.get(s.id)?.late).length;
        const gradedCount = submitted.filter(s => submissionsMap.get(s.id)?.grade !== undefined && submissionsMap.get(s.id)?.grade !== null).length;

        submissionsStats.innerHTML = `
          <span class="qb-badge diff-mudah">✅ ${submitted.length} sudah kumpul</span>
          <span class="qb-badge ${notYet.length ? "diff-sulit" : ""}">❌ ${notYet.length} belum kumpul</span>
          ${lateCount   ? `<span class="qb-badge diff-sulit">⚠️ ${lateCount} terlambat</span>` : ""}
          ${gradedCount ? `<span class="qb-badge diff-sedang">⭐ ${gradedCount} sudah dinilai</span>` : ""}
        `;

        if (!rosterStudents.length) {
          renderEmpty(submissionsList, "🎓", "Belum ada siswa terdaftar di kelas ini.");
          return;
        }

        // Urutkan: sudah kumpul dulu (terbaru dulu), lalu belum kumpul (a-z)
        const sortedSubmitted = [...submitted].sort((a, b) => {
          const ta = submissionsMap.get(a.id)?.submittedAt?.toMillis?.() || 0;
          const tb = submissionsMap.get(b.id)?.submittedAt?.toMillis?.() || 0;
          return tb - ta;
        });
        const sortedNotYet = [...notYet].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "id")
        );

        const rows = [
          ...sortedSubmitted.map(s => renderStudentRow(s, submissionsMap.get(s.id), item)),
          ...sortedNotYet.map(s   => renderStudentRow(s, null, item)),
        ];
        submissionsList.innerHTML = rows.join("");

        // Event: simpan nilai & feedback
        submissionsList.querySelectorAll("[data-grade-id]").forEach(btn => {
          btn.addEventListener("click", () => saveGrade(btn.dataset.gradeId, btn.dataset.studentId));
        });
      }

      // Listener roster kelas
      rosterUnsub = onSnapshot(
        query(collection(db, "students"), where("classId", "==", item.classId)),
        snap => {
          rosterStudents = snap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
          renderPanel();
        },
        () => renderEmpty(submissionsList, "⚠️", "Gagal memuat daftar siswa.")
      );

      // Listener submissions untuk tugas ini
      submissionsUnsub = onSnapshot(
        query(collection(db, "submissions"), where("assignmentId", "==", item.id)),
        snap => {
          submissionsMap = new Map(snap.docs.map(d => [d.data().studentId, { _docId: d.id, ...d.data() }]));
          renderPanel();
        },
        () => renderEmpty(submissionsList, "⚠️", "Gagal memuat daftar pengumpulan.")
      );
    }

    function renderStudentRow(student, sub, item) {
      const hasSubmitted = !!sub;
      const gradeVal     = sub?.grade !== undefined && sub?.grade !== null ? sub.grade : "";
      const feedbackVal  = sub?.feedback || "";
      const docId        = submissionDocId(item.id, student.id);

      const statusBadge = !hasSubmitted
        ? `<span class="qb-badge diff-sulit">❌ Belum Kumpul</span>`
        : sub.late
          ? `<span class="qb-badge diff-sulit">⚠️ Terlambat</span>`
          : `<span class="qb-badge diff-mudah">✅ Tepat Waktu</span>`;

      const existingGradeBadge = (sub?.grade !== undefined && sub?.grade !== null)
        ? gradeBadge(sub.grade) : "";

      return `
        <div class="list-row" style="flex-direction:column;align-items:stretch;gap:8px;padding:12px 14px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <div class="list-row-icon" aria-hidden="true" style="flex-shrink:0;">👤</div>
            <div style="flex:1;min-width:0;">
              <h4 style="margin:0;font-size:13.5px;">${escapeHtml(student.name || "—")}</h4>
              <p style="margin:2px 0 0;font-size:11.5px;color:var(--text-soft);">${student.nis ? `NIS ${escapeHtml(student.nis)}` : "—"}</p>
            </div>
            <div style="flex-shrink:0;display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end;">
              ${statusBadge}
              ${existingGradeBadge}
            </div>
          </div>

          ${hasSubmitted ? `
          <div style="font-size:11.5px;color:var(--text-soft);border-top:1px solid var(--border);padding-top:8px;">
            🕒 Dikumpulkan ${fmtDateTime(sub.submittedAt)}<br>
            🔗 <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">${escapeHtml(sub.link)}</a>
            ${sub.feedback ? `<div style="margin-top:4px;">💬 Feedback sebelumnya: <em>${escapeHtml(sub.feedback)}</em></div>` : ""}
            ${sub.gradedAt  ? `<div style="color:var(--text-soft);margin-top:2px;">Dinilai ${fmtDateTime(sub.gradedAt)}</div>` : ""}
          </div>
          ` : ""}

          ${hasSubmitted ? `
          <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:8px;">
            <div style="flex:0 0 80px;">
              <label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:3px;">Nilai (0–100)</label>
              <input type="number" id="grade-${escapeHtml(docId)}" min="0" max="100" step="1"
                value="${escapeHtml(String(gradeVal))}"
                placeholder="—"
                style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);">
            </div>
            <div style="flex:1;min-width:120px;">
              <label style="font-size:11px;color:var(--text-soft);display:block;margin-bottom:3px;">Feedback / Komentar</label>
              <input type="text" id="feedback-${escapeHtml(docId)}" maxlength="300"
                value="${escapeHtml(feedbackVal)}"
                placeholder="Komentar untuk siswa (opsional)"
                style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--surface);color:var(--text);">
            </div>
            <button type="button" class="btn-primary"
              style="flex:0 0 auto;padding:7px 12px;font-size:12.5px;white-space:nowrap;"
              data-grade-id="${escapeHtml(docId)}"
              data-student-id="${escapeHtml(student.id)}">
              💾 Simpan
            </button>
          </div>
          ` : `
          <div style="font-size:11.5px;color:var(--text-soft);border-top:1px solid var(--border);padding-top:8px;text-align:center;">
            Penilaian tersedia setelah siswa mengumpulkan
          </div>
          `}
        </div>`;
    }

    async function saveGrade(docId, studentId) {
      const gradeInput    = document.getElementById(`grade-${docId}`);
      const feedbackInput = document.getElementById(`feedback-${docId}`);
      const btn           = document.querySelector(`[data-grade-id="${docId}"]`);
      if (!gradeInput || !btn) return;

      const gradeRaw  = gradeInput.value.trim();
      const feedback  = feedbackInput ? feedbackInput.value.trim() : "";
      const grade     = gradeRaw !== "" ? Number(gradeRaw) : null;

      if (grade !== null && (isNaN(grade) || grade < 0 || grade > 100)) {
        gradeInput.style.border = "1.5px solid #c0392b";
        gradeInput.focus();
        return;
      }
      gradeInput.style.border = "";
      btn.disabled = true;
      btn.textContent = "Menyimpan…";

      try {
        await setDoc(doc(db, "submissions", docId), {
          grade: grade,
          feedback,
          gradedAt: serverTimestamp(),
          gradedByName: profile.name || "-",
        }, { merge: true });
        btn.textContent = "✅ Tersimpan";
        setTimeout(() => { btn.textContent = "💾 Simpan"; btn.disabled = false; }, 1500);
      } catch {
        btn.textContent = "❌ Gagal";
        setTimeout(() => { btn.textContent = "💾 Simpan"; btn.disabled = false; }, 1500);
      }
    }

    function closeSubmissions() {
      submissionsOverlay.classList.remove("open");
      if (submissionsUnsub) { submissionsUnsub(); submissionsUnsub = null; }
      if (rosterUnsub)      { rosterUnsub();      rosterUnsub      = null; }
    }

    document.getElementById("submissionsCloseBtn").addEventListener("click", closeSubmissions);
    submissionsOverlay.addEventListener("click", ev => {
      if (ev.target === submissionsOverlay) closeSubmissions();
    });

    // ================================================================
    // Render filter kelas + daftar tugas
    // ================================================================
    function renderChipsAndList() {
      const chips = [{ id: "all", label: "Semua Kelas" }, ...myClasses];
      chipsEl.innerHTML = chips.map(c => `
        <button type="button" class="filter-chip ${c.id === activeClassFilter ? "active" : ""}" data-class="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>
      `).join("");
      chipsEl.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          activeClassFilter = btn.dataset.class;
          renderChipsAndList();
        });
      });
      renderList();
    }

    function renderList() {
      const items = activeClassFilter === "all"
        ? myTugas
        : myTugas.filter(t => t.classId === activeClassFilter);
      totalLabel.textContent = `${myTugas.length} tugas`;

      if (!items.length) {
        renderEmpty(listEl, "📚",
          myTugas.length
            ? "Tidak ada tugas untuk kelas ini."
            : "Anda belum membuat tugas. Ketuk \"Tambah Tugas\" untuk mulai.");
        return;
      }

      const now = Date.now();
      listEl.innerHTML = items.map(t => {
        const deadlineMs = t.deadline?.toDate?.().getTime();
        const overdue    = deadlineMs && deadlineMs <= now;
        return `
        <div class="qb-card">
          <div class="qb-badges">
            <span class="qb-badge">${escapeHtml(t.classLabel || t.classId || "—")}</span>
            ${t.subject ? `<span class="qb-badge">${escapeHtml(t.subject)}</span>` : ""}
            <span class="qb-badge ${overdue ? "diff-sulit" : "diff-mudah"}">${overdue ? "Lewat Deadline" : "Aktif"}</span>
          </div>
          <p class="qb-text">${escapeHtml(t.title)}</p>
          <ul class="qb-options">
            <li>⏰ Deadline: ${fmtDateTime(t.deadline)}</li>
            ${t.description ? `<li>${escapeHtml(t.description)}</li>` : ""}
          </ul>
          <div class="qb-card-actions" style="flex-wrap:wrap;">
            <button type="button" class="btn-secondary" data-action="submissions" data-id="${t.id}">📋 Pengumpulan & Nilai</button>
            <button type="button" class="btn-secondary" data-action="edit"        data-id="${t.id}">✏️ Edit</button>
            <button type="button" class="btn-danger"    data-action="delete"      data-id="${t.id}">🗑️ Hapus</button>
          </div>
        </div>`;
      }).join("");

      listEl.querySelectorAll('[data-action="submissions"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const t = myTugas.find(x => x.id === btn.dataset.id);
          if (t) openSubmissions(t);
        });
      });
      listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const t = myTugas.find(x => x.id === btn.dataset.id);
          if (t) openSheet(t);
        });
      });
      listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => openConfirm(btn.dataset.id));
      });
    }

    // ================================================================
    // Live query tugas milik guru
    // ================================================================
    renderSkeleton(listEl);
    onSnapshot(
      query(collection(db, "assignments"), where("teacherId", "==", user.uid)),
      (snap) => {
        myTugas = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        renderChipsAndList();
      },
      () => {
        totalLabel.textContent = "Gagal memuat";
        renderEmpty(listEl, "⚠️", "Gagal memuat daftar tugas. Periksa koneksi lalu muat ulang.");
      }
    );

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
