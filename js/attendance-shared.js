// ============================================================================
// MODUL BERSAMA — Fitur Absensi QR Code
// Dipakai oleh: absensi-siswa.html (Portal Siswa), absensi-scan.html &
// absensi-rekap.html (Portal Guru).
//
// Skema: attendance/{docId} : {
//   studentId    : uid siswa
//   studentName  : string (denormalisasi, sama seperti examTitle di results)
//   nis          : string opsional (denormalisasi dari students/{uid})
//   classId      : string (sama seperti field classId di users/schedules —
//                  di project ini classId SEKALIGUS jadi label kelas, mis. "XII IPA 1")
//   date         : "YYYY-MM-DD" (string, zona waktu lokal perangkat yang mencatat)
//   status       : "hadir" | "izin" | "sakit" | "alpa"
//   method       : "qr" (hasil scan) | "manual" (diisi/diubah guru dari Rekap)
//   time         : "HH:MM" jam saat dicatat/diubah terakhir
//   recordedBy   : uid guru yang mencatat/mengubah terakhir
//   recordedByName: string
//   updatedAt    : Timestamp (serverTimestamp) — waktu pencatatan/perubahan TERAKHIR
//                  (sengaja tidak ada field createdAt terpisah supaya scan/edit
//                  ulang di hari yang sama cukup satu write tanpa perlu getDoc
//                  dulu untuk cek dokumen sudah ada atau belum)
// }
//
// docId dibuat DETERMINISTIK: `${classId}__${date}__${studentId}` (karakter
// yang tidak aman untuk docId dibersihkan dulu). Ini sengaja supaya satu
// siswa hanya punya SATU dokumen absensi per hari per kelas — scan QR dua
// kali di hari yang sama otomatis nimpa (setDoc merge), bukan bikin data
// dobel — dan supaya guru bisa langsung tahu docId tanpa query tambahan saat
// mengedit status manual dari Rekap.
//
// Query yang dipakai di seluruh fitur ini SENGAJA disusun supaya index yang
// dibutuhkan minimal (pola sama seperti jadwal-pelajaran.js/kelas-jadwal.js):
// - classId==X + date==Y (dua kesetaraan) → TIDAK butuh composite index.
// - studentId==uid saja (tanpa orderBy) → TIDAK butuh composite index;
//   pengurutan "terbaru dulu" dihitung di client.
// - classId==X + date range (rekap bulanan) → BUTUH 1 composite index baru
//   (classId ASC, date ASC), sudah ditambahkan ke firestore.indexes.json.

export const QR_PREFIX = "SMAN1GEBOG-ABSEN:";

export const STATUS_LABEL = {
  hadir: "Hadir",
  izin: "Izin",
  sakit: "Sakit",
  alpa: "Alpa",
};

export const STATUS_ICON = {
  hadir: "✅",
  izin: "📩",
  sakit: "🤒",
  alpa: "❌",
};

/** Tanggal hari ini dalam format "YYYY-MM-DD" mengikuti zona waktu lokal perangkat. */
export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nowTimeStr(d = new Date()) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Bersihkan segmen supaya aman dipakai sebagai bagian docId Firestore. */
function safeSegment(s) {
  return String(s ?? "").trim().replace(/[/\s]+/g, "-") || "x";
}

export function attendanceDocId(classId, date, studentId) {
  return `${safeSegment(classId)}__${date}__${studentId}`;
}

export function makeQrPayload(studentId) {
  return `${QR_PREFIX}${studentId}`;
}

/** Kembalikan uid siswa dari isi QR, atau null jika bukan QR absensi sistem ini. */
export function parseQrPayload(text) {
  if (typeof text !== "string" || !text.startsWith(QR_PREFIX)) return null;
  const uid = text.slice(QR_PREFIX.length).trim();
  return uid || null;
}

export function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
