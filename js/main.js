document.getElementById('year').textContent = new Date().getFullYear();

  // Theme toggle (in-memory only — no localStorage per this environment's constraints)
  const themeBtn = document.getElementById('themeToggle');
  themeBtn.addEventListener('click', () => {
    const body = document.body;
    const isDark = body.getAttribute('data-theme') === 'dark';
    body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    themeBtn.textContent = isDark ? '🌙' : '☀️';
  });

  // Search overlay
  const searchBtn = document.getElementById('searchToggle');
  const searchBar = document.getElementById('searchBar');
  searchBtn.addEventListener('click', () => {
    const open = searchBar.classList.toggle('open');
    searchBtn.setAttribute('aria-expanded', open);
    if (open) searchBar.querySelector('input').focus();
  });

  // Nav drawer
  const menuBtn = document.getElementById('menuToggle');
  const bottomMenuBtn = document.getElementById('bottomMenuBtn');
  const menuClose = document.getElementById('menuClose');
  const navDrawer = document.getElementById('navDrawer');
  function openMenu(){ navDrawer.classList.add('open'); menuBtn.setAttribute('aria-expanded','true'); }
  function closeMenu(){ navDrawer.classList.remove('open'); menuBtn.setAttribute('aria-expanded','false'); }
  menuBtn.addEventListener('click', openMenu);
  bottomMenuBtn.addEventListener('click', (e)=>{ e.preventDefault(); openMenu(); });
  menuClose.addEventListener('click', closeMenu);
  navDrawer.addEventListener('click', (e)=>{ if(e.target === navDrawer) closeMenu(); });
  navDrawer.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
