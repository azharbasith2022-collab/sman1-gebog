// Khusus agenda.html. Data CONTOH — akan diganti data asli dari Firestore (collection: events).
const AGENDA_DATA = [
  {
    title: "Contoh: Ujian Tengah Semester Ganjil",
    category: "Akademik",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Upacara Peringatan Hari Pendidikan",
    category: "Kegiatan",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Rapat Wali Murid Kelas X",
    category: "Rapat",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Libur Semester Ganjil",
    category: "Libur",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Class Meeting Akhir Semester",
    category: "Kegiatan",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
  {
    title: "Contoh: Pembagian Rapor Semester",
    category: "Akademik",
    day: "—", mon: "—", monthGroup: "— belum ada data",
    time: "— belum ada data",
    location: "— belum ada data",
    desc: "Deskripsi lengkap kegiatan akan tampil di sini setelah data Firestore terhubung."
  },
];

function renderAgendaList() {
  const list = document.getElementById("agendaFullList");
  const empty = document.getElementById("agendaEmpty");
  if (!list) return;

  const query = document.getElementById("agendaSearch").value.trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";

  const filtered = AGENDA_DATA
    .map((a, i) => ({ ...a, _idx: i }))
    .filter(a => {
      const matchCategory = category === "semua" || a.category === category;
      const matchQuery = !query || a.title.toLowerCase().includes(query);
      return matchCategory && matchQuery;
    });

  if (!filtered.length) {
    list.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  let lastGroup = null;
  let html = "";
  filtered.forEach(a => {
    if (a.monthGroup !== lastGroup) {
      html += `<p class="agd-month-label">${a.monthGroup}</p>`;
      lastGroup = a.monthGroup;
    }
    html += `
    <div class="agd-item" data-idx="${a._idx}">
      <button type="button" class="agd-head" aria-expanded="false">
        <div class="agd-date"><b>${a.day}</b><span>${a.mon}</span></div>
        <div class="agd-head-body">
          <span class="agd-cat">${a.category}</span>
          <p class="agd-title">${a.title}</p>
          <div class="agd-meta"><span>🕒 ${a.time}</span><span>📍 ${a.location}</span></div>
        </div>
        <span class="agd-chev">⌄</span>
      </button>
      <div class="agd-detail">
        <div class="agd-detail-inner">${a.desc}</div>
      </div>
    </div>`;
  });
  list.innerHTML = html;

  list.querySelectorAll(".agd-head").forEach(btn => {
    btn.addEventListener("click", () => {
      const item = btn.closest(".agd-item");
      const isOpen = item.classList.contains("open");
      list.querySelectorAll(".agd-item.open").forEach(el => {
        el.classList.remove("open");
        el.querySelector(".agd-head").setAttribute("aria-expanded", "false");
      });
      if (!isOpen) {
        item.classList.add("open");
        btn.setAttribute("aria-expanded", "true");
      }
    });
  });
}

const agendaSearchEl = document.getElementById("agendaSearch");
if (agendaSearchEl) {
  agendaSearchEl.addEventListener("input", renderAgendaList);
  document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      renderAgendaList();
    });
  });
  renderAgendaList();
}
