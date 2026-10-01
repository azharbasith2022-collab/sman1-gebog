// Khusus manajemen-pengguna.html (Portal Admin & Developer, halaman 29).
//
// §26 spek: admin bisa melihat/mencari/filter user, MEMBUAT user dengan
// metode yang aman, mengubah info, mengaktifkan/nonaktifkan akun, dan
// mengatur role — tanpa layanan berbayar (§1 spek: tidak boleh memaksa
// Cloud Functions/Admin SDK yang butuh paket Blaze).
//
// ---- Cara kerja pembuatan akun (100% Spark/free tier, tanpa Cloud Function) ----
// createUserWithEmailAndPassword pada `auth` PRIMER akan otomatis membuat
// sesi baru menggantikan sesi admin yang sedang login (perilaku standar
// Firebase Auth SDK) — itu tidak boleh terjadi di sini. Solusinya: buat
// APLIKASI FIREBASE KEDUA (initializeApp dengan nama berbeda) yang punya
// instance Auth-nya sendiri, dipakai KHUSUS untuk operasi createUser, lalu
// langsung signOut dari instance kedua itu selesai dipakai. Sesi admin di
// `auth` primer sama sekali tidak tersentuh.
//
// Admin TIDAK menentukan kata sandi awal pengguna baru (rawan kalau
// dibagikan lewat chat/kertas) — begitu akun dibuat, langsung dikirim email
// "Atur Kata Sandi" (sendPasswordResetEmail, mekanisme sama dengan Lupa
// Kata Sandi) ke email pengguna baru. Password sementara yang dibuatkan
// sistem bersifat acak & tidak pernah ditampilkan/disimpan di mana pun.
//
// ---- Keterbatasan yang diakui jujur (bukan disembunyikan) ----
// - "Nonaktifkan akun" HANYA memblokir di level aplikasi (field `disabled`
//   di dokumen Firestore users/{uid}, dicek oleh requireAuth() & login.html)
//   — akun Firebase Authentication itu sendiri TETAP bisa dipakai signin
//   secara teknis (mis. lewat SDK lain), karena men-disable akun Auth
//   sungguhan butuh Admin SDK di server. Ini bukan cara memblokir yang
//   sempurna, tapi cukup untuk mengontrol akses ke seluruh halaman portal
//   di sistem ini, dan tidak butuh biaya sama sekali.
// - "Hapus pengguna" menghapus dokumen Firestore (users + dokumen cermin di
//   students/teachers/staff) sehingga akun itu langsung ditolak requireAuth()
//   di halaman manapun — tapi akun Firebase Authentication-nya sendiri tidak
//   ikut terhapus (alasan sama seperti di atas). Dinyatakan apa adanya lewat
//   teks di dialog konfirmasi, bukan diklaim sebagai penghapusan total.
//
// ---- Dokumen cermin (students/teachers/staff) ----
// users/{uid} adalah SUMBER KEBENARAN untuk role & akses (dipakai
// firestore.rules & requireAuth()). Untuk role siswa/guru/tu, dibuat juga
// dokumen ringkas di collection students/teachers/staff (id sama = uid)
// supaya statistik Dashboard Admin/TU (§24 spek, sebelumnya selalu 0 karena
// belum ada yang mengisi collection ini) jadi angka nyata, dan supaya guru
// & TU punya direktori dasar untuk fase migrasi halaman publik Guru & Staff
// berikutnya. Kalau role diubah, dokumen cermin lama dihapus & dibuat ulang
// sesuai role baru.

import { requireAuth, logout, ROLE_LABEL } from "./auth.js";
import { db, auth } from "./firebase-init.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut as signOutSecondary,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const MIRROR_COLLECTION = { siswa: "students", guru: "teachers", tu: "staff" };

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase()).join("");
}

function genTempPassword() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return "Aa1!" + Array.from(bytes, b => b.toString(36)).join("").slice(0, 14);
}

// Instance Firebase KEDUA, khusus dipakai membuat akun baru tanpa mengganti
// sesi login admin yang sedang aktif di instance PERTAMA (auth dari firebase-init.js).
const secondaryApp = initializeApp(firebaseConfig, "AdminUserCreation");
const secondaryAuth = getAuth(secondaryApp);

export function initManajemenPengguna() {
  requireAuth(["admin", "developer"], (currentUser) => {
    const listEl = document.getElementById("userList");
    const totalLabel = document.getElementById("totalLabel");
    const searchInput = document.getElementById("uSearch");
    const chipsEl = document.getElementById("roleChips");

    const sheetOverlay = document.getElementById("sheetUser");
    const sheetTitle = document.getElementById("sheetUserTitle");
    const form = document.getElementById("formUser");
    const errBox = document.getElementById("errUser");
    const submitBtn = document.getElementById("submitUser");
    const roleSelect = document.getElementById("uRole");
    const emailInput = document.getElementById("uEmail");
    const emailHint = document.getElementById("uEmailHint");
    const disabledGroup = document.getElementById("uDisabledGroup");
    const disabledCheckbox = document.getElementById("uDisabled");

    const confirmOverlay = document.getElementById("confirmOverlay");
    const confirmTextEl = document.getElementById("confirmText");

    let allUsers = [];
    let activeRole = "all";
    let searchTerm = "";
    let editingUid = null;
    let pendingDeleteUid = null;

    const ROLE_HINT = {
      siswa: "Bisa masuk Portal Siswa: jadwal, pengumuman, dan mengerjakan CBT.",
      guru: "Bisa masuk Portal Guru: kelas, bank soal, dan CBT.",
      tu: "Bisa masuk Portal Tata Usaha: informasi & administrasi sekolah.",
      admin: "Akses penuh ke seluruh sistem, termasuk manajemen pengguna ini.",
      developer: "Akses teknis setara admin, sesuai batas permission sistem (§20 spek) — bukan backdoor.",
    };

    function updateRoleFieldVisibility() {
      const role = roleSelect.value;
      document.querySelectorAll(".role-field").forEach(el => { el.style.display = "none"; });
      document.querySelectorAll(`.role-${role}`).forEach(el => { el.style.display = ""; });
      document.getElementById("uRoleHint").textContent = ROLE_HINT[role] || "";
    }
    roleSelect.addEventListener("change", updateRoleFieldVisibility);

    // ---- Sheet open/close ----
    function openSheet(userDoc = null) {
      form.reset();
      errBox.style.display = "none";
      editingUid = userDoc?.id || null;
      sheetTitle.textContent = editingUid
        ? (userDoc?.status === "pending" ? "Edit Pendaftaran (Menunggu ACC)" : "Edit Pengguna")
        : "Tambah Pengguna";
      submitBtn.querySelector("span").textContent = editingUid ? "Simpan Perubahan" : "Buat Akun & Kirim Email";

      document.getElementById("uName").value = userDoc?.name || "";
      emailInput.value = userDoc?.email || "";
      emailInput.disabled = !!editingUid;
      emailHint.style.display = editingUid ? "block" : "none";
      document.getElementById("uPhone").value = userDoc?.phone || "";
      roleSelect.value = userDoc?.role || "siswa";
      document.getElementById("uClassId").value = userDoc?.classId || "";
      document.getElementById("uNis").value = userDoc?.nis || "";
      document.getElementById("uNisn").value = userDoc?.nisn || "";
      document.getElementById("uPhotoUrl").value = userDoc?.photoURL || "";
      document.getElementById("uSubject").value = userDoc?.subject || "";
      document.getElementById("uJabatan").value = userDoc?.jabatan || "";

      const isSelf = editingUid === currentUser.uid;
      const isPendingUser = userDoc?.status === "pending";
      // Akun pending diaktifkan lewat tombol "Setujui" di kartu (bukan
      // checkbox ini), supaya status tetap konsisten dengan field disabled.
      disabledGroup.style.display = editingUid && !isSelf && !isPendingUser ? "block" : "none";
      disabledCheckbox.checked = !!userDoc?.disabled;
      roleSelect.disabled = isSelf; // admin tidak boleh ubah role diri sendiri (cegah lockout)

      updateRoleFieldVisibility();
      sheetOverlay.classList.add("open");
      document.getElementById("uName").focus();
    }
    function closeSheet() {
      sheetOverlay.classList.remove("open");
      editingUid = null;
      roleSelect.disabled = false;
    }
    document.getElementById("addBtn").addEventListener("click", () => openSheet(null));
    document.getElementById("sheetUserClose").addEventListener("click", closeSheet);
    sheetOverlay.addEventListener("click", (ev) => { if (ev.target === sheetOverlay) closeSheet(); });

    function showError(msg) {
      errBox.querySelector("span:last-child").textContent = msg;
      errBox.style.display = "flex";
    }

    // ---- Submit (create / update) ----
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      errBox.style.display = "none";

      const name = document.getElementById("uName").value.trim();
      const email = emailInput.value.trim();
      const phone = document.getElementById("uPhone").value.trim();
      const role = roleSelect.value;

      if (!name) return showError("Nama lengkap wajib diisi.");
      if (!email) return showError("Email wajib diisi.");

      const roleFields = {};
      if (role === "siswa") {
        roleFields.classId = document.getElementById("uClassId").value.trim();
        roleFields.nis = document.getElementById("uNis").value.trim();
        roleFields.nisn = document.getElementById("uNisn").value.trim();
        roleFields.photoURL = document.getElementById("uPhotoUrl").value.trim();
      } else if (role === "guru") {
        roleFields.subject = document.getElementById("uSubject").value.trim();
      } else if (role === "tu") {
        roleFields.jabatan = document.getElementById("uJabatan").value.trim();
      }

      submitBtn.disabled = true;
      try {
        if (editingUid) {
          const isSelf = editingUid === currentUser.uid;
          const prev = allUsers.find(u => u.id === editingUid);
          const payload = {
            name, phone, role: isSelf ? prev.role : role,
            disabled: isSelf ? false : disabledCheckbox.checked,
            updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
          };
          Object.assign(payload, roleFields);
          await updateDoc(doc(db, "users", editingUid), payload);
          await syncMirrorDoc(editingUid, payload.role, { name, email: prev.email, phone, ...roleFields }, prev.role);
        } else {
          // 1) Buat akun Firebase Authentication lewat instance KEDUA, supaya
          //    sesi admin yang sedang login di instance PERTAMA tidak terganti.
          const tempPassword = genTempPassword();
          const cred = await createUserWithEmailAndPassword(secondaryAuth, email, tempPassword);
          const newUid = cred.user.uid;
          await sendPasswordResetEmail(auth, email); // email "Atur Kata Sandi" ke pengguna baru
          await signOutSecondary(secondaryAuth);

          // 2) Simpan profil & role ke Firestore (sumber kebenaran akses).
          const payload = {
            name, email, phone, role, disabled: false,
            createdAt: serverTimestamp(), createdBy: currentUser.uid,
            updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
            ...roleFields,
          };
          await setDoc(doc(db, "users", newUid), payload);
          await syncMirrorDoc(newUid, role, { name, email, phone, ...roleFields }, null);
        }
        closeSheet();
      } catch (err) {
        if (err?.code === "auth/email-already-in-use") {
          showError("Email ini sudah terdaftar sebagai akun lain.");
        } else if (err?.code === "auth/invalid-email") {
          showError("Format email tidak valid.");
        } else {
          showError("Gagal menyimpan pengguna. Periksa koneksi lalu coba lagi.");
        }
      } finally {
        submitBtn.disabled = false;
      }
    });

    // Buat/perbarui/hapus dokumen cermin di students/teachers/staff mengikuti role.
    async function syncMirrorDoc(uid, newRole, fields, oldRole) {
      if (oldRole && oldRole !== newRole && MIRROR_COLLECTION[oldRole]) {
        try { await deleteDoc(doc(db, MIRROR_COLLECTION[oldRole], uid)); } catch { /* abaikan jika sudah tidak ada */ }
      }
      const col = MIRROR_COLLECTION[newRole];
      if (!col) return; // admin/developer tidak punya collection cermin
      await setDoc(doc(db, col, uid), { ...fields, updatedAt: serverTimestamp() }, { merge: true });
    }

    // ---- Toggle aktif/nonaktif cepat dari kartu (tanpa buka sheet) ----
    async function toggleDisabled(u) {
      if (u.id === currentUser.uid) return; // cegah admin mengunci akunnya sendiri
      try {
        await updateDoc(doc(db, "users", u.id), {
          disabled: !u.disabled, updatedAt: serverTimestamp(), updatedBy: currentUser.uid,
        });
      } catch {
        showToast("Gagal mengubah status akun. Periksa koneksi lalu coba lagi.");
      }
    }

    let toastTimer = null;
    function showToast(text) {
      let toast = document.getElementById("mwToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "mwToast";
        toast.className = "auth-alert error";
        toast.style.position = "fixed"; toast.style.left = "16px"; toast.style.right = "16px";
        toast.style.bottom = "84px"; toast.style.zIndex = "50";
        toast.innerHTML = `<span aria-hidden="true">⚠️</span><span></span>`;
        document.body.appendChild(toast);
      }
      toast.querySelector("span:last-child").textContent = text;
      toast.style.display = "flex";
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => { toast.style.display = "none"; }, 4000);
    }

    // ---- ACC pendaftaran mandiri (status: 'pending', lihat daftar.html) ----
    // Setujui: aktifkan akun (disabled:false, status:'approved') & buat
    // dokumen cermin `students` supaya langsung ikut statistik Dashboard,
    // sama seperti akun yang dibuat manual oleh admin.
    async function approveUser(u) {
      try {
        await updateDoc(doc(db, "users", u.id), {
          status: "approved", disabled: false,
          approvedAt: serverTimestamp(), approvedBy: currentUser.uid,
        });
        await syncMirrorDoc(u.id, u.role, {
          name: u.name, email: u.email, phone: u.phone,
          classId: u.classId, nis: u.nis, nisn: u.nisn,
        }, null);
        showToast(`Akun "${u.name || u.email}" disetujui.`);
      } catch {
        showToast("Gagal menyetujui akun. Periksa koneksi lalu coba lagi.");
      }
    }

    // ---- Hapus pengguna / tolak pendaftaran ----
    function openConfirm(u) {
      pendingDeleteUid = u.id;
      confirmTextEl.textContent = u.status === "pending"
        ? `Pendaftaran "${u.name || u.email}" akan ditolak & dihapus dari Firestore. Akun Firebase Authentication yang sudah dibuat orang tersebut saat mendaftar tidak ikut terhapus (butuh Admin SDK berbayar) — ia tetap tidak akan bisa masuk portal manapun karena dokumen profilnya sudah hilang.`
        : `Dokumen "${u.name || u.email}" akan dihapus dari Firestore dan tidak bisa lagi masuk ke portal manapun. Akun Firebase Authentication-nya sendiri tidak ikut terhapus (butuh Admin SDK berbayar) — gunakan "Nonaktifkan" jika hanya ingin memblokir sementara.`;
      confirmOverlay.classList.add("open");
    }
    function closeConfirm() {
      confirmOverlay.classList.remove("open");
      pendingDeleteUid = null;
    }
    document.getElementById("confirmCancelBtn").addEventListener("click", closeConfirm);
    confirmOverlay.addEventListener("click", (ev) => { if (ev.target === confirmOverlay) closeConfirm(); });
    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
      if (!pendingDeleteUid || pendingDeleteUid === currentUser.uid) return;
      const btn = document.getElementById("confirmDeleteBtn");
      btn.disabled = true;
      try {
        const u = allUsers.find(x => x.id === pendingDeleteUid);
        await deleteDoc(doc(db, "users", pendingDeleteUid));
        if (u?.role && MIRROR_COLLECTION[u.role]) {
          try { await deleteDoc(doc(db, MIRROR_COLLECTION[u.role], pendingDeleteUid)); } catch { /* abaikan */ }
        }
        closeConfirm();
      } catch {
        showToast("Gagal menghapus pengguna. Periksa koneksi lalu coba lagi.");
      } finally {
        btn.disabled = false;
      }
    });

    // ---- Render daftar (search + filter role, semua di client) ----
    function renderChips() {
      const pendingCount = allUsers.filter(u => u.status === "pending").length;
      const chips = [
        { id: "all", label: "Semua" },
        { id: "pending", label: pendingCount ? `Menunggu ACC (${pendingCount})` : "Menunggu ACC" },
        { id: "siswa", label: "Siswa" },
        { id: "guru", label: "Guru" },
        { id: "tu", label: "Tata Usaha" },
        { id: "admin", label: "Admin" },
        { id: "developer", label: "Developer" },
      ];
      chipsEl.innerHTML = chips.map(c => `
        <button type="button" class="filter-chip ${c.id === activeRole ? "active" : ""}" data-role="${c.id}">${c.label}</button>
      `).join("");
      chipsEl.querySelectorAll("button").forEach(btn => {
        btn.addEventListener("click", () => {
          activeRole = btn.dataset.role;
          renderChips();
          renderList();
        });
      });
    }

    function renderList() {
      let items = allUsers;
      if (activeRole === "pending") items = items.filter(u => u.status === "pending");
      else if (activeRole !== "all") items = items.filter(u => u.role === activeRole);
      if (searchTerm) {
        items = items.filter(u =>
          (u.name || "").toLowerCase().includes(searchTerm) ||
          (u.email || "").toLowerCase().includes(searchTerm));
      }

      totalLabel.textContent = `${allUsers.length} pengguna`;

      if (!items.length) {
        const msg = !allUsers.length
          ? "Belum ada pengguna. Ketuk \"Tambah Pengguna\" untuk membuat akun pertama."
          : activeRole === "pending"
            ? "Tidak ada pendaftaran yang sedang menunggu ACC."
            : "Tidak ada pengguna yang cocok dengan pencarian/filter.";
        listEl.innerHTML = `<div class="empty-state"><div class="es-icon">👥</div>${msg}</div>`;
        return;
      }

      listEl.innerHTML = items.map(u => {
        const isSelf = u.id === currentUser.uid;
        const isPending = u.status === "pending";
        const secondary = u.role === "siswa" ? [u.classId, u.nis].filter(Boolean).join(" • ")
          : u.role === "guru" ? u.subject
          : u.role === "tu" ? u.jabatan
          : "";
        return `
        <div class="mw-card">
          <div class="mw-card-head">
            <div style="display:flex;gap:10px;align-items:center;">
              <div class="staff-photo" style="width:36px;height:36px;font-size:13px;" aria-hidden="true">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="" onerror="this.parentElement.textContent='${escapeHtml(initials(u.name))}';">` : escapeHtml(initials(u.name))}</div>
              <div>
                <h3 class="mw-card-title">${escapeHtml(u.name || "(tanpa nama)")}${isSelf ? " <span style=\"font-weight:600;color:var(--text-soft);\">(Anda)</span>" : ""}</h3>
                <div style="font-size:11.5px;color:var(--text-soft);">${escapeHtml(u.email || "")}</div>
              </div>
            </div>
          </div>
          <div class="mw-badges">
            <span class="mw-badge">${escapeHtml(ROLE_LABEL[u.role] || u.role)}</span>
            ${isPending ? `<span class="mw-badge pending">⏳ Menunggu ACC</span>`
              : u.disabled ? `<span class="mw-badge urgent">Nonaktif</span>` : `<span class="mw-badge">Aktif</span>`}
          </div>
          ${secondary ? `<p class="mw-card-desc">${escapeHtml(secondary)}</p>` : ""}
          <div class="mw-card-actions">
            ${isPending ? `
              <button type="button" class="btn-secondary" data-action="edit" data-id="${u.id}">✏️ Edit</button>
              <button type="button" class="btn-primary" data-action="approve" data-id="${u.id}">✅ Setujui</button>
              <button type="button" class="btn-danger" data-action="delete" data-id="${u.id}">🗑️ Tolak</button>
            ` : `
              <button type="button" class="btn-secondary" data-action="edit" data-id="${u.id}">✏️ Edit</button>
              <button type="button" class="btn-secondary" data-action="toggle" data-id="${u.id}" ${isSelf ? "disabled" : ""}>${u.disabled ? "✅ Aktifkan" : "🚫 Nonaktifkan"}</button>
              <button type="button" class="btn-danger" data-action="delete" data-id="${u.id}" ${isSelf ? "disabled" : ""}>🗑️ Hapus</button>
            `}
          </div>
        </div>`;
      }).join("");

      listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
        btn.addEventListener("click", () => { const u = allUsers.find(x => x.id === btn.dataset.id); if (u) openSheet(u); });
      });
      listEl.querySelectorAll('[data-action="toggle"]').forEach(btn => {
        btn.addEventListener("click", () => { const u = allUsers.find(x => x.id === btn.dataset.id); if (u) toggleDisabled(u); });
      });
      listEl.querySelectorAll('[data-action="approve"]').forEach(btn => {
        btn.addEventListener("click", () => { const u = allUsers.find(x => x.id === btn.dataset.id); if (u) approveUser(u); });
      });
      listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
        btn.addEventListener("click", () => { const u = allUsers.find(x => x.id === btn.dataset.id); if (u) openConfirm(u); });
      });
    }

    searchInput.addEventListener("input", () => {
      searchTerm = searchInput.value.trim().toLowerCase();
      renderList();
    });

    // ---- Live query Firestore ----
    listEl.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="skeleton-row">
        <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
        <div style="flex:1;">
          <div class="skeleton-box" style="width:75%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-box" style="width:45%;height:10px;"></div>
        </div>
      </div>`).join("");

    const qUsers = query(collection(db, "users"));
    onSnapshot(qUsers, (snap) => {
      allUsers = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      renderChips();
      renderList();
    }, () => {
      totalLabel.textContent = "Gagal memuat";
      listEl.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div>Gagal memuat daftar pengguna. Periksa koneksi lalu muat ulang.</div>`;
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
