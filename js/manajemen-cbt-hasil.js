// Khusus manajemen-cbt-hasil.html (Portal Guru, halaman 24 — halaman
// terakhir Portal Guru). CRUD PENUH untuk ujian CBT milik guru yang login,
// plus tampilan hasil & statistik per ujian — semuanya benar-benar
// tersambung ke Firestore, bukan tombol/data palsu.
//
// Skema (perluasan skema exams yang sudah ada sejak Dashboard Siswa/Guru):
//   exams/{id} : {
//     title, subject, classId, classLabel, teacherId,
//     durationMinutes, startTime (Timestamp), endTime (Timestamp),
//     active      : boolean — kontrol tampil/tidaknya ujian ke siswa,
//                    TERPISAH dari status waktu mulai/selesai (§27 spek:
//                    "menonaktifkan ujian" adalah aksi guru, bukan otomatis
//                    dari jadwal). Halaman siswa (dashboard-siswa.js,
//                    daftar-cbt.js) sudah diperbarui untuk menyaring
//                    active !== false di sisi client.
//     questionIds : [ID dokumen `questions` milik guru ini yang dipakai],
//     totalPoints : jumlah poin seluruh soal terpilih (dihitung ulang tiap
//                    simpan, bukan disinkronkan otomatis jika soal diedit
//                    setelahnya — guru perlu buka & simpan ulang ujian jika
//                    ingin memperbarui total poin setelah mengedit soal).
//     createdAt / updatedAt (Timestamp)
//   }
//
//   results/{id} — dibaca (read-only) di sini untuk statistik. Field
//   `teacherId` diasumsikan ada (denormalisasi dari exam) begitu Sistem CBT
//   sungguhan membuat dokumen ini nanti — lihat perketatan firestore.rules
//   di bagian bawah project ini. Sampai saat itu, koleksi ini akan tampil
//   sebagai empty state yang jujur (belum ada siswa mengerjakan).
//
// Query exams & questions HANYA satu filter kesetaraan tanpa orderBy —
// sama seperti kelas-jadwal.js & bank-soal.js — supaya tidak butuh
// composite index tambahan; pengurutan & filter kelas dilakukan di client.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp, Timestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

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

function fmtDateTime(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time} WIB`;
}

/** "2026-09-14T07:30" (format datetime-local) dari sebuah Timestamp, di zona waktu lokal perangkat. */
function toDatetimeLocalValue(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initManajemenCbt() {
  requireAuth(["guru"], (user) => {
    const listEl = document.getElementById("examList");
    const totalLabel = document.getElementById("totalLabel");
    const chipsEl = document.getElementById("classChips");

    const sheetOverlay = document.getElementById("sheetOverlay");
    const sheetTitle = document.getElementById("sheetTitle");
    const form = document.getElementById("examForm");
    const noClassNote = document.getElementById("noClassNote");
    const formErrorBox = document.getElementById("formError");
    const formErrorText = document.getElementById("formErrorText");
    const submitBtn = document.getElementById("submitBtn");
    const submitBtnText = document.getElementById("submitBtnText");
    const classSelect = document.getElementById("fClass");
    const subjectInput = document.getElementById("fSubject");
    const subjectSuggestions = document.getElementById("examSubjectSuggestions");
    const questionPicker = document.getElementById("questionPicker");
    const questionHint = document.getElementById("questionHint");

    const resultsOverlay = document.getElementById("resultsOverlay");
    const resultsTitle = document.getElementById("resultsTitle");
    const resultsStats = document.getElementById("resultsStats");
    const resultsList = document.getElementById("resultsList");
    let resultsUnsub = null;

    const confirmOverlay = document.getElementById("confirmOverlay");

    let myClasses = [];      // [{ id, label }]
    let myQuestions = [];    // dari bank soal guru sendiri
    let myExams = [];
    let activeClassFilter = "all";
    let editingId = null;
    let pendingDeleteId = null;

    // ---- Kelas yang diajar (dari schedules, sama seperti kelas-jadwal.js) ----
    onSnapshot(query(collection(db, "schedules"), where("teacherId", "==", user.uid)), (snap) => {
      const seen = new Map();
      snap.docs.forEach(d => {
        const s = d.data();
        const key = s.classId || s.classLabel;
        if (key && !seen.has(key)) seen.set(key, s.classLabel || s.classId);
      });
      myClasses = [...seen.entries()].map(([id, label]) => ({ id, label }));
      classSelect.innerHTML = myClasses.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join("");
      noClassNote.style.display = myClasses.length ? "none" : "flex";
      submitBtn.disabled = !myClasses.length;
      renderChipsAndList();
    });

    // ---- Bank soal guru sendiri (untuk pemilih soal & saran mapel) ----
    onSnapshot(query(collection(db, "questions"), where("createdBy", "==", user.uid)), (snap) => {
      myQuestions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const subjects = [...new Set(myQuestions.map(q => q.subject).filter(Boolean))].sort();
      subjectSuggestions.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">`).join("");
      renderQuestionPicker();
    });

    function renderQuestionPicker(checkedIds = null) {
      const currentlyChecked = checkedIds || [...questionPicker.querySelectorAll("input:checked")].map(i => i.value);
      if (!myQuestions.length) {
        questionHint.textContent = "Anda belum punya soal di Bank Soal. Tambahkan soal dulu di halaman Bank Soal.";
        questionPicker.innerHTML = "";
        return;
      }
      const filterSubject = subjectInput.value.trim().toLowerCase();
      const shown = filterSubject
        ? myQuestions.filter(q => (q.subject || "").toLowerCase().includes(filterSubject))
        : myQuestions;

      questionHint.textContent = `${currentlyChecked.length} soal terpilih dari ${shown.length} soal ditampilkan (${myQuestions.length} total di Bank Soal).`;

      if (!shown.length) {
        questionPicker.innerHTML = `<p style="font-size:11.5px;color:var(--text-soft);padding:8px 0;">Tidak ada soal dengan mata pelajaran ini. Kosongkan mata pelajaran untuk melihat semua soal.</p>`;
        return;
      }
      questionPicker.innerHTML = shown.map(q => `
        <label style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;">
          <input type="checkbox" value="${q.id}" class="option-mark" style="margin-top:3px;" ${currentlyChecked.includes(q.id) ? "checked" : ""}>
          <span style="font-size:12.5px;line-height:1.5;">${escapeHtml((q.text || "").slice(0, 90))}${(q.text || "").length > 90 ? "…" : ""}
            <br><span style="color:var(--text-soft);font-size:11px;">${escapeHtml(q.subject || "—")} · ${q.points ?? 10} poin</span>
          </span>
        </label>`).join("");
      questionPicker.querySelectorAll("input").forEach(inp => {
        inp.addEventListener("change", () => {
          const n = questionPicker.querySelectorAll("input:checked").length;
          questionHint.textContent = `${n} soal terpilih dari ${shown.length} soal ditampilkan (${myQuestions.length} total di Bank Soal).`;
        });
      });
    }
    subjectInput.addEventListener("input", () => renderQuestionPicker());

    // ---- Sheet buat/edit ujian ----
    function openSheet(exam = null) {
      form.reset();
      formErrorBox.style.display = "none";
      editingId = exam?.id || null;
      sheetTitle.textContent = editingId ? "Edit Ujian" : "Buat Ujian";
      submitBtnText.textContent = editingId ? "Simpan Perubahan" : "Simpan Ujian";

      document.getElementById("fTitle").value = exam?.title || "";
      subjectInput.value = exam?.subject || "";
      classSelect.value = exam?.classId || "";
      document.getElementById("fDuration").value = exam?.durationMinutes || 60;
      document.getElementById("fStart").value = toDatetimeLocalValue(exam?.startTime);
      document.getElementById("fEnd").value = toDatetimeLocalValue(exam?.endTime);
      document.getElementById("fActive").checked = exam ? exam.active !== false : true;

      renderQuestionPicker(exam?.questionIds || []);
      sheetOverlay.classList.add("open");
      document.getElementById("fTitle").focus();
    }
    function closeSheet() {
      sheetOverlay.classList.remove("open");
      editingId = null;
    }
    document.getElementById("addBtn").addEventListener("click", () => openSheet(null));
    document.getElementById("sheetCloseBtn").addEventListener("click", closeSheet);
    sheetOverlay.addEventListener("click", (ev) => { if (ev.target === sheetOverlay) closeSheet(); });

    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      formErrorBox.style.display = "none";

      const title = document.getElementById("fTitle").value.trim();
      const subject = subjectInput.value.trim();
      const classId = classSelect.value;
      const classLabel = myClasses.find(c => c.id === classId)?.label || classId;
      const durationMinutes = Number(document.getElementById("fDuration").value);
      const startVal = document.getElementById("fStart").value;
      const endVal = document.getElementById("fEnd").value;
      const active = document.getElementById("fActive").checked;
      const questionIds = [...questionPicker.querySelectorAll("input:checked")].map(i => i.value);

      if (!title || !subject || !classId) {
        formErrorText.textContent = "Judul, mata pelajaran, dan kelas wajib diisi.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (!startVal || !endVal) {
        formErrorText.textContent = "Waktu mulai dan waktu selesai wajib diisi.";
        formErrorBox.style.display = "flex";
        return;
      }
      const startDate = new Date(startVal);
      const endDate = new Date(endVal);
      if (endDate <= startDate) {
        formErrorText.textContent = "Waktu selesai harus setelah waktu mulai.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
        formErrorText.textContent = "Durasi minimal 5 menit.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (!questionIds.length) {
        formErrorText.textContent = "Pilih minimal 1 soal dari Bank Soal untuk ujian ini.";
        formErrorBox.style.display = "flex";
        return;
      }

      const totalPoints = questionIds.reduce((sum, id) => {
        const q = myQuestions.find(x => x.id === id);
        return sum + (q?.points || 0);
      }, 0);

      const payload = {
        title, subject, classId, classLabel, teacherId: user.uid,
        durationMinutes, active, questionIds, totalPoints,
        startTime: Timestamp.fromDate(startDate),
        endTime: Timestamp.fromDate(endDate),
        updatedAt: serverTimestamp(),
      };

      submitBtn.disabled = true;
      try {
        if (editingId) {
          await updateDoc(doc(db, "exams", editingId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "exams"), payload);
        }
        closeSheet();
      } catch (err) {
        formErrorText.textContent = "Gagal menyimpan ujian. Periksa koneksi lalu coba lagi.";
        formErrorBox.style.display = "flex";
      } finally {
        submitBtn.disabled = false;
      }
    });

    // ---- Aktifkan/nonaktifkan ujian (tanpa membuka sheet) ----
    async function toggleActive(examId, nextActive) {
      try {
        await updateDoc(doc(db, "exams", examId), { active: nextActive, updatedAt: serverTimestamp() });
      } catch {
        // Kegagalan akan terlihat karena badge tidak berubah (data live dari onSnapshot) — cukup diam-diam gagal tanpa menyesatkan UI.
      }
    }

    // ---- Hapus ujian ----
    function openConfirm(id) { pendingDeleteId = id; confirmOverlay.classList.add("open"); }
    function closeConfirm() { confirmOverlay.classList.remove("open"); pendingDeleteId = null; }
    document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
    confirmOverlay.addEventListener("click", (ev) => { if (ev.target === confirmOverlay) closeConfirm(); });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, "exams", pendingDeleteId));
        closeConfirm();
      } catch {
        btn.disabled = false;
      }
    });

    // ---- Hasil & statistik ujian (read-only) ----
    function openResults(exam) {
      resultsTitle.textContent = `Hasil — ${exam.title}`;
      resultsStats.innerHTML = "";
      renderSkeleton(resultsList, 2);
      resultsOverlay.classList.add("open");

      if (resultsUnsub) resultsUnsub();
      resultsUnsub = onSnapshot(query(collection(db, "results"), where("examId", "==", exam.id)), (snap) => {
        const results = snap.docs.map(d => d.data());
        if (!results.length) {
          resultsStats.innerHTML = `<span class="qb-badge">0 peserta</span>`;
          renderEmpty(resultsList, "📊", "Belum ada siswa yang mengerjakan ujian ini.");
          return;
        }
        const scores = results.map(r => r.score || 0);
        const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        const max = Math.max(...scores);
        const min = Math.min(...scores);
        resultsStats.innerHTML = `
          <span class="qb-badge">${results.length} peserta</span>
          <span class="qb-badge">Rata-rata ${avg}</span>
          <span class="qb-badge">Tertinggi ${max}</span>
          <span class="qb-badge">Terendah ${min}</span>`;
        resultsList.innerHTML = results
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .map(r => `
          <div class="list-row">
            <div class="list-row-icon" aria-hidden="true">👤</div>
            <div class="list-row-body">
              <h4>${escapeHtml(r.studentName || "Siswa")}</h4>
              <p>✅ ${r.correct ?? "—"} benar · ❌ ${r.wrong ?? "—"} salah · ${fmtDateTime(r.createdAt)}</p>
            </div>
            <span class="list-row-score">${r.score ?? "—"}</span>
          </div>`).join("");
      }, () => {
        resultsStats.innerHTML = "";
        renderEmpty(resultsList, "⚠️", "Gagal memuat hasil. Periksa koneksi lalu muat ulang.");
      });
    }
    document.getElementById("resultsCloseBtn").addEventListener("click", () => {
      resultsOverlay.classList.remove("open");
      if (resultsUnsub) { resultsUnsub(); resultsUnsub = null; }
    });
    resultsOverlay.addEventListener("click", (ev) => {
      if (ev.target === resultsOverlay) {
        resultsOverlay.classList.remove("open");
        if (resultsUnsub) { resultsUnsub(); resultsUnsub = null; }
      }
    });

    // ---- Render filter kelas + daftar ujian ----
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
      let items = activeClassFilter === "all" ? myExams : myExams.filter(e => e.classId === activeClassFilter);
      totalLabel.textContent = `${myExams.length} ujian`;

      if (!items.length) {
        renderEmpty(listEl, "📝",
          myExams.length ? "Tidak ada ujian untuk kelas ini." : "Anda belum membuat ujian. Ketuk \"Buat Ujian\" untuk mulai.");
        return;
      }

      const now = Date.now();
      listEl.innerHTML = items.map(e => {
        const start = e.startTime?.toDate?.().getTime();
        const end = e.endTime?.toDate?.().getTime();
        let timeStatus = "Terjadwal";
        if (end && end <= now) timeStatus = "Selesai";
        else if (start && start <= now) timeStatus = "Berlangsung";
        const isActive = e.active !== false;

        return `
        <div class="qb-card">
          <div class="qb-badges">
            <span class="qb-badge">${escapeHtml(e.classLabel || e.classId || "—")}</span>
            <span class="qb-badge">${escapeHtml(e.subject || "—")}</span>
            <span class="qb-badge ${timeStatus === "Berlangsung" ? "diff-mudah" : ""}">${timeStatus}</span>
            <span class="qb-badge ${isActive ? "" : "diff-sulit"}">${isActive ? "Aktif" : "Nonaktif"}</span>
          </div>
          <p class="qb-text">${escapeHtml(e.title)}</p>
          <ul class="qb-options">
            <li>🕒 ${fmtDateTime(e.startTime)} – ${fmtDateTime(e.endTime)}</li>
            <li>⏱️ ${e.durationMinutes || "—"} menit · 🗂️ ${(e.questionIds || []).length} soal · ⭐ ${e.totalPoints ?? "—"} poin</li>
          </ul>
          <div class="qb-card-actions" style="flex-wrap:wrap;">
            <button type="button" class="btn-secondary" data-action="edit" data-id="${e.id}">✏️ Edit</button>
            <button type="button" class="btn-secondary" data-action="toggle" data-id="${e.id}" data-next="${!isActive}">${isActive ? "⏸️ Nonaktifkan" : "▶️ Aktifkan"}</button>
            <button type="button" class="btn-secondary" data-action="results" data-id="${e.id}">📊 Hasil</button>
            <button type="button" class="btn-danger" data-action="delete" data-id="${e.id}">🗑️ Hapus</button>
          </div>
        </div>`;
      }).join("");

      listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const e = myExams.find(x => x.id === btn.dataset.id);
          if (e) openSheet(e);
        });
      });
      listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
        btn.addEventListener("click", () => toggleActive(btn.dataset.id, btn.dataset.next === "true"));
      });
      listEl.querySelectorAll('[data-action="results"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const e = myExams.find(x => x.id === btn.dataset.id);
          if (e) openResults(e);
        });
      });
      listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => openConfirm(btn.dataset.id));
      });
    }

    // ---- Live query ujian milik guru (satu filter kesetaraan, tanpa
    // orderBy, supaya tidak butuh composite index tambahan — urutan
    // terbaru dulu dihitung di client) ----
    renderSkeleton(listEl);
    onSnapshot(query(collection(db, "exams"), where("teacherId", "==", user.uid)), (snap) => {
      myExams = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderChipsAndList();
    }, () => {
      totalLabel.textContent = "Gagal memuat";
      renderEmpty(listEl, "⚠️", "Gagal memuat daftar ujian. Periksa koneksi lalu muat ulang.");
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
