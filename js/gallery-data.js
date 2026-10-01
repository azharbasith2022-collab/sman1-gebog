// Khusus galeri.html. Data CONTOH — akan diganti data asli dari Firestore (collection: gallery).
// Setiap foto memakai placeholder emoji/gradient karena belum ada file foto asli di /assets.
// Saat foto asli sudah diupload, ganti .gal-photo (div) menjadi <img loading="lazy" src="..." alt="...">
// agar lazy loading native browser langsung aktif tanpa perlu ubah logika lain di file ini.
const GALERI_ALBUMS = [
  {
    album: "Kegiatan Sekolah",
    category: "Kegiatan",
    date: "— belum ada data",
    photos: [
      { icon: "🎤", caption: "Contoh: Upacara bendera" },
      { icon: "🎭", caption: "Contoh: Pentas seni sekolah" },
      { icon: "🏃", caption: "Contoh: Jalan sehat" },
      { icon: "🎶", caption: "Contoh: Latihan paduan suara" },
    ]
  },
  {
    album: "Fasilitas Sekolah",
    category: "Fasilitas",
    date: "— belum ada data",
    photos: [
      { icon: "🏫", caption: "Contoh: Gedung utama" },
      { icon: "📚", caption: "Contoh: Perpustakaan" },
      { icon: "🔬", caption: "Contoh: Laboratorium IPA" },
      { icon: "💻", caption: "Contoh: Laboratorium komputer" },
      { icon: "⚽", caption: "Contoh: Lapangan olahraga" },
      { icon: "🕌", caption: "Contoh: Mushola sekolah" },
    ]
  },
  {
    album: "Wisuda & Kelulusan",
    category: "Wisuda",
    date: "— belum ada data",
    photos: [
      { icon: "🎓", caption: "Contoh: Pelepasan siswa kelas XII" },
      { icon: "📸", caption: "Contoh: Foto bersama wali kelas" },
      { icon: "🥇", caption: "Contoh: Penyerahan penghargaan lulusan terbaik" },
    ]
  },
  {
    album: "Prestasi & Lomba",
    category: "Prestasi",
    date: "— belum ada data",
    photos: [
      { icon: "🏆", caption: "Contoh: Juara lomba tingkat kabupaten" },
      { icon: "🏅", caption: "Contoh: Tim olimpiade sains" },
      { icon: "🎯", caption: "Contoh: Lomba ekstrakurikuler" },
      { icon: "📝", caption: "Contoh: Lomba karya tulis ilmiah" },
    ]
  },
];

function flattenPhotos() {
  const flat = [];
  GALERI_ALBUMS.forEach((al, ai) => {
    al.photos.forEach((p, pi) => {
      flat.push({ ...p, album: al.album, date: al.date, _ai: ai, _pi: pi });
    });
  });
  return flat;
}
const GALERI_FLAT = flattenPhotos();

function renderGaleri() {
  const wrap = document.getElementById("galeriAlbums");
  const empty = document.getElementById("galeriEmpty");
  if (!wrap) return;

  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";
  const albums = GALERI_ALBUMS.filter(al => category === "semua" || al.category === category);

  if (!albums.length) {
    wrap.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  wrap.innerHTML = albums.map(al => `
    <div class="gal-album">
      <div class="gal-album-head">
        <h2>📁 ${al.album}</h2>
        <span>${al.photos.length} foto · 📅 ${al.date}</span>
      </div>
      <div class="gal-grid">
        ${al.photos.map((p, pi) => {
          const flatIdx = GALERI_FLAT.findIndex(f => f.album === al.album && f._pi === pi);
          return `
          <button type="button" class="gal-photo" data-flat-idx="${flatIdx}" aria-label="Perbesar foto: ${p.caption}">
            <span aria-hidden="true">${p.icon}</span>
            <span class="gal-photo-cap">${p.caption}</span>
          </button>`;
        }).join("")}
      </div>
    </div>
  `).join("");

  wrap.querySelectorAll(".gal-photo").forEach(btn => {
    btn.addEventListener("click", () => openLightbox(parseInt(btn.dataset.flatIdx, 10)));
  });
}

// ---- Lightbox ----
let lbIndex = 0;
function openLightbox(idx) {
  lbIndex = idx;
  renderLightbox();
  document.getElementById("lightbox").classList.add("open");
}
function closeLightbox() {
  document.getElementById("lightbox").classList.remove("open");
}
function renderLightbox() {
  const p = GALERI_FLAT[lbIndex];
  document.getElementById("lightboxImg").textContent = p.icon;
  document.getElementById("lightboxCaption").textContent = p.caption;
  document.getElementById("lightboxMeta").textContent = `${p.album} · 📅 ${p.date}`;
}
function lbStep(dir) {
  lbIndex = (lbIndex + dir + GALERI_FLAT.length) % GALERI_FLAT.length;
  renderLightbox();
}

const galeriWrapEl = document.getElementById("galeriAlbums");
if (galeriWrapEl) {
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderGaleri();
    });
  });
  renderGaleri();

  document.getElementById("lightboxClose").addEventListener("click", closeLightbox);
  document.getElementById("lightboxPrev").addEventListener("click", () => lbStep(-1));
  document.getElementById("lightboxNext").addEventListener("click", () => lbStep(1));
  document.getElementById("lightbox").addEventListener("click", (e) => {
    if (e.target.id === "lightbox") closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (!document.getElementById("lightbox").classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") lbStep(-1);
    if (e.key === "ArrowRight") lbStep(1);
  });
}
