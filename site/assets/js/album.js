/* gus.photos — album behavior layer (manifest-driven).
   Plain browser <script src> file: no imports/exports. Single IIFE, uses globals. */
(function(){
  const M = window.__MANIFEST__, SITE = window.__SITE__ || {};
  const BONUS = (M.bonus && M.bonus.photos) || [];
  // ALL = main timeline + bonus, chronological. Used for id/day lookups, favorites, hero —
  // so bonus photos open in the lightbox and bonus favorites join the carousel. Timeline/Grid
  // still iterate M.photos only (bonus is its own tab).
  const ALL = [...M.photos, ...BONUS].sort((a,b)=> a.datetime<b.datetime?-1 : a.datetime>b.datetime?1 : 0);
  const byId = Object.fromEntries(ALL.map(p => [p.id, p]));
  const ORDER = Object.fromEntries(ALL.map((p,i) => [p.id, i])); // chronological index (main + bonus)
  const THUMB = id => byId[id].tiers.thumb;
  const VIEW  = id => byId[id].tiers.view;
  const FULL  = id => byId[id].tiers.full;
  const META  = id => byId[id];
  let HERO_FAVS = ALL.filter(p => p.favorite).map(p => p.id);
  if(!HERO_FAVS.length){ // no favorites curated yet → cycle an even spread of the whole album
    const N = Math.min(12, M.photos.length), step = M.photos.length / N;
    HERO_FAVS = Array.from({length:N}, (_, i) => M.photos[Math.floor(i*step)].id);
  }
  const DAYOF = Object.fromEntries(ALL.map(p => [p.id, p.day]));
  let lang = localStorage.getItem('gp_lang') || 'en';
  let fullRes = localStorage.getItem('gp_fullres') === '1';

  const el = (tag, cls, html) => { const e=document.createElement(tag); if(cls)e.className=cls; if(html!=null)e.innerHTML=html; return e; };
  const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function dateLabel(dt){ const [d]=dt.split(' '); const [Y,Mo,D]=d.split(':').map(Number); return `${MONTHS[Mo-1]} ${D}`; }
  function dateTimeLabel(dt){ const [d,t]=dt.split(' '); const [Y,Mo,D]=d.split(':').map(Number); return `${MONTHS[Mo-1]} ${D}, ${Y} · ${(t||'').slice(0,5)}`; }
  const phaseSpans = ph => ph ? `<span class="en">${ph.en}</span><span class="pt">${ph.pt}</span>` : '';

  function figure(p){
    const f = el('figure'); f.dataset.id = p.id; if(p.favorite) f.dataset.fav='1';
    const img = new Image(); img.loading='lazy'; img.src = THUMB(p.id); img.alt='';
    f.append(img);
    const bits = [];
    if(p.fnumber) bits.push('ƒ/'+p.fnumber); if(p.exposure) bits.push(p.exposure+'s'); if(p.iso) bits.push('ISO '+p.iso);
    if(bits.length) f.append(el('div','chip', '<b>●</b> '+bits.join(' · ')));
    if(p.favorite){ const s=el('span','fav-star'); s.textContent='★'; f.append(s); }
    return f;
  }
  function videoTile(v){
    const f = el('figure','vid'); f.dataset.vid='1'; f.dataset.src=v.src; if(v.poster) f.dataset.poster=v.poster;
    if(v.original) f.dataset.original=v.original;
    const img = new Image(); img.loading='lazy'; img.src=v.poster; img.alt=''; f.append(img);
    f.append(el('span','vbadge', v.dur||'')); f.append(el('span','vlabel','VIDEO'));
    return f;
  }

  function renderTimeline(){
    const tl = el('div','tl'); let phEn=null, day=null, grid=null;
    for(const p of M.photos){
      const cur = p.phase ? p.phase.en : '';
      if(cur !== phEn){ phEn=cur; day=null; const ch=el('div','chapter'); ch.append(el('div','ph', phaseSpans(p.phase))); tl.append(ch); }
      if(p.day !== day){ day=p.day; const dg=el('div','day-group'); const h=el('div','day-head');
        h.append(el('span','day-date', dateLabel(p.datetime))); h.append(el('span','day-n', `Day ${p.day}`));
        dg.append(h); grid=el('div','grid'); dg.append(grid); tl.append(dg); }
      grid.append(figure(p));
    }
    document.getElementById('timeline').replaceChildren(tl);
  }
  const renderGrid = () => { const g = el('div','fav-grid'); M.photos.forEach(p => g.append(figure(p))); document.getElementById('grid').replaceChildren(g); };
  const renderFavorites = () => {
    const favs = ALL.filter(p=>p.favorite);
    const g=el('div','fav-grid'); favs.forEach(p=>g.append(figure(p)));
    document.getElementById('favorites').replaceChildren(g);
    const sm = document.querySelector('.tab[data-view="favorites"] small'); if(sm) sm.textContent = favs.length;
  };
  function renderBonus(){
    const b = M.bonus || {photos:[],videos:[]}; const g=el('div','fav-grid');
    (b.photos||[]).forEach(p => g.append(figure(p)));
    (b.videos||[]).forEach(v => g.append(videoTile(v)));
    document.getElementById('bonus').replaceChildren(g);
  }
  renderTimeline(); renderGrid(); renderFavorites(); renderBonus();
  if(M.lastDay){ const sc=document.getElementById('scrub'); if(sc) sc.max = String(M.lastDay); }

  // ── attach lightbox clicks (figures only; video tiles have no data-id, so they won't open) ──
  document.querySelectorAll('figure[data-id]').forEach(f => { f.onclick = () => openModal(f); });
  // video tiles open the video player overlay (they carry data-src, not data-id, so the photo lightbox skips them)
  document.querySelectorAll('figure[data-vid]').forEach(f => {
    f.onclick = () => openVideo(f.dataset.src, f.dataset.poster, f.dataset.original);
  });

  // ── i18n: EN/PT toggle, persisted to localStorage ──
  function setLang(l){
    lang = l;
    try{ localStorage.setItem('gp_lang', l); }catch(e){}
    document.body.className = 'lang-' + l;
    document.getElementById('enBtn').classList.toggle('on', l==='en');
    document.getElementById('ptBtn').classList.toggle('on', l==='pt');
    document.documentElement.lang = l==='pt' ? 'pt-BR' : 'en';
    // re-render open lightbox so #mDay phase + giscus lang follow the language
    if(modal.classList.contains('open')){
      show();
      if(!commentsPane.hidden) loadComments();
    }
  }
  document.getElementById('enBtn').onclick = () => setLang('en');
  document.getElementById('ptBtn').onclick = () => setLang('pt');

  // ── tabs ──
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => {
      document.querySelectorAll('.tab').forEach(x => x.classList.remove('on')); t.classList.add('on');
      document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
      document.getElementById(t.dataset.view).classList.add('on');
    };
  });

  // ── lightbox ──
  const modal = document.getElementById('modal'), mImg = document.getElementById('mImg');
  let list = [], idx = 0;
  let zoomed = false, panX = 0, panY = 0, drag = null;  // lightbox 1:1 zoom + drag-to-pan

  function setRow(id, val){ const elv=document.getElementById(id); elv.textContent = val||''; const row=elv.closest('.row'); if(row) row.style.display = val ? '' : 'none'; }
  function fill(m){
    // bonus images may lack a capture date (e.g. a screenshot) → leave the day/date lines blank rather than "Day null"
    document.getElementById('mDay').textContent = (m.day != null) ? (`Day ${m.day}` + (m.phase ? ` · ${m.phase[lang]}` : '')) : '';
    document.getElementById('mDate').textContent = m.datetime ? dateTimeLabel(m.datetime) : '';
    setRow('mModel', m.model); setRow('mFocal', m.focal); setRow('mFocal35', m.focal35);
    setRow('mF', m.fnumber ? `ƒ/${m.fnumber}` : ''); setRow('mShutter', m.exposure ? `${m.exposure} s` : '');
    setRow('mIso', m.iso); setRow('mProfile', m.profile || '');
    document.getElementById('mDims').textContent = `${m.width} × ${m.height}`;
    // P3 badge only if profile present; HDR badge only if hdr:
    document.querySelector('.badge.p3').style.display = m.profile ? '' : 'none';
    document.querySelector('.badge.hdr').style.display = m.hdr ? '' : 'none';
  }

  function show(){
    const id = list[idx].dataset.id, m = META(id);
    resetZoom();                                          // changing photo exits 1:1 zoom
    mImg.src = fullRes ? FULL(id) : VIEW(id);
    fill(m);
    document.querySelector('.dl').href = FULL(id);
    document.getElementById('mCount').textContent = (idx+1) + ' / ' + list.length;
    document.getElementById('cCount').textContent = '';   // per-photo count; giscus fills it in
    if(!commentsPane.hidden) loadComments();
  }
  function openModal(fig){
    const sec = fig.closest('.view');
    list = [...sec.querySelectorAll('figure[data-id]')].sort((a,b)=>ORDER[a.dataset.id]-ORDER[b.dataset.id]);
    idx = list.indexOf(fig); show(); modal.classList.add('open');
  }
  function step(d){ idx = (idx+d+list.length)%list.length; show(); }
  function close_(){ modal.classList.remove('open'); if(document.fullscreenElement) document.exitFullscreen(); }
  function fs(){ if(!document.fullscreenElement){ modal.requestFullscreen && modal.requestFullscreen(); } else { document.exitFullscreen(); } }
  document.getElementById('closeX').onclick = close_;
  document.getElementById('prevBtn').onclick = () => step(-1);
  document.getElementById('nextBtn').onclick = () => step(1);
  document.getElementById('infoBtn').onclick = () => modal.classList.toggle('noinfo');
  document.getElementById('fsBtn').onclick = fs;
  document.addEventListener('keydown', e => {
    if(vmodal.classList.contains('open')){ if(e.key==='Escape' && !document.fullscreenElement) closeVideo(); return; }
    if(!modal.classList.contains('open')) return;
    if(e.key==='Escape'){ if(zoomed) setZoom(false); else if(!document.fullscreenElement) close_(); }
    else if(e.key==='ArrowLeft') step(-1);
    else if(e.key==='ArrowRight') step(1);
    else if(e.key==='z' || e.key==='Z') setZoom(!zoomed);
    else if(e.key==='i' || e.key==='I') modal.classList.toggle('noinfo');
    else if(e.key==='f' || e.key==='F') fs();
  });

  // ── lightbox 1:1 zoom + drag-to-pan (magnifier toggles native full size; drag to move) ──
  const zoomBtn = document.getElementById('zoomBtn'), stageEl = document.querySelector('.stage');
  function clampPan(){
    const r = stageEl.getBoundingClientRect();
    const mx = Math.max(0, (mImg.naturalWidth  - r.width)  / 2);
    const my = Math.max(0, (mImg.naturalHeight - r.height) / 2);
    panX = Math.max(-mx, Math.min(mx, panX));
    panY = Math.max(-my, Math.min(my, panY));
  }
  function applyPan(){ mImg.style.transform = `translate(calc(-50% + ${panX}px), calc(-50% + ${panY}px))`; }
  function resetZoom(){
    if(!zoomed) return;
    zoomed = false; modal.classList.remove('zoom'); zoomBtn.classList.remove('on');
    mImg.style.transform = ''; panX = panY = 0;
  }
  function setZoom(on){
    if(on === zoomed) return;
    const id = list[idx] && list[idx].dataset.id; if(!id) return;
    if(on){
      zoomed = true; modal.classList.add('zoom'); zoomBtn.classList.add('on');
      panX = panY = 0; applyPan();
      const full = FULL(id);
      if(mImg.getAttribute('src') !== full){          // load native resolution for true full size (preload to avoid a flash)
        const pre = new Image();
        pre.onload = () => { if(zoomed){ mImg.src = full; clampPan(); applyPan(); } };
        pre.src = full;
      } else { clampPan(); applyPan(); }
    } else {
      resetZoom();
      mImg.src = fullRes ? FULL(id) : VIEW(id);
    }
  }
  zoomBtn.onclick = () => setZoom(!zoomed);
  stageEl.addEventListener('pointerdown', e => {
    if(!zoomed) return;
    drag = { x: e.clientX, y: e.clientY, px: panX, py: panY };
    try { stageEl.setPointerCapture(e.pointerId); } catch(_){}
    e.preventDefault();
  });
  stageEl.addEventListener('pointermove', e => {
    if(!drag) return;
    panX = drag.px + (e.clientX - drag.x); panY = drag.py + (e.clientY - drag.y);
    clampPan(); applyPan();
  });
  const endDrag = () => { drag = null; };
  stageEl.addEventListener('pointerup', endDrag);
  stageEl.addEventListener('pointercancel', endDrag);

  // keep the Comments tab count in sync with giscus (replaces the static placeholder; blank when 0)
  window.addEventListener('message', e => {
    if(e.origin !== 'https://giscus.app') return;
    const g = e.data && e.data.giscus;
    if(g && g.discussion){
      const n = g.discussion.totalCommentCount || 0;
      document.getElementById('cCount').textContent = n ? ('· ' + n) : '';
    }
  });

  // ── video player overlay (bonus videos) ──
  const vmodal = document.getElementById('vmodal'), vmVideo = document.getElementById('vmVideo'), vmDl = document.getElementById('vmDl');
  function openVideo(src, poster, original){
    if(!src) return;
    if(poster) vmVideo.poster = poster; else vmVideo.removeAttribute('poster');
    if(original){ vmDl.href = original; vmDl.style.display=''; } else { vmDl.style.display='none'; }
    vmVideo.src = src; vmodal.classList.add('open');
    const pr = vmVideo.play(); if(pr && pr.catch) pr.catch(()=>{}); // autoplay may be blocked; controls remain
  }
  function closeVideo(){
    vmodal.classList.remove('open'); vmVideo.pause();
    vmVideo.removeAttribute('src'); vmVideo.load(); // stop buffering
    if(document.fullscreenElement) document.exitFullscreen();
  }
  document.getElementById('vmClose').onclick = closeVideo;
  vmodal.addEventListener('click', e => { if(e.target === vmodal) closeVideo(); });

  // ── full-res toggle (persisted) ──
  (function(){
    const tg = document.getElementById('fullresToggle'), note = document.getElementById('resNote');
    function applyNote(){ note.textContent = fullRes ? 'Full resolution · 4032px' : '2048px · faster'; }
    tg.checked = fullRes; applyNote();
    tg.addEventListener('change', () => {
      fullRes = tg.checked; try{ localStorage.setItem('gp_fullres', fullRes?'1':'0'); }catch(e){}
      applyNote();
      if(modal.classList.contains('open')) show();
    });
  })();

  // ── Details ⇄ Comments segmented toggle ──
  const detailsPane = document.getElementById('detailsPane'), commentsPane = document.getElementById('commentsPane');
  // comments need a configured giscus repo/category; until then hide the toggle and show details only
  const giscusOn = !!(SITE.giscus && SITE.giscus.repoId && SITE.giscus.categoryId);
  (function(){
    const segBox = document.querySelector('.seg');
    if(!giscusOn){ if(segBox) segBox.style.display = 'none'; commentsPane.hidden = true; detailsPane.hidden = false; return; }
    const bd = document.getElementById('segDetails'), bc = document.getElementById('segComments');
    function seg(comments){
      commentsPane.hidden = !comments; detailsPane.hidden = comments;
      bd.classList.toggle('on', !comments); bc.classList.toggle('on', comments);
      if(comments) loadComments();
    }
    bd.onclick = () => seg(false); bc.onclick = () => seg(true);
  })();

  // ── giscus comments: lazy, per-photo, nav-synced ──
  let giscusLoaded = false;
  function currentId(){ return list[idx] ? list[idx].dataset.id : null; }
  function loadComments(){
    if(!giscusOn) return;
    const id = currentId(); if(!id) return;
    const term = `${M.slug}:${id}`;
    const mount = document.getElementById('giscus-mount');
    if(!giscusLoaded){
      const s = document.createElement('script');
      s.src='https://giscus.app/client.js'; s.async=true; s.crossOrigin='anonymous';
      Object.assign(s.dataset, { repo:SITE.giscus.repo, repoId:SITE.giscus.repoId,
        category:SITE.giscus.category, categoryId:SITE.giscus.categoryId,
        mapping:'specific', term, strict:'1', reactionsEnabled:'1', emitMetadata:'0',
        inputPosition:'top', theme:'dark_dimmed', lang, loading:'lazy' });
      mount.replaceChildren(s); giscusLoaded = true;
    } else {
      const f = document.querySelector('iframe.giscus-frame');
      f && f.contentWindow.postMessage({ giscus:{ setConfig:{ term, lang } } }, 'https://giscus.app');
    }
  }

  // ── hero: crossfade + ken burns + play/pause + scrub + fullscreen ──
  const ALL_IDS = M.photos.map(p => p.id);
  const SLIDE_MS = 5200;
  const layers = [document.getElementById('layA'), document.getElementById('layB')];
  let kbDir = 0, hi = 0, autoTimer = null, playing = false;
  const scrub = document.getElementById('scrub');
  const heroDayEl = document.getElementById('heroDay'), heroPhaseEl = document.getElementById('heroPhase'), playBtn = document.getElementById('playBtn');
  // fallback day-threshold phase (only used when a photo carries no phase of its own)
  function phaseForDay(d){ return d<22?'Germination & Seedling':d<83?'Vegetative':d<119?'Flowering':'Harvest'; }
  function phaseFor(id){ const p = byId[id]; if(p && p.phase) return p.phase[lang]; return phaseForDay(DAYOF[id]); }
  function cap(id, moveHandle){
    const d = DAYOF[id]; if(moveHandle) scrub.value = d;
    heroDayEl.textContent = 'Day ' + d; heroPhaseEl.textContent = '· ' + phaseFor(id);
  }
  function shownLayer(){ return layers[0].classList.contains('show') ? layers[0] : layers[1]; }
  function crossTo(id, moveHandle){
    const out = shownLayer(), inc = (out===layers[0]) ? layers[1] : layers[0];
    inc.onload = function(){
      inc.onload = null;
      inc.style.animation = 'none'; void inc.offsetWidth;
      inc.style.animation = (kbDir?'kbIn':'kbOut') + ' ' + (SLIDE_MS+1600) + 'ms ease forwards'; kbDir = 1-kbDir;
      inc.classList.add('show'); out.classList.remove('show');
    };
    inc.src = VIEW(id); cap(id, moveHandle);
  }
  function showInstant(id){
    layers[0].onload = null; layers[1].onload = null;
    layers[0].style.animation = 'none'; layers[1].style.animation = 'none';
    layers[0].style.transform = 'none'; layers[1].style.transform = 'none';
    shownLayer().src = VIEW(id); cap(id, false);
  }
  function nearestByDay(day){ let best=ALL_IDS[0], bd=1e9; ALL_IDS.forEach(id => { const df=Math.abs(DAYOF[id]-day); if(df<bd){ bd=df; best=id; } }); return best; }
  function setPlay(p){
    playing = p; playBtn.innerHTML = p ? '&#9208;' : '&#9654;'; clearInterval(autoTimer);
    if(p){ autoTimer = setInterval(() => { hi = (hi+1)%HERO_FAVS.length; crossTo(HERO_FAVS[hi], true); }, SLIDE_MS); }
  }
  playBtn.onclick = () => setPlay(!playing);
  scrub.addEventListener('input', () => { setPlay(false); showInstant(nearestByDay(+scrub.value)); });
  document.getElementById('heroFsBtn').onclick = () => {
    const s = document.getElementById('heroStage');
    if(!document.fullscreenElement){ s.requestFullscreen && s.requestFullscreen(); } else { document.exitFullscreen(); }
  };
  (function(){
    const stage = document.getElementById('heroStage'), sb = document.querySelector('.scrubber'), home = sb.parentNode;
    document.addEventListener('fullscreenchange', () => {
      if(document.fullscreenElement === stage){ sb.classList.add('scrubber--fs'); stage.appendChild(sb); }
      else { sb.classList.remove('scrubber--fs'); home.appendChild(sb); }
    });
  })();

  // init i18n state (persisted lang + button states) before kicking off hero
  setLang(lang);

  if(HERO_FAVS.length){
    layers[0].src = VIEW(HERO_FAVS[0]); cap(HERO_FAVS[0], true);
    layers[0].style.animation = 'kbIn ' + (SLIDE_MS+1600) + 'ms ease forwards'; kbDir = 1;
    setPlay(true);
  }

  // Warm the scrub-target view images (the unique nearest-by-day photos, ~one per day) in the
  // background after first paint, so dragging the scrubber is responsive immediately. Sequential
  // (one at a time) to avoid competing with initial render / saturating the connection.
  setTimeout(function preloadScrub(){
    const targets = [...new Set(Array.from({length: M.lastDay || 0}, (_, i) => nearestByDay(i + 1)))];
    let i = 0;
    (function next(){
      if(i >= targets.length) return;
      const im = new Image();
      im.onload = im.onerror = () => { i++; next(); };
      im.src = VIEW(targets[i]);
    })();
  }, 1800);
})();
