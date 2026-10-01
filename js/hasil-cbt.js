// Khusus hasil-cbt.html. Menampilkan SELURUH riwayat hasil CBT milik siswa
// yang login, langsung dari Firestore — bukan data contoh. Sesuai §32 spek:
// siswa hanya boleh melihat hasil miliknya sendiri (dijamin di firestore.rules
// lewat `resource.data.studentId == request.auth.uid`, bukan cuma di UI).
//
// Skema: results/{id} : { studentId, examId (opsional, untuk tautan balik dari
//                          Daftar CBT), examTitle, subject, score, correct,
//                          wrong, createdAt (Timestamp) }

import { requireAuth, logout } from "./auth.js";
import { db } from "./firebase-init.js";
import { collection, query, where, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-firestore.js";

function fmtDate(ts) {
  if (!ts?.toDate) return "—";
  return ts.toDate().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function renderSkeleton(el) {
  el.innerHTML = Array.from({ length: 3 }).map(() => `
    <div class="skeleton-row">
      <div class="skeleton-box" style="width:36px;height:36px;border-radius:10px;"></div>
      <div style="flex:1;">
        <div class="skeleton-box" style="width:70%;height:12px;margin-bottom:8px;"></div>
        <div class="skeleton-box" style="width:40%;height:10px;"></div>
      </div>
    </div>`).join("");
}

function renderEmpty(el, icon, text) {
  el.innerHTML = `<div class="empty-state"><div class="es-icon">${icon}</div>${text}</div>`;
}

export function initHasilCbt() {
  requireAuth(["siswa"], (user) => {
    const listEl = document.getElementById("resultList");
    const statsEl = document.getElementById("statsGrid");
    const statsBanner = document.getElementById("statsBanner");
    renderSkeleton(listEl);

    const highlightExamId = new URLSearchParams(location.search).get("examId");

    const qResult = query(
      collection(db, "results"),
      where("studentId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    onSnapshot(qResult, (snap) => {
      if (snap.empty) {
        statsBanner.style.display = "none";
        renderEmpty(listEl, "📊", "Belum ada riwayat hasil CBT. Hasil ujian yang sudah Anda kerjakan akan muncul di sini.");
        return;
      }

      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const scores = results.map(r => Number(r.score)).filter(n => !Number.isNaN(n));
      const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "—";
      const max = scores.length ? Math.max(...scores) : "—";
      const min = scores.length ? Math.min(...scores) : "—";

      statsBanner.style.display = "flex";
      statsEl.innerHTML = `
        <div class="stat"><b>${results.length}</b><span>Ujian Diikuti</span></div>
        <div class="stat"><b>${avg}</b><span>Rata-rata</span></div>
        <div class="stat"><b>${max}</b><span>Tertinggi</span></div>
        <div class="stat"><b>${min}</b><span>Terendah</span></div>
      `;

      listEl.innerHTML = results.map(r => {
        const isHighlighted = highlightExamId && r.examId === highlightExamId;
        const hasBreakdown = r.correct != null || r.wrong != null;
        return `
        <div class="list-row" id="result-${r.id}" style="${isHighlighted ? "background:var(--blue-100);border-radius:12px;padding-left:8px;padding-right:8px;" : ""}">
          <div class="list-row-icon" aria-hidden="true">📊</div>
          <div class="list-row-body">
            <h4>${r.examTitle || "—"}</h4>
            <p>${r.subject || ""} · ${fmtDate(r.createdAt)}${hasBreakdown ? ` · ✅ ${r.correct ?? "—"} · ❌ ${r.wrong ?? "—"}` : ""}</p>
          </div>
          <span class="list-row-score">${r.score ?? "—"}</span>
        </div>`;
      }).join("");

      if (highlightExamId) {
        const target = results.find(r => r.examId === highlightExamId);
        if (target) {
          document.getElementById(`result-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, () => {
      statsBanner.style.display = "none";
      renderEmpty(listEl, "⚠️", "Gagal memuat riwayat hasil. Periksa koneksi lalu muat ulang.");
    });

    document.getElementById("logoutBtn").addEventListener("click", async () => {
      await logout();
      location.replace("login.html");
    });
  });
}
