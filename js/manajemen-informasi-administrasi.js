// Khusus manajemen-informasi-administrasi.html (Portal Tata Usaha, halaman
// 26 — halaman TERAKHIR Portal TU). CRUD PENUH untuk tiga hal yang menjadi
// tanggung jawab TU sehari-hari (§20/§23 spek: "informasi administrasi,
// pengumuman, agenda, dokumen" — TIDAK termasuk berita/galeri/prestasi/
// profil sekolah/PPDB, yang tetap Admin-only lewat Manajemen Website (28),
// supaya TU tidak diberi "akses admin penuh" sesuai batasan §23):
//
//   1. Pengumuman (collection: announcements) — field SAMA PERSIS dengan
//      yang sudah dipakai pengumuman.html / pengumuman-siswa.html / semua
//      dashboard, supaya perubahan di sini langsung tampak di halaman-
//      halaman tersebut tanpa migrasi apa pun:
//        { title, category, detail, urgent, published,
//          createdBy, createdAt, updatedAt }
//
//   2. Agenda (collection: events) — SKEMA BARU yang pertama kali
//      didefinisikan di dashboard-tu.js (lihat komentar di sana). Halaman
//      publik agenda.html masih memakai data contoh statis (agenda-data.js)
//      sampai Admin memigrasikannya di fase Manajemen Website (28); di sini
//      TU sudah mengelola data ASLI-nya lebih dulu:
//        { title, category, date (Timestamp), location, description,
//          createdBy, createdAt, updatedAt }
//
//   3. Dokumen Administrasi (collection BARU: adminDocs) — supaya sistem
//      tetap Rp0 (§1 spek), dokumen dicatat sebagai judul + tautan
//      eksternal (mis. Google Drive yang sudah dibagikan) alih-alih unggah
//      berkas ke Firebase Storage, yang berarti tidak perlu storage.rules
//      atau kuota Storage sama sekali:
//        { title, category, description, link, createdBy, createdAt, updatedAt }
//      Hanya staf internal (guru/TU/admin/developer) yang bisa membaca
//      collection ini — lihat firestore.rules, tidak pernah terbuka publik.
//
// firestore.rules diperluas di fase ini: write untuk `announcements` &
// `events` sekarang juga mengizinkan hasRole('tu') (sebelumnya isManagement()
// saja), dan collection `adminDocs` ditambahkan dengan akses read isStaff()
// / write isManagement()||hasRole('tu'). Tidak ada collection lain yang
// dibuka lebih lebar — prinsip least privilege tetap dijaga.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, orderBy, onSnapshot,
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
        <div class="skeleton-box" style="width:80%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:50%;height:10px;"></div>
      </div>
    </div>`).join("");
}
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
function toDatetimeLocalValue(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function showFormError(boxEl, msg) {
  boxEl.querySelector("span:last-child").textContent = msg;
  boxEl.style.display = "flex";
}

export function initManajemenInformasiAdministrasi() {
  requireAuth(["tu"], (user) => {
    const totalLabel = document.getElementById("totalLabel");
    const addBtn = document.getElementById("addBtn");
    const confirmOverlay = document.getElementById("confirmOverlay");
    let pendingDelete = null; // { collectionName, id }

    // ---- Tab switching ----
    const tabs = ["pengumuman", "agenda", "dokumen"];
    let activeTab = "pengumuman";
    document.querySelectorAll("#tabChips .filter-chip").forEach(btn => {
      btn.addEventListener("click", () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll("#tabChips .filter-chip").forEach(b => {
          b.classList.toggle("active", b === btn);
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        tabs.forEach(t => { document.getElementById(`panel-${t}`).style.display = t === activeTab ? "" : "none"; });
      });
    });

    // ---- Sheet close buttons (generik untuk ketiga form) ----
    document.querySelectorAll(".sheet-close").forEach(btn => {
      btn.addEventListener("click", () => closeSheet(document.getElementById(btn.dataset.sheet)));
    });
    document.querySelectorAll(".sheet-overlay").forEach(overlay => {
      overlay.addEventListener("click", (ev) => { if (ev.target === overlay) closeSheet(overlay); });
    });
    function openSheet(overlay) { overlay.classList.add("open"); }
    function closeSheet(overlay) { overlay.classList.remove("open"); }

    // ---- FAB: buka form sesuai tab aktif ----
    addBtn.addEventListener("click", () => {
      if (activeTab === "pengumuman") openPengumumanForm(null);
      else if (activeTab === "agenda") openAgendaForm(null);
      else openDokumenForm(null);
    });

    // ---- Hapus (dipakai bersama ketiga jenis data) ----
    function openConfirm(collectionName, id) {
      pendingDelete = { collectionName, id };
      confirmOverlay.classList.add("open");
    }
    document.getElementById("confirmCancelBtn").addEventListener("click", () => {
      pendingDelete = null;
      confirmOverlay.classList.remove("open");
    });
    confirmOverlay.addEventListener("click", (ev) => {
      if (ev.target === confirmOverlay) { pendingDelete = null; confirmOverlay.classList.remove("open"); }
    });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDelete) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, pendingDelete.collectionName, pendingDelete.id));
        pendingDelete = null;
        confirmOverlay.classList.remove("open");
      } catch {
        // Kegagalan terlihat karena dialog tetap terbuka — pengguna bisa coba lagi.
      } finally {
        btn.disabled = false;
      }
    });

    let totals = { pengumuman: 0, agenda: 0, dokumen: 0 };
    function updateTotalLabel() {
      totalLabel.textContent = `${totals.pengumuman} pengumuman · ${totals.agenda} agenda · ${totals.dokumen} dokumen`;
    }

    // ======================================================================
    // 1) PENGUMUMAN
    // ======================================================================
    const pengumumanListEl = document.getElementById("pengumumanList");
    const sheetPengumuman = document.getElementById("sheetPengumuman");
    const formPengumuman = document.getElementById("formPengumuman");
    const errPengumuman = document.getElementById("errPengumuman");
    let editingPengumumanId = null;
    let allPengumuman = [];

    function openPengumumanForm(item) {
      formPengumuman.reset();
      errPengumuman.style.display = "none";
      editingPengumumanId = item?.id || null;
      document.getElementById("sheetPengumumanTitle").textContent = editingPengumumanId ? "Edit Pengumuman" : "Tambah Pengumuman";
      document.getElementById("pTitle").value = item?.title || "";
      document.getElementById("pCategory").value = item?.category || "";
      document.getElementById("pDetail").value = item?.detail || "";
      document.getElementById("pUrgent").checked = !!item?.urgent;
      document.getElementById("pPublished").checked = item ? item.published !== false : true;
      const cats = [...new Set(allPengumuman.map(p => p.category).filter(Boolean))].sort();
      document.getElementById("pengumumanCategorySuggestions").innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join("");
      openSheet(sheetPengumuman);
      document.getElementById("pTitle").focus();
    }

    formPengumuman.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errPengumuman.style.display = "none";
      const title = document.getElementById("pTitle").value.trim();
      if (!title) { showFormError(errPengumuman, "Judul wajib diisi."); return; }
      const payload = {
        title,
        category: document.getElementById("pCategory").value.trim(),
        detail: document.getElementById("pDetail").value.trim(),
        urgent: document.getElementById("pUrgent").checked,
        published: document.getElementById("pPublished").checked,
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      const btn = document.getElementById("submitPengumuman");
      btn.disabled = true;
      try {
        if (editingPengumumanId) {
          await updateDoc(doc(db, "announcements", editingPengumumanId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "announcements"), payload);
        }
        closeSheet(sheetPengumuman);
      } catch {
        showFormError(errPengumuman, "Gagal menyimpan pengumuman. Periksa koneksi lalu coba lagi.");
      } finally {
        btn.disabled = false;
      }
    });

    async function togglePublished(id, next) {
      try { await updateDoc(doc(db, "announcements", id), { published: next, updatedAt: serverTimestamp() }); } catch { /* badge tidak berubah jika gagal */ }
    }

    function renderPengumuman() {
      totals.pengumuman = allPengumuman.length;
      updateTotalLabel();
      if (!allPengumuman.length) {
        renderEmpty(pengumumanListEl, "📣", "Belum ada pengumuman. Ketuk \"Tambah\" untuk membuat yang pertama.");
        return;
      }
      pengumumanListEl.innerHTML = allPengumuman.map(p => `
        <div class="qb-card">
          <div class="qb-badges">
            ${p.category ? `<span class="qb-badge">${escapeHtml(p.category)}</span>` : ""}
            <span class="qb-badge ${p.urgent ? "diff-sulit" : ""}">${p.urgent ? "Penting" : "Biasa"}</span>
            <span class="qb-badge ${p.published !== false ? "diff-mudah" : ""}">${p.published !== false ? "Dipublikasikan" : "Draf"}</span>
          </div>
          <p class="qb-text">${escapeHtml(p.title)}</p>
          <ul class="qb-options"><li>📅 ${fmtDate(p.createdAt)}</li></ul>
          <div class="qb-card-actions" style="flex-wrap:wrap;">
            <button type="button" class="btn-secondary" data-act="edit" data-id="${p.id}">✏️ Edit</button>
            <button type="button" class="btn-secondary" data-act="toggle" data-id="${p.id}" data-next="${p.published === false}">${p.published !== false ? "🙈 Jadikan Draf" : "📢 Publikasikan"}</button>
            <button type="button" class="btn-danger" data-act="delete" data-id="${p.id}">🗑️ Hapus</button>
          </div>
        </div>`).join("");
      pengumumanListEl.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener("click", () => openPengumumanForm(allPengumuman.find(x => x.id === b.dataset.id))));
      pengumumanListEl.querySelectorAll('[data-act="toggle"]').forEach(b => b.addEventListener("click", () => togglePublished(b.dataset.id, b.dataset.next === "true")));
      pengumumanListEl.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener("click", () => openConfirm("announcements", b.dataset.id)));
    }

    renderSkeleton(pengumumanListEl);
    onSnapshot(query(collection(db, "announcements"), orderBy("createdAt", "desc")), (snap) => {
      allPengumuman = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderPengumuman();
    }, () => renderEmpty(pengumumanListEl, "⚠️", "Gagal memuat pengumuman. Periksa koneksi lalu muat ulang."));

    // ======================================================================
    // 2) AGENDA
    // ======================================================================
    const agendaListEl = document.getElementById("agendaList");
    const sheetAgenda = document.getElementById("sheetAgenda");
    const formAgenda = document.getElementById("formAgenda");
    const errAgenda = document.getElementById("errAgenda");
    let editingAgendaId = null;
    let allAgenda = [];

    function openAgendaForm(item) {
      formAgenda.reset();
      errAgenda.style.display = "none";
      editingAgendaId = item?.id || null;
      document.getElementById("sheetAgendaTitle").textContent = editingAgendaId ? "Edit Agenda" : "Tambah Agenda";
      document.getElementById("aTitle").value = item?.title || "";
      document.getElementById("aCategory").value = item?.category || "";
      document.getElementById("aDate").value = toDatetimeLocalValue(item?.date);
      document.getElementById("aLocation").value = item?.location || "";
      document.getElementById("aDesc").value = item?.description || "";
      const cats = [...new Set(allAgenda.map(a => a.category).filter(Boolean))].sort();
      document.getElementById("agendaCategorySuggestions").innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join("");
      openSheet(sheetAgenda);
      document.getElementById("aTitle").focus();
    }

    formAgenda.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errAgenda.style.display = "none";
      const title = document.getElementById("aTitle").value.trim();
      const dateVal = document.getElementById("aDate").value;
      if (!title) { showFormError(errAgenda, "Nama kegiatan wajib diisi."); return; }
      if (!dateVal) { showFormError(errAgenda, "Tanggal & waktu wajib diisi."); return; }
      const payload = {
        title,
        category: document.getElementById("aCategory").value.trim(),
        date: Timestamp.fromDate(new Date(dateVal)),
        location: document.getElementById("aLocation").value.trim(),
        description: document.getElementById("aDesc").value.trim(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      const btn = document.getElementById("submitAgenda");
      btn.disabled = true;
      try {
        if (editingAgendaId) {
          await updateDoc(doc(db, "events", editingAgendaId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "events"), payload);
        }
        closeSheet(sheetAgenda);
      } catch {
        showFormError(errAgenda, "Gagal menyimpan agenda. Periksa koneksi lalu coba lagi.");
      } finally {
        btn.disabled = false;
      }
    });

    function renderAgenda() {
      totals.agenda = allAgenda.length;
      updateTotalLabel();
      if (!allAgenda.length) {
        renderEmpty(agendaListEl, "📅", "Belum ada agenda. Ketuk \"Tambah\" untuk membuat yang pertama.");
        return;
      }
      const now = Date.now();
      agendaListEl.innerHTML = allAgenda.map(a => {
        const past = a.date?.toDate?.().getTime() < now;
        return `
        <div class="qb-card">
          <div class="qb-badges">
            ${a.category ? `<span class="qb-badge">${escapeHtml(a.category)}</span>` : ""}
            <span class="qb-badge ${past ? "diff-sulit" : "diff-mudah"}">${past ? "Sudah lewat" : "Mendatang"}</span>
          </div>
          <p class="qb-text">${escapeHtml(a.title)}</p>
          <ul class="qb-options">
            <li>🕒 ${fmtDateTime(a.date)}</li>
            ${a.location ? `<li>📍 ${escapeHtml(a.location)}</li>` : ""}
          </ul>
          <div class="qb-card-actions" style="flex-wrap:wrap;">
            <button type="button" class="btn-secondary" data-act="edit" data-id="${a.id}">✏️ Edit</button>
            <button type="button" class="btn-danger" data-act="delete" data-id="${a.id}">🗑️ Hapus</button>
          </div>
        </div>`;
      }).join("");
      agendaListEl.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener("click", () => openAgendaForm(allAgenda.find(x => x.id === b.dataset.id))));
      agendaListEl.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener("click", () => openConfirm("events", b.dataset.id)));
    }

    renderSkeleton(agendaListEl);
    onSnapshot(query(collection(db, "events"), orderBy("date", "asc")), (snap) => {
      allAgenda = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAgenda();
    }, () => renderEmpty(agendaListEl, "⚠️", "Gagal memuat agenda. Periksa koneksi lalu muat ulang."));

    // ======================================================================
    // 3) DOKUMEN ADMINISTRASI
    // ======================================================================
    const dokumenListEl = document.getElementById("dokumenList");
    const sheetDokumen = document.getElementById("sheetDokumen");
    const formDokumen = document.getElementById("formDokumen");
    const errDokumen = document.getElementById("errDokumen");
    let editingDokumenId = null;
    let allDokumen = [];

    function openDokumenForm(item) {
      formDokumen.reset();
      errDokumen.style.display = "none";
      editingDokumenId = item?.id || null;
      document.getElementById("sheetDokumenTitle").textContent = editingDokumenId ? "Edit Dokumen" : "Tambah Dokumen";
      document.getElementById("dTitle").value = item?.title || "";
      document.getElementById("dCategory").value = item?.category || "";
      document.getElementById("dLink").value = item?.link || "";
      document.getElementById("dDesc").value = item?.description || "";
      const cats = [...new Set(allDokumen.map(d => d.category).filter(Boolean))].sort();
      document.getElementById("dokumenCategorySuggestions").innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join("");
      openSheet(sheetDokumen);
      document.getElementById("dTitle").focus();
    }

    formDokumen.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errDokumen.style.display = "none";
      const title = document.getElementById("dTitle").value.trim();
      if (!title) { showFormError(errDokumen, "Judul dokumen wajib diisi."); return; }
      const link = document.getElementById("dLink").value.trim();
      if (link) {
        try { new URL(link); } catch { showFormError(errDokumen, "Tautan tidak valid. Gunakan format https://..."); return; }
      }
      const payload = {
        title,
        category: document.getElementById("dCategory").value.trim(),
        link,
        description: document.getElementById("dDesc").value.trim(),
        createdBy: user.uid,
        updatedAt: serverTimestamp(),
      };
      const btn = document.getElementById("submitDokumen");
      btn.disabled = true;
      try {
        if (editingDokumenId) {
          await updateDoc(doc(db, "adminDocs", editingDokumenId), payload);
        } else {
          payload.createdAt = serverTimestamp();
          await addDoc(collection(db, "adminDocs"), payload);
        }
        closeSheet(sheetDokumen);
      } catch {
        showFormError(errDokumen, "Gagal menyimpan dokumen. Periksa koneksi lalu coba lagi.");
      } finally {
        btn.disabled = false;
      }
    });

    function renderDokumen() {
      totals.dokumen = allDokumen.length;
      updateTotalLabel();
      if (!allDokumen.length) {
        renderEmpty(dokumenListEl, "🗄️", "Belum ada dokumen tercatat. Ketuk \"Tambah\" untuk mencatat yang pertama.");
        return;
      }
      dokumenListEl.innerHTML = allDokumen.map(d => `
        <div class="qb-card">
          <div class="qb-badges">
            ${d.category ? `<span class="qb-badge">${escapeHtml(d.category)}</span>` : ""}
          </div>
          <p class="qb-text">${escapeHtml(d.title)}</p>
          <ul class="qb-options">
            <li>📅 ${fmtDate(d.createdAt)}</li>
            ${d.link ? `<li>🔗 <a href="${escapeHtml(d.link)}" target="_blank" rel="noopener noreferrer">Buka tautan</a></li>` : ""}
          </ul>
          <div class="qb-card-actions" style="flex-wrap:wrap;">
            <button type="button" class="btn-secondary" data-act="edit" data-id="${d.id}">✏️ Edit</button>
            <button type="button" class="btn-danger" data-act="delete" data-id="${d.id}">🗑️ Hapus</button>
          </div>
        </div>`).join("");
      dokumenListEl.querySelectorAll('[data-act="edit"]').forEach(b => b.addEventListener("click", () => openDokumenForm(allDokumen.find(x => x.id === b.dataset.id))));
      dokumenListEl.querySelectorAll('[data-act="delete"]').forEach(b => b.addEventListener("click", () => openConfirm("adminDocs", b.dataset.id)));
    }

    renderSkeleton(dokumenListEl);
    onSnapshot(query(collection(db, "adminDocs"), orderBy("createdAt", "desc")), (snap) => {
      allDokumen = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderDokumen();
    }, () => renderEmpty(dokumenListEl, "⚠️", "Gagal memuat dokumen. Periksa koneksi lalu muat ulang."));

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
