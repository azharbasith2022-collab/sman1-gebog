// Khusus pengaturan-sistem.html (Portal Admin & Developer, halaman 30 —
// halaman TERAKHIR dari 30 halaman utama spek).
//
// Tiga bagian, semuanya nyata (bukan mockup):
//
// 1. Pengaturan Umum -> dokumen tunggal `settings/general`. Berisi tahun
//    ajaran/semester aktif (murni informasi, belum dibaca halaman lain pada
//    fase ini — sama seperti Profil & PPDB di Manajemen Website yang jujur
//    menyatakan status migrasinya) dan MODE PEMELIHARAAN yang BENAR-BENAR
//    aktif: dicek oleh requireAuth() (js/auth.js) di SETIAP halaman portal
//    internal setiap kali dibuka, bukan hanya dekorasi UI di halaman ini.
//
// 2. Log Aktivitas -> collection `activityLogs`, ditulis apa adanya oleh
//    logActivity() (js/auth.js) saat ada login berhasil ke portal dan saat
//    Pengaturan Umum disimpan. Read-only di sini, tidak ada tombol edit/hapus
//    karena firestore.rules memang mengunci update/delete (allow: if false)
//    supaya log tidak bisa dimanipulasi siapa pun termasuk admin.
//
// 3. Info Teknis -> HANYA untuk role developer (§20 spek: "Developer memiliki
//    akses teknis yang diperlukan"), disembunyikan dari admin. Menampilkan
//    identitas project Firebase (projectId/authDomain/storageBucket — ini
//    BUKAN rahasia, sudah ada di bundle client manapun, lihat catatan di
//    firebase-config.js) dan info runtime browser. TIDAK PERNAH menampilkan
//    apiKey mentah secara penuh (disamarkan) apalagi service account/secret
//    apa pun, karena memang tidak pernah ada di kode client (§46 spek).

import { requireAuth, logout, ROLE_LABEL, logActivity } from "./auth.js";
import { db } from "./firebase-init.js";
import { firebaseConfig } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, serverTimestamp,
  collection, query, orderBy, limit, onSnapshot,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function timeAgo(date) {
  if (!date) return "—";
  const diffSec = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSec < 60) return "Baru saja";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  return date.toLocaleString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ACTION_ICON = { login: "🔑", ubah_pengaturan: "⚙️" };
const ACTION_LABEL = { login: "Masuk ke portal", ubah_pengaturan: "Mengubah Pengaturan Sistem" };

function maskKey(key) {
  if (!key || key.length < 10) return key || "—";
  return `${key.slice(0, 6)}••••••••${key.slice(-4)}`;
}

export function initPengaturanSistem() {
  requireAuth(["admin", "developer"], (user, profile) => {
    document.getElementById("roleTag").textContent = `Masuk sebagai ${ROLE_LABEL[profile.role] || profile.role}`;

    // ---- Tab switching (pola sama dengan manajemen-website.js) ----
    const tabChips = document.getElementById("tabChips");
    function setActiveTab(tab) {
      tabChips.querySelectorAll(".filter-chip").forEach(btn => {
        const isActive = btn.dataset.tab === tab;
        btn.classList.toggle("active", isActive);
        btn.setAttribute("aria-selected", isActive ? "true" : "false");
      });
      document.querySelectorAll(".tab-panel").forEach(panel => {
        panel.style.display = panel.id === `panel-${tab}` ? "" : "none";
      });
    }
    tabChips.querySelectorAll(".filter-chip").forEach(btn => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });

    // Info Teknis hanya untuk developer (§20 spek) — admin tidak melihat tab ini sama sekali.
    if (profile.role !== "developer") {
      document.getElementById("tabTeknisBtn").remove();
    }

    // ============================================================
    // 1. PENGATURAN UMUM
    // ============================================================
    const formUmum = document.getElementById("formUmum");
    const errUmum = document.getElementById("errUmum");
    const okUmum = document.getElementById("okUmum");
    const submitUmum = document.getElementById("submitUmum");
    const fTahun = document.getElementById("stTahunAjaran");
    const fSemester = document.getElementById("stSemester");
    const fMaintenance = document.getElementById("stMaintenance");
    const fMaintMsg = document.getElementById("stMaintMsg");

    function showErr(text) {
      errUmum.querySelector("span:last-child").textContent = text;
      errUmum.style.display = "flex";
      okUmum.style.display = "none";
    }

    getDoc(doc(db, "settings", "general")).then(snap => {
      const data = snap.exists() ? snap.data() : {};
      fTahun.value = data.tahunAjaran || "";
      fSemester.value = data.semester || "Ganjil";
      fMaintenance.checked = !!data.maintenanceMode;
      fMaintenance.dataset.prev = String(!!data.maintenanceMode);
      fMaintMsg.value = data.maintenanceMessage || "";
    }).catch(() => showErr("Gagal memuat pengaturan saat ini. Muat ulang halaman."));

    formUmum.addEventListener("submit", async (e) => {
      e.preventDefault();
      errUmum.style.display = "none";
      okUmum.style.display = "none";
      submitUmum.disabled = true;
      submitUmum.querySelector("span").textContent = "Menyimpan…";
      try {
        const wasMaintenance = fMaintenance.dataset.prev === "true";
        await setDoc(doc(db, "settings", "general"), {
          tahunAjaran: fTahun.value.trim(),
          semester: fSemester.value,
          maintenanceMode: fMaintenance.checked,
          maintenanceMessage: fMaintMsg.value.trim(),
          updatedAt: serverTimestamp(),
          updatedBy: user.uid,
        }, { merge: true });
        fMaintenance.dataset.prev = String(fMaintenance.checked);
        okUmum.style.display = "flex";
        const detail = fMaintenance.checked
          ? "Mengaktifkan mode pemeliharaan"
          : (wasMaintenance ? "Menonaktifkan mode pemeliharaan" : "Memperbarui pengaturan umum");
        logActivity(user, profile, "ubah_pengaturan", detail);
      } catch (err) {
        showErr(err.code === "permission-denied"
          ? "Anda tidak memiliki izin untuk mengubah pengaturan ini."
          : "Gagal menyimpan pengaturan. Periksa koneksi lalu coba lagi.");
      } finally {
        submitUmum.disabled = false;
        submitUmum.querySelector("span").textContent = "Simpan Pengaturan";
      }
    });

    // ============================================================
    // 2. LOG AKTIVITAS (read-only, real-time, tidak bisa diubah/dihapus)
    // ============================================================
    const logList = document.getElementById("logList");
    logList.innerHTML = `
      <div class="skeleton-row"><div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
        <div style="flex:1;"><div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div><div class="skeleton-box" style="width:40%;height:10px;"></div></div></div>`;

    const logQuery = query(collection(db, "activityLogs"), orderBy("createdAt", "desc"), limit(30));
    onSnapshot(logQuery, (snap) => {
      if (snap.empty) {
        logList.innerHTML = `<div class="empty-state"><div class="es-icon">🗒️</div>Belum ada aktivitas tercatat.</div>`;
        return;
      }
      logList.innerHTML = snap.docs.map(d => {
        const l = d.data();
        const when = l.createdAt?.toDate ? l.createdAt.toDate() : null;
        return `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${ACTION_ICON[l.action] || "📌"}</div>
          <div class="list-row-body">
            <h4>${escapeHtml(l.name)} · ${escapeHtml(ROLE_LABEL[l.role] || l.role)}</h4>
            <p>${escapeHtml(ACTION_LABEL[l.action] || l.action)}${l.detail ? " — " + escapeHtml(l.detail) : ""}</p>
          </div>
          <span class="list-row-tag" style="white-space:nowrap;">${escapeHtml(timeAgo(when))}</span>
        </div>`;
      }).join("");
    }, () => {
      logList.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div>Gagal memuat log aktivitas.</div>`;
    });

    // ============================================================
    // 3. INFO TEKNIS (developer only)
    // ============================================================
    if (profile.role === "developer") {
      const teknisList = document.getElementById("teknisList");
      const rows = [
        { icon: "🆔", label: "Firebase Project ID", value: firebaseConfig.projectId },
        { icon: "🌐", label: "Auth Domain", value: firebaseConfig.authDomain },
        { icon: "🗄️", label: "Storage Bucket", value: firebaseConfig.storageBucket },
        { icon: "🔑", label: "API Key (disamarkan)", value: maskKey(firebaseConfig.apiKey) },
        { icon: "📦", label: "Firebase SDK", value: "v10.13.1 (modular, via CDN gstatic)" },
        { icon: "💳", label: "Paket Firebase", value: "Spark (free tier) — §1 spek: tidak ada layanan berbayar" },
        { icon: "🖥️", label: "User Agent Browser", value: navigator.userAgent },
        { icon: "📶", label: "Status Koneksi Saat Ini", value: navigator.onLine ? "Online" : "Offline" },
      ];
      teknisList.innerHTML = rows.map(r => `
        <div class="list-row">
          <div class="list-row-icon" aria-hidden="true">${r.icon}</div>
          <div class="list-row-body"><h4>${escapeHtml(r.label)}</h4><p style="word-break:break-all;">${escapeHtml(r.value)}</p></div>
        </div>`).join("");
    }

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
