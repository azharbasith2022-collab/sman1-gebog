// ============================================================================
// MODUL BERSAMA — Fitur Tugas Online
// Dipakai oleh: tugas-guru.html (Portal Guru) & tugas-siswa.html (Portal Siswa).
//
// Skema:
//   assignments/{id} : {
//     title, description, subject (opsional),
//     classId, classLabel, teacherId, teacherName,
//     deadline    : Timestamp,
//     createdAt / updatedAt : Timestamp (serverTimestamp)
//   }
//
//   submissions/{docId} : {
//     assignmentId, studentId, studentName, nis, classId,
//     link        : string (URL eksternal — Google Drive/OneDrive/dst,
//                    TIDAK ada file yang diunggah ke Firebase Storage,
//                    supaya sistem tetap Rp0),
//     late        : boolean (dihitung saat kirim/ubah),
//     submittedAt : Timestamp (serverTimestamp, ditulis ulang tiap kirim/ubah),
//     -- Nilai & Feedback (diisi guru, opsional) --
//     grade       : number|null   (0–100)
//     feedback    : string        (komentar guru)
//     gradedAt    : Timestamp     (serverTimestamp, saat guru menyimpan)
//     gradedByName: string        (nama guru)
//   }
//   docId dibuat DETERMINISTIK: `${assignmentId}__${studentId}` — satu siswa
//   hanya punya SATU dokumen pengumpulan per tugas (kirim ulang/ubah
//   menimpa via setDoc merge, bukan bikin data dobel).
//
// Query sengaja hanya SATU filter kesetaraan TANPA orderBy — tidak butuh
// composite index tambahan; urutan dihitung di client.

function safeSegment(s) {
  return String(s ?? "").trim().replace(/[/\s]+/g, "-") || "x";
}

export function submissionDocId(assignmentId, studentId) {
  return `${safeSegment(assignmentId)}__${safeSegment(studentId)}`;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

export function fmtDateTime(ts) {
  if (!ts?.toDate) return "—";
  const d = ts.toDate();
  const date = d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return `${date}, ${time} WIB`;
}

/** "2026-09-14T07:30" (format datetime-local) dari sebuah Timestamp */
export function toDatetimeLocalValue(ts) {
  if (!ts?.toDate) return "";
  const d = ts.toDate();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Validasi ringan: harus terlihat seperti URL http(s) yang wajar. */
export function looksLikeUrl(text) {
  try {
    const u = new URL(text);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Badge nilai — warna berbeda tiap rentang */
export function gradeBadge(grade) {
  if (grade === null || grade === undefined) return "";
  const n = Number(grade);
  const color = n >= 85 ? "diff-mudah" : n >= 70 ? "diff-sedang" : "diff-sulit";
  return `<span class="qb-badge ${color}">⭐ Nilai: ${n}</span>`;
}
