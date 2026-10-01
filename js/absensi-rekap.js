// Khusus absensi-rekap.html (Portal Guru/TU/Admin). Dua tab:
// - "Harian": daftar SELURUH siswa satu kelas untuk satu tanggal, dengan
//   dropdown status yang bisa diubah manual (Hadir/Izin/Sakit/Alpa) — dipakai
//   untuk mengisi Izin/Sakit/Alpa (yang wajar tidak lewat scan QR) atau
//   mengoreksi hasil scan yang salah.
// - "Bulanan": rekap jumlah Hadir/Izin/Sakit/Alpa per siswa untuk satu kelas
//   dalam satu bulan.
// Kedua tab bisa diekspor ke Excel (SheetJS) atau PDF (jsPDF + autotable),
// keduanya dimuat dari CDN sebagai library global (bukan modul).
//
// Daftar kelas & roster siswa diambil dari collection `students` TANPA
// where/orderBy (siapa pun yang punya akses ke halaman ini memang staf yang
// boleh melihat seluruh siswa — pola sama seperti Manajemen Website untuk
// admin) — dikelompokkan per classId di client.
//
// Query attendance:
// - Tab Harian: classId==X + date==Y (dua kesetaraan) → TIDAK butuh index baru.
// - Tab Bulanan: classId==X + date>=awal + date<=akhir → BUTUH composite index
//   (classId ASC, date ASC), sudah ditambahkan ke firestore.indexes.json.

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import {
  collection, query, where, onSnapshot, doc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import {
  attendanceDocId, todayStr, nowTimeStr, STATUS_LABEL, escapeHtml,
} from "./attendance-shared.js";

const STATUS_KEYS = ["hadir", "izin", "sakit", "alpa"];

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

function monthBounds(monthValue) {
  // monthValue: "YYYY-MM" → batas string "YYYY-MM-01".."YYYY-MM-31"
  // (perbandingan string, cukup aman karena tanggal tidak valid seperti
  // "-32" tidak pernah benar-benar tersimpan sebagai data)
  return [`${monthValue}-01`, `${monthValue}-31`];
}

export function initAbsensiRekap() {
  requireAuth(["guru", "tu", "admin", "developer"], (user, profile) => {
    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.href = "login.html";
    });

    const chipsEl = document.getElementById("classChips");
    const modeTabs = document.querySelectorAll(".att-mode-tabs button");
    const harianPanel = document.getElementById("harianPanel");
    const bulananPanel = document.getElementById("bulananPanel");
    const harianDate = document.getElementById("harianDate");
    const bulananMonth = document.getElementById("bulananMonth");
    const summaryEl = document.getElementById("rekapSummary");
    const rosterEl = document.getElementById("rosterList");
    const harianContent = document.getElementById("harianContent");
    const rekapTableWrap = document.getElementById("rekapTableWrap");
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");

    const now = new Date();
    harianDate.value = todayStr();
    harianDate.max = todayStr();
    bulananMonth.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    let allStudents = [];
    let activeClassId = null;
    let mode = "harian";
    let unsubHarian = null;
    let unsubBulanan = null;
    let exportRows = []; // { header:[...], rows:[[...]], title:"..." } — diisi ulang tiap render

    // ---- 1) Daftar kelas (dari seluruh siswa terdaftar) ----
    onSnapshot(collection(db, "students"), (snap) => {
      allStudents = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const seen = new Map();
      allStudents.forEach(s => { if (s.classId && !seen.has(s.classId)) seen.set(s.classId, s.classId); });
      const classIds = Array.from(seen.keys()).sort();

      if (classIds.length === 0) {
        chipsEl.innerHTML = `<span style="font-size:12px;color:var(--text-soft);">Belum ada data kelas siswa.</span>`;
        return;
      }
      if (!activeClassId || !classIds.includes(activeClassId)) activeClassId = classIds[0];

      chipsEl.innerHTML = classIds.map(id => `
        <button type="button" class="filter-chip${id === activeClassId ? " active" : ""}" data-class="${escapeHtml(id)}">${escapeHtml(id)}</button>
      `).join("");
      chipsEl.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
          chipsEl.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
          btn.classList.add("active");
          activeClassId = btn.dataset.class;
          renderActiveMode();
        });
      });
      renderActiveMode();
    }, () => {
      chipsEl.innerHTML = `<span style="font-size:12px;color:#8a2c2c;">Gagal memuat daftar kelas.</span>`;
    });

    modeTabs.forEach(btn => {
      btn.addEventListener("click", () => {
        modeTabs.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        mode = btn.dataset.mode;
        harianPanel.style.display = mode === "harian" ? "block" : "none";
        bulananPanel.style.display = mode === "bulanan" ? "block" : "none";
        harianContent.style.display = mode === "harian" ? "block" : "none";
        rekapTableWrap.style.display = mode === "bulanan" ? "block" : "none";
        renderActiveMode();
      });
    });
    harianDate.addEventListener("change", renderActiveMode);
    bulananMonth.addEventListener("change", renderActiveMode);

    function renderActiveMode() {
      if (!activeClassId) return;
      if (mode === "harian") watchHarian(); else watchBulanan();
    }

    function rosterForClass() {
      return allStudents.filter(s => s.classId === activeClassId)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "id"));
    }

    // ---- Tab Harian ----
    function watchHarian() {
      if (unsubHarian) unsubHarian();
      if (unsubBulanan) unsubBulanan();
      const roster = rosterForClass();
      const date = harianDate.value || todayStr();
      const qDay = query(collection(db, "attendance"), where("classId", "==", activeClassId), where("date", "==", date));
      unsubHarian = onSnapshot(qDay, (snap) => {
        const byStudent = new Map();
        snap.forEach(d => byStudent.set(d.data().studentId, d.data()));
        renderSummary(roster, byStudent);
        renderRoster(roster, byStudent, date);
        exportRows = {
          title: `Absensi ${activeClassId} - ${date}`,
          header: ["Nama", "NIS", "Status", "Jam", "Metode"],
          rows: roster.map(s => {
            const r = byStudent.get(s.id);
            return [s.name || "—", s.nis || "-", r ? (STATUS_LABEL[r.status] || r.status) : "Belum diisi", r?.time || "-", r ? (r.method === "qr" ? "Scan QR" : "Manual") : "-"];
          }),
        };
      }, () => renderEmpty(rosterEl, "⚠️", "Gagal memuat data absensi."));
    }

    function renderSummary(roster, byStudent) {
      const counts = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
      let belum = 0;
      roster.forEach(s => {
        const r = byStudent.get(s.id);
        if (r && counts[r.status] !== undefined) counts[r.status]++; else belum++;
      });
      summaryEl.innerHTML = STATUS_KEYS.map(k => `
        <div class="att-summary-item"><strong>${counts[k]}</strong><span>${STATUS_LABEL[k]}</span></div>
      `).join("") + `<div class="att-summary-item"><strong>${belum}</strong><span>Belum Diisi</span></div>`;
      summaryEl.style.gridTemplateColumns = "repeat(5,1fr)";
    }

    function renderRoster(roster, byStudent, date) {
      if (roster.length === 0) {
        renderEmpty(rosterEl, "🎓", "Belum ada siswa terdaftar di kelas ini.");
        return;
      }
      rosterEl.innerHTML = roster.map(s => {
        const r = byStudent.get(s.id);
        const status = r?.status || "";
        return `
        <div class="att-roster-row">
          <div class="list-row-body">
            <h4>${escapeHtml(s.name || "—")}</h4>
            <p>${s.nis ? `NIS ${escapeHtml(s.nis)}` : "—"}${r ? ` · 🕒 ${escapeHtml(r.time || "-")} · ${r.method === "qr" ? "Scan QR" : "Manual"}` : ""}</p>
          </div>
          <select class="att-status-select" data-student="${escapeHtml(s.id)}" aria-label="Status absensi ${escapeHtml(s.name || "")}">
            <option value="" ${status === "" ? "selected" : ""}>Belum diisi</option>
            ${STATUS_KEYS.map(k => `<option value="${k}" ${status === k ? "selected" : ""}>${STATUS_LABEL[k]}</option>`).join("")}
          </select>
        </div>`;
      }).join("");

      rosterEl.querySelectorAll(".att-status-select").forEach(sel => {
        sel.addEventListener("change", async () => {
          const studentId = sel.dataset.student;
          const status = sel.value;
          if (!status) return; // "Belum diisi" dipilih ulang: tidak menulis apa pun
          const student = allStudents.find(s => s.id === studentId);
          const id = attendanceDocId(activeClassId, date, studentId);
          sel.disabled = true;
          try {
            await setDoc(doc(db, "attendance", id), {
              studentId,
              studentName: student?.name || "—",
              nis: student?.nis || "",
              classId: activeClassId,
              date,
              status,
              method: "manual",
              time: nowTimeStr(),
              recordedBy: user.uid,
              recordedByName: profile.name || "-",
              updatedAt: serverTimestamp(),
            }, { merge: true });
          } catch {
            alert("Gagal menyimpan status. Periksa koneksi lalu coba lagi.");
          } finally {
            sel.disabled = false;
          }
        });
      });
    }

    // ---- Tab Bulanan ----
    function watchBulanan() {
      if (unsubHarian) unsubHarian();
      if (unsubBulanan) unsubBulanan();
      const roster = rosterForClass();
      const [start, end] = monthBounds(bulananMonth.value);
      const qMonth = query(
        collection(db, "attendance"),
        where("classId", "==", activeClassId),
        where("date", ">=", start),
        where("date", "<=", end)
      );
      unsubBulanan = onSnapshot(qMonth, (snap) => {
        const perStudent = new Map();
        snap.forEach(d => {
          const r = d.data();
          if (!perStudent.has(r.studentId)) perStudent.set(r.studentId, { hadir: 0, izin: 0, sakit: 0, alpa: 0 });
          const c = perStudent.get(r.studentId);
          if (c[r.status] !== undefined) c[r.status]++;
        });

        const totals = { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
        roster.forEach(s => {
          const c = perStudent.get(s.id) || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
          STATUS_KEYS.forEach(k => { totals[k] += c[k]; });
        });
        summaryEl.style.gridTemplateColumns = "repeat(4,1fr)";
        summaryEl.innerHTML = STATUS_KEYS.map(k => `
          <div class="att-summary-item"><strong>${totals[k]}</strong><span>${STATUS_LABEL[k]}</span></div>
        `).join("");

        if (roster.length === 0) {
          rekapTableWrap.innerHTML = `<div class="empty-state"><div class="es-icon">🎓</div>Belum ada siswa terdaftar di kelas ini.</div>`;
          exportRows = { title: `Rekap ${activeClassId} - ${bulananMonth.value}`, header: ["Nama", "NIS", "Hadir", "Izin", "Sakit", "Alpa", "Total Tercatat"], rows: [] };
          return;
        }

        rekapTableWrap.innerHTML = `
          <div class="att-rekap-scroll">
            <table class="att-rekap-table">
              <thead><tr><th>Nama</th><th>NIS</th><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Alpa</th><th>Total</th></tr></thead>
              <tbody>
                ${roster.map(s => {
                  const c = perStudent.get(s.id) || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
                  const total = STATUS_KEYS.reduce((sum, k) => sum + c[k], 0);
                  return `<tr><td>${escapeHtml(s.name || "—")}</td><td>${escapeHtml(s.nis || "-")}</td><td>${c.hadir}</td><td>${c.izin}</td><td>${c.sakit}</td><td>${c.alpa}</td><td>${total}</td></tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>`;

        exportRows = {
          title: `Rekap ${activeClassId} - ${bulananMonth.value}`,
          header: ["Nama", "NIS", "Hadir", "Izin", "Sakit", "Alpa", "Total Tercatat"],
          rows: roster.map(s => {
            const c = perStudent.get(s.id) || { hadir: 0, izin: 0, sakit: 0, alpa: 0 };
            const total = STATUS_KEYS.reduce((sum, k) => sum + c[k], 0);
            return [s.name || "—", s.nis || "-", c.hadir, c.izin, c.sakit, c.alpa, total];
          }),
        };
      }, () => { rekapTableWrap.innerHTML = `<div class="empty-state"><div class="es-icon">⚠️</div>Gagal memuat rekap.</div>`; });
    }

    // ---- Export ----
    exportExcelBtn.addEventListener("click", () => {
      if (!exportRows.rows || !window.XLSX) return;
      const data = [exportRows.header, ...exportRows.rows];
      const ws = window.XLSX.utils.aoa_to_sheet(data);
      const wb = window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb, ws, "Absensi");
      window.XLSX.writeFile(wb, `${exportRows.title.replace(/[^a-zA-Z0-9]+/g, "_")}.xlsx`);
    });

    exportPdfBtn.addEventListener("click", () => {
      if (!exportRows.rows || !window.jspdf) return;
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF();
      pdf.setFontSize(12);
      pdf.text(exportRows.title, 14, 14);
      pdf.autoTable({ head: [exportRows.header], body: exportRows.rows, startY: 20, styles: { fontSize: 8 } });
      pdf.save(`${exportRows.title.replace(/[^a-zA-Z0-9]+/g, "_")}.pdf`);
    });
  });
}
