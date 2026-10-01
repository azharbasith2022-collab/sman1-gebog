// Khusus prestasi.html. Data CONTOH — akan diganti data asli dari Firestore (collection: achievements).
const PRESTASI_DATA = [
  {
    title: "Contoh: Juara Lomba Karya Tulis Ilmiah",
    level: "Kabupaten",
    medal: "🥇",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Juara Lomba Cerdas Cermat",
    level: "Provinsi",
    medal: "🥈",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Juara Olimpiade Sains Nasional",
    level: "Nasional",
    medal: "🏅",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Juara Lomba Debat Bahasa Inggris",
    level: "Sekolah",
    medal: "🏅",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Juara Kompetisi Robotik Pelajar",
    level: "Internasional",
    medal: "🏆",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Juara Turnamen Futsal Pelajar",
    level: "Kabupaten",
    medal: "🥉",
    year: "— belum ada data",
    team: "— belum ada data",
    desc: "Dokumentasi dan keterangan lengkap prestasi akan tampil di sini setelah data Firestore terhubung."
  },
];

function renderPrestasiGrid() {
  const grid = document.getElementById("prestasiFullGrid");
  const empty = document.getElementById("prestasiEmpty");
  if (!grid) return;

  const query = document.getElementById("prestasiSearch").value.trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const level = activeChip ? activeChip.dataset.level : "semua";

  const filtered = PRESTASI_DATA.filter(p => {
    const matchLevel = level === "semua" || p.level === level;
    const matchQuery = !query ||
      p.title.toLowerCase().includes(query) ||
      p.team.toLowerCase().includes(query);
    return matchLevel && matchQuery;
  });

  if (!filtered.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  grid.innerHTML = filtered.map(p => `
    <div class="prestasi-full-card">
      <div class="prestasi-doc" aria-hidden="true">${p.medal}</div>
      <div class="prestasi-full-body">
        <div class="prestasi-full-top">
          <span class="prestasi-full-tag">Tingkat ${p.level}</span>
          <span class="prestasi-full-year">${p.year}</span>
        </div>
        <h3>${p.title}</h3>
        <p class="prestasi-full-meta">🧑‍🎓 ${p.team}</p>
        <p class="prestasi-full-meta">${p.desc}</p>
      </div>
    </div>`).join("");
}

const prestasiSearchEl = document.getElementById("prestasiSearch");
if (prestasiSearchEl) {
  prestasiSearchEl.addEventListener("input", renderPrestasiGrid);
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderPrestasiGrid();
    });
  });
  renderPrestasiGrid();
}
