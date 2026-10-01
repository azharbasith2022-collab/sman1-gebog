// ============================================================================
// INISIALISASI FIREBASE — dipakai bersama oleh semua halaman yang butuh
// Authentication / Firestore (login.html, lupa-password.html, dan seluruh
// portal internal di fase berikutnya).
//
// Memakai Firebase JS SDK v10 (modular) langsung dari CDN Google — tidak
// butuh build step/bundler, dan tetap masuk Firebase free tier (Spark plan).
// ============================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Persistence default: tetap login walau tab/browser ditutup ("Ingat saya").
// Halaman login bisa memanggil setSessionOnly() jika pengguna mencentang
// "jangan ingat saya di perangkat ini" (mis. komputer lab bersama).
setPersistence(auth, browserLocalPersistence).catch(() => {
  // Jika persistence gagal diset (mis. mode private browsing yang membatasi
  // storage), Firebase Auth tetap jalan dengan persistence bawaan tab.
});

export async function setSessionOnlyPersistence() {
  await setPersistence(auth, browserSessionPersistence);
}

export async function setLocalPersistence() {
  await setPersistence(auth, browserLocalPersistence);
}
