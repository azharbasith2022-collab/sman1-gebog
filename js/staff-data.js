// Data CONTOH guru & staff — akan diganti oleh data dari Firestore (collection: teachers, staff).
// Mudah dibedakan dari data production: semua entri di sini bertanda comment ini.
const STAFF_DATA = [
  { name: "Sukarno", role: "Kepala Sekolah", category: "pimpinan", subject: "" },
  { name: "Dra. Siti Aminah", role: "Wakil Kepala Sekolah — Kurikulum", category: "pimpinan", subject: "" },
  { name: "Ahmad Fauzi, S.Pd.", role: "Guru", category: "guru", subject: "Matematika" },
  { name: "Rina Kusuma, S.Pd.", role: "Guru", category: "guru", subject: "Bahasa Indonesia" },
  { name: "Budi Santoso, S.Pd.", role: "Guru", category: "guru", subject: "Fisika" },
  { name: "Dewi Lestari, S.Pd.", role: "Guru", category: "guru", subject: "Bahasa Inggris" },
  { name: "Muhammad Iqbal, S.Pd.", role: "Guru", category: "guru", subject: "Kimia" },
  { name: "Sri Wahyuni, S.Pd.", role: "Guru", category: "guru", subject: "Biologi" },
  { name: "Agus Setiawan, S.Pd.", role: "Guru", category: "guru", subject: "Sejarah" },
  { name: "Nur Hidayah, S.Pd.", role: "Guru", category: "guru", subject: "Pendidikan Agama Islam" },
  { name: "Eko Prasetyo, S.Kom.", role: "Guru", category: "guru", subject: "Informatika" },
  { name: "Wahyu Ramadhan, S.Pd.", role: "Guru", category: "guru", subject: "Penjaskes" },
  { name: "Tuti Marlina, A.Md.", role: "Kepala Tata Usaha", category: "tu", subject: "" },
  { name: "Joko Widodo", role: "Staf Tata Usaha", category: "tu", subject: "" },
  { name: "Umi Kalsum", role: "Staf Perpustakaan", category: "tu", subject: "" },
];

function initials(name) {
  return name.replace(/,.*$/, "").split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
}

function renderStaff(list) {
  const grid = document.getElementById("staffGrid");
  const empty = document.getElementById("staffEmpty");
  if (!list.length) {
    grid.innerHTML = "";
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";
  grid.innerHTML = list.map(p => `
    <div class="staff-card">
      <div class="staff-photo">${initials(p.name)}</div>
      <h3>${p.name}</h3>
      <p class="staff-role">${p.role}</p>
      ${p.subject ? `<p class="staff-subject">${p.subject}</p>` : ""}
    </div>
  `).join("");
}

function applyStaffFilter() {
  const query = document.getElementById("staffSearch").value.trim().toLowerCase();
  const activeChip = document.querySelector(".filter-chip.active");
  const category = activeChip ? activeChip.dataset.category : "semua";
  const filtered = STAFF_DATA.filter(p => {
    const matchCategory = category === "semua" || p.category === category;
    const matchQuery = !query || p.name.toLowerCase().includes(query) || p.subject.toLowerCase().includes(query) || p.role.toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });
  renderStaff(filtered);
}

document.getElementById("staffSearch").addEventListener("input", applyStaffFilter);
document.querySelectorAll(".filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    applyStaffFilter();
  });
});

renderStaff(STAFF_DATA);
