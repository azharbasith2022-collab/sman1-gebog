// Khusus pengumuman-siswa.html. Menampilkan SELURUH pengumuman yang sudah
// dipublikasikan (published == true), langsung dari Firestore — bukan data
// contoh. Query Firestore ke server hanya dilakukan SEKALI (live listener);
// pencarian & filter kategori setelah itu berjalan di sisi client dari data
// yang sudah diterima, supaya terasa instan tanpa query berulang.
//
// Skema: announcements/{id} : { title, category, published, urgent,
//                                createdAt (Timestamp), detail }
//   category bersifat opsional — jika kosong, badge kategori tidak ditampilkan
//   dan item tetap muncul di filter "Semua".

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

let allAnnouncements = [];
let hasLoadedOnce = false;

function fmtDate(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function renderList() {
  const list = document.getElementById("pengumumanList");
  const empty = document.getElementById("pengumumanEmpty");
  if (!list) return;

  const searchEl = document.getElementById("pengumumanSearch");
  const q = (searchEl?.value || "").trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";

  const filtered = allAnnouncements
    .filter(p => {
      const matchCategory = category === "semua" || p.category === category;
      const matchQuery = !q || (p.title || "").toLowerCase().includes(q);
      return matchCategory && matchQuery;
    })
    .sort((a, b) => (b.urgent === a.urgent ? 0 : b.urgent ? 1 : -1));

  if (!hasLoadedOnce) {
    list.innerHTML = Array.from({ length: 3 }).map(() => `
      <div class="skeleton-row">
        <div class="skeleton-box" style="width:34px;height:34px;border-radius:10px;"></div>
        <div style="flex:1;">
          <div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div>
          <div class="skeleton-box" style="width:35%;height:10px;"></div>
        </div>
      </div>`).join("");
    empty.style.display = "none";
    return;
  }

  if (!allAnnouncements.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    empty.textContent = "Belum ada pengumuman yang dipublikasikan.";
    return;
  }

  if (!filtered.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    empty.textContent = "Tidak ditemukan pengumuman yang cocok dengan pencarian.";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = filtered.map(p => `
    <div class="peng-item ${p.urgent ? "urgent" : ""}" data-id="${p.id}">
      <button type="button" class="peng-head" aria-expanded="false">
        <div class="peng-icon ${p.urgent ? "urgent" : ""}">${p.urgent ? "📌" : "📄"}</div>
        <div class="peng-head-body">
          <div class="peng-badges">
            ${p.category ? `<span class="peng-cat">${p.category}</span>` : ""}
            ${p.urgent ? `<span class="peng-urgent-tag">Penting</span>` : ""}
          </div>
          <p class="peng-title">${p.title || "—"}</p>
          <p class="peng-date">📅 ${fmtDate(p.createdAt)}</p>
        </div>
        <span class="peng-chev">⌄</span>
      </button>
      <div class="peng-detail">
        <div class="peng-detail-inner">${p.detail || p.excerpt || "Tidak ada detail tambahan untuk pengumuman ini."}</div>
      </div>
    </div>
  `).join("");

  list.querySelectorAll(".peng-head").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".peng-item");
      const isOpen = item.classList.contains("open");
      list.querySelectorAll(".peng-item.open").forEach(el => {
        el.classList.remove("open");
        el.querySelector(".peng-head").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

export function initPengumumanSiswa() {
  requireAuth(["siswa"], () => {
    renderList(); // tampilkan skeleton dulu

    const qAnn = query(
      collection(db, "announcements"),
      where("published", "==", true),
      orderBy("createdAt", "desc")
    );
    onSnapshot(qAnn, (snap) => {
      hasLoadedOnce = true;
      allAnnouncements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      renderList();
    }, () => {
      hasLoadedOnce = true;
      allAnnouncements = [];
      const list = document.getElementById("pengumumanList");
      const empty = document.getElementById("pengumumanEmpty");
      list.innerHTML = "";
      empty.style.display = "block";
      empty.textContent = "Gagal memuat pengumuman. Periksa koneksi lalu muat ulang.";
    });

    document.getElementById("pengumumanSearch").addEventListener("input", renderList);
    document.querySelectorAll(".filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        renderList();
      });
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
