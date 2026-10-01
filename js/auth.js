// ============================================================================
// MODUL AUTENTIKASI BERSAMA
// Dipakai oleh login.html, lupa-password.html, dan seluruh halaman portal
// internal (Siswa/Guru/TU/Admin/Developer) pada fase berikutnya.
// ============================================================================

import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import {
  doc,
  getDoc,
  addDoc,
  collection,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

// Halaman dashboard tiap role akan tersedia pada fase RBAC & Portal (lanjutan
// project ini). Peta ini sudah disiapkan sekarang supaya begitu halaman
// dashboard dibuat, redirect otomatis tinggal aktif tanpa mengubah kode login.
export const ROLE_DASHBOARD = {
  siswa: "dashboard-siswa.html",
  guru: "dashboard-guru.html",
  tu: "dashboard-tu.html",
  admin: "dashboard-admin.html",
  developer: "dashboard-admin.html",
};


/**
 * Samakan role lama dari bot (student/teacher) dengan role portal.
 * Juga menyamakan status aktif lama (active:false) dengan disabled:true.
 */
function normalizeUserProfile(data) {
  if (!data) return null;
  const roleMap = { student: "siswa", teacher: "guru", student_user: "siswa" };
  const role = roleMap[data.role] || data.role;
  return {
    ...data,
    role,
    disabled: data.disabled === true || data.active === false,
  };
}

export const ROLE_LABEL = {
  siswa: "Siswa",
  guru: "Guru",
  tu: "Tata Usaha",
  admin: "Admin",
  developer: "Developer",
};

/** Terjemahkan kode error Firebase Auth ke pesan berbahasa Indonesia yang aman ditampilkan. */
export function translateAuthError(code) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-disabled": "Akun ini telah dinonaktifkan. Hubungi Tata Usaha/Admin sekolah.",
    "auth/user-not-found": "Email atau kata sandi salah.",
    "auth/wrong-password": "Email atau kata sandi salah.",
    "auth/invalid-credential": "Email atau kata sandi salah.",
    "auth/invalid-login-credentials": "Email atau kata sandi salah.",
    "auth/missing-password": "Kata sandi wajib diisi.",
    "auth/email-already-in-use": "Email ini sudah terdaftar. Gunakan menu \"Lupa sandi?\" jika ini akun Anda.",
    "auth/weak-password": "Kata sandi minimal 6 karakter.",
    "auth/too-many-requests": "Terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.",
    "auth/network-request-failed": "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.",
    "config/missing": "Firebase website belum dikonfigurasi. Isi firebase-config.js dengan konfigurasi Web App Firebase Anda.",
    "firestore/permission-denied": "Login Firebase berhasil, tetapi profil pengguna tidak bisa dibaca dari Firestore. Periksa Firestore Rules dan dokumen users/{UID}.",
    "permission-denied": "Login Firebase berhasil, tetapi akses ke profil Firestore ditolak. Periksa Firestore Rules dan dokumen users/{UID}.",
    "firestore/profile-read-failed": "Login Firebase berhasil, tetapi profil pengguna gagal dibaca dari Firestore. Periksa koneksi dan Firestore Rules.",
  };
  return map[code] || "Terjadi kesalahan saat memproses permintaan. Silakan coba lagi.";
}

/** Login dengan email & password. Melempar Error dengan .code milik Firebase jika gagal. */
export async function loginWithEmail(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Kirim email reset password. Selalu diperlakukan sebagai "berhasil" di UI
 * (lihat lupa-password.html) untuk mencegah enumerasi akun terdaftar. */
export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function logout() {
  await signOut(auth);
}

/** Ambil dokumen role user dari Firestore collection `users` (bukan dari client-trusted claim). */
export async function getUserProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) return null;
    return normalizeUserProfile(snap.data());
  } catch (err) {
    // Bedakan kegagalan Firestore (rules/network/config) dari profil yang
    // memang tidak ada. Pemanggil login dapat menampilkan pesan yang jelas.
    const wrapped = new Error("Gagal membaca profil pengguna dari Firestore");
    wrapped.code = err?.code || "firestore/profile-read-failed";
    wrapped.cause = err;
    throw wrapped;
  }
}

/** Ambil dokumen pengaturan umum sistem (dipakai Pengaturan Sistem/30 & guard
 * mode pemeliharaan di bawah). Dokumen tunggal `settings/general`; jika belum
 * pernah disimpan admin, dianggap pengaturan default (mode pemeliharaan mati). */
export async function getSystemSettings() {
  const snap = await getDoc(doc(db, "settings", "general"));
  return snap.exists() ? snap.data() : {};
}

/** Catat satu aktivitas nyata ke collection `activityLogs` (§34 spek). Dokumen
 * tidak bisa diubah/dihapus siapa pun sesuai firestore.rules — hanya dibuat.
 * Kegagalan mencatat log TIDAK BOLEH menggagalkan aksi utama pengguna. */
export async function logActivity(user, profile, action, detail = "") {
  try {
    await addDoc(collection(db, "activityLogs"), {
      uid: user.uid,
      name: profile?.name || user.email || "—",
      role: profile?.role || "-",
      action,
      detail,
      createdAt: serverTimestamp(),
    });
  } catch {
    // diamkan: log adalah pelengkap, bukan syarat aksi utama berhasil.
  }
}

/** Dipanggil sekali di halaman portal untuk memastikan pengguna sudah login
 * dan rolenya termasuk yang diizinkan. Redirect otomatis jika tidak. */
export function requireAuth(allowedRoles, onReady) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.replace(`login.html?redirect=${next}`);
      return;
    }
    const profile = await getUserProfile(user.uid);
    if (!profile || profile.disabled || (allowedRoles && !allowedRoles.includes(profile.role))) {
      location.replace("unauthorized.html");
      return;
    }
    // Mode pemeliharaan (Pengaturan Sistem/30): saat aktif, hanya admin/developer
    // yang tetap bisa membuka portal — role lain diarahkan ke halaman info,
    // BUKAN dikunci permanen (admin bisa mematikannya kapan saja).
    if (!["admin", "developer"].includes(profile.role)) {
      const settings = await getSystemSettings().catch(() => ({}));
      if (settings.maintenanceMode) {
        location.replace("unauthorized.html?reason=maintenance");
        return;
      }
    }
    onReady(user, profile);
  });
}

export { onAuthStateChanged };
