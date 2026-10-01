// Khusus manajemen-website.html (Portal Admin & Developer, halaman 28).
// Admin/developer mengelola SELURUH konten website publik dari satu halaman:
// 5 daftar dengan CRUD penuh (berita/news, galeri/gallery, prestasi/
// achievements, pengumuman/announcements, agenda/events) + 2 dokumen tunggal
// (profil sekolah & akademik -> schoolProfile/main, PPDB -> ppdb/main).
//
// Semuanya BENAR-BENAR tersimpan/terhapus di Firestore, bukan tombol palsu
// (§25 spek). firestore.rules sudah mengizinkan admin/developer (isManagement())
// menulis kelima collection ini sejak fase Authentication; hanya `ppdb` yang
// perlu ditambahkan sebagai collection baru (lihat firestore.rules di root).
//
// Pola CRUD (sheet + dialog konfirmasi + query tanpa where/orderBy lalu
// diurutkan di client) disalin persis dari js/bank-soal.js supaya konsisten
// dengan Portal Guru. Perbedaannya: di sini admin BOLEH melihat & mengubah
// SEMUA dokumen (bukan hanya miliknya sendiri), karena firestore.rules
// mengizinkan isManagement() penuh atas kelima collection ini.
//
// Halaman publik (berita.html, galeri.html, dst.) MASIH memakai data contoh
// di js/*-data.js — migrasi supaya halaman publik membaca langsung dari
// Firestore adalah fase terpisah berikutnya (dicatat jujur di README, bukan
// diam-diam dianggap selesai di sini).

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc,
  getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// ---- Konfigurasi tiap tab daftar (berita/galeri/prestasi/pengumuman/agenda) ----
// collection   : nama collection Firestore
// listEl/tab   : id elemen DOM
// sheet        : id sheet-overlay
// fields       : { firestoreField: { el: idInputDom, type: "text"|"lines"|"checkbox"|"photos" } }
// title(doc)   : judul kartu di daftar
// badges(doc)  : array string badge kartu
// desc(doc)    : teks ringkas kartu
// emptyIcon/emptyText

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function linesToArray(text) {
  return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean);
}

function parseLabelColon(text) {
  // "Label: Isi" per baris -> [{label, value}]
  return linesToArray(text).map(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return { label: line, value: "" };
    return { label: line.slice(0, idx).trim(), value: line.slice(idx + 1).trim() };
  });
}

function parseTitleDesc(text) {
  // "Judul: Deskripsi" per baris -> [{title, desc}]
  return linesToArray(text).map(line => {
    const idx = line.indexOf(":");
    if (idx === -1) return { title: line, desc: "" };
    return { title: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() };
  });
}

function parseFaq(text) {
  // "Pertanyaan :: Jawaban" per baris -> [{q, a}]
  return linesToArray(text).map(line => {
    const idx = line.indexOf("::");
    if (idx === -1) return { q: line, a: "" };
    return { q: line.slice(0, idx).trim(), a: line.slice(idx + 2).trim() };
  });
}

function parsePhotos(text) {
  // "emoji | keterangan | URL (opsional)" per baris -> [{emoji, caption, url}]
  return linesToArray(text).map(line => {
    const parts = line.split("|").map(s => s.trim());
    return { emoji: parts[0] || "🖼️", caption: parts[1] || "", url: parts[2] || "" };
  });
}

function arrToLines(arr, fmt) {
  return (arr || []).map(fmt).join("\n");
}

const LIST_CONFIGS = [
  {
    key: "berita", collection: "news", listEl: "beritaList", sheet: "sheetBerita",
    err: "errBerita", form: "formBerita", submitBtn: "submitBerita", titleEl: "sheetBeritaTitle",
    emptyIcon: "📰", emptyText: "Belum ada berita. Ketuk \"Tambah\" untuk membuat berita pertama.",
    categorySuggestions: "beritaCategorySuggestions",
    load(doc) {
      document.getElementById("nTitle").value = doc?.title || "";
      document.getElementById("nCategory").value = doc?.category || "";
      document.getElementById("nIcon").value = doc?.icon || "";
      document.getElementById("nExcerpt").value = doc?.excerpt || "";
      document.getElementById("nContent").value = arrToLines(doc?.content, p => p);
      document.getElementById("nPublished").checked = doc ? !!doc.published : true;
    },
    read() {
      const title = document.getElementById("nTitle").value.trim();
      const content = linesToArray(document.getElementById("nContent").value);
      if (!title) return { error: "Judul wajib diisi." };
      if (!content.length) return { error: "Isi berita wajib diisi (minimal 1 paragraf)." };
      return {
        payload: {
          title,
          category: document.getElementById("nCategory").value.trim(),
          icon: document.getElementById("nIcon").value.trim() || "📰",
          excerpt: document.getElementById("nExcerpt").value.trim(),
          content,
          published: document.getElementById("nPublished").checked,
        },
      };
    },
    cardTitle: d => d.title || "(tanpa judul)",
    cardBadges: d => [d.category, d.published ? null : "Draf"].filter(Boolean),
    cardDesc: d => d.excerpt || (d.content || [])[0] || "",
  },
  {
    key: "galeri", collection: "gallery", listEl: "galeriList", sheet: "sheetGaleri",
    err: "errGaleri", form: "formGaleri", submitBtn: "submitGaleri", titleEl: "sheetGaleriTitle",
    emptyIcon: "🖼️", emptyText: "Belum ada album. Ketuk \"Tambah\" untuk membuat album pertama.",
    categorySuggestions: "galeriCategorySuggestions",
    load(doc) {
      document.getElementById("gAlbum").value = doc?.album || "";
      document.getElementById("gCategory").value = doc?.category || "";
      document.getElementById("gPhotos").value = arrToLines(doc?.photos, p => `${p.emoji || ""} | ${p.caption || ""} | ${p.url || ""}`);
    },
    read() {
      const album = document.getElementById("gAlbum").value.trim();
      const photos = parsePhotos(document.getElementById("gPhotos").value);
      if (!album) return { error: "Nama album wajib diisi." };
      if (!photos.length) return { error: "Isi minimal 1 foto." };
      return {
        payload: { album, category: document.getElementById("gCategory").value.trim(), photos },
      };
    },
    cardTitle: d => d.album || "(tanpa nama)",
    cardBadges: d => [d.category, `${(d.photos || []).length} foto`].filter(Boolean),
    cardDesc: d => (d.photos || []).slice(0, 3).map(p => p.caption).filter(Boolean).join(" • "),
  },
  {
    key: "prestasi", collection: "achievements", listEl: "prestasiList", sheet: "sheetPrestasi",
    err: "errPrestasi", form: "formPrestasi", submitBtn: "submitPrestasi", titleEl: "sheetPrestasiTitle",
    emptyIcon: "🏆", emptyText: "Belum ada prestasi. Ketuk \"Tambah\" untuk menambahkan prestasi pertama.",
    load(doc) {
      document.getElementById("prTitle").value = doc?.title || "";
      document.getElementById("prLevel").value = doc?.level || "";
      document.getElementById("prMedal").value = doc?.medal || "";
      document.getElementById("prYear").value = doc?.year || "";
      document.getElementById("prTeam").value = doc?.team || "";
      document.getElementById("prDesc").value = doc?.description || "";
    },
    read() {
      const title = document.getElementById("prTitle").value.trim();
      if (!title) return { error: "Nama prestasi wajib diisi." };
      return {
        payload: {
          title,
          level: document.getElementById("prLevel").value.trim(),
          medal: document.getElementById("prMedal").value.trim() || "🏅",
          year: document.getElementById("prYear").value.trim(),
          team: document.getElementById("prTeam").value.trim(),
          description: document.getElementById("prDesc").value.trim(),
        },
      };
    },
    cardTitle: d => d.title || "(tanpa nama)",
    cardBadges: d => [d.level, d.year].filter(Boolean),
    cardDesc: d => d.team || d.description || "",
  },
  {
    key: "pengumuman", collection: "announcements", listEl: "pengumumanList", sheet: "sheetPengumuman",
    err: "errPengumuman", form: "formPengumuman", submitBtn: "submitPengumuman", titleEl: "sheetPengumumanTitle",
    emptyIcon: "📣", emptyText: "Belum ada pengumuman. Ketuk \"Tambah\" untuk membuat pengumuman pertama.",
    categorySuggestions: "pengumumanCategorySuggestions",
    load(doc) {
      document.getElementById("pmTitle").value = doc?.title || "";
      document.getElementById("pmCategory").value = doc?.category || "";
      document.getElementById("pmDetail").value = doc?.detail || "";
      document.getElementById("pmUrgent").checked = !!doc?.urgent;
      document.getElementById("pmPublished").checked = doc ? !!doc.published : true;
    },
    read() {
      const title = document.getElementById("pmTitle").value.trim();
      if (!title) return { error: "Judul wajib diisi." };
      return {
        payload: {
          title,
          category: document.getElementById("pmCategory").value.trim(),
          detail: document.getElementById("pmDetail").value.trim(),
          urgent: document.getElementById("pmUrgent").checked,
          published: document.getElementById("pmPublished").checked,
        },
      };
    },
    cardTitle: d => d.title || "(tanpa judul)",
    cardBadges: d => [d.category, d.urgent ? "Penting" : null, d.published ? null : "Draf"].filter(Boolean),
    cardDesc: d => d.detail || "",
  },
  {
    key: "agenda", collection: "events", listEl: "agendaList", sheet: "sheetAgenda",
    err: "errAgenda", form: "formAgenda", submitBtn: "submitAgenda", titleEl: "sheetAgendaTitle",
    emptyIcon: "📅", emptyText: "Belum ada agenda. Ketuk \"Tambah\" untuk membuat agenda pertama.",
    categorySuggestions: "agendaCategorySuggestions",
    load(doc) {
      document.getElementById("agTitle").value = doc?.title || "";
      document.getElementById("agCategory").value = doc?.category || "";
      document.getElementById("agDate").value = doc?.date || "";
      document.getElementById("agTime").value = doc?.time || "";
      document.getElementById("agLocation").value = doc?.location || "";
      document.getElementById("agDesc").value = doc?.description || "";
    },
    read() {
      const title = document.getElementById("agTitle").value.trim();
      const date = document.getElementById("agDate").value;
      if (!title) return { error: "Nama kegiatan wajib diisi." };
      if (!date) return { error: "Tanggal wajib diisi." };
      return {
        payload: {
          title,
          category: document.getElementById("agCategory").value.trim(),
          date,
          time: document.getElementById("agTime").value.trim(),
          location: document.getElementById("agLocation").value.trim(),
          description: document.getElementById("agDesc").value.trim(),
        },
      };
    },
    cardTitle: d => d.title || "(tanpa nama)",
    cardBadges: d => [d.category, d.date].filter(Boolean),
    cardDesc: d => [d.time, d.location].filter(Boolean).join(" • ") || d.description || "",
  },
];

export function initManajemenWebsite() {
  requireAuth(["admin", "developer"], (user) => {
    const tabChips = document.getElementById("tabChips");
    const totalLabel = document.getElementById("totalLabel");
    const addBtn = document.getElementById("addBtn");
    const confirmOverlay = document.getElementById("confirmOverlay");
    const confirmText = document.getElementById("confirmText");

    let activeTab = "berita";
    const dataByKey = {}; // key -> array of docs (untuk 5 tab daftar)
    let pendingDelete = null; // { cfg, id }
    let editingId = null; // dipakai sheet yang sedang terbuka

    // ---- Ganti tab ----
    function setActiveTab(tab) {
      activeTab = tab;
      tabChips.querySelectorAll(".filter-chip").forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.style.display = panel.id === `panel-${tab}` ? "" : "none";
      });
      // FAB hanya relevan untuk 5 tab daftar, bukan untuk Profil/PPDB (form disimpan lewat tombol form itu sendiri)
      const cfg = LIST_CONFIGS.find(c => c.key === tab);
      addBtn.style.display = cfg ? "flex" : "none";
      updateTotalLabel();
    }
    tabChips.querySelectorAll(".filter-chip").forEach(btn => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });

    function updateTotalLabel() {
      const cfg = LIST_CONFIGS.find(c => c.key === activeTab);
      if (!cfg) { totalLabel.textContent = "Dokumen tunggal"; return; }
      const n = (dataByKey[cfg.key] || []).length;
      totalLabel.textContent = `${n} item`;
    }

    // ---- Render kartu daftar per tab ----
    function renderSkeleton(el) {
      el.innerHTML = Array.from({ length: 3 }).map(() => `
        <div class="skeleton-row">
          <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
          <div style="flex:1;">
            <div class="skeleton-box" style="width:80%;height:12px;margin-bottom:8px;"></div>
            <div class="skeleton-box" style="width:50%;height:10px;"></div>
          </div>
        </div>`).join("");
    }

    function renderEmpty(el, icon, text) {
      el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${escapeHtml(text)}</div>`;
    }

    function renderList(cfg) {
      const el = document.getElementById(cfg.listEl);
      const items = dataByKey[cfg.key] || [];
      if (!items.length) { renderEmpty(el, cfg.emptyIcon, cfg.emptyText); return; }

      el.innerHTML = items.map(d => `
        <div class="mw-card">
          <div class="mw-card-head">
            <h3 class="mw-card-title">${escapeHtml(cfg.cardTitle(d))}</h3>
          </div>
          <div class="mw-badges">
            ${cfg.cardBadges(d).map(b => `<span class="mw-badge ${b === "Penting" ? "urgent" : b === "Draf" ? "draft" : ""}">${escapeHtml(b)}</span>`).join("")}
          </div>
          ${cfg.cardDesc(d) ? `<p class="mw-card-desc">${escapeHtml(cfg.cardDesc(d))}</p>` : ""}
          <div class="mw-card-actions">
            <button type="button" class="btn-secondary" data-action="edit" data-id="${d.id}">✏️ Edit</button>
            <button type="button" class="btn-danger" data-action="delete" data-id="${d.id}">🗑️ Hapus</button>
          </div>
        </div>`).join("");

      el.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => {
          const d = items.find(x => x.id === btn.dataset.id);
          if (d) openSheet(cfg, d);
        });
      });
      el.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => openConfirm(cfg, btn.dataset.id));
      });

      if (cfg.categorySuggestions) {
        const dl = document.getElementById(cfg.categorySuggestions);
        const cats = [...new Set(items.map(d => d.category).filter(Boolean))].sort();
        dl.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">`).join("");
      }
    }

    // ---- Sheet open/close (dipakai kelima tab daftar) ----
    function openSheet(cfg, docData = null) {
      const sheetEl = document.getElementById(cfg.sheet);
      const errBox = document.getElementById(cfg.err);
      errBox.style.display = "none";
      document.getElementById(cfg.form).reset();
      editingId = docData?.id || null;
      document.getElementById(cfg.titleEl).textContent = editingId ? `Edit ${sheetLabel(cfg)}` : `Tambah ${sheetLabel(cfg)}`;
      cfg.load(docData);
      document.getElementById(cfg.submitBtn).querySelector("span").textContent = editingId ? "Simpan Perubahan" : `Simpan ${sheetLabel(cfg)}`;
      sheetEl.classList.add("open");
    }
    function sheetLabel(cfg) {
      return { berita: "Berita", galeri: "Album", prestasi: "Prestasi", pengumuman: "Pengumuman", agenda: "Agenda" }[cfg.key];
    }
    function closeSheet(cfg) {
      document.getElementById(cfg.sheet).classList.remove("open");
      editingId = null;
    }
    document.querySelectorAll(".sheet-close").forEach(btn => {
      btn.addEventListener("click", () => {
        const cfg = LIST_CONFIGS.find(c => c.sheet === btn.dataset.sheet);
        if (cfg) closeSheet(cfg);
      });
    });
    document.querySelectorAll(".sheet-overlay").forEach(overlay => {
      overlay.addEventListener("click", (ev) => {
        if (ev.target !== overlay) return;
        const cfg = LIST_CONFIGS.find(c => c.sheet === overlay.id);
        if (cfg) closeSheet(cfg);
      });
    });

    addBtn.addEventListener("click", () => {
      const cfg = LIST_CONFIGS.find(c => c.key === activeTab);
      if (cfg) openSheet(cfg, null);
    });

    // ---- Submit form sheet (create/update) ----
    LIST_CONFIGS.forEach(cfg => {
      document.getElementById(cfg.form).addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const errBox = document.getElementById(cfg.err);
        errBox.style.display = "none";

        const result = cfg.read();
        if (result.error) {
          errBox.querySelector("span:last-child").textContent = result.error;
          errBox.style.display = "flex";
          return;
        }

        const payload = { ...result.payload, updatedAt: serverTimestamp(), updatedBy: user.uid };
        const submitBtn = document.getElementById(cfg.submitBtn);
        submitBtn.disabled = true;
        try {
          if (editingId) {
            await updateDoc(doc(db, cfg.collection, editingId), payload);
          } else {
            payload.createdAt = serverTimestamp();
            payload.createdBy = user.uid;
            await addDoc(collection(db, cfg.collection), payload);
          }
          closeSheet(cfg);
        } catch (err) {
          errBox.querySelector("span:last-child").textContent = "Gagal menyimpan. Periksa koneksi lalu coba lagi.";
          errBox.style.display = "flex";
        } finally {
          submitBtn.disabled = false;
        }
      });
    });

    // ---- Dialog konfirmasi hapus (dipakai bersama kelima tab) ----
    function openConfirm(cfg, id) {
      pendingDelete = { cfg, id };
      const d = (dataByKey[cfg.key] || []).find(x => x.id === id);
      confirmText.textContent = `"${cfg.cardTitle(d || {})}" akan dihapus permanen dan tidak dapat dikembalikan.`;
      confirmOverlay.classList.add("open");
    }
    function closeConfirm() {
      confirmOverlay.classList.remove("open");
      pendingDelete = null;
    }
    document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
    confirmOverlay.addEventListener("click", (ev) => { if (ev.target === confirmOverlay) closeConfirm(); });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDelete) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        await deleteDoc(doc(db, pendingDelete.cfg.collection, pendingDelete.id));
        closeConfirm();
      } catch {
        btn.disabled = false;
        confirmText.textContent = "Gagal menghapus. Periksa koneksi lalu coba lagi.";
      } finally {
        btn.disabled = false;
      }
    });

    // ---- Live query Firestore untuk kelima tab daftar ----
    LIST_CONFIGS.forEach(cfg => {
      renderSkeleton(document.getElementById(cfg.listEl));
      const q = query(collection(db, cfg.collection));
      onSnapshot(q, (snap) => {
        dataByKey[cfg.key] = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        if (activeTab === cfg.key) updateTotalLabel();
        renderList(cfg);
      }, () => {
        renderEmpty(document.getElementById(cfg.listEl), "⚠️", "Gagal memuat data. Periksa koneksi lalu muat ulang.");
      });
    });

    // ---- Profil & Akademik: dokumen tunggal schoolProfile/main ----
    const formProfil = document.getElementById("formProfil");
    const errProfil = document.getElementById("errProfil");
    (async () => {
      try {
        const snap = await getDoc(doc(db, "schoolProfile", "main"));
        const d = snap.exists() ? snap.data() : {};
        document.getElementById("pIdentitas").value = arrToLines(d.identitas, i => `${i.label}: ${i.value}`);
        document.getElementById("pSejarah").value = d.sejarah || "";
        document.getElementById("pVisi").value = d.visi || "";
        document.getElementById("pMisi").value = arrToLines(d.misi, m => m);
        document.getElementById("pNilai").value = arrToLines(d.nilai, n => `${n.title}: ${n.desc}`);
        document.getElementById("pFasilitas").value = arrToLines(d.fasilitas, f => `${f.title}: ${f.desc}`);
        document.getElementById("pKurikulum").value = d.kurikulum || "";
        document.getElementById("pPeminatan").value = arrToLines(d.peminatan, p => p);
        document.getElementById("pEkskul").value = arrToLines(d.ekskul, e => e);
      } catch {
        errProfil.querySelector("span:last-child").textContent = "Gagal memuat data profil. Periksa koneksi lalu muat ulang halaman.";
        errProfil.style.display = "flex";
      }
    })();
    formProfil.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errProfil.style.display = "none";
      const submitBtn = document.getElementById("submitProfil");
      submitBtn.disabled = true;
      try {
        await setDoc(doc(db, "schoolProfile", "main"), {
          identitas: parseLabelColon(document.getElementById("pIdentitas").value),
          sejarah: document.getElementById("pSejarah").value.trim(),
          visi: document.getElementById("pVisi").value.trim(),
          misi: linesToArray(document.getElementById("pMisi").value),
          nilai: parseTitleDesc(document.getElementById("pNilai").value),
          fasilitas: parseTitleDesc(document.getElementById("pFasilitas").value),
          kurikulum: document.getElementById("pKurikulum").value.trim(),
          peminatan: linesToArray(document.getElementById("pPeminatan").value),
          ekskul: linesToArray(document.getElementById("pEkskul").value),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        }, { merge: true });
        errProfil.className = "auth-alert success";
        errProfil.querySelector("span:last-child").textContent = "Profil & Akademik berhasil disimpan.";
        errProfil.style.display = "flex";
      } catch {
        errProfil.className = "auth-alert error";
        errProfil.querySelector("span:last-child").textContent = "Gagal menyimpan. Periksa koneksi lalu coba lagi.";
        errProfil.style.display = "flex";
      } finally {
        submitBtn.disabled = false;
      }
    });

    // ---- PPDB: dokumen tunggal ppdb/main ----
    const formPpdb = document.getElementById("formPpdb");
    const errPpdb = document.getElementById("errPpdb");
    (async () => {
      try {
        const snap = await getDoc(doc(db, "ppdb", "main"));
        const d = snap.exists() ? snap.data() : {};
        document.getElementById("dInfo").value = d.info || "";
        document.getElementById("dPersyaratan").value = arrToLines(d.persyaratan, p => p);
        document.getElementById("dJadwal").value = arrToLines(d.jadwal, j => `${j.tahap}: ${j.tanggal}`);
        document.getElementById("dAlur").value = arrToLines(d.alur, a => a);
        document.getElementById("dDokumen").value = arrToLines(d.dokumen, x => x);
        document.getElementById("dFaq").value = arrToLines(d.faq, f => `${f.q} :: ${f.a}`);
      } catch {
        errPpdb.querySelector("span:last-child").textContent = "Gagal memuat data PPDB. Periksa koneksi lalu muat ulang halaman.";
        errPpdb.style.display = "flex";
      }
    })();
    formPpdb.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errPpdb.style.display = "none";
      const submitBtn = document.getElementById("submitPpdb");
      submitBtn.disabled = true;
      try {
        await setDoc(doc(db, "ppdb", "main"), {
          info: document.getElementById("dInfo").value.trim(),
          persyaratan: linesToArray(document.getElementById("dPersyaratan").value),
          jadwal: parseLabelColon(document.getElementById("dJadwal").value).map(x => ({ tahap: x.label, tanggal: x.value })),
          alur: linesToArray(document.getElementById("dAlur").value),
          dokumen: linesToArray(document.getElementById("dDokumen").value),
          faq: parseFaq(document.getElementById("dFaq").value),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        }, { merge: true });
        errPpdb.className = "auth-alert success";
        errPpdb.querySelector("span:last-child").textContent = "Informasi PPDB berhasil disimpan.";
        errPpdb.style.display = "flex";
      } catch {
        errPpdb.className = "auth-alert error";
        errPpdb.querySelector("span:last-child").textContent = "Gagal menyimpan. Periksa koneksi lalu coba lagi.";
        errPpdb.style.display = "flex";
      } finally {
        submitBtn.disabled = false;
      }
    });

    setActiveTab("berita");

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
