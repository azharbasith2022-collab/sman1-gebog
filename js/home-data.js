// Khusus Beranda (index.html). Jangan sertakan file ini di halaman lain
// karena elemen #newsList, #annList, dst. hanya ada di Beranda.

// ---- Contoh data (DATA CONTOH — akan diganti data asli dari Firestore) ----
const news = [
  {title:"Contoh: Judul Berita Sekolah", date:"— belum ada data", excerpt:"Konten berita akan tampil di sini setelah data Firestore terhubung."},
  {title:"Contoh: Kegiatan Sekolah", date:"— belum ada data", excerpt:"Deskripsi singkat berita akan tampil di sini."},
  {title:"Contoh: Pengumuman Kegiatan", date:"— belum ada data", excerpt:"Ringkasan konten berita akan tampil di sini."},
];
const anns = [
  {title:"Contoh judul pengumuman", date:"— belum ada data", urgent:true, icon:"📌"},
  {title:"Contoh judul pengumuman", date:"— belum ada data", urgent:false, icon:"📄"},
  {title:"Contoh judul pengumuman", date:"— belum ada data", urgent:false, icon:"📅"},
];
const agenda = [
  {d:"—", m:"—", title:"Contoh nama kegiatan", info:"Waktu & lokasi akan tampil di sini"},
  {d:"—", m:"—", title:"Contoh nama kegiatan", info:"Waktu & lokasi akan tampil di sini"},
];
const prestasi = [
  {medal:"🥇", tag:"Tingkat Kabupaten", title:"Contoh nama prestasi", info:"Nama siswa/tim · Tahun"},
  {medal:"🥈", tag:"Tingkat Provinsi", title:"Contoh nama prestasi", info:"Nama siswa/tim · Tahun"},
  {medal:"🏅", tag:"Tingkat Nasional", title:"Contoh nama prestasi", info:"Nama siswa/tim · Tahun"},
];

document.getElementById('newsList').innerHTML = news.map(n => `
  <div class="news-item">
    <div class="news-thumb"></div>
    <div class="news-body">
      <h3>${n.title}</h3>
      <div class="news-meta">📅 ${n.date}</div>
      <div class="news-excerpt">${n.excerpt}</div>
    </div>
  </div>`).join('');

document.getElementById('annList').innerHTML = anns.map(a => `
  <div class="ann-item">
    <div class="ann-icon ${a.urgent ? 'urgent' : ''}">${a.icon}</div>
    <div>
      <p class="ann-title">${a.title}</p>
      <p class="ann-date">${a.date}</p>
    </div>
    <span class="chev">›</span>
  </div>`).join('');

document.getElementById('agendaList').innerHTML = agenda.map(a => `
  <div class="agenda-item">
    <div class="agenda-date"><b>${a.d}</b><span>${a.m}</span></div>
    <div class="agenda-info"><h3>${a.title}</h3><p>${a.info}</p></div>
  </div>`).join('');

document.getElementById('prestasiList').innerHTML = prestasi.map(p => `
  <div class="prestasi-card">
    <div class="prestasi-medal">${p.medal}</div>
    <span class="prestasi-tag">${p.tag}</span>
    <h3>${p.title}</h3>
    <p>${p.info}</p>
  </div>`).join('');

document.getElementById('galleryGrid').innerHTML = Array.from({length:6}).map(()=>'<div class="gal-tile">🖼️</div>').join('');
