// Khusus bank-soal.html (Portal Guru, halaman 23). CRUD PENUH untuk soal
// pilihan ganda milik guru yang login — tambah, edit, hapus, semuanya
// benar-benar tersimpan/terhapus di Firestore (bukan tombol palsu).
//
// Skema: questions/{id} : {
//   createdBy   : uid guru pembuat (dipakai untuk isolasi data & query)
//   subject     : string, mis. "Matematika"
//   category    : string opsional, mis. "Aljabar"
//   difficulty  : "mudah" | "sedang" | "sulit"
//   points      : number
//   text        : string pertanyaan
//   options     : [{ label:"A", text:"..." }, ...]
//   correct     : ["A"] atau ["A","C"] (sesuai `multiple`)
//   multiple    : boolean — true jika jawaban benar lebih dari satu
//   explanation : string opsional, pembahasan
//   createdAt / updatedAt : Timestamp (serverTimestamp)
// }
//
// Query hanya SATU filter kesetaraan (createdBy) tanpa orderBy, supaya
// tidak butuh composite index tambahan — pengurutan (terbaru dulu),
// pencarian teks, dan filter mata pelajaran semuanya di sisi client, sama
// seperti pola di kelas-jadwal.js.
//
// §31 spek (keamanan CBT) hanya melarang jawaban benar bocor ke SISWA saat
// ujian berlangsung — itu ditegakkan oleh firestore.rules (`questions`
// staff-only) di halaman pengerjaan CBT nanti. Di halaman milik guru sendiri
// ini, guru memang PERLU melihat & mengatur jawaban benar miliknya sendiri.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot,
  addDoc, updateDoc, deleteDoc, doc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const OPTION_LABELS = ["A", "B", "C", "D"];
const DIFF_TEXT = { mudah: "Mudah", sedang: "Sedang", sulit: "Sulit" };

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

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

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

export function initBankSoal() {
  requireAuth(["guru"], (user) => {
    const listEl = document.getElementById("qbList");
    const totalLabel = document.getElementById("totalLabel");
    const searchInput = document.getElementById("qbSearch");
    const chipsEl = document.getElementById("subjectChips");
    const subjectSuggestions = document.getElementById("subjectSuggestions");

    const sheetOverlay = document.getElementById("sheetOverlay");
    const sheetTitle = document.getElementById("sheetTitle");
    const form = document.getElementById("qbForm");
    const optionRowsEl = document.getElementById("optionRows");
    const multipleCheckbox = document.getElementById("fMultiple");
    const optionHint = document.getElementById("optionHint");
    const formErrorBox = document.getElementById("formError");
    const formErrorText = document.getElementById("formErrorText");
    const submitBtn = document.getElementById("submitBtn");
    const submitBtnText = document.getElementById("submitBtnText");

    const confirmOverlay = document.getElementById("confirmOverlay");

    let allQuestions = [];
    let activeSubject = "all";
    let searchTerm = "";
    let editingId = null;
    let pendingDeleteId = null;

    // ---- Bangun 4 baris input opsi (A–D) ----
    function buildOptionRows(values = {}) {
      optionRowsEl.innerHTML = OPTION_LABELS.map(label => `
        <div class="option-input-row">
          <input type="${multipleCheckbox.checked ? "checkbox" : "radio"}" name="correctOption" class="option-mark"
                 value="${label}" id="opt${label}" aria-label="Tandai ${label} sebagai jawaban benar">
          <div class="form-input-wrap">
            <span aria-hidden="true">${label}</span>
            <input type="text" id="optText${label}" placeholder="Teks pilihan ${label}" value="${escapeHtml(values[label] || "")}">
          </div>
        </div>`).join("");
    }
    buildOptionRows();

    multipleCheckbox.addEventListener("change", () => {
      const marked = OPTION_LABELS.filter(l => document.getElementById(`opt${l}`)?.checked);
      const values = {};
      OPTION_LABELS.forEach(l => { values[l] = document.getElementById(`optText${l}`)?.value || ""; });
      buildOptionRows(values);
      marked.forEach(l => { const el = document.getElementById(`opt${l}`); if (el) el.checked = true; });
      optionHint.textContent = multipleCheckbox.checked
        ? "Centang satu atau lebih kotak di samping pilihan yang benar."
        : "Tandai satu lingkaran di samping pilihan yang benar.";
    });

    // ---- Sheet open/close ----
    function openSheet(question = null) {
      form.reset();
      formErrorBox.style.display = "none";
      editingId = question?.id || null;
      sheetTitle.textContent = editingId ? "Edit Soal" : "Tambah Soal";
      submitBtnText.textContent = editingId ? "Simpan Perubahan" : "Simpan Soal";

      document.getElementById("fSubject").value = question?.subject || "";
      document.getElementById("fCategory").value = question?.category || "";
      document.getElementById("fDifficulty").value = question?.difficulty || "sedang";
      document.getElementById("fPoints").value = question?.points || 10;
      document.getElementById("fText").value = question?.text || "";
      document.getElementById("fExplanation").value = question?.explanation || "";
      multipleCheckbox.checked = !!question?.multiple;

      const values = {};
      (question?.options || []).forEach(o => { values[o.label] = o.text; });
      buildOptionRows(values);
      optionHint.textContent = multipleCheckbox.checked
        ? "Centang satu atau lebih kotak di samping pilihan yang benar."
        : "Tandai satu lingkaran di samping pilihan yang benar.";
      (question?.correct || []).forEach(l => { const el = document.getElementById(`opt${l}`); if (el) el.checked = true; });

      sheetOverlay.classList.add("open");
      document.getElementById("fSubject").focus();
    }
    function closeSheet() {
      sheetOverlay.classList.remove("open");
      editingId = null;
    }
    document.getElementById("addBtn").addEventListener("click", () => openSheet(null));
    document.getElementById("sheetCloseBtn").addEventListener("click", closeSheet);
    sheetOverlay.addEventListener("click", (ev) => { if (ev.target === sheetOverlay) closeSheet(); });

    // ---- Submit form (create/update) ----
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      formErrorBox.style.display = "none";

      const subject = document.getElementById("fSubject").value.trim();
      const category = document.getElementById("fCategory").value.trim();
      const difficulty = document.getElementById("fDifficulty").value;
      const points = Number(document.getElementById("fPoints").value);
      const text = document.getElementById("fText").value.trim();
      const explanation = document.getElementById("fExplanation").value.trim();

      const options = OPTION_LABELS
        .map(label => ({ label, text: document.getElementById(`optText${label}`).value.trim() }))
        .filter(o => o.text);
      const correct = OPTION_LABELS.filter(l => document.getElementById(`opt${l}`)?.checked);

      if (!subject || !text) {
        formErrorText.textContent = "Mata pelajaran dan teks pertanyaan wajib diisi.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (options.length < 2) {
        formErrorText.textContent = "Isi minimal 2 pilihan jawaban.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (!correct.length) {
        formErrorText.textContent = "Tandai minimal satu pilihan sebagai jawaban benar.";
        formErrorBox.style.display = "flex";
        return;
      }
      if (!Number.isFinite(points) || points < 1) {
        formErrorText.textContent = "Poin harus berupa angka lebih besar dari 0.";
        formErrorBox.style.display = "flex";
        return;
      }

      const payload = {
        subject, category, difficulty, points, text, explanation,
        options, correct, multiple: multipleCheckbox.checked,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      };

      submitBtn.disabled = true;
      try {
        if (editingId) {
          await updateDoc(doc(db, "questions", editingId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "questions"), payload);
        }
        closeSheet();
      } catch (err) {
        formErrorText.textContent = "Gagal menyimpan soal. Periksa koneksi lalu coba lagi.";
        formErrorBox.style.display = "flex";
      } finally {
        submitBtn.disabled = false;
      }
    });

    // ---- Hapus soal (dengan dialog konfirmasi, bukan window.confirm) ----
    function openConfirm(id) {
      pendingDeleteId = id;
      confirmOverlay.classList.add("open");
    }
    function closeConfirm() {
      confirmOverlay.classList.remove("open");
      pendingDeleteId = null;
    }
    document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
    confirmOverlay.addEventListener("click", (ev) => { if (ev.target === confirmOverlay) closeConfirm(); });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDeleteId) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, "questions", pendingDeleteId));
        closeConfirm();
      } catch {
        btn.disabled = false;
        showComingSoonToast("Gagal menghapus soal. Periksa koneksi lalu coba lagi.");
      }
    });

    // ---- Render daftar (search + filter mata pelajaran, semua di client) ----
    function renderChips() {
      const subjects = [...new Set(allQuestions.map(q => q.subject).filter(Boolean))].sort();
      subjectSuggestions.innerHTML = subjects.map(s => `<option value="${escapeHtml(s)}">`).join("");

      const chips = [{ id: "all", label: "Semua" }, ...subjects.map(s => ({ id: s, label: s }))];
      chipsEl.innerHTML = chips.map(c => `
        <button type="button" class="filter-chip ${c.id === activeSubject ? "active" : ""}" data-subject="${escapeHtml(c.id)}">${escapeHtml(c.label)}</button>
      `).join("");
      chipsEl.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          activeSubject = btn.dataset.subject;
          renderChips();
          renderList();
        });
      });
    }

    function renderList() {
      let items = allQuestions;
      if (activeSubject !== "all") items = items.filter(q => q.subject === activeSubject);
      if (searchTerm) items = items.filter(q => (q.text || "").toLowerCase().includes(searchTerm));

      totalLabel.textContent = `${allQuestions.length} soal`;

      if (!items.length) {
        renderEmpty(listEl, "🗂️",
          allQuestions.length ? "Tidak ada soal yang cocok dengan pencarian/filter." : "Anda belum menambahkan soal. Ketuk \"Tambah Soal\" untuk mulai.");
        return;
      }

      listEl.innerHTML = items.map(q => `
        <div class="qb-card">
          <div class="qb-card-head">
            <div class="qb-badges">
              <span class="qb-badge">${escapeHtml(q.subject || "—")}</span>
              ${q.category ? `<span class="qb-badge">${escapeHtml(q.category)}</span>` : ""}
              <span class="qb-badge diff-${q.difficulty || "sedang"}">${DIFF_TEXT[q.difficulty] || "Sedang"}</span>
              <span class="qb-badge">${q.points ?? 10} poin</span>
            </div>
          </div>
          <p class="qb-text">${escapeHtml(q.text)}</p>
          <ul class="qb-options">
            ${(q.options || []).map(o => `<li class="${(q.correct || []).includes(o.label) ? "correct" : ""}"><strong>${o.label}.</strong> ${escapeHtml(o.text)}</li>`).join("")}
          </ul>
          <div class="qb-card-actions">
            <button type="button" class="btn-secondary" data-action="edit" data-id="${q.id}">✏️ Edit</button>
            <button type="button" class="btn-danger" data-action="delete" data-id="${q.id}">🗑️ Hapus</button>
          </div>
        </div>`).join("");

      listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const q = allQuestions.find(x => x.id === btn.dataset.id);
          if (q) openSheet(q);
        });
      });
      listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => openConfirm(btn.dataset.id));
      });
    }

    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderList();
    });

    // ---- Live query Firestore ----
    renderSkeleton(listEl);
    const qMine = query(collection(db, "questions"), where("createdBy", "==", user.uid));
    onSnapshot(qMine, (snap) => {
      allQuestions = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      renderChips();
      renderList();
    }, () => {
      totalLabel.textContent = "Gagal memuat";
      renderEmpty(listEl, "⚠️", "Gagal memuat bank soal. Periksa koneksi lalu muat ulang.");
    });

    guardLinksTo("manajemen-cbt-hasil.html", "Halaman Manajemen CBT & Hasil sedang dibangun pada fase Portal Guru berikutnya.");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
