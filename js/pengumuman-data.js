// Data CONTOH pengumuman — akan diganti data asli dari Firestore (collection: announcements).
const PENGUMUMAN_DATA = [
  {
    title: "Contoh: Jadwal Ujian Akhir Semester",
    category: "Akademik",
    date: "— belum ada data",
    urgent: true,
    icon: "📌",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung. Bagian ini menampilkan contoh struktur pengumuman penting yang dapat diperluas siswa untuk membaca isi selengkapnya."
  },
  {
    title: "Contoh: Pengumpulan Berkas Beasiswa",
    category: "Umum",
    date: "— belum ada data",
    urgent: false,
    icon: "📄",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Perubahan Jadwal Upacara Bendera",
    category: "Kegiatan",
    date: "— belum ada data",
    urgent: false,
    icon: "📅",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Pemberitahuan Libur Sekolah",
    category: "Umum",
    date: "— belum ada data",
    urgent: true,
    icon: "📌",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Sosialisasi Tata Tertib Sekolah",
    category: "Umum",
    date: "— belum ada data",
    urgent: false,
    icon: "📄",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Jadwal Pengambilan Rapor",
    category: "Akademik",
    date: "— belum ada data",
    urgent: false,
    icon: "📄",
    detail: "Detail lengkap pengumuman akan tampil di sini setelah data Firestore terhubung."
  },
];

function renderPengumumanList() {
  const list = document.getElementById("pengumumanList");
  const empty = document.getElementById("pengumumanEmpty");
  if (!list) return;

  const query = document.getElementById("pengumumanSearch").value.trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";

  const filtered = PENGUMUMAN_DATA
    .map((p, i) => ({ ...p, _idx: i }))
    .filter(p => {
      const matchCategory = category === "semua" || p.category === category;
      const matchQuery = !query || p.title.toLowerCase().includes(query);
      return matchCategory && matchQuery;
    })
    .sort((a, b) => (b.urgent === a.urgent ? 0 : b.urgent ? 1 : -1));

  if (!filtered.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = filtered.map(p => `
    <div class="peng-item ${p.urgent ? "urgent" : ""}" data-idx="${p._idx}">
      <button type="button" class="peng-head" aria-expanded="false">
        <div class="peng-icon ${p.urgent ? "urgent" : ""}">${p.icon}</div>
        <div class="peng-head-body">
          <div class="peng-badges">
            <span class="peng-cat">${p.category}</span>
            ${p.urgent ? `<span class="peng-urgent-tag">Penting</span>` : ""}
          </div>
          <p class="peng-title">${p.title}</p>
          <p class="peng-date">📅 ${p.date}</p>
        </div>
        <span class="peng-chev">⌄</span>
      </button>
      <div class="peng-detail">
        <div class="peng-detail-inner">${p.detail}</div>
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

const pengumumanSearchEl = document.getElementById("pengumumanSearch");
if (pengumumanSearchEl) {
  pengumumanSearchEl.addEventListener("input", renderPengumumanList);
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderPengumumanList();
    });
  });
  renderPengumumanList();
}
