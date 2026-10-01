// Data berita publik dari Firestore collection `news`.
// Hanya dokumen dengan published == true yang dibaca halaman publik.
import { db } from "./firebase-init.js";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

const BERITA_PER_PAGE = 6;
let beritaCurrentPage = 1;
let BERITA_DATA = [];
let detailLoaded = false;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function dateValue(value) {
  if (!value) return 0;
  if (typeof value.toDate === "function") return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatDate(value) {
  const ms = dateValue(value);
  if (!ms) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "long", year: "numeric",
  }).format(new Date(ms));
}

function normalizeNews(docSnap) {
  const d = docSnap.data() || {};
  const content = Array.isArray(d.content) ? d.content : (d.content ? [String(d.content)] : []);
  return {
    id: docSnap.id,
    title: String(d.title || "Tanpa judul"),
    category: String(d.category || "Berita"),
    icon: String(d.icon || "📰"),
    date: formatDate(d.published_at || d.created_at),
    excerpt: String(d.excerpt || content[0] || ""),
    content,
    _sort: dateValue(d.published_at || d.created_at),
  };
}

function renderBeritaList() {
  const grid = document.getElementById("beritaGrid");
  const empty = document.getElementById("beritaEmpty");
  const pagination = document.getElementById("beritaPagination");
  if (!grid) return;

  const searchEl = document.getElementById("beritaSearch");
  const queryText = (searchEl?.value || "").trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";

  const filtered = BERITA_DATA.filter(n => {
    const matchCategory = category === "semua" || n.category === category;
    const matchQuery = !queryText || n.title.toLowerCase().includes(queryText) || n.excerpt.toLowerCase().includes(queryText);
    return matchCategory && matchQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / BERITA_PER_PAGE));
  if (beritaCurrentPage > totalPages) beritaCurrentPage = totalPages;
  const start = (beritaCurrentPage - 1) * BERITA_PER_PAGE;
  const pageItems = filtered.slice(start, start + BERITA_PER_PAGE);

  if (!pageItems.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    pagination.innerHTML = "";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = pageItems.map(n => `
    <a class="berita-card" href="detail-berita.html?id=${encodeURIComponent(n.id)}">
      <div class="berita-thumb">${escapeHtml(n.icon)}</div>
      <div class="berita-body">
        <span class="berita-cat">${escapeHtml(n.category)}</span>
        <h3>${escapeHtml(n.title)}</h3>
        <p class="berita-date">📅 ${escapeHtml(n.date)}</p>
        <p class="berita-excerpt">${escapeHtml(n.excerpt)}</p>
      </div>
    </a>
  `).join("");

  let pageBtns = `<button class="page-btn" id="beritaPrev" ${beritaCurrentPage === 1 ? "disabled" : ""} aria-label="Halaman sebelumnya">‹</button>`;
  for (let i = 1; i <= totalPages; i++) {
    pageBtns += `<button class="page-btn ${i === beritaCurrentPage ? "active" : ""}" data-page="${i}">${i}</button>`;
  }
  pageBtns += `<button class="page-btn" id="beritaNext" ${beritaCurrentPage === totalPages ? "disabled" : ""} aria-label="Halaman berikutnya">›</button>`;
  pagination.innerHTML = pageBtns;

  document.getElementById("beritaPrev")?.addEventListener("click", () => { beritaCurrentPage--; renderBeritaList(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  document.getElementById("beritaNext")?.addEventListener("click", () => { beritaCurrentPage++; renderBeritaList(); window.scrollTo({ top: 0, behavior: "smooth" }); });
  pagination.querySelectorAll("[data-page]").forEach(btn => btn.addEventListener("click", () => {
    beritaCurrentPage = Number(btn.dataset.page);
    renderBeritaList();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
}

function bindListControls() {
  const searchEl = document.getElementById("beritaSearch");
  if (searchEl && !searchEl.dataset.bound) {
    searchEl.dataset.bound = "1";
    searchEl.addEventListener("input", () => { beritaCurrentPage = 1; renderBeritaList(); });
  }
  document.querySelectorAll(".filter-chip").forEach(chip => {
    if (chip.dataset.bound) return;
    chip.dataset.bound = "1";
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      beritaCurrentPage = 1;
      renderBeritaList();
    });
  });
}

function subscribeNews() {
  if (!document.getElementById("beritaGrid")) return;
  const q = query(collection(db, "news"), where("published", "==", true));
  onSnapshot(q, snapshot => {
    BERITA_DATA = snapshot.docs.map(normalizeNews).sort((a, b) => b._sort - a._sort);
    bindListControls();
    renderBeritaList();
  }, error => {
    console.error("Gagal membaca berita Firestore:", error);
    const empty = document.getElementById("beritaEmpty");
    if (empty) {
      empty.textContent = "Berita belum dapat dimuat. Silakan coba lagi nanti.";
      empty.style.display = "block";
    }
  });
}

async function renderBeritaDetail() {
  const wrap = document.getElementById("beritaDetailWrap");
  const notFound = document.getElementById("beritaNotFound");
  if (!wrap || detailLoaded) return;
  detailLoaded = true;

  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    wrap.style.display = "none";
    notFound.style.display = "block";
    return;
  }

  try {
    const snap = await getDoc(doc(db, "news", id));
    if (!snap.exists() || snap.data()?.published !== true) throw new Error("not_found");
    const item = normalizeNews(snap);

    notFound.style.display = "none";
    wrap.style.display = "block";
    document.title = `SMA Negeri 1 Gebog — ${item.title}`;
    document.getElementById("beritaCrumbTitle").textContent = item.title;
    document.getElementById("beritaDetailHero").textContent = item.icon;
    document.getElementById("beritaDetailCat").textContent = item.category;
    document.getElementById("beritaDetailDate").textContent = `📅 ${item.date}`;
    document.getElementById("beritaDetailTitle").textContent = item.title;
    document.getElementById("beritaDetailContent").innerHTML = item.content.map(p => `<p>${escapeHtml(p)}</p>`).join("");

    const related = BERITA_DATA.filter(n => n.id !== item.id && n.category === item.category).slice(0, 3);
    const fallback = related.length ? related : BERITA_DATA.filter(n => n.id !== item.id).slice(0, 3);
    document.getElementById("beritaRelated").innerHTML = fallback.map(n => `
      <a class="berita-card" href="detail-berita.html?id=${encodeURIComponent(n.id)}">
        <div class="berita-thumb">${escapeHtml(n.icon)}</div>
        <div class="berita-body"><span class="berita-cat">${escapeHtml(n.category)}</span><h3>${escapeHtml(n.title)}</h3><p class="berita-date">📅 ${escapeHtml(n.date)}</p></div>
      </a>
    `).join("");
  } catch (error) {
    console.error("Gagal membaca detail berita:", error);
    wrap.style.display = "none";
    notFound.style.display = "block";
    document.title = "SMA Negeri 1 Gebog — Berita Tidak Ditemukan";
  }
}

subscribeNews();
renderBeritaDetail();
