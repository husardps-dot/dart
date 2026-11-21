(() => {

const ORDER = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
const R = { board:260, dOut:228.98, dIn:185.4, tOut:138.12, tIn:78.3, bull:78.3, eye:38.41, num:245.25 };
const COL = { black:'#1F1F1F', white:'#EFE6CF', green:'#1B9E5A', red:'#D7263D', bull:'#1B9E5A', eye:'#D7263D', bg:'#EFE6CF', ink:'#1F1F1F', dark:'#1F1F1F' };
const KEY = 'dart-scorer-v2';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const lsGet = k => { try{ const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; }catch(e){ return null; } };
const lsSet = (k,v) => { try{ localStorage.setItem(k, JSON.stringify(v)); return true; }catch(e){ return false; } };

/* ================= LOCAL DATABASE (IndexedDB, fallback localStorage) ================= */
const DB = (() => {
  let dbp = null;
  function open(){
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error('no idb'));
      const rq = indexedDB.open('dart-scorer', 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error);
    });
    return dbp;
  }
  async function get(k){
    try{
      const db = await open();
      return await new Promise((res, rej) => { const r = db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    }catch(e){ return lsGet('idb-' + k); }
  }
  async function set(k, v){
    try{
      const db = await open();
      await new Promise((res, rej) => { const tx = db.transaction('kv','readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      return 'idb';
    }catch(e){ return lsSet('idb-' + k, v) ? 'ls' : 'fail'; }
  }
  return { get, set };
})();
let ST = { rev:0, legs:[] }, syncState = 'idb';
const saveStatsQuiet = () => saveStats();
async function saveStats(){
  if (typeof undoTimer !== 'undefined' && undoTimer){ clearTimeout(undoTimer); undoTimer = null; undoSnap = null; $('undoBar').classList.remove('show'); }
  ST.rev = (ST.rev||0) + 1;
  lsSet(KEY, S);
  syncState = await DB.set('stats', ST);
  renderSyncInfo();
}
const legWord = n => n + ' ' + (n===1 ? 'leg' : (n%10>=2 && n%10<=4 && (n%100<12 || n%100>14)) ? 'legi' : 'legów');
function renderSyncInfo(){
  const el = $('syncInfo'); if (!el) return;
  el.textContent = { idb:`✓ Zapisane na tym urządzeniu · ${legWord(ST.legs.length)}`, ls:'✓ Zapisane w pamięci przeglądarki', fail:'⚠ Nie udało się zapisać – zrób kopię zapasową' }[syncState] || '';
}

/* ================= GAME STATE ================= */
let S = lsGet(KEY) || lsGet('dart-scorer-v1') || { phase:'setup', players:['Gracz 1','Gracz 2'], start:501, out:'double' };
if (S.phase === 'game' && !S.finished) { S.finished = []; S.pending = null; }
let tab = 'board', view = 'main';
const save = () => lsSet(KEY, S);

/* ---------- SETUP ---------- */
function renderSetup(){
  $('setup').style.display = ''; $('game').style.display = 'none'; $('btnNew').style.display = 'none';
  $('modeInfo').textContent = '';
  $('plist').innerHTML = S.players.map((p,i) => `<div class="p"><div class="n">${esc(p)}</div>
    <button class="btn" data-up="${i}" title="W górę" ${i===0?'disabled style="opacity:.3"':''}>↑</button>
    <button class="btn danger" data-del="${i}" title="Usuń">✕</button></div>`).join('') || '<div class="small">Dodaj przynajmniej jednego gracza.</div>';
  const inGame = new Set(S.players.map(p => p.toLowerCase()));
  const everyone = allPlayers();
  const known = everyone.filter(a => !inGame.has(a.key)).sort((x,y) => y.legs - x.legs || x.name.localeCompare(y.name,'pl')).slice(0,12).map(a => a.name);
  $('known').innerHTML = known.length ? '<span class="small">Dodaj szybko:</span> ' + known.map(n => `<button class="chip" data-add="${esc(n)}">+ ${esc(n)}</button>`).join('') : '';
  $('pnames').innerHTML = everyone.filter(a => !inGame.has(a.key)).map(a => `<option value="${esc(a.name)}">`).join('');
  $('startOpts').innerHTML = [301,501,701].map(v => `<button class="btn ${S.start===v?'sel':''}" data-start="${v}">${v}</button>`).join('');
  $('outOpts').innerHTML = [['double','Na podwójnym (double out)'],['single','Dowolnie']].map(([v,t]) => `<button class="btn ${S.out===v?'sel':''}" data-out="${v}">${t}</button>`).join('');
}
$('plist').onclick = e => {
  const d = e.target.dataset;
  if (d.del !== undefined) S.players.splice(+d.del,1);
  else if (d.up !== undefined && +d.up > 0){ const i=+d.up; [S.players[i-1],S.players[i]] = [S.players[i],S.players[i-1]]; }
  else return;
  save(); renderSetup();
};
function addPlayer(v){
  v = v.trim(); if (!v) return;
  if (S.players.some(p => p.toLowerCase() === v.toLowerCase())){ $('setupErr').textContent = `Gracz „${v}” już jest na liście.`; return; }
  $('setupErr').textContent = '';
  S.players.push(v); save(); renderSetup();
}
$('addForm').onsubmit = e => { e.preventDefault(); addPlayer($('pname').value); $('pname').value=''; $('pname').focus(); };
$('known').onclick = e => { const n = e.target.dataset.add; if (n) addPlayer(n); };
$('startOpts').onclick = e => { if (e.target.dataset.start){ S.start=+e.target.dataset.start; save(); renderSetup(); } };
$('outOpts').onclick = e => { if (e.target.dataset.out){ S.out=e.target.dataset.out; save(); renderSetup(); } };
$('btnStart').onclick = () => {
  if (!S.players.length){ $('setupErr').textContent = 'Dodaj przynajmniej jednego gracza.'; return; }
  if (registerNames(S.players)) saveStatsQuiet();
  S.phase = 'game';
  S.legs = S.players.map(() => 0);
  S.legStarter = 0;
  newLeg();
};
function newLeg(){
  S.turns = []; S.cur = []; S.player = S.legStarter; S.finished = []; S.pending = null; S.msg = '';
  marks = [];
  save(); render();
}

/* ---------- GAME LOGIC ---------- */
const turnTotal = darts => darts.reduce((a,d) => a + d.score, 0);
const isFinished = pi => S.finished.some(f => f.p === pi);
const placeOf = pi => { const i = S.finished.findIndex(f => f.p === pi); return i < 0 ? 0 : i+1; };
function remaining(pi){
  let r = S.start;
  for (const t of S.turns) if (t.p === pi && !t.bust) r -= t.total;
  if (pi === S.player) r -= turnTotal(S.cur);
  return r;
}
function legStats(pi, includeCur){
  let pts=0, darts=0, best=0, co=0, c180=0, c140=0, c100=0, busts=0;
  for (const t of S.turns) if (t.p === pi){
    darts += t.n;
    if (t.bust){ busts++; continue; }
    pts += t.total;
    if (t.n && t.total > best) best = t.total;
    if (t.fin) co = t.total;
    if (t.total === 180) c180++; else if (t.total >= 140) c140++; else if (t.total >= 100) c100++;
  }
  if (includeCur !== false && pi === S.player){ darts += S.cur.length; pts += turnTotal(S.cur); }
  return { pts, darts, best, co, c180, c140, c100, busts, avg: darts ? pts/darts*3 : 0 };
}
const isDoubleDart = d => d.m === 2;
const canThrow = () => S.phase==='game' && !S.pending && S.cur.length < 3 && !isFinished(S.player);
function nextActive(from){
  const n = S.players.length;
  for (let k=1;k<=n;k++){ const i=(from+k)%n; if (!isFinished(i)) return i; }
  return from;
}

function addDart(score, m, label){
  if (!canThrow()) return;
  const before = remaining(S.player);
  const d = { score, m, label };
  const after = before - score;
  S.msg = '';
  S.cur.push(d);
  if (after < 0 || (S.out==='double' && after === 1) || (after === 0 && S.out==='double' && !isDoubleDart(d))){ endTurn(true); return; }
  if (after === 0){ endTurn(false, true); return; }
  if (S.cur.length === 3) endTurn(false);
  else { save(); render(); }
}
function endTurn(bust, fin){
  const t = { p:S.player, darts:S.cur, total:turnTotal(S.cur), n:S.cur.length, bust:!!bust, fin:!!fin };
  S.turns.push(t);
  S.cur = [];
  const name = S.players[S.player];
  if (fin){
    S.finished.push({ p:S.player });
    const left = S.players.map((_,i)=>i).filter(i => !isFinished(i));
    if (left.length <= 1){
      if (left.length === 1) S.finished.push({ p:left[0], auto:true });
      S.pending = { type:'legEnd' };
    } else {
      S.pending = { type:'finish', p:S.player };
    }
    S.msg = '';
    save(); render(); showPending(); return;
  }
  S.msg = bust ? `${name}: przerzut (bust) – tura nie liczy się` : `${name}: ${t.total}`;
  S.msgBust = !!bust;
  S.player = nextActive(S.player);
  save(); render();
}
function undo(){
  S.msg='';
  if (S.pending && S.pending.early){
    S.finished = S.finished.filter(f => !f.auto);
    S.pending = { type:'finish', p:S.pending.from };
    save(); render(); showPending(); return;
  }
  if (S.pending){ S.pending = null; hideModal('finModal'); }
  if (S.cur.length){ S.cur.pop(); save(); render(); return; }
  const t = S.turns.pop();
  if (!t){ render(); return; }
  if (t.fin) S.finished = S.finished.filter(f => f.p !== t.p && !f.auto);
  S.player = t.p;
  S.cur = t.darts.slice(0,-1);
  save(); render();
}
function nextPlayer(){
  if (S.pending || isFinished(S.player)) return;
  endTurn(false);
}
function continueLeg(){
  S.pending = null; hideModal('finModal');
  S.player = nextActive(S.player);
  save(); render();
}
function endLegEarly(){
  const from = S.pending && S.pending.p;
  const left = S.players.map((_,i)=>i).filter(i => !isFinished(i)).sort((x,y) => remaining(x)-remaining(y));
  left.forEach(p => S.finished.push({ p, auto:true }));
  S.pending = { type:'legEnd', early:true, from };
  save(); render(); showPending();
}
function recordLeg(){
  const np = S.players.length;
  const entry = { d:new Date().toISOString(), start:S.start, out:S.out, np, players:[] };
  S.finished.forEach((f,idx) => {
    const st = legStats(f.p, false);
    entry.players.push({ n:S.players[f.p], pl:idx+1, dt:st.darts, pt:st.pts, bt:st.best, co:st.co, c180:st.c180, c140:st.c140, c100:st.c100, fin:!f.auto, tu:turnsStr(f.p) });
  });
  ST.legs.push(entry);
  const w = S.finished[0].p;
  S.legs[w] = (S.legs[w]||0) + 1;
}
function saveLegAnd(next){
  recordLeg();
  hideModal('finModal');
  if (next === 'leg'){ S.legStarter = (S.legStarter+1) % S.players.length; newLeg(); }
  else { S.phase='setup'; S.pending=null; save(); view='stats'; render(); }
  saveStats();
}

/* ---------- CHECKOUT HINTS ---------- */
const ALL = [];
for (let n=20;n>=1;n--) ALL.push({s:n*3,l:'T'+n});
for (let n=20;n>=1;n--) ALL.push({s:n,l:String(n)});
ALL.push({s:25,l:'25'});
const DBL = [];
for (let n=20;n>=1;n--) DBL.push({s:n*2,l:'D'+n});
DBL.push({s:50,l:'Bull'});
const SETUP = [...ALL, ...DBL].sort((a,b)=>b.s-a.s);
function checkout(rem, left){
  if (rem <= 0 || left <= 0) return null;
  const pref = r => { const d = (S.out==='double' ? DBL : [...DBL, ...ALL]).find(x=>x.s===r); return d?[d.l]:null; };
  let r = pref(rem); if (r) return r;
  if (left >= 2) for (const a of SETUP){ const x = pref(rem - a.s); if (x) return [a.l, ...x]; }
  if (left >= 3) for (const a of SETUP) for (const b of SETUP){ const x = pref(rem - a.s - b.s); if (x) return [a.l, b.l, ...x]; }
  return null;
}

/* ---------- BOARD ---------- */
function polar(r, deg){ const a = deg*Math.PI/180; return [r*Math.cos(a), r*Math.sin(a)]; }
function arc(r1, r2, a1, a2){
  const [x1,y1]=polar(r2,a1),[x2,y2]=polar(r2,a2),[x3,y3]=polar(r1,a2),[x4,y4]=polar(r1,a1);
  return `M${x1},${y1}A${r2},${r2} 0 0 1 ${x2},${y2}L${x3},${y3}A${r1},${r1} 0 0 0 ${x4},${y4}Z`;
}
function buildBoard(){
  // tarcza_dart_social.svg (1000×1000, środek 500) przeskalowana ×0,5306 do r = 260:
  // bull 0–72,39 · 25 do 147,56 · potrójne do 260,31 · pojedyncze do 349,40 · podwójne do 431,53 · obwódka z cyframi do 490
  let h = `<circle r="${R.board}" fill="${COL.bg}"/><g stroke="${COL.bg}" stroke-width="3.2" stroke-linejoin="round">`;
  ORDER.forEach((n,i) => {
    const mid = -90 + i*18, a1 = mid-9, a2 = mid+9;
    const dark = i % 2 === 0;
    const base = dark ? COL.black : COL.white;
    const ring = dark ? COL.red : COL.green;
    h += `<path d="${arc(R.tIn,R.tOut,a1,a2)}" fill="${ring}"/>`;
    h += `<path d="${arc(R.tOut,R.dIn,a1,a2)}" fill="${base}"/>`;
    h += `<path d="${arc(R.dIn,R.dOut,a1,a2)}" fill="${ring}"/>`;
  });
  h += `<path d="M${R.bull},0A${R.bull},${R.bull} 0 1 1 ${-R.bull},0A${R.bull},${R.bull} 0 1 1 ${R.bull},0ZM${R.eye},0A${R.eye},${R.eye} 0 1 0 ${-R.eye},0A${R.eye},${R.eye} 0 1 0 ${R.eye},0Z" fill="${COL.bull}" fill-rule="evenodd"/>`;
  h += `<circle r="${R.eye}" fill="${COL.eye}"/></g>`;
  h += `<g fill="${COL.ink}" font-family="'Space Grotesk', ui-sans-serif, system-ui, sans-serif" font-size="24.4" font-weight="500" text-anchor="middle" dominant-baseline="central" pointer-events="none">`;
  ORDER.forEach((n,i) => { const [x,y] = polar(R.num, -90 + i*18); h += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}">${n}</text>`; });
  h += `</g>`;
  h += `<g id="hl" class="hl" pointer-events="none"></g><g id="flash" pointer-events="none"></g><g id="marks" pointer-events="none"></g>`;
  $('board').innerHTML = h;
}
function hitAt(ev){
  const svg = $('board');
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  const r = Math.hypot(p.x, p.y);
  if (r > R.board) return null;
  let n, m, shape;
  const ring = (ro, ri) => `<path d="M${ro},0A${ro},${ro} 0 1 1 ${-ro},0A${ro},${ro} 0 1 1 ${ro},0ZM${ri},0A${ri},${ri} 0 1 0 ${-ri},0A${ri},${ri} 0 1 0 ${ri},0Z" fill-rule="evenodd"/>`;
  if (r <= R.eye){ n=25; m=2; shape=`<circle r="${R.eye}"/>`; }
  else if (r <= R.bull){ n=25; m=1; shape=ring(R.bull,R.eye); }
  else if (r > R.dOut){ n=0; m=0; shape=ring(R.board,R.dOut); }
  else {
    let deg = Math.atan2(p.y, p.x)*180/Math.PI + 90 + 9;
    deg = ((deg % 360) + 360) % 360;
    const i = Math.floor(deg/18);
    n = ORDER[i];
    let r1, r2;
    if (r > R.dIn){ m=2; r1=R.dIn; r2=R.dOut; }
    else if (r > R.tOut){ m=1; r1=R.tOut; r2=R.dIn; }
    else if (r > R.tIn){ m=3; r1=R.tIn; r2=R.tOut; }
    else { m=1; r1=R.bull; r2=R.tIn; }
    const mid = -90 + i*18;
    shape = `<path d="${arc(r1,r2,mid-9,mid+9)}"/>`;
  }
  const label = n===0 ? 'Pudło' : n===25 ? (m===2?'Bull':'25') : (m===3?'T':m===2?'D':'') + n;
  return { x:p.x, y:p.y, n, m, score:n*m, label, shape };
}
function showHL(h, strong){
  const g = $('hl'), tip = $('tip');
  if (!h || !canThrow()){ g.innerHTML=''; tip.classList.remove('show'); return; }
  g.innerHTML = h.shape + h.shape;
  g.setAttribute('class', strong ? 'hl strong' : 'hl');
  const word = h.m===3 ? 'potrójne' : h.m===2 ? (h.n===25?'środek':'podwójne') : h.n===0 ? 'poza polem punktowym' : 'pojedyncze';
  tip.innerHTML = `<b>${h.label}</b> <span>= ${h.score}</span><small>${word}</small>`;
  tip.classList.add('show');
}
function flash(h){
  const g = $('flash');
  g.innerHTML = h.shape;
  g.classList.remove('go'); void g.getBBox(); g.classList.add('go');
}
let pressing = false, lastHit = null, marks = [];
const svgEl = $('board');
svgEl.addEventListener('pointerdown', ev => {
  if (!canThrow()) return;
  pressing = true; lastHit = hitAt(ev);
  try{ svgEl.setPointerCapture(ev.pointerId); }catch(e){}
  showHL(lastHit, true);
  ev.preventDefault();
});
svgEl.addEventListener('pointermove', ev => {
  const h = hitAt(ev);
  if (pressing) lastHit = h;
  showHL(h, pressing);
});
svgEl.addEventListener('pointerup', ev => {
  if (!pressing) return;
  pressing = false;
  const h = hitAt(ev) || lastHit;
  lastHit = null;
  if (!h || !canThrow()){ showHL(null); return; }
  flash(h);
  marks.push([h.x,h.y]);
  addDart(h.score, h.m, h.n===0 ? '0' : h.label);
  showHL(ev.pointerType==='mouse' ? hitAt(ev) : null, false);
});
svgEl.addEventListener('pointercancel', () => { pressing=false; lastHit=null; showHL(null); });
svgEl.addEventListener('pointerleave', () => { if (!pressing) showHL(null); });
function drawMarks(){
  const g = document.getElementById('marks'); if (!g) return;
  if (!S.cur || !S.cur.length) marks = [];
  marks = marks.slice(0, S.cur ? S.cur.length : 0);
  g.innerHTML = marks.map(([x,y],i) => `<circle cx="${x}" cy="${y}" r="7" fill="#efe6cf" stroke="#000" stroke-width="2"/><text x="${x}" y="${y-12}" fill="#efe6cf" font-size="16" font-weight="700" text-anchor="middle" stroke="#000" stroke-width="3" paint-order="stroke">${i+1}</text>`).join('');
}

/* ---------- MODALS ---------- */
const showModal = id => $(id).classList.add('show');
const hideModal = id => $(id).classList.remove('show');
const MEDAL = ['🥇','🥈','🥉'];
const placeTxt = n => (MEDAL[n-1] || '') + ' ' + n + '.';
function standingsTable(){
  const ps = S.finished.map((f,idx) => ({ n:S.players[f.p], pl:idx+1 }));
  const pre = ps.length > 1 ? legDeltas(computeElo(), ps) : null;
  const rows = S.finished.map((f,idx) => {
    const st = legStats(f.p, false);
    const eloCell = pre ? `<b>${eloInt((pre.before[idx]+pre.d[idx])/100)}</b> <span class="${dCls(pre.d[idx])}">${fmtD(pre.d[idx]/100)}</span>` : '–';
    return `<tr><td>${placeTxt(idx+1)}</td><td class="l">${esc(S.players[f.p])}</td><td>${st.darts}</td><td>${st.avg.toFixed(1)}</td><td>${st.best||'–'}</td><td>${f.auto ? (remaining(f.p) ? `<span class="small">zost. ${remaining(f.p)}</span>` : '–') : st.co}</td><td class="nowrap">${eloCell}</td></tr>`;
  }).join('');
  return `<div class="tblwrap"><table class="tbl sm"><tr><th></th><th class="l">Gracz</th><th>Lotki</th><th>Śr.</th><th>Max</th><th>Check</th><th title="ELO po zapisaniu legu i zmiana">ELO</th></tr>${rows}</table></div>${pre ? '<div class="small" style="margin-top:6px">Zmiany ELO zapiszą się po kliknięciu „Zapisz”.</div>' : ''}`;
}
function showPending(){
  const P = S.pending; if (!P){ hideModal('finModal'); return; }
  if (P.type === 'finish'){
    const place = placeOf(P.p), st = legStats(P.p, false);
    $('finSub').textContent = `Miejsce ${place}. · checkout ${st.co}`;
    $('finTitle').textContent = `${MEDAL[place-1]||''} ${S.players[P.p]}`;
    const left = S.players.length - S.finished.length;
    $('finBody').innerHTML = `<div class="small">Średnia ${st.avg.toFixed(1)} · ${st.darts} lotek</div><p style="margin:12px 0 0">Zostało ${left} graczy – gracie dalej o kolejne miejsca, czy kończycie?</p><p class="small" style="margin:6px 0 0">„Zakończ leg” zapisze wynik; reszta dostanie miejsca wg pozostałych punktów.</p>`;
    $('finBtns').innerHTML = `<button class="btn" data-f="undo">↶ Cofnij</button><button class="btn" data-f="stop">Zakończ leg</button><button class="btn primary" data-f="cont">Gramy dalej</button>`;
  } else {
    $('finSub').textContent = S.pending.early ? 'Leg zakończony wcześniej' : 'Koniec legu';
    $('finTitle').textContent = `🏆 ${S.players[S.finished[0].p]}`;
    $('finBody').innerHTML = standingsTable();
    $('finBtns').innerHTML = `<button class="btn" data-f="undo">↶ Cofnij</button><button class="btn" data-f="end">Zapisz i zakończ</button><button class="btn primary" data-f="next">Zapisz i nowy leg</button>`;
  }
  showModal('finModal');
}
$('finBtns').onclick = e => {
  const f = e.target.dataset.f;
  if (f==='undo') undo();
  else if (f==='cont') continueLeg();
  else if (f==='stop') endLegEarly();
  else if (f==='next') saveLegAnd('leg');
  else if (f==='end') saveLegAnd('end');
};
let cfFn = null;
function promptBox(title, text, value, ok, fn, secret){
  confirmBox(title, text, ok, () => fn($('cfInput').value));
  $('cfInput').type = secret ? 'password' : 'text'; $('cfInput').maxLength = secret ? 40 : 20;
  $('cfIcon').style.display = secret ? '' : 'none';
  $('cfInput').style.display = ''; $('cfInput').value = value; setTimeout(() => { $('cfInput').focus(); $('cfInput').select(); }, 30);
}
$('cfInput').addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); $('cfOk').click(); } });
function confirmBox(title, text, ok, fn){
  $('cfInput').style.display = 'none'; $('cfIcon').style.display = 'none';
  $('cfTitle').textContent = title; $('cfText').textContent = text; $('cfOk').textContent = ok; cfFn = fn;
  $('cfCancel').style.display = fn ? '' : 'none';
  showModal('cfModal');
}
$('cfCancel').onclick = () => hideModal('cfModal');
$('cfOk').onclick = () => { hideModal('cfModal'); const f = cfFn; cfFn = null; if (f) f(); };

/* ---------- RANKING ELO (pairwise) ----------
   Start 1000. Każdy leg (mecz) z ≥2 graczami: każdy gracz porównywany z każdym rywalem.
   E_ij = 1 / (1 + 10^((R_j − R_i)/400)),  S_ij = 1 / 0 / 0,5 (wyżej / niżej / to samo miejsce)
   ΔR_i = Σ_j K_ij/(n−1) · (S_ij − E_ij),  K_ij = (K_i + K_j)/2,
   K = 40 (0–9 meczów), 32 (10–49), 24 (od 50) – liczone z meczów rozegranych PRZED tym meczem.
   Wszystko liczone z ELO sprzed meczu; ELO trzymane w setnych częściach punktu (liczby całkowite),
   a ewentualna różnica z zaokrągleń trafia do gracza z największą zmianą – suma zmian = dokładnie 0.
   Ranking jest zawsze przeliczany od zera ze wszystkich zapisanych legów w kolejności dat,
   więc usunięty (anulowany) leg nie ma na niego wpływu. Brak spadków za nieaktywność. */
const ELO_START = 1000;
const kFor = m => m < 10 ? 40 : m < 50 ? 32 : 24;
let eloState = null;
function legDeltas(state, ps){
  const n = ps.length;
  const keys = ps.map(p => p.n.toLowerCase());
  const before = keys.map(k => state.R.has(k) ? state.R.get(k) : ELO_START * 100);
  const Ks = keys.map(k => kFor(state.M.get(k) || 0));
  const raw = ps.map((p, i) => {
    let s = 0;
    for (let j = 0; j < n; j++){
      if (j === i) continue;
      const E = 1 / (1 + Math.pow(10, (before[j] - before[i]) / 100 / 400));
      const S = p.pl < ps[j].pl ? 1 : p.pl > ps[j].pl ? 0 : 0.5;
      s += (Ks[i] + Ks[j]) / 2 / (n - 1) * (S - E);
    }
    return s;
  });
  const d = raw.map(x => Math.round(x * 100));
  const residual = -d.reduce((a, b) => a + b, 0);
  if (residual){ let idx = 0; raw.forEach((x, i) => { if (Math.abs(x) > Math.abs(raw[idx])) idx = i; }); d[idx] += residual; }
  return { keys, before, d, Ks };
}
function computeElo(){
  const state = { R:new Map(), M:new Map(), PEAK:new Map(), LAST:new Map(), hist:new Map(), matches:[] };
  const legs = ST.legs.map((L, i) => ({ L, i })).sort((a, b) => a.L.d < b.L.d ? -1 : a.L.d > b.L.d ? 1 : a.i - b.i).map(x => x.L);
  for (const L of legs){
    L.players.forEach(p => { delete p.eb; delete p.ed; delete p.ea; delete p.k; });
    if (L.players.length < 2) continue;
    const ps = L.players;
    const { keys, before, d, Ks } = legDeltas(state, ps);
    const mi = state.matches.length;
    const rec = { L, idx:mi, rows:[] };
    ps.forEach((p, i) => {
      const k = keys[i], after = before[i] + d[i];
      state.R.set(k, after);
      state.M.set(k, (state.M.get(k) || 0) + 1);
      state.PEAK.set(k, Math.max(state.PEAK.has(k) ? state.PEAK.get(k) : ELO_START * 100, after));
      state.LAST.set(k, d[i]);
      p.eb = before[i] / 100; p.ed = d[i] / 100; p.ea = after / 100; p.k = Ks[i];
      if (!state.hist.has(k)) state.hist.set(k, []);
      state.hist.get(k).push({ d:L.d, idx:mi, b:p.eb, dd:p.ed, a:p.ea, k:p.k, pl:p.pl, np:ps.length, start:L.start });
      rec.rows.push({ key:k, name:p.n, pl:p.pl, b:p.eb, dd:p.ed, a:p.ea });
    });
    rec.rows.sort((a, b) => a.pl - b.pl);
    state.matches.push(rec);
  }
  eloState = state;
  return state;
}
const fmtElo = v => (Math.round(v * 10) / 10).toFixed(1).replace(/\.0$/, '');
const eloInt = v => Math.round(v);
const fmtD = v => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(1);
const dCls = v => v > 0 ? 'eup' : v < 0 ? 'edown' : 'esame';

/* line chart: series = [{name, color, muted, pts:[{x,y,tip}]}] */
function eloLineChart(series, opt){
  const W = 640, H = opt.h || 230, pl = 44, pr = opt.pr || 104, pt = 14, pb = 26;
  const all = series.flatMap(s => s.pts);
  if (!all.length) return '<div class="small">Brak meczów z rywalami.</div>';
  let yMin = Math.min(ELO_START, ...all.map(p => p.y)), yMax = Math.max(ELO_START, ...all.map(p => p.y));
  const span = Math.max(20, yMax - yMin); yMin -= span * 0.12; yMax += span * 0.12;
  const step = [5,10,20,25,50,100,200][[5,10,20,25,50,100,200].findIndex(s => (yMax - yMin) / s <= 6)] || 200;
  const xMin = opt.xMin, xMax = Math.max(opt.xMax, xMin + 1);
  const X = x => pl + (W - pl - pr) * (x - xMin) / (xMax - xMin), Y = v => pt + (H - pt - pb) * (1 - (v - yMin) / (yMax - yMin));
  let g = '';
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) g += `<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="grid"/><text x="${pl-6}" y="${(Y(v)+4).toFixed(1)}" class="ax" text-anchor="end">${v}</text>`;
  g += `<line x1="${pl}" x2="${W-pr}" y1="${Y(ELO_START).toFixed(1)}" y2="${Y(ELO_START).toFixed(1)}" class="base"/>`;
  const order = series.slice().sort((a, b) => (a.muted ? 0 : 1) - (b.muted ? 0 : 1));
  let lines = '', dots = '', labels = [];
  order.forEach(s => {
    if (!s.pts.length) return;
    const d = s.pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
    lines += `<path d="${d}" fill="none" stroke="${s.muted ? 'rgba(239,230,207,.16)' : s.color}" stroke-width="${s.muted ? 1.5 : 2.5}" stroke-linejoin="round" stroke-linecap="round"/>`;
    if (!s.muted){
      s.pts.forEach(p => { if (p.tip) dots += `<g class="hit" data-tip="${esc(p.tip)}"><circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="10" fill="transparent"/><circle cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="4" fill="${s.color}" stroke="#1f1f1f" stroke-width="2"/></g>`; });
      const last = s.pts[s.pts.length - 1];
      labels.push({ y:Y(last.y), x:X(last.x), text:`${s.name} ${eloInt(last.y)}`, color:s.color });
    }
  });
  labels.sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i-1].y < 13) labels[i].y = labels[i-1].y + 13;
  const lab = labels.map(l => `<text x="${(l.x + 8).toFixed(1)}" y="${(l.y + 4).toFixed(1)}" class="lbl" fill="${l.color}">${esc(l.text)}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.aria || 'Rozwój ELO')}">${g}${lines}${dots}${lab}
    <text x="${pl}" y="${H-6}" class="ax">${esc(opt.left || '')}</text><text x="${W-pr}" y="${H-6}" class="ax" text-anchor="end">${esc(opt.right || '')}</text></svg>`;
}
const HL_COLORS = ['#efe6cf', '#d7263d', '#1b9e5a'];
let eloHL = null, eloRecentN = 6;
function renderEloRanking(ag){
  const st = eloState;
  const ranked = ag.filter(a => a.mElo > 0);
  if (!st.matches.length){ $('eloChart').innerHTML = '<div class="small">Wykres pojawi się po pierwszym legu z co najmniej dwoma graczami.</div>'; $('eloChips').innerHTML = ''; $('eloRecent').innerHTML = '<div class="small">Brak meczów.</div>'; $('eloMore').style.display = 'none'; return; }
  if (!eloHL) eloHL = ranked.slice(0, 3).map(a => a.key);
  eloHL = eloHL.filter(k => ranked.some(a => a.key === k));
  const series = ranked.map(a => {
    const h = st.hist.get(a.key) || [];
    const ci = eloHL.indexOf(a.key);
    const pts = h.length ? [{ x:h[0].idx - 0.5, y:h[0].b }].concat(h.map(e => ({ x:e.idx, y:e.a, tip:`${a.name} · ${fmtDate(e.d)} · ${e.pl}/${e.np} miejsce · ${fmtD(e.dd)} → ${fmtElo(e.a)}` }))) : [];
    return { name:a.name, color:ci >= 0 ? HL_COLORS[ci] : null, muted:ci < 0, pts };
  });
  const first = st.matches[0].L.d, last = st.matches[st.matches.length - 1].L.d;
  $('eloChart').innerHTML = eloLineChart(series, { xMin:-0.6, xMax:st.matches.length - 1, left:fmtDate(first), right:`${fmtDate(last)} · ${st.matches.length} meczów`, aria:'Rozwój rankingu ELO' });
  $('eloChips').innerHTML = '<span class="small">Wyróżnij (max 3):</span> ' + ranked.map(a => {
    const ci = eloHL.indexOf(a.key);
    return `<button class="chip ${ci >= 0 ? 'on' : ''}" data-hl="${esc(a.key)}">${ci >= 0 ? `<span class="dot" style="background:${HL_COLORS[ci]}"></span>` : ''}${esc(a.name)} <span class="small">${eloInt(a.elo)}</span></button>`;
  }).join('');
  const recent = st.matches.slice().reverse().slice(0, eloRecentN);
  $('eloRecent').innerHTML = recent.map(m => `<div class="erow"><div class="small">${fmtDate(m.L.d)}, ${fmtTime(m.L.d)} · ${m.L.start} · ${m.L.np} graczy</div><div class="echips">${m.rows.map(r => `<span class="echip"><b>${MEDAL[r.pl-1] || r.pl + '.'}</b> <a class="plink" data-prof="${esc(r.key)}">${esc(r.name)}</a> ${eloInt(r.a)} <span class="${dCls(r.dd)}">${fmtD(r.dd)}</span></span>`).join('')}</div></div>`).join('');
  $('eloMore').style.display = st.matches.length > eloRecentN ? '' : 'none';
}
$('eloChips').addEventListener('click', e => {
  const b = e.target.closest('[data-hl]'); if (!b) return;
  const k = b.dataset.hl, i = eloHL.indexOf(k);
  if (i >= 0) eloHL.splice(i, 1); else { if (eloHL.length >= 3) eloHL.shift(); eloHL.push(k); }
  renderEloRanking(aggregate());
});
$('eloMore').onclick = () => { eloRecentN += 10; renderEloRanking(aggregate()); };
function eloProfileHtml(P){
  const h = (eloState && eloState.hist.get(P.key)) || [];
  if (!h.length) return `<div class="card" style="margin-top:12px"><div class="sechead">Ranking ELO</div><div class="small">Brak meczów z rywalami – startowe ELO ${ELO_START}.</div></div>`;
  const pts = [{ x:h[0].idx - 0.5, y:h[0].b }].concat(h.map(e => ({ x:e.idx, y:e.a, tip:`${fmtDate(e.d)} · ${e.pl}/${e.np} miejsce · ${fmtD(e.dd)} → ${fmtElo(e.a)}` })));
  const chart = eloLineChart([{ name:P.name, color:HL_COLORS[0], muted:false, pts }], { xMin:h[0].idx - 0.6, xMax:h[h.length-1].idx, left:fmtDate(h[0].d), right:`${fmtDate(h[h.length-1].d)} · ${h.length} meczów`, pr:104, aria:'Rozwój ELO gracza' });
  const rows = h.slice().reverse().map(e => `<tr><td class="l">${fmtDate(e.d)}, ${fmtTime(e.d)}</td><td>${e.start}</td><td>${MEDAL[e.pl-1] || ''} ${e.pl}/${e.np}</td><td>${fmtElo(e.b)}</td><td class="${dCls(e.dd)}">${fmtD(e.dd)}</td><td><b>${fmtElo(e.a)}</b></td><td class="small">${e.k}</td></tr>`).join('');
  return `<div class="pgrid">
    <div class="card"><div class="sechead">Rozwój ELO</div>${chart}<div class="small">Przerywana linia = start (${ELO_START}). Najedź na punkt, żeby zobaczyć mecz.</div></div>
    <div class="card"><div class="sechead">Historia ELO</div><div class="tblwrap ehist"><table class="tbl sm"><tr><th class="l">Data</th><th>Gra</th><th>Miejsce</th><th>Przed</th><th>Zmiana</th><th>Po</th><th title="Współczynnik K użyty w tym meczu">K</th></tr>${rows}</table></div></div>
  </div>`;
}

/* ---------- STATS / RANKING ---------- */
const RATING_K = 6, RATING_MIN = 3;
function aggregate(){
  const E = computeElo();
  const M = new Map();
  for (const L of ST.legs) for (const p of L.players){
    const key = p.n.toLowerCase();
    let a = M.get(key);
    if (!a){ a = { key, name:p.n, legs:0, w:0, s:0, t:0, pts:0, dt:0, bt:0, co:0, c180:0, c140:0, c100:0, bestLeg:null, beat:0, opp:0, plSum:0, npSum:0, mp:0 }; M.set(key,a); }
    a.name = p.n; a.legs++;
    if (L.np > 1){ if (p.pl===1) a.w++; else if (p.pl===2) a.s++; else if (p.pl===3) a.t++; a.beat += L.np - p.pl; a.opp += L.np - 1; a.plSum += p.pl; a.npSum += L.np; a.mp++; }
    a.pts += p.pt; a.dt += p.dt;
    a.bt = Math.max(a.bt, p.bt||0); a.co = Math.max(a.co, p.co||0);
    a.c180 += p.c180||0; a.c140 += p.c140||0; a.c100 += p.c100||0;
    if (p.fin && (!a.bestLeg || p.dt < a.bestLeg.dt)) a.bestLeg = { dt:p.dt, start:L.start };
  }
  const list = [...M.values()];
  // Współczynnik: % pokonanych rywali; start od 50 (RATING_K wirtualnych rywali), klasyfikacja od RATING_MIN legów z rywalami
  list.forEach(a => {
    a.avg = a.dt ? a.pts/a.dt*3 : 0; a.wp = a.legs ? a.w/a.legs : 0;
    a.rating = (a.beat + RATING_K/2) / (a.opp + RATING_K) * 100;
    a.ranked = a.mp >= RATING_MIN;
    a.avgPl = a.mp ? a.plSum/a.mp : 0; a.avgNp = a.mp ? a.npSum/a.mp : 0;
  });
  list.forEach(a => {
    a.elo = (E.R.has(a.key) ? E.R.get(a.key) : ELO_START*100) / 100;
    a.mElo = E.M.get(a.key) || 0;
    a.peak = (E.PEAK.has(a.key) ? E.PEAK.get(a.key) : ELO_START*100) / 100;
    a.lastD = E.LAST.has(a.key) ? E.LAST.get(a.key) / 100 : null;
    a.ranked = a.mElo > 0;
  });
  list.sort((x,y) => (y.ranked - x.ranked) || y.elo - x.elo || y.mElo - x.mElo || x.name.localeCompare(y.name,'pl'));
  list.forEach((a,i) => a.rank = a.ranked ? i+1 : null);
  return list;
}
const fmtDate = iso => { try{ const d = new Date(iso); return d.toLocaleDateString('pl-PL',{day:'numeric',month:'short'}); }catch(e){ return ''; } };
function topList(items, el, fmt){
  $(el).innerHTML = items.length ? items.map(fmt).join('') : '<li class="small">Brak danych – zagrajcie leg!</li>';
}
function renderStats(){
  const ag = aggregate();
  const firstUn = ag.findIndex(a => !a.ranked);
  $('rankTbl').innerHTML = `<tr><th>#</th><th class="l">Gracz</th><th title="Aktualne ELO">ELO</th><th title="Zmiana w ostatnim meczu">Ost. zmiana</th><th title="Mecze z rywalami (liczone do ELO)">Mecze</th><th title="Najwyższe osiągnięte ELO">Najwyższe</th><th title="Średnie zajęte miejsce / średnia liczba graczy w legu">Śr. miejsce</th><th title="Wygrane legi">🥇</th><th title="Drugie miejsca">🥈</th><th title="Trzecie miejsca">🥉</th><th>% wygr.</th><th>Śr.</th><th>Max tura</th><th>Max check</th><th>180</th><th>140+</th><th>100+</th><th>Najkr. leg</th></tr>` +
    (ag.length ? ag.map((a,i) => (i === firstUn ? `<tr class="unr-h"><td colspan="18" class="l small">Bez meczów z rywalami – startowe ${ELO_START} ELO</td></tr>` : '') +
      `<tr class="${a.ranked ? '' : 'unr'}"><td>${a.rank || '–'}</td><td class="l"><a class="plink" data-prof="${esc(a.key)}"><b>${esc(a.name)}</b></a></td><td class="coef"><b>${eloInt(a.elo)}</b></td><td class="${a.lastD == null ? '' : dCls(a.lastD)}">${a.lastD == null ? '–' : fmtD(a.lastD)}</td><td>${a.mElo}</td><td>${a.mElo ? eloInt(a.peak) : '–'}</td><td>${a.mp ? `${a.avgPl.toFixed(1)} <span class="small">/ ${a.avgNp.toFixed(1)}</span>` : '–'}</td><td>${a.w}</td><td>${a.s}</td><td>${a.t}</td><td>${Math.round(a.wp*100)}%</td><td>${a.avg.toFixed(1)}</td><td>${a.bt||'–'}</td><td>${a.co||'–'}</td><td>${a.c180}</td><td>${a.c140}</td><td>${a.c100}</td><td>${a.bestLeg ? a.bestLeg.dt + (a.bestLeg.start!==501?` <span class="small">(${a.bestLeg.start})</span>`:'') : '–'}</td></tr>`).join('')
      : `<tr><td colspan="18" class="small" style="text-align:center;padding:16px">Jeszcze nie ma zapisanych legów.</td></tr>`);
  renderEloRanking(ag);
  const flat = [];
  ST.legs.forEach(L => L.players.forEach(p => flat.push({ ...p, d:L.d, start:L.start })));
  const li = (main, who, extra) => `<li><span class="rv">${main}</span><span class="rn">${esc(who)}</span><span class="small">${extra}</span></li>`;
  topList(flat.filter(p=>p.bt>0).sort((a,b)=>b.bt-a.bt).slice(0,5), 'recTurn', p => li(p.bt, p.n, fmtDate(p.d)));
  topList(flat.filter(p=>p.co>0).sort((a,b)=>b.co-a.co).slice(0,5), 'recCo', p => li(p.co, p.n, fmtDate(p.d)));
  topList(flat.filter(p=>p.fin && p.pl===1).sort((a,b)=>a.dt-b.dt).slice(0,5), 'recLeg', p => li(p.dt + ' lotek', p.n, `${p.start} · ${fmtDate(p.d)}`));
  topList(flat.filter(p=>p.dt>=9).map(p=>({...p, avg:p.pt/p.dt*3})).sort((a,b)=>b.avg-a.avg).slice(0,5), 'recAvg', p => li(p.avg.toFixed(1), p.n, fmtDate(p.d)));
  renderManage();
  renderSyncInfo();
}
$('btnRank').onclick = () => { view = view==='stats' ? 'main' : 'stats'; render(); };
$('btnPlayers').onclick = () => { view = view==='players' ? 'main' : 'players'; render(); if (view==='players') setTimeout(() => { try{ $('plSearch').focus({preventScroll:true}); }catch(e){} }, 50); };
$('plBack').onclick = () => { view = 'main'; render(); };
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g){ view = g.dataset.go; render(); } });
$('statsBack').onclick = () => { view = 'main'; render(); };
$('delAll').onclick = () => requireAdmin(() => { if (!ST.legs.length) return; confirmBox('Wyczyścić wszystkie statystyki?', `Ranking, rekordy i ${legsWord(ST.legs.length)} zostaną usunięte. Lista zawodników zostaje.`, 'Wyczyść', () => mutate('Wyczyszczono wszystkie statystyki', () => { ST.legs = []; })); });
$('mgUnlock').onclick = () => requireAdmin(() => {}, 'Podaj hasło, żeby zarządzać historią legów.');
$('mgLock').onclick = lockAdmin;
$('mgPin').onclick = changePin;

/* ---------- ADMIN LOCK (password for managing / deleting stats) ---------- */
// compact SHA-256 (sync, works without secure context)
function sha256(str){
  const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
  const bytes = Array.from(unescape(encodeURIComponent(str)), c => c.charCodeAt(0));
  const l = bytes.length * 8;
  bytes.push(0x80); while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i*8)) & 255);
  let H = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rot = (x,n) => (x >>> n) | (x << (32-n));
  for (let o = 0; o < bytes.length; o += 64){
    const W = new Array(64);
    for (let i = 0; i < 16; i++) W[i] = (bytes[o+i*4]<<24)|(bytes[o+i*4+1]<<16)|(bytes[o+i*4+2]<<8)|bytes[o+i*4+3];
    for (let i = 16; i < 64; i++){ const s0 = rot(W[i-15],7)^rot(W[i-15],18)^(W[i-15]>>>3), s1 = rot(W[i-2],17)^rot(W[i-2],19)^(W[i-2]>>>10); W[i] = (W[i-16]+s0+W[i-7]+s1)|0; }
    let [a,b,c,d,e,f,g,h] = H;
    for (let i = 0; i < 64; i++){
      const t1 = (h + (rot(e,6)^rot(e,11)^rot(e,25)) + ((e&f)^(~e&g)) + K[i] + W[i])|0;
      const t2 = ((rot(a,2)^rot(a,13)^rot(a,22)) + ((a&b)^(a&c)^(b&c)))|0;
      h = g; g = f; f = e; e = (d + t1)|0; d = c; c = b; b = a; a = (t1 + t2)|0;
    }
    H = [H[0]+a|0,H[1]+b|0,H[2]+c|0,H[3]+d|0,H[4]+e|0,H[5]+f|0,H[6]+g|0,H[7]+h|0];
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8,'0')).join('');
}
const PIN_DEFAULT = { s:'dart-social', h:sha256('dart-social|2112') };
const pinCfg = () => (ST.pin && ST.pin.s && ST.pin.h) ? ST.pin : PIN_DEFAULT;
const pinOk = pw => sha256(pinCfg().s + '|' + pw) === pinCfg().h;
const UNLOCK_MS = 5 * 60 * 1000;
let unlockedUntil = 0, badTries = 0, lockoutUntil = 0;
const isUnlocked = () => Date.now() < unlockedUntil;
const touchAdmin = () => { if (isUnlocked()) unlockedUntil = Date.now() + UNLOCK_MS; };
function lockAdmin(){ unlockedUntil = 0; if (view === 'stats') renderManage(); }
function requireAdmin(fn, why){
  if (isUnlocked()){ touchAdmin(); fn(); return; }
  if (Date.now() < lockoutUntil){
    confirmBox('Za dużo prób', `Spróbuj ponownie za ${Math.ceil((lockoutUntil - Date.now())/1000)} s.`, 'OK', null); return;
  }
  promptBox('Podaj hasło', why || 'Ta czynność zmienia statystyki, więc jest chroniona hasłem.', '', 'Odblokuj', pw => {
    if (pinOk(pw)){
      badTries = 0; unlockedUntil = Date.now() + UNLOCK_MS;
      fn();
      if (view === 'stats') renderManage();
    } else {
      badTries++;
      if (badTries >= 5){ lockoutUntil = Date.now() + 30000; badTries = 0; confirmBox('Złe hasło', 'Za dużo nieudanych prób – blokada na 30 sekund.', 'OK', null); }
      else setTimeout(() => requireAdmin(fn, `Złe hasło – spróbuj jeszcze raz (próba ${badTries + 1} z 5).`), 30);
    }
  }, true);
}
function changePin(){
  requireAdmin(() => promptBox('Nowe hasło', 'Co najmniej 4 znaki. Zapamiętaj je – bez niego nie da się nic usunąć.', '', 'Dalej', p1 => {
    if (p1.length < 4){ confirmBox('Za krótkie', 'Hasło musi mieć co najmniej 4 znaki.', 'OK', null); return; }
    setTimeout(() => promptBox('Powtórz nowe hasło', 'Wpisz to samo hasło jeszcze raz.', '', 'Zapisz hasło', p2 => {
      if (p1 !== p2){ confirmBox('Hasła się różnią', 'Spróbuj jeszcze raz.', 'OK', null); return; }
      const s = Math.random().toString(36).slice(2, 10);
      ST.pin = { s, h:sha256(s + '|' + p1) };
      saveStats();
      confirmBox('Hasło zmienione', 'Nowe hasło działa od teraz.', 'OK', null);
    }, true), 30);
  }, true));
}
setInterval(() => { if (!isUnlocked() && view === 'stats' && $('mgBody') && $('mgBody').style.display !== 'none') renderManage(); }, 10000);

/* ---------- STATS MANAGEMENT (delete with undo) ---------- */
let undoSnap = null, undoTimer = null, undoDesc = '';
const MF = { p:'', from:'', to:'' };
const pad2 = n => String(n).padStart(2,'0');
const dayKey = iso => { const d = new Date(iso); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
const fmtDay = k => { try{ const [y,m,d] = k.split('-').map(Number); return new Date(y, m-1, d).toLocaleDateString('pl-PL', { weekday:'long', day:'numeric', month:'long', year:'numeric' }); }catch(e){ return k; } };
const fmtTime = iso => { try{ return new Date(iso).toLocaleTimeString('pl-PL', { hour:'2-digit', minute:'2-digit' }); }catch(e){ return ''; } };
const plural = (n, one, few, many) => n === 1 ? one : (n%10>=2 && n%10<=4 && (n%100<12 || n%100>14)) ? few : many;
const legsWord = n => `${n} ${plural(n,'leg','legi','legów')}`;

/* removes one player's entry from a leg; remaining players keep their order, places close up */
function dropPlayer(L, key){
  L.players = L.players.filter(p => p.n.toLowerCase() !== key);
  L.players.sort((a,b) => a.pl - b.pl).forEach((p,i) => p.pl = i + 1);
  L.np = L.players.length;
}
function mutate(desc, fn){
  if (undoTimer) commitPending();
  undoSnap = JSON.stringify({ legs:ST.legs, roster:roster() });
  fn();
  ST.legs = ST.legs.filter(L => L.players.length);
  undoDesc = desc;
  render();
  showUndo();
  undoTimer = setTimeout(commitPending, 9000);
}
function commitPending(){
  if (!undoTimer) return;
  clearTimeout(undoTimer); undoTimer = null; undoSnap = null;
  $('undoBar').classList.remove('show');
  saveStats();
}
function undoLast(){
  if (!undoSnap) return;
  clearTimeout(undoTimer); undoTimer = null;
  const s = JSON.parse(undoSnap); undoSnap = null;
  ST.legs = s.legs; ST.roster = s.roster;
  $('undoBar').classList.remove('show');
  render();
}
function showUndo(){
  const b = $('undoBar');
  $('undoText').textContent = undoDesc;
  const bar = $('undoProg'); bar.style.transition = 'none'; bar.style.width = '100%';
  b.classList.add('show');
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = 'width 9s linear'; bar.style.width = '0%'; }));
}
$('undoBtn').onclick = undoLast;
$('undoOk').onclick = commitPending;
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') commitPending(); });
window.addEventListener('pagehide', commitPending);

function filteredLegs(){
  return ST.legs.map((L,i) => ({ L, i })).filter(({L}) => {
    const k = dayKey(L.d);
    if (MF.from && k < MF.from) return false;
    if (MF.to && k > MF.to) return false;
    if (MF.p && !L.players.some(p => p.n.toLowerCase() === MF.p)) return false;
    return true;
  });
}
function renderManage(){
  const un = isUnlocked();
  $('mgBody').style.display = un ? '' : 'none';
  $('mgLocked').style.display = un ? 'none' : '';
  if (!un) return;
  const names = allPlayers().filter(a => a.legs).sort((x,y) => x.name.localeCompare(y.name,'pl'));
  if (MF.p && !names.some(a => a.key === MF.p)) MF.p = '';
  $('mfPlayer').innerHTML = '<option value="">Wszyscy gracze</option>' + names.map(a => `<option value="${esc(a.key)}" ${a.key===MF.p?'selected':''}>${esc(a.name)}</option>`).join('');
  $('mfFrom').value = MF.from; $('mfTo').value = MF.to;
  const list = filteredLegs();
  const pName = MF.p ? (names.find(a => a.key === MF.p) || {}).name : '';
  const filtered = MF.p || MF.from || MF.to;
  $('mfSummary').innerHTML = ST.legs.length
    ? `${filtered ? 'Pasuje' : 'Wszystkich'}: <b>${legsWord(list.length)}</b>${filtered ? ` z ${ST.legs.length}` : ''}`
    : 'Brak zapisanych legów.';
  $('mfBulk').innerHTML = !list.length ? '' :
    (MF.p ? `<button class="btn" data-bulk="player">Usuń wyniki: ${esc(pName)} (${legsWord(list.length)})</button>` : '') +
    (filtered ? `<button class="btn danger" data-bulk="legs">Usuń ${MF.p ? 'całe ' : ''}pokazane legi (${list.length})</button>` : '');
  $('mfClear').style.display = filtered ? '' : 'none';
  // group by day, newest first
  const days = new Map();
  list.slice().reverse().forEach(x => { const k = dayKey(x.L.d); if (!days.has(k)) days.set(k, []); days.get(k).push(x); });
  let h = '';
  days.forEach((arr, k) => {
    h += `<div class="day"><div class="day-h"><div><b class="day-t">${fmtDay(k)}</b><span class="small"> · ${legsWord(arr.length)}</span></div>
      <button class="btn sm danger" data-delday="${k}">Usuń ${arr.length === 1 ? 'leg' : 'te legi'} z dnia</button></div>`;
    arr.forEach(({L,i}) => {
      const ps = L.players.slice().sort((a,b) => a.pl - b.pl);
      h += `<details class="legrow"><summary><span class="lr-time">${fmtTime(L.d)}</span><span class="lr-game">${L.start}${L.out==='double'?' DO':''}</span><span class="lr-pl">${ps.map(p => `<span class="${MF.p===p.n.toLowerCase()?'me':''}">${MEDAL[p.pl-1]||p.pl+'.'} ${esc(p.n)}</span>`).join('')}</span><span class="lr-more">▾</span></summary>
        <div class="lr-body"><div class="tblwrap"><table class="tbl sm"><tr><th>Miejsce</th><th class="l">Gracz</th><th>Śr.</th><th>Lotki</th><th>Max</th><th>Checkout</th><th>ELO</th></tr>
        ${ps.map(p => `<tr><td>${MEDAL[p.pl-1]||''} ${p.pl}.</td><td class="l"><a class="plink" data-prof="${esc(p.n.toLowerCase())}">${esc(p.n)}</a> <button class="btn sm rmx" data-rmp="${i}" data-key="${esc(p.n.toLowerCase())}" title="Usuń tylko tego gracza z tego legu">✕ usuń z legu</button></td><td>${p.dt ? (p.pt/p.dt*3).toFixed(1) : '–'}</td><td>${p.dt}</td><td>${p.bt||'–'}</td><td>${p.co||'–'}</td><td class="nowrap">${p.ea != null ? `${fmtElo(p.eb)} → <b>${fmtElo(p.ea)}</b> <span class="${dCls(p.ed)}">${fmtD(p.ed)}</span>` : '–'}</td></tr>`).join('')}
        </table></div>
        <div class="actions" style="margin-top:8px"><button class="btn sm danger" data-delleg="${i}">🗑 Usuń cały leg</button></div>
        <div class="small" style="margin-top:6px">Po usunięciu gracza z legu pozostali przesuwają się na wolne miejsca.</div></div></details>`;
    });
    h += `</div>`;
  });
  $('legLog').innerHTML = h || (ST.legs.length ? '<div class="small" style="padding:8px 0">Nic nie pasuje do filtrów.</div>' : '');
}
$('mfPlayer').onchange = e => { MF.p = e.target.value; renderManage(); };
$('mfFrom').onchange = e => { MF.from = e.target.value; renderManage(); };
$('mfTo').onchange = e => { MF.to = e.target.value; renderManage(); };
$('mfClear').onclick = () => { MF.p = MF.from = MF.to = ''; renderManage(); };
$('legLog').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  if (!isUnlocked()){ renderManage(); return; } touchAdmin();
  if (b.dataset.delleg !== undefined){
    const L = ST.legs[+b.dataset.delleg]; if (!L) return;
    mutate(`Usunięto leg z ${fmtDate(L.d)}, ${fmtTime(L.d)}`, () => { ST.legs.splice(+b.dataset.delleg, 1); });
  } else if (b.dataset.rmp !== undefined){
    const L = ST.legs[+b.dataset.rmp]; if (!L) return;
    const p = L.players.find(x => x.n.toLowerCase() === b.dataset.key);
    mutate(`Usunięto ${p ? p.n : 'gracza'} z legu ${fmtTime(L.d)}`, () => dropPlayer(L, b.dataset.key));
  } else if (b.dataset.delday){
    const k = b.dataset.delday;
    const idx = new Set(filteredLegs().filter(x => dayKey(x.L.d) === k).map(x => x.i));
    confirmBox('Usunąć legi z tego dnia?', `${fmtDay(k)}: ${legsWord(idx.size)}${MF.p ? ' (tylko te z wybranym graczem)' : ''}. Przez kilka sekund będzie można to cofnąć.`, 'Usuń', () =>
      mutate(`Usunięto ${legsWord(idx.size)} z ${fmtDay(k)}`, () => { ST.legs = ST.legs.filter((_,i) => !idx.has(i)); }));
  }
});
$('mfBulk').addEventListener('click', e => {
  const b = e.target.closest('[data-bulk]'); if (!b) return;
  if (!isUnlocked()){ renderManage(); return; } touchAdmin();
  const list = filteredLegs(), idx = new Set(list.map(x => x.i));
  if (b.dataset.bulk === 'legs'){
    confirmBox('Usunąć pokazane legi?', `${legsWord(idx.size)} zostanie usuniętych w całości, ze wszystkimi graczami.`, 'Usuń', () =>
      mutate(`Usunięto ${legsWord(idx.size)}`, () => { ST.legs = ST.legs.filter((_,i) => !idx.has(i)); }));
  } else {
    const key = MF.p, name = (allPlayers().find(a => a.key === key) || {}).name || key;
    confirmBox(`Usunąć wyniki: ${name}?`, `${name} zniknie z ${legsWord(idx.size)}${MF.from||MF.to ? ' z wybranego okresu' : ''}. Pozostali gracze w tych legach zostają.`, 'Usuń', () =>
      mutate(`Usunięto wyniki: ${name} (${legsWord(idx.size)})`, () => { ST.legs.forEach((L,i) => { if (idx.has(i)) dropPlayer(L, key); }); }));
  }
});
function wipePlayerStats(key, name, alsoRoster){
  const n = ST.legs.filter(L => L.players.some(p => p.n.toLowerCase() === key)).length;
  mutate(alsoRoster ? `Usunięto zawodnika ${name}` : `Usunięto statystyki: ${name} (${legsWord(n)})`, () => {
    ST.legs.forEach(L => dropPlayer(L, key));
    if (alsoRoster) ST.roster = roster().filter(rr => rr.n.toLowerCase() !== key);
  });
}

async function saveFile(name, text){ download(name, text); return 'saved'; }
/* ---------- EXPORT (JSON backup + CSV for Excel) ---------- */
const csvCell = v => { const s = String(v == null ? '' : v); return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const dec = (v, d) => (Number(v) || 0).toFixed(d === undefined ? 1 : d).replace('.', ',');
const toCSV = rows => '﻿' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n';
const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; };
function exportJSON(){
  const stats = { rev:ST.rev || 0, legs:ST.legs, roster:roster() };
  return JSON.stringify({ app:'dart-scorer', version:1, exported:new Date().toISOString(), stats }, null, 1);
}
function exportRankingCSV(){
  const rows = [['Miejsce','Gracz','ELO','Najwyższe ELO','Mecze (ELO)','K','Ostatnia zmiana ELO','Pokonani rywale','Wszyscy rywale','Śr. miejsce','Śr. graczy w legu','Legi','1. miejsca','2. miejsca','3. miejsca','% wygranych','Średnia (3 lotki)','Najwyższa tura','Największy checkout','180','140+','100+','Najkrótszy wygrany leg (lotki)','Sklasyfikowany']];
  allPlayers().sort((x,y) => (x.rank||1e9) - (y.rank||1e9) || x.name.localeCompare(y.name,'pl')).forEach(a => {
    rows.push([a.rank || '', a.name, dec(a.elo, 2), dec(a.mElo ? a.peak : ELO_START, 2), a.mElo || 0, kFor(a.mElo || 0), a.lastD == null ? '' : dec(a.lastD, 2), a.beat || 0, a.opp || 0, a.mp ? dec(a.avgPl,2) : '', a.mp ? dec(a.avgNp,2) : '', a.legs || 0, a.w || 0, a.s || 0, a.t || 0,
      a.legs ? dec((a.wp||0)*100, 0) : '', a.legs ? dec(a.avg) : '', a.bt || '', a.co || '', a.c180 || 0, a.c140 || 0, a.c100 || 0, a.bestLeg ? a.bestLeg.dt : '', a.ranked ? 'tak' : 'nie']);
  });
  return toCSV(rows);
}
function exportLegsCSV(){
  computeElo();
  const rows = [['Data','Godzina','Gra','Zakończenie','Liczba graczy','Miejsce','Gracz','Skończył','Lotki','Punkty','Średnia (3 lotki)','Najwyższa tura','Checkout','180','140+','100+','ELO przed','Zmiana ELO','ELO po','K','Tury (rzuty)']];
  ST.legs.slice().sort((x,y) => x.d < y.d ? -1 : 1).forEach(L => {
    L.players.slice().sort((a,b) => a.pl - b.pl).forEach(p => {
      rows.push([dayKey(L.d), fmtTime(L.d), L.start, L.out === 'double' ? 'double out' : 'dowolne', L.np, p.pl, p.n, p.fin ? 'tak' : 'nie', p.dt, p.pt,
        p.dt ? dec(p.pt/p.dt*3) : '', p.bt || '', p.co || '', p.c180 || 0, p.c140 || 0, p.c100 || 0, p.ea != null ? dec(p.eb, 2) : '', p.ea != null ? dec(p.ed, 2) : '', p.ea != null ? dec(p.ea, 2) : '', p.k || '', Array.isArray(p.tu) ? p.tu.join(' | ') : '']);
    });
  });
  return toCSV(rows);
}
async function runExport(kind){
  const info = $('exInfo');
  const files = {
    json:[`dart-social-kopia-${stamp()}.json`, exportJSON],
    rank:[`dart-social-ranking-${stamp()}.csv`, exportRankingCSV],
    legs:[`dart-social-legi-${stamp()}.csv`, exportLegsCSV]
  };
  const [name, make] = files[kind];
  if (kind !== 'json' && !ST.legs.length && !roster().length){ if (info) info.textContent = 'Nie ma jeszcze czego eksportować.'; return; }
  try{
    const res = await saveFile(name, make());
    if (info) info.textContent = res === 'copied' ? `Nie można tu zapisać pliku – zawartość ${name} skopiowano do schowka.` : `Gotowe: ${name}`;
  }catch(e){
    if (info) info.textContent = (e && e.code === 'declined') ? 'Zapis anulowany.' : 'Nie udało się zapisać pliku.';
  }
}
[['exJson','json'],['exRank','rank'],['exLegs','legs']].forEach(([id,k]) => { const b = $(id); if (b) b.onclick = () => runExport(k); });

/* ---------- PLAYERS & PROFILES ---------- */
let profKey = null;
const roster = () => (Array.isArray(ST.roster) ? ST.roster : (ST.roster = []));
function allPlayers(){
  const ag = aggregate();
  const M = new Map(ag.map((a,i) => [a.key, Object.assign({}, a)]));
  roster().forEach(r => {
    const k = r.n.toLowerCase();
    if (!M.has(k)) M.set(k, { key:k, name:r.n, legs:0, w:0, s:0, t:0, avg:0, wp:0, rank:null, elo:ELO_START, mElo:0, peak:ELO_START, lastD:null, ranked:false, mp:0 });
    M.get(k).added = r.added;
  });
  return [...M.values()];
}
function registerNames(names){
  const have = new Set(allPlayers().map(a => a.key));
  let changed = false;
  names.forEach(n => { const k = n.trim().toLowerCase(); if (k && !have.has(k)){ roster().push({ n:n.trim(), added:new Date().toISOString() }); have.add(k); changed = true; } });
  return changed;
}
function turnsStr(pi){
  return S.turns.filter(t => t.p === pi).map(t => t.n ? t.darts.map(d => d.label).join(' ') + (t.bust ? '!' : t.fin ? '*' : '') : '-');
}
function parseLabel(l){
  if (l === '0') return { n:0, m:0, s:0 };
  if (l === 'Bull') return { n:25, m:2, s:50 };
  if (l === '25') return { n:25, m:1, s:25 };
  const m = l[0]==='T' ? 3 : l[0]==='D' ? 2 : 1;
  const n = +(m > 1 ? l.slice(1) : l);
  return { n, m, s:n*m };
}
function profileData(key){
  const r = { legs:0, w:0, s:0, t:0, pts:0, dt:0, bt:0, co:0, coSum:0, coN:0, c180:0, c140:0, c100:0, c60:0, busts:0,
    f9p:0, f9d:0, dd:0, ddHit:0, bestLeg:null, bestAvg:0, hits:new Map(), buckets:[0,0,0,0,0,0,0], doubles:new Map(),
    form:[], h2h:new Map(), recent:[], first:null, last:null, detailed:0, turns:0 };
  ST.legs.forEach(L => L.players.forEach(p => {
    if (p.n.toLowerCase() !== key) return;
    r.legs++;
    if (L.np > 1){ if (p.pl===1) r.w++; else if (p.pl===2) r.s++; else if (p.pl===3) r.t++; }
    r.pts += p.pt; r.dt += p.dt; r.bt = Math.max(r.bt, p.bt||0);
    if (p.co){ r.co = Math.max(r.co, p.co); r.coSum += p.co; r.coN++; }
    r.c180 += p.c180||0; r.c140 += p.c140||0; r.c100 += p.c100||0;
    if (p.fin && (!r.bestLeg || p.dt < r.bestLeg.dt)) r.bestLeg = { dt:p.dt, start:L.start };
    const avg = p.dt ? p.pt/p.dt*3 : 0;
    if (p.dt >= 9) r.bestAvg = Math.max(r.bestAvg, avg);
    r.form.push({ d:L.d, avg, pl:p.pl, np:L.np, start:L.start });
    if (!r.first || L.d < r.first) r.first = L.d;
    if (!r.last || L.d > r.last) r.last = L.d;
    L.players.forEach(o => {
      if (o === p) return;
      const k = o.n.toLowerCase();
      let h = r.h2h.get(k);
      if (!h){ h = { key:k, name:o.n, n:0, win:0, loss:0 }; r.h2h.set(k, h); }
      h.name = o.n; h.n++; if (p.pl < o.pl) h.win++; else h.loss++;
    });
    r.recent.push({ L, p, avg });
    if (!Array.isArray(p.tu)) return;
    r.detailed++;
    let rem = L.start;
    p.tu.forEach((ts, ti) => {
      if (ts === '-') return;
      const bust = ts.endsWith('!'), fin = ts.endsWith('*');
      const labels = ts.replace(/[!*]$/, '').split(' ').filter(Boolean);
      const before = rem; let sum = 0;
      labels.forEach((lb, di) => {
        const h = parseLabel(lb);
        const k = h.m === 0 ? '0' : lb;
        r.hits.set(k, (r.hits.get(k)||0) + 1);
        if (L.out === 'double' && (rem === 50 || (rem <= 40 && rem > 0 && rem % 2 === 0))){ r.dd++; if (fin && di === labels.length-1) r.ddHit++; }
        rem -= h.s; sum += h.s;
      });
      if (bust){ rem = before; r.busts++; }
      const tot = bust ? 0 : sum;
      if (ti < 3){ r.f9p += tot; r.f9d += labels.length; }
      if (labels.length === 3 || bust || fin){
        r.turns++;
        r.buckets[tot>=180?6 : tot>=140?5 : tot>=100?4 : tot>=60?3 : tot>=40?2 : tot>=20?1 : 0]++;
      }
      if (tot >= 60 && tot < 100) r.c60++;
      if (fin){ const lb = labels[labels.length-1]; r.doubles.set(lb, (r.doubles.get(lb)||0) + 1); }
    });
  }));
  r.avg = r.dt ? r.pts/r.dt*3 : 0;
  r.wp = r.legs ? r.w/r.legs : 0;
  r.f9 = r.f9d ? r.f9p/r.f9d*3 : 0;
  r.recent.sort((a,b) => a.L.d < b.L.d ? 1 : -1);
  r.form.sort((a,b) => a.d < b.d ? -1 : 1);
  return r;
}

/* players list */
function hlMatch(name, q){
  if (!q) return esc(name);
  const i = name.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(name);
  return esc(name.slice(0,i)) + '<mark>' + esc(name.slice(i, i+q.length)) + '</mark>' + esc(name.slice(i+q.length));
}
function renderPlayers(){
  const q = $('plSearch').value.trim();
  const list = allPlayers()
    .filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()))
    .sort((x,y) => (x.rank||1e9) - (y.rank||1e9) || x.name.localeCompare(y.name, 'pl'));
  let h = list.map(a => `<button class="pcard" data-prof="${esc(a.key)}">
      <div class="pc-top"><span class="pc-name">${hlMatch(a.name, q)}</span>${a.rank ? `<span class="pc-rank">#${a.rank}</span>` : ''}</div>
      <div class="pc-meta">${a.legs ? `ELO ${eloInt(a.elo)} · ${legsWord(a.legs)} · śr. ${a.avg.toFixed(1)}` : `ELO ${ELO_START} · jeszcze nie grał(a)`}</div>
    </button>`).join('');
  if (!list.length) h = `<div class="small" style="padding:10px 0">${q ? `Nie ma zawodnika „${esc(q)}”. <button class="chip" id="plAddQ">+ Dodaj „${esc(q)}”</button>` : 'Brak zawodników – dodaj pierwszego poniżej.'}</div>`;
  $('plList').innerHTML = h;
  $('plCount').textContent = allPlayers().length ? `${allPlayers().length} zawodników` : '';
  const b = $('plAddQ'); if (b) b.onclick = () => addRosterPlayer(q);
}
function addRosterPlayer(name){
  name = (name||'').trim();
  if (!name){ return; }
  if (allPlayers().some(a => a.key === name.toLowerCase())){ $('plErr').textContent = `„${name}” już jest na liście.`; return; }
  $('plErr').textContent = '';
  roster().push({ n:name, added:new Date().toISOString() });
  $('plNew').value = ''; $('plSearch').value = '';
  profKey = name.toLowerCase(); view = 'profile';
  render(); saveStats();
}
$('plSearch').addEventListener('input', renderPlayers);
$('plAdd').onsubmit = e => { e.preventDefault(); addRosterPlayer($('plNew').value); };
document.addEventListener('click', e => {
  const t = e.target.closest('[data-prof]');
  if (!t) return;
  profKey = t.dataset.prof; view = 'profile'; render(); window.scrollTo(0,0);
});

/* profile */
const tile = (label, value, sub) => `<div class="tile"><div class="t-l">${label}</div><div class="t-v">${value}</div>${sub ? `<div class="t-s">${sub}</div>` : ''}</div>`;
const pct = (a, b) => b ? Math.round(a/b*100) + '%' : '–';
function formChart(form){
  const data = form.slice(-20);
  if (!data.length) return '<div class="small">Brak legów.</div>';
  const W = 600, H = 190, pl = 34, pr = 8, pt = 14, pb = 26;
  const max = Math.max(60, Math.ceil(Math.max(...data.map(d => d.avg)) / 20) * 20);
  const bw = (W - pl - pr) / data.length, y = v => pt + (H-pt-pb) * (1 - v/max);
  const all = data.reduce((s,d) => s + d.avg, 0) / data.length;
  let g = '';
  for (let v = 0; v <= max; v += max/4){ g += `<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl-6}" y="${y(v)+4}" class="ax" text-anchor="end">${Math.round(v)}</text>`; }
  const bars = data.map((d,i) => {
    const w = Math.min(34, Math.max(3, bw*0.64)), x = pl + i*bw + (bw - w)/2, top = y(d.avg), h = Math.max(0, y(0) - top), r = Math.min(4, w/2, h);
    const path = `M${x},${y(0)}V${top+r}Q${x},${top} ${x+r},${top}H${x+w-r}Q${x+w},${top} ${x+w},${top+r}V${y(0)}Z`;
    const tip = `${fmtDate(d.d)} · ${d.start} · śr. ${d.avg.toFixed(1)} · miejsce ${d.pl}/${d.np}`;
    return `<g class="hit" data-tip="${esc(tip)}"><rect x="${pl+i*bw}" y="${pt}" width="${bw}" height="${H-pt-pb}" fill="transparent"/><path d="${path}" class="bar"/>${d.pl===1 && d.np>1 ? `<circle cx="${x+w/2}" cy="${top-7}" r="3.5" class="win"/>` : ''}</g>`;
  }).join('');
  const avgLine = `<line x1="${pl}" x2="${W-pr}" y1="${y(all)}" y2="${y(all)}" class="avgl"/><text x="${W-pr}" y="${y(all)-5}" class="ax" text-anchor="end">średnio ${all.toFixed(1)}</text>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Średnia w ostatnich legach">${g}${bars}${avgLine}<text x="${pl}" y="${H-6}" class="ax">starsze</text><text x="${W-pr}" y="${H-6}" class="ax" text-anchor="end">najnowszy leg</text></svg>
    <div class="small">Słupek = średnia na 3 lotki w jednym legu (ostatnie ${data.length}). Kropka = wygrany leg.</div>`;
}
function bucketBars(b, total){
  const names = ['0–19','20–39','40–59','60–99','100–139','140–179','180'];
  const max = Math.max(1, ...b);
  return names.map((n,i) => `<div class="hb" data-tip="${n}: ${b[i]} tur (${pct(b[i], total)})"><span class="hb-l">${n}</span><span class="hb-t"><span style="width:${(b[i]/max*100).toFixed(1)}%"></span></span><span class="hb-v">${b[i]}</span></div>`).join('');
}
function heatBoard(hits){
  let max = 0; hits.forEach((v,k) => { if (k !== '0') max = Math.max(max, v); });
  const a = (k) => { const v = hits.get(k)||0; return v ? (0.18 + 0.82*Math.sqrt(v/max)).toFixed(2) : 0; };
  const tip = (k, name) => `${name}: ${hits.get(k)||0}×`;
  let h = `<circle r="${R.board}" fill="#1f1f1f"/><g stroke="#1f1f1f" stroke-width="2">`;
  ORDER.forEach((n,i) => {
    const mid = -90 + i*18, a1 = mid-9, a2 = mid+9;
    [['T'+n, R.tIn, R.tOut, 'T'+n], [String(n), R.tOut, R.dIn, String(n)], ['D'+n, R.dIn, R.dOut, 'D'+n]].forEach(([k, r1, r2, nm]) => {
      h += `<path d="${arc(r1,r2,a1,a2)}" fill="#2a2a2a"/><path d="${arc(r1,r2,a1,a2)}" fill="#efe6cf" fill-opacity="${a(k)}" data-tip="${tip(k,nm)}"/>`;
    });
  });
  h += `<circle r="${R.bull}" fill="#2a2a2a"/><circle r="${R.bull}" fill="#efe6cf" fill-opacity="${a('25')}" data-tip="${tip('25','25')}"/>`;
  h += `<circle r="${R.eye}" fill="#2a2a2a" stroke="#1f1f1f" stroke-width="4"/><circle r="${R.eye}" fill="#efe6cf" fill-opacity="${a('Bull')}" data-tip="${tip('Bull','Bull')}"/></g>`;
  h += `<g fill="rgba(239,230,207,.55)" font-family="'Space Grotesk', sans-serif" font-size="24.4" font-weight="500" dominant-baseline="central" text-anchor="middle" pointer-events="none">`;
  ORDER.forEach((n,i) => { const [x,y] = polar(R.num, -90 + i*18); h += `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}">${n}</text>`; });
  return `<svg class="heat" viewBox="-262 -262 524 524">${h}</g></svg>`;
}
function renderProfile(){
  const P = allPlayers().find(a => a.key === profKey);
  if (!P){ view = 'players'; render(); return; }
  const r = profileData(profKey);
  const coAvg = r.coN ? (r.coSum / r.coN).toFixed(1) : '–';
  const totalHits = [...r.hits.values()].reduce((s,v) => s+v, 0);
  const topHits = [...r.hits.entries()].filter(([k]) => k !== '0').sort((a,b) => b[1]-a[1]).slice(0,6);
  const trebles = [...r.hits.entries()].filter(([k]) => k[0]==='T').reduce((s,[,v]) => s+v, 0);
  const misses = r.hits.get('0') || 0;
  const fav = [...r.doubles.entries()].sort((a,b) => b[1]-a[1]).slice(0,5);
  const h2h = [...r.h2h.values()].sort((a,b) => b.n - a.n);
  let h = `<div class="row" style="justify-content:space-between;margin-bottom:10px">
      <button class="btn" data-go="players">← Zawodnicy</button>
      <div class="row pr-admin"><button class="btn sm" id="prRename">✎ Zmień nazwę</button><button class="btn sm danger" id="prDelete">Usuń zawodnika</button></div>
    </div>
    <div class="card prof-head">
      <div class="ph-av">${esc(P.name.slice(0,1).toUpperCase())}</div>
      <div style="flex:1;min-width:0">
        <div class="ph-name">${esc(P.name)}</div>
        <div class="small">${P.rank ? `#${P.rank} w rankingu · ELO ${eloInt(P.elo)} · ` : `ELO ${eloInt(P.elo)} · `}${r.legs ? `${legsWord(r.legs)} · gra od ${fmtDate(r.first)} · ostatnio ${fmtDate(r.last)}` : (P.added ? `dodany(a) ${fmtDate(P.added)} · ` : '') + 'jeszcze bez rozegranych legów'}</div>
      </div>
      <div class="ph-acts">
        <button class="btn h2hbtn ${h2hOpen ? 'on' : ''}" id="prH2H" title="Porównaj z innym zawodnikiem" aria-label="Porównanie H2H">${ICO_H2H}<span>Porównaj</span></button>
        ${S.phase !== 'game' && !S.players.some(n => n.toLowerCase() === P.key) ? `<button class="btn primary" id="prToGame">+ Do następnej gry</button>` : ''}
      </div>
    </div>`;
  h += h2hPanelHtml(P) + h2hCardHtml(P);
  if (!r.legs){
    $('profileView').innerHTML = h + `<div class="card" style="margin-top:12px"><p class="small" style="margin:0">Statystyki pojawią się po pierwszym zapisanym legu.</p></div>`;
    bindProfile(P); return;
  }
  h += `<div class="tiles">
      ${tile('ELO', eloInt(P.elo), P.mElo ? `najwyżej ${eloInt(P.peak)} · ${P.mElo} meczów · K = ${kFor(P.mElo)}` : `start · K = ${kFor(0)}`)}
      ${tile('Śr. miejsce', P.mp ? P.avgPl.toFixed(1) : '–', P.mp ? `z ${P.avgNp.toFixed(1)} graczy · pokonał(a) ${P.beat} z ${P.opp} rywali` : 'brak legów z rywalami')}
      ${tile('Wygrane', `${r.w}`, `${pct(r.w, r.legs)} legów`)}
      ${tile('Podium', `${r.w + r.s + r.t}`, `🥈 ${r.s} · 🥉 ${r.t}`)}
      ${tile('Średnia (3 lotki)', r.avg.toFixed(1), `najlepszy leg ${r.bestAvg ? r.bestAvg.toFixed(1) : '–'}`)}
      ${tile('Średnia 9 pierwszych', r.f9 ? r.f9.toFixed(1) : '–', 'pierwsze 3 tury legu')}
      ${tile('Najwyższa tura', r.bt || '–', `180 × ${r.c180} · 140+ × ${r.c140}`)}
      ${tile('Tury 100+', `${r.c100 + r.c140 + r.c180}`, `60–99 × ${r.c60}`)}
      ${tile('Największy checkout', r.co || '–', `średni ${coAvg} · ${r.coN}× zamknięte`)}
      ${tile('Skuteczność na podwójnych', r.dd ? pct(r.ddHit, r.dd) : '–', r.dd ? `${r.ddHit} z ${r.dd} lotek` : '')}
      ${tile('Najkrótszy wygrany leg', r.bestLeg ? `${r.bestLeg.dt}` : '–', r.bestLeg ? `lotek · ${r.bestLeg.start}` : '')}
      ${tile('Lotki łącznie', `${r.dt}`, `${r.busts} bustów`)}
    </div>
    ${eloProfileHtml(P)}
    <div class="pgrid">
      <div class="card"><div class="sechead">Forma</div>${formChart(r.form)}</div>
      <div class="card"><div class="sechead">Rozkład tur</div>${r.turns ? bucketBars(r.buckets, r.turns) + `<div class="small" style="margin-top:6px">${r.turns} pełnych tur</div>` : '<div class="small">Brak szczegółowych danych.</div>'}</div>
      <div class="card"><div class="sechead">Gdzie trafia</div>${totalHits ? `<div class="heatwrap">${heatBoard(r.hits)}<div><ol class="rec">${topHits.map(([k,v]) => `<li><span class="rv">${k}</span><span class="small">${v}× · ${pct(v,totalHits)}</span></li>`).join('')}</ol><div class="small" style="margin-top:8px">Potrójne: ${pct(trebles,totalHits)} lotek<br>Pudła: ${pct(misses,totalHits)} lotek</div></div></div>` : '<div class="small">Brak szczegółowych danych.</div>'}</div>
      <div class="card"><div class="sechead">Ulubione zamknięcia</div>${fav.length ? `<ol class="rec">${fav.map(([k,v]) => `<li><span class="rv">${k}</span><span class="small">${v}×</span></li>`).join('')}</ol>` : '<div class="small">Jeszcze nic nie zamknął(a).</div>'}</div>
    </div>
    <div class="card" style="margin-top:12px"><div class="sechead">Pojedynki</div>
      ${h2h.length ? `<div class="tblwrap"><table class="tbl sm"><tr><th class="l">Przeciwnik</th><th>Wspólne legi</th><th>Wyżej</th><th>Niżej</th><th class="l" style="width:40%">Bilans</th></tr>${h2h.map(o => `<tr><td class="l"><a class="plink" data-prof="${esc(o.key)}">${esc(o.name)}</a> <button class="btn sm h2hmini" data-h2h="${esc(o.key)}" title="Porównaj H2H">H2H</button></td><td>${o.n}</td><td>${o.win}</td><td>${o.loss}</td><td class="l"><span class="duel"><span style="width:${(o.win/o.n*100).toFixed(1)}%"></span></span></td></tr>`).join('')}</table></div><div class="small" style="margin-top:6px">„Wyżej” = skończył(a) leg na lepszym miejscu niż przeciwnik.</div>` : '<div class="small">Grał(a) tylko sam(a).</div>'}
    </div>
    <div class="card" style="margin-top:12px"><div class="sechead">Ostatnie legi</div>
      <div class="tblwrap"><table class="tbl sm"><tr><th class="l">Data</th><th>Gra</th><th>Miejsce</th><th>Śr.</th><th>Lotki</th><th>Max</th><th>Checkout</th><th></th></tr>${r.recent.slice(0,15).map(x => `<tr><td class="l">${fmtDate(x.L.d)}</td><td>${x.L.start}</td><td>${MEDAL[x.p.pl-1]||''} ${x.p.pl}/${x.L.np}</td><td>${x.avg.toFixed(1)}</td><td>${x.p.dt}</td><td>${x.p.bt||'–'}</td><td>${x.p.co||'–'}</td><td><button class="btn sm" data-prm="${ST.legs.indexOf(x.L)}" title="Usuń ten leg ze statystyk gracza">🗑</button></td></tr>`).join('')}</table></div>
      <div class="actions" style="margin-top:8px"><button class="btn sm" id="prAllLegs">Wszystkie legi gracza (${r.legs}) – zarządzaj →</button></div>
    </div>`;
  if (r.detailed < r.legs) h += `<p class="small">Mapa trafień, rozkład tur, średnia z 9 lotek i skuteczność na podwójnych liczą się z ${r.detailed} z ${r.legs} legów (starsze legi nie miały zapisanych pojedynczych rzutów).</p>`;
  $('profileView').innerHTML = h;
  bindProfile(P);
}
function bindProfile(P){
  bindH2H(P);
  const ren = $('prRename');
  if (ren) ren.onclick = () => promptBox('Zmień nazwę', 'Nowa nazwa zmieni się też we wszystkich zapisanych legach.', P.name, 'Zapisz', v => {
    v = v.trim();
    if (!v || v === P.name) return;
    const nk = v.toLowerCase();
    if (nk !== P.key && allPlayers().some(a => a.key === nk)){ confirmBox('Nazwa zajęta', `Zawodnik „${v}” już istnieje.`, 'OK', null); return; }
    ST.legs.forEach(L => L.players.forEach(p => { if (p.n.toLowerCase() === P.key) p.n = v; }));
    roster().forEach(rr => { if (rr.n.toLowerCase() === P.key) rr.n = v; });
    if (!roster().some(rr => rr.n.toLowerCase() === nk)) roster().push({ n:v, added:new Date().toISOString() });
    S.players = S.players.map(n => n.toLowerCase() === P.key ? v : n); save();
    profKey = nk; render(); saveStats();
  });
  const del = $('prDelete');
  if (del) del.onclick = () => {
    const n = ST.legs.filter(L => L.players.some(p => p.n.toLowerCase() === P.key)).length;
    confirmBox(`Usunąć zawodnika ${P.name}?`, n ? `Zniknie z listy zawodników razem ze swoimi wynikami z ${legsWord(n)}. Pozostali gracze w tych legach zostają.` : `${P.name} zniknie z listy zawodników.`, 'Usuń', () => {
      view = 'players'; wipePlayerStats(P.key, P.name, true);
    });
  };
  const all = $('prAllLegs');
  if (all) all.onclick = () => { MF.p = P.key; MF.from = MF.to = ''; view = 'stats'; render(); setTimeout(() => $('manageCard').scrollIntoView({ behavior:'smooth' }), 30); };
  $('profileView').querySelectorAll('[data-prm]').forEach(b => b.onclick = () => {
    const L = ST.legs[+b.dataset.prm]; if (!L) return;
    mutate(`Usunięto leg z ${fmtDate(L.d)} ze statystyk: ${P.name}`, () => dropPlayer(L, P.key));
  });
  ['prRename','prDelete'].forEach(id => { const el = $(id); if (el && el.onclick){ const f = el.onclick; el.onclick = ev => requireAdmin(() => f.call(el, ev)); } });
  $('profileView').querySelectorAll('[data-prm]').forEach(el => { const f = el.onclick; el.onclick = ev => requireAdmin(() => f.call(el, ev)); });
  const tg = $('prToGame');
  if (tg) tg.onclick = () => { if (!S.players.some(n => n.toLowerCase() === P.key)) S.players.push(P.name); save(); view = 'main'; render(); };
}
/* ---------- H2H – porównanie dwóch zawodników ---------- */
const ICO_H2H = "<svg class=\"ico h2hico\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"1821.1 1342.6 566.0 360.4\"><g transform=\"matrix(1,0,0,1,-793.1591,-353.354554)\"><g transform=\"matrix(0.716846,0,0,0.716846,1812.575404,448.089315)\"><path d=\"M1221.901,2083.493C1163.83,2054.135 1123.976,1993.904 1123.976,1924.438C1123.976,1826.138 1203.784,1746.33 1302.084,1746.33C1400.385,1746.33 1480.192,1826.138 1480.192,1924.438C1480.192,1959.34 1470.131,1991.911 1452.754,2019.406C1451.246,2021.793 1449.682,2024.142 1448.065,2026.451L1416.701,2026.451C1418.739,2024.163 1420.71,2021.813 1422.61,2019.406C1443.236,1993.273 1455.551,1960.282 1455.551,1924.438C1455.551,1839.737 1386.785,1770.971 1302.084,1770.971C1217.383,1770.971 1148.617,1839.737 1148.617,1924.438C1148.617,1979.759 1177.951,2028.283 1221.901,2055.29C1229.642,2060.046 1237.836,2064.135 1246.403,2067.476C1263.668,2074.21 1282.448,2077.906 1302.084,2077.906C1317.52,2077.906 1332.426,2075.622 1346.484,2071.374C1348.857,2070.657 1351.205,2069.884 1353.529,2069.057L1353.529,2094.992C1351.2,2095.694 1348.851,2096.35 1346.484,2096.958C1332.288,2100.606 1317.411,2102.547 1302.084,2102.547C1282.642,2102.547 1263.923,2099.425 1246.403,2093.655C1237.938,2090.868 1229.753,2087.463 1221.901,2083.493Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2158.74608,959.718427)\"><path d=\"M1174.633,2086.139C1126.852,2048.415 1096.164,1989.982 1096.164,1924.438C1096.164,1810.788 1188.433,1718.518 1302.084,1718.518C1415.735,1718.518 1508.005,1810.788 1508.005,1924.438C1508.005,1984.046 1482.623,2037.773 1442.087,2075.39C1438.119,2079.072 1434.006,2082.6 1429.757,2085.964C1429.493,2086.172 1429.229,2086.38 1428.965,2086.588L1426.254,2086.588C1415.009,2086.588 1404.225,2091.055 1396.273,2099.006C1394.272,2101.007 1392.492,2103.187 1390.948,2105.509C1389.608,2107.524 1388.447,2109.645 1387.473,2111.848C1383.034,2113.876 1378.511,2115.751 1373.91,2117.466C1351.543,2125.802 1327.341,2130.359 1302.084,2130.359C1270.41,2130.359 1240.396,2123.192 1213.578,2110.393C1199.665,2103.753 1186.611,2095.597 1174.633,2086.139ZM1429.757,2031.663C1454.142,2002.665 1468.838,1965.254 1468.838,1924.438C1468.838,1832.404 1394.118,1757.685 1302.084,1757.685C1210.05,1757.685 1135.33,1832.404 1135.33,1924.438C1135.33,1965.378 1150.115,2002.891 1174.633,2031.926C1185.765,2045.11 1198.905,2056.546 1213.578,2065.76C1239.234,2081.872 1269.579,2091.192 1302.084,2091.192C1334.74,2091.192 1365.216,2081.785 1390.948,2065.535C1405.574,2056.298 1418.667,2044.85 1429.757,2031.663Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2158.74608,959.718427)\"><path d=\"M1302.084,1796.766C1372.549,1796.766 1429.757,1853.974 1429.757,1924.438C1429.757,1994.903 1372.549,2052.111 1302.084,2052.111C1231.62,2052.111 1174.411,1994.903 1174.411,1924.438C1174.411,1853.974 1231.62,1796.766 1302.084,1796.766ZM1302.084,1835.932C1253.236,1835.932 1213.578,1875.59 1213.578,1924.438C1213.578,1973.286 1253.236,2012.945 1302.084,2012.945C1350.932,2012.945 1390.59,1973.286 1390.59,1924.438C1390.59,1875.59 1350.932,1835.932 1302.084,1835.932Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2158.74608,959.718427)\"><path d=\"M1302.084,1875.65C1329.011,1875.65 1350.873,1897.511 1350.873,1924.438C1350.873,1951.365 1329.011,1973.227 1302.084,1973.227C1275.157,1973.227 1253.296,1951.365 1253.296,1924.438C1253.296,1897.511 1275.157,1875.65 1302.084,1875.65ZM1302.084,1914.816C1296.774,1914.816 1292.462,1919.128 1292.462,1924.438C1292.462,1929.749 1296.774,1934.06 1302.084,1934.06C1307.395,1934.06 1311.706,1929.749 1311.706,1924.438C1311.706,1919.128 1307.395,1914.816 1302.084,1914.816Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1096.460286,1529.397747)\"><rect x=\"2817.06\" y=\"1726.678\" width=\"28.851\" height=\"232.232\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1131.268945,1529.397747)\"><path d=\"M2845.91,1802.02L2845.91,1958.909L2817.06,1958.909L2817.06,1726.678C2827.566,1749.871 2837.223,1775.075 2845.91,1802.02Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,893.580549,1529.397747)\"><path d=\"M2845.91,1726.677L2845.91,1958.909L2817.06,1958.909L2817.06,1802.02C2825.747,1775.075 2835.404,1749.87 2845.91,1726.677Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,928.389209,1529.397747)\"><path d=\"M2845.91,1631.443L2845.91,1958.909L2817.06,1958.909L2817.06,1672.985C2826.243,1657.749 2835.878,1643.86 2845.91,1631.443Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.561243,928.869188,932.550613)\"><rect x=\"2874.077\" y=\"1602.52\" width=\"28.688\" height=\"388.772\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.612238,0,0,0.612238,991.074349,850.829465)\"><path d=\"M2960.404,1861.197L2960.404,1958.909L2931.817,1958.909L2931.817,1847.259C2932.954,1848.969 2934.265,1850.575 2935.739,1852.049C2941.596,1857.906 2949.54,1861.197 2957.823,1861.197L2960.404,1861.197ZM2960.404,1602.52L2960.404,1714.874L2957.823,1714.874C2949.54,1714.874 2941.596,1718.165 2935.739,1724.022C2934.265,1725.496 2932.954,1727.102 2931.817,1728.812L2931.817,1602.52L2960.404,1602.52Z\" style=\"fill:rgb(27,158,90);\"/></g><g transform=\"matrix(0.716846,0,0,0.716846,2115.245621,448.089315)\"><path d=\"M1151.414,2019.406C1134.037,1991.911 1123.976,1959.34 1123.976,1924.438C1123.976,1826.138 1203.784,1746.33 1302.084,1746.33C1400.385,1746.33 1480.192,1826.138 1480.192,1924.438C1480.192,1993.849 1440.402,2054.039 1382.406,2083.423C1374.582,2087.387 1366.425,2090.791 1357.991,2093.581C1340.405,2099.398 1321.609,2102.547 1302.084,2102.547C1294.067,2102.547 1286.173,2102.016 1278.435,2100.987C1276.072,2100.673 1273.723,2100.313 1271.39,2099.907L1271.39,2074.83C1273.72,2075.304 1276.068,2075.725 1278.435,2076.091C1286.144,2077.286 1294.042,2077.906 1302.084,2077.906C1321.806,2077.906 1340.664,2074.178 1357.991,2067.388C1366.528,2064.043 1374.693,2059.955 1382.406,2055.204C1426.279,2028.181 1455.551,1979.701 1455.551,1924.438C1455.551,1839.737 1386.785,1770.971 1302.084,1770.971C1217.383,1770.971 1148.617,1839.737 1148.617,1924.438C1148.617,1960.282 1160.932,1993.273 1181.558,2019.406C1183.458,2021.813 1185.429,2024.163 1187.467,2026.451L1156.104,2026.451C1154.486,2024.142 1152.923,2021.793 1151.414,2019.406Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2461.416298,959.718427)\"><path d=\"M1162.082,2075.39C1121.545,2037.773 1096.164,1984.046 1096.164,1924.438C1096.164,1810.788 1188.433,1718.518 1302.084,1718.518C1415.735,1718.518 1508.005,1810.788 1508.005,1924.438C1508.005,1989.881 1477.41,2048.234 1429.757,2085.964C1417.82,2095.415 1404.813,2103.572 1390.948,2110.222C1364.039,2123.128 1333.899,2130.359 1302.084,2130.359C1289.233,2130.359 1276.655,2129.179 1264.454,2126.922C1260.616,2126.212 1256.815,2125.396 1253.055,2124.476C1252.03,2114.889 1247.758,2105.887 1240.877,2099.006C1233.56,2091.689 1223.844,2087.322 1213.578,2086.672C1212.688,2086.616 1211.794,2086.588 1210.897,2086.588L1175.203,2086.588C1175.013,2086.438 1174.823,2086.289 1174.633,2086.139C1170.305,2082.722 1166.118,2079.136 1162.082,2075.39ZM1429.757,2031.663C1454.142,2002.665 1468.838,1965.254 1468.838,1924.438C1468.838,1832.404 1394.118,1757.685 1302.084,1757.685C1210.05,1757.685 1135.33,1832.404 1135.33,1924.438C1135.33,1965.378 1150.115,2002.891 1174.633,2031.926C1185.765,2045.11 1198.905,2056.546 1213.578,2065.76C1239.234,2081.872 1269.579,2091.192 1302.084,2091.192C1334.74,2091.192 1365.216,2081.785 1390.948,2065.535C1405.574,2056.298 1418.667,2044.85 1429.757,2031.663Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2461.416298,959.718427)\"><path d=\"M1302.084,1796.766C1372.549,1796.766 1429.757,1853.974 1429.757,1924.438C1429.757,1994.903 1372.549,2052.111 1302.084,2052.111C1231.62,2052.111 1174.411,1994.903 1174.411,1924.438C1174.411,1853.974 1231.62,1796.766 1302.084,1796.766ZM1302.084,1835.932C1253.236,1835.932 1213.578,1875.59 1213.578,1924.438C1213.578,1973.286 1253.236,2012.945 1302.084,2012.945C1350.932,2012.945 1390.59,1973.286 1390.59,1924.438C1390.59,1875.59 1350.932,1835.932 1302.084,1835.932Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.450987,0,0,0.450987,2461.416298,959.718427)\"><path d=\"M1302.084,1875.65C1329.011,1875.65 1350.873,1897.511 1350.873,1924.438C1350.873,1951.365 1329.011,1973.227 1302.084,1973.227C1275.157,1973.227 1253.296,1951.365 1253.296,1924.438C1253.296,1897.511 1275.157,1875.65 1302.084,1875.65ZM1302.084,1914.816C1296.774,1914.816 1292.462,1919.128 1292.462,1924.438C1292.462,1929.749 1296.774,1934.06 1302.084,1934.06C1307.395,1934.06 1311.706,1929.749 1311.706,1924.438C1311.706,1919.128 1307.395,1914.816 1302.084,1914.816Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1399.130503,1529.397747)\"><path d=\"M2845.91,1672.985L2845.91,1958.909L2817.06,1958.909L2817.06,1631.443C2827.091,1643.86 2836.727,1657.75 2845.91,1672.985Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1433.939162,1529.397747)\"><path d=\"M2845.91,1802.02L2845.91,1958.909L2817.06,1958.909L2817.06,1726.678C2827.566,1749.871 2837.223,1775.075 2845.91,1802.02Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1196.250767,1529.397747)\"><path d=\"M2845.91,1726.677L2845.91,1958.909L2817.06,1958.909L2817.06,1802.02C2825.747,1775.075 2835.404,1749.87 2845.91,1726.677Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.266945,1231.059426,1529.397747)\"><rect x=\"2817.06\" y=\"1726.677\" width=\"28.85\" height=\"232.232\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.561243,1231.539405,932.550613)\"><path d=\"M2902.765,1884.632L2902.765,1991.291L2874.077,1991.291L2874.077,1884.7L2900.791,1884.701C2901.451,1884.701 2902.11,1884.678 2902.765,1884.632ZM2874.077,1725.083L2874.077,1602.52L2902.765,1602.52L2902.765,1725.151C2902.11,1725.106 2901.451,1725.083 2900.791,1725.083L2874.077,1725.083Z\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.612238,0,0,0.612238,1293.744566,850.829465)\"><rect x=\"2931.817\" y=\"1602.52\" width=\"28.587\" height=\"356.39\" style=\"fill:rgb(215,38,61);\"/></g><g transform=\"matrix(0.526966,0,0,0.526966,1497.628118,702.742774)\"><path d=\"M2435.864,2307.524L2439.704,2289.534L2459.047,2273.341L2484.791,2268.007L2554.574,2270.564L2859.097,2267.591L2882.577,2273.341L2902.332,2287.545L2906.568,2306.792L2906.651,2389.449L2905.759,2415.307L2893.276,2438.807L2868.341,2449.189L2472.124,2447.406L2445.774,2435.814L2437.053,2418.724L2433.784,2354.51L2435.864,2307.524Z\" style=\"fill:rgb(238,229,206);\"/></g><g transform=\"matrix(3.854705,0,0,3.854705,-951.135967,-2569.778572)\"><g transform=\"matrix(0.526966,0,0,0.526966,975.330654,1180.783313)\"><text x=\"0px\" y=\"0px\" style=\"font-family:'Space Grotesk', sans-serif;font-weight:500;font-size:50px;fill:rgb(31,31,31);\">H2H</text></g></g><g transform=\"matrix(0.417448,0,0,0.526966,2406.821194,776.928454)\"><path d=\"M1438.966,2123.028C1454.323,2123.028 1469.051,2127.861 1479.909,2136.463C1490.768,2145.065 1496.869,2156.731 1496.869,2168.897L1496.869,2266.326C1496.869,2278.491 1490.768,2290.158 1479.909,2298.76C1469.051,2307.362 1454.323,2312.195 1438.966,2312.195L946.576,2312.195C931.219,2312.195 916.491,2307.362 905.633,2298.76C894.774,2290.158 888.673,2278.491 888.673,2266.326L888.673,2168.897C888.673,2156.731 894.774,2145.065 905.633,2136.463C916.491,2127.861 931.219,2123.028 946.576,2123.028L1438.966,2123.028ZM1438.966,2132.611L946.576,2132.611C934.428,2132.611 922.777,2136.434 914.187,2143.239C905.597,2150.044 900.771,2159.273 900.771,2168.897L900.771,2266.326C900.771,2275.95 905.597,2285.179 914.187,2291.984C922.777,2298.788 934.428,2302.611 946.576,2302.611L1438.966,2302.611C1451.114,2302.611 1462.765,2298.788 1471.355,2291.984C1479.945,2285.179 1484.771,2275.95 1484.771,2266.326L1484.771,2168.897C1484.771,2159.273 1479.945,2150.044 1471.355,2143.239C1462.765,2136.434 1451.114,2132.611 1438.966,2132.611Z\" style=\"fill:rgb(238,229,206);\"/></g></g></svg>";
const ICO_SEARCH = "<svg class=\"ico\" aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"824.3 508.9 151.5 182.3\"><g id=\"lupa\"><g transform=\"matrix(0.199435,-0.115144,0.115144,0.199435,410.190469,342.182751)\"><path d=\"M1302.084,1718.518C1415.735,1718.518 1508.005,1810.788 1508.005,1924.438C1508.005,2038.089 1415.735,2130.359 1302.084,2130.359C1188.433,2130.359 1096.164,2038.089 1096.164,1924.438C1096.164,1810.788 1188.433,1718.518 1302.084,1718.518ZM1302.084,1757.685C1210.05,1757.685 1135.33,1832.404 1135.33,1924.438C1135.33,2016.472 1210.05,2091.192 1302.084,2091.192C1394.118,2091.192 1468.838,2016.472 1468.838,1924.438C1468.838,1832.404 1394.118,1757.685 1302.084,1757.685Z\" style=\"fill:currentColor;\"/></g><g transform=\"matrix(0.199435,-0.115144,0.115144,0.199435,410.190469,342.182751)\"><path d=\"M1302.084,1796.766C1372.549,1796.766 1429.757,1853.974 1429.757,1924.438C1429.757,1994.903 1372.549,2052.111 1302.084,2052.111C1231.62,2052.111 1174.411,1994.903 1174.411,1924.438C1174.411,1853.974 1231.62,1796.766 1302.084,1796.766ZM1302.084,1835.932C1253.236,1835.932 1213.578,1875.59 1213.578,1924.438C1213.578,1973.286 1253.236,2012.945 1302.084,2012.945C1350.932,2012.945 1390.59,1973.286 1390.59,1924.438C1390.59,1875.59 1350.932,1835.932 1302.084,1835.932Z\" style=\"fill:currentColor;\"/></g><g transform=\"matrix(0.199435,-0.115144,0.115144,0.199435,410.190469,342.182751)\"><path d=\"M1302.084,1875.65C1329.011,1875.65 1350.873,1897.511 1350.873,1924.438C1350.873,1951.365 1329.011,1973.227 1302.084,1973.227C1275.157,1973.227 1253.296,1951.365 1253.296,1924.438C1253.296,1897.511 1275.157,1875.65 1302.084,1875.65ZM1302.084,1914.816C1296.774,1914.816 1292.462,1919.128 1292.462,1924.438C1292.462,1929.749 1296.774,1934.06 1302.084,1934.06C1307.395,1934.06 1311.706,1929.749 1311.706,1924.438C1311.706,1919.128 1307.395,1914.816 1302.084,1914.816Z\" style=\"fill:currentColor;\"/></g><g transform=\"matrix(1,0,0,1,-358.462153,-2554.837992)\"><path d=\"M1281.32,3243.979L1259.269,3205.786C1262.396,3205.399 1265.514,3204.812 1268.606,3204.021L1284.602,3231.727L1319.976,3211.304L1303.969,3183.578C1306.189,3181.3 1308.248,3178.898 1310.139,3176.391L1332.201,3214.603L1324.461,3219.071L1289.087,3239.494L1281.32,3243.979Z\" style=\"fill:currentColor;\"/></g><g transform=\"matrix(1,0,0,1,-358.462153,-2554.837992)\"><path d=\"M1272.305,3192.135C1243.108,3202.837 1209.535,3191.335 1193.459,3163.491C1175.468,3132.33 1186.161,3092.424 1217.322,3074.433C1248.484,3056.442 1288.39,3067.135 1306.381,3098.296C1322.411,3126.061 1315.67,3160.767 1291.968,3180.729L1307.725,3208.021L1288.039,3219.387L1272.305,3192.135ZM1284.683,3186.049C1283.973,3186.496 1283.251,3186.931 1282.518,3187.355C1281.861,3187.734 1281.2,3188.1 1280.536,3188.454L1291.322,3207.136L1295.474,3204.739L1284.683,3186.049ZM1221.832,3082.244C1194.982,3097.746 1185.768,3132.131 1201.27,3158.981C1216.773,3185.832 1251.157,3195.045 1278.008,3179.543C1304.858,3164.041 1314.071,3129.656 1298.569,3102.806C1283.067,3075.955 1248.683,3066.742 1221.832,3082.244Z\" style=\"fill:currentColor;\"/></g></g></svg>";
let h2hOpen = false, h2hKey = null, h2hFor = null;
const H2H_A = '#1b9e5a', H2H_B = '#d7263d';
function h2hPanelHtml(P){
  if (h2hFor !== P.key){ h2hFor = P.key; h2hOpen = false; h2hKey = null; }
  const others = allPlayers().filter(a => a.key !== P.key).sort((x,y) => (x.rank||1e9) - (y.rank||1e9) || x.name.localeCompare(y.name,'pl'));
  return `<div class="h2hpanel ${h2hOpen ? 'open' : ''}" id="h2hPanel"><div class="h2hpanel-in">
    <div class="small" style="margin-bottom:8px">Porównaj zawodnika <b>${esc(P.name)}</b> z:</div>
    <div class="searchbox">${ICO_SEARCH}<input type="search" id="h2hSearch" placeholder="Szukaj rywala…" autocomplete="off" aria-label="Szukaj rywala"></div>
    <div class="h2hlist" id="h2hList">${others.length ? others.map(a => `<button class="pcard" data-h2hpick="${esc(a.key)}" data-name="${esc(a.name.toLowerCase())}"><div class="pc-top"><span class="pc-name">${esc(a.name)}</span>${a.rank ? `<span class="pc-rank">#${a.rank}</span>` : ''}</div><div class="pc-meta">ELO ${eloInt(a.elo)} · ${legsWord(a.legs)}</div></button>`).join('') : '<div class="small">Nie ma jeszcze innych zawodników.</div>'}</div>
    <div class="small" id="h2hNone" style="display:none;padding:8px 0">Nikt nie pasuje do wyszukiwania.</div>
  </div></div>`;
}
function h2hCardHtml(P){
  if (!h2hKey) return '';
  const all = allPlayers();
  const A = all.find(a => a.key === P.key), B = all.find(a => a.key === h2hKey);
  if (!A || !B) return '';
  const ra = profileData(A.key), rb = profileData(B.key);
  // bezpośrednie legi
  const common = [];
  ST.legs.forEach(L => {
    const pa = L.players.find(p => p.n.toLowerCase() === A.key), pb = L.players.find(p => p.n.toLowerCase() === B.key);
    if (pa && pb) common.push({ L, pa, pb });
  });
  common.sort((x,y) => x.L.d < y.L.d ? 1 : -1);
  const aW = common.filter(c => c.pa.pl < c.pb.pl).length, bW = common.filter(c => c.pb.pl < c.pa.pl).length;
  const pA = 1 / (1 + Math.pow(10, (B.elo - A.elo) / 400));
  // statystyki obok siebie
  const f1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1);
  const pctv = (a, b) => b ? a / b * 100 : null;
  const rows = [
    ['ELO', A.elo, B.elo, 'hi', v => eloInt(v)],
    ['Najwyższe ELO', A.mElo ? A.peak : null, B.mElo ? B.peak : null, 'hi', v => v == null ? '–' : eloInt(v)],
    ['Mecze', A.mElo, B.mElo, null, v => v],
    ['Wygrane legi', ra.legs ? pctv(ra.w, ra.legs) : null, rb.legs ? pctv(rb.w, rb.legs) : null, 'hi', v => v == null ? '–' : Math.round(v) + '%'],
    ['Śr. miejsce', A.mp ? A.avgPl : null, B.mp ? B.avgPl : null, 'lo', f1],
    ['Średnia (3 lotki)', ra.dt ? ra.avg : null, rb.dt ? rb.avg : null, 'hi', f1],
    ['Średnia 9 pierwszych', ra.f9 || null, rb.f9 || null, 'hi', f1],
    ['Najwyższa tura', ra.bt || null, rb.bt || null, 'hi', v => v == null ? '–' : v],
    ['Tury 100+', ra.legs ? ra.c100 + ra.c140 + ra.c180 : null, rb.legs ? rb.c100 + rb.c140 + rb.c180 : null, 'hi', v => v == null ? '–' : v],
    ['Największy checkout', ra.co || null, rb.co || null, 'hi', v => v == null ? '–' : v],
    ['Średni checkout', ra.coN ? ra.coSum / ra.coN : null, rb.coN ? rb.coSum / rb.coN : null, 'hi', f1],
    ['Skuteczność na podwójnych', ra.dd ? pctv(ra.ddHit, ra.dd) : null, rb.dd ? pctv(rb.ddHit, rb.dd) : null, 'hi', v => v == null ? '–' : Math.round(v) + '%'],
    ['Najkrótszy wygrany leg', ra.bestLeg ? ra.bestLeg.dt : null, rb.bestLeg ? rb.bestLeg.dt : null, 'lo', v => v == null ? '–' : v + ' lot.'],
    ['Busty na leg', ra.detailed ? ra.busts / ra.detailed : null, rb.detailed ? rb.busts / rb.detailed : null, 'lo', v => v == null ? '–' : (Math.round(v * 10) / 10).toFixed(1)],
  ];
  const cmp = rows.map(([lab, va, vb, better, fmt]) => {
    const both = va != null && vb != null;
    let wa = false, wb = false;
    if (both && better && va !== vb){ const aBetter = better === 'hi' ? va > vb : va < vb; wa = aBetter; wb = !aBetter; }
    // dłuższy pasek = lepszy wynik (przy „mniej = lepiej” skala jest odwrócona)
    const bar = (v, o) => {
      if (v == null || typeof v !== 'number') return 0;
      if (better === 'lo'){ if (v <= 0) return 100; const mn = o != null ? Math.min(v, o) : v; return Math.max(4, mn / v * 100); }
      const mx = Math.max(Math.abs(v), o != null ? Math.abs(o) : 0);
      return mx ? Math.max(4, Math.abs(v) / mx * 100) : 0;
    };
    const barA = bar(va, vb), barB = bar(vb, va);
    return `<div class="cmp-row">
      <div class="cmp-v a ${wa ? 'win' : ''}">${fmt(va)}</div>
      <div class="cmp-mid"><div class="cmp-lab">${lab}</div><div class="cmp-bars"><span class="cb a"><i style="width:${barA.toFixed(1)}%"></i></span><span class="cb b"><i style="width:${barB.toFixed(1)}%"></i></span></div></div>
      <div class="cmp-v b ${wb ? 'win' : ''}">${fmt(vb)}</div></div>`;
  }).join('');
  // wspólny wykres ELO
  const st = eloState; let chart = '<div class="small">Brak meczów z rywalami.</div>';
  const ha = st && st.hist.get(A.key) || [], hb = st && st.hist.get(B.key) || [];
  if (ha.length || hb.length){
    const mk = (h, nm) => h.length ? [{ x:h[0].idx - 0.5, y:h[0].b }].concat(h.map(e => ({ x:e.idx, y:e.a, tip:`${nm} · ${fmtDate(e.d)} · ${e.pl}/${e.np} miejsce · ${fmtD(e.dd)} → ${fmtElo(e.a)}` }))) : [];
    const xs = ha.concat(hb).map(e => e.idx);
    chart = eloLineChart([{ name:A.name, color:H2H_A, pts:mk(ha, A.name) }, { name:B.name, color:H2H_B, pts:mk(hb, B.name) }],
      { xMin:Math.min(...xs) - 0.6, xMax:Math.max(...xs), left:fmtDate(st.matches[Math.min(...xs)].L.d), right:fmtDate(st.matches[Math.max(...xs)].L.d), aria:'ELO obu zawodników' });
  }
  const list = common.slice(0, 10).map(c => `<tr><td class="l">${fmtDate(c.L.d)}, ${fmtTime(c.L.d)}</td><td>${c.L.start} · ${c.L.np} gr.</td>
      <td class="${c.pa.pl < c.pb.pl ? 'win' : ''}">${MEDAL[c.pa.pl-1] || ''} ${c.pa.pl}. ${c.pa.ed != null ? `<span class="${dCls(c.pa.ed)}">${fmtD(c.pa.ed)}</span>` : ''}</td>
      <td class="${c.pb.pl < c.pa.pl ? 'win' : ''}">${MEDAL[c.pb.pl-1] || ''} ${c.pb.pl}. ${c.pb.ed != null ? `<span class="${dCls(c.pb.ed)}">${fmtD(c.pb.ed)}</span>` : ''}</td></tr>`).join('');
  return `<div class="card h2hcard" id="h2hCard">
    <div class="h2h-top">
      <div class="h2h-p a"><span class="h2h-dot" style="background:${H2H_A}"></span><div><div class="h2h-name">${esc(A.name)}</div><div class="small">ELO ${eloInt(A.elo)}${A.rank ? ` · #${A.rank}` : ''}</div></div></div>
      <div class="h2h-vs">${ICO_H2H}</div>
      <div class="h2h-p b"><div><div class="h2h-name"><a class="plink" data-prof="${esc(B.key)}">${esc(B.name)}</a></div><div class="small">ELO ${eloInt(B.elo)}${B.rank ? ` · #${B.rank}` : ''}</div></div><span class="h2h-dot" style="background:${H2H_B}"></span></div>
    </div>
    <div class="h2h-sum">
      <div class="h2h-score"><b class="sa">${aW}</b><span class="small">bilans w ${legsWord(common.length)}</span><b class="sb">${bW}</b></div>
      <div class="duel2"><span style="width:${common.length ? (aW / common.length * 100).toFixed(1) : 50}%;background:${H2H_A}"></span><span style="flex:1;background:${common.length ? H2H_B : 'rgba(239,230,207,.15)'}"></span></div>
      <div class="small" style="margin-top:8px">Szansa na wygraną w bezpośrednim pojedynku wg ELO: <b>${esc(A.name)} ${Math.round(pA * 100)}%</b> – <b>${esc(B.name)} ${Math.round((1 - pA) * 100)}%</b></div>
    </div>
    <div class="cmp">${cmp}</div>
    <div class="sechead" style="margin-top:16px">ELO obu zawodników</div>${chart}
    ${common.length ? `<div class="sechead" style="margin-top:16px">Wspólne legi</div><div class="tblwrap"><table class="tbl sm h2htbl"><tr><th class="l">Data</th><th>Gra</th><th><span class="h2h-dot sm" style="background:${H2H_A}"></span>${esc(A.name)}</th><th><span class="h2h-dot sm" style="background:${H2H_B}"></span>${esc(B.name)}</th></tr>${list}</table></div>${common.length > 10 ? `<div class="small" style="margin-top:6px">Pokazano 10 ostatnich z ${common.length}.</div>` : ''}` : '<div class="small" style="margin-top:12px">Ci zawodnicy nie grali jeszcze ze sobą.</div>'}
    <div class="actions" style="margin-top:14px"><button class="btn" id="h2hSwap">⇄ Zamień strony</button><button class="btn" id="h2hOther">Inny rywal</button><button class="btn" id="h2hClose">✕ Zamknij porównanie</button></div>
  </div>`;
}
function bindH2H(P){
  const btn = $('prH2H'), panel = $('h2hPanel');
  if (btn) btn.onclick = () => {
    h2hOpen = !h2hOpen;
    panel.classList.toggle('open', h2hOpen); btn.classList.toggle('on', h2hOpen);
    if (h2hOpen) setTimeout(() => { try{ $('h2hSearch').focus({ preventScroll:true }); }catch(e){} }, 220);
  };
  const s = $('h2hSearch');
  if (s) s.addEventListener('input', () => {
    const q = s.value.trim().toLowerCase(); let n = 0;
    $('h2hList').querySelectorAll('[data-h2hpick]').forEach(b => { const ok = !q || b.dataset.name.includes(q); b.style.display = ok ? '' : 'none'; if (ok) n++; });
    $('h2hNone').style.display = n ? 'none' : '';
  });
  if (panel) panel.addEventListener('click', e => {
    const b = e.target.closest('[data-h2hpick]'); if (!b) return;
    h2hKey = b.dataset.h2hpick; h2hOpen = false; render();
    setTimeout(() => { const c = $('h2hCard'); if (c) c.scrollIntoView({ behavior:'smooth', block:'start' }); }, 40);
  });
  $('profileView').querySelectorAll('[data-h2h]').forEach(b => b.onclick = () => {
    h2hKey = b.dataset.h2h; h2hOpen = false; render();
    setTimeout(() => { const c = $('h2hCard'); if (c) c.scrollIntoView({ behavior:'smooth', block:'start' }); }, 40);
  });
  const sw = $('h2hSwap'); if (sw) sw.onclick = () => { const a = P.key; profKey = h2hKey; h2hFor = h2hKey; h2hKey = a; h2hOpen = false; render(); };
  const ot = $('h2hOther'); if (ot) ot.onclick = () => { h2hOpen = true; const p = $('h2hPanel'); p.classList.add('open'); $('prH2H').classList.add('on'); p.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(() => { try{ $('h2hSearch').focus({ preventScroll:true }); }catch(e){} }, 220); };
  const cl = $('h2hClose'); if (cl) cl.onclick = () => { h2hKey = null; render(); };
}

/* floating tooltip for charts */
document.addEventListener('pointerover', e => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  const f = $('tipf');
  if (!t || !(t.closest('#profileView') || t.closest('#stats'))){ f.classList.remove('show'); return; }
  f.textContent = t.dataset.tip; f.classList.add('show');
});
document.addEventListener('pointermove', e => {
  const f = $('tipf'); if (!f.classList.contains('show')) return;
  const x = Math.min(window.innerWidth - f.offsetWidth - 8, e.clientX + 12);
  f.style.left = Math.max(8, x) + 'px'; f.style.top = (e.clientY - f.offsetHeight - 12) + 'px';
});

/* ---------- RENDER ---------- */
function render(){
  lsSet('dart-view', { view, prof:profKey, t:Date.now() });
  ['stats','playersView','profileView'].forEach(id => $(id).style.display = 'none');
  $('btnRank').classList.toggle('sel', view === 'stats');
  $('btnPlayers').classList.toggle('sel', view === 'players' || view === 'profile');
  if (view !== 'main'){
    $('modeInfo').textContent = ''; $('setup').style.display = 'none'; $('game').style.display = 'none'; $('btnNew').style.display = 'none';
    if (view === 'stats'){ $('stats').style.display = ''; renderStats(); }
    else if (view === 'players'){ $('playersView').style.display = ''; renderPlayers(); }
    else { $('profileView').style.display = ''; renderProfile(); }
    return;
  }
  if (S.phase !== 'game'){ renderSetup(); return; }
  $('setup').style.display = 'none'; $('game').style.display = ''; $('btnNew').style.display = '';
  $('modeInfo').textContent = `${S.start} · ${S.out==='double'?'double out':'dowolne zakończenie'}`;
  $('players').innerHTML = S.players.map((p,i) => {
    const st = legStats(i), pl = placeOf(i);
    return `<div class="pl ${i===S.player && !S.pending && !pl?'active':''} ${pl?'done':''}">
      <div class="nm">${esc(p)}</div><div class="legs">${pl ? placeTxt(pl) : (S.legs[i] ? '★'+S.legs[i] : '')}</div>
      <div class="sc">${pl ? (S.finished[pl-1].auto ? '–' : '✓') : remaining(i)}</div>
      <div class="meta">śr. ${st.avg.toFixed(1)} · lotki ${st.darts} · legi ${S.legs[i]||0}</div></div>`;
  }).join('');
  const rem = remaining(S.player);
  $('who').textContent = S.pending ? (S.pending.type==='legEnd' ? 'Leg zakończony' : `${S.players[S.pending.p]} skończył(a)!`) : `Rzuca: ${S.players[S.player]} · lotka ${Math.min(S.cur.length+1,3)}/3`;
  $('remain').textContent = rem;
  $('turnSum').textContent = turnTotal(S.cur);
  $('darts').innerHTML = [0,1,2].map(i => S.cur[i] ? `<div class="dart${i===S.cur.length-1?' new':''}">${S.cur[i].label}</div>` : `<div class="dart empty">–</div>`).join('');
  const co = !S.pending && rem <= 170 ? checkout(rem, 3 - S.cur.length) : null;
  $('hint').textContent = co ? 'Zejście: ' + co.join(' · ') : '';
  $('msg').textContent = S.msg || '';
  $('msg').className = 'msg' + (S.msgBust ? ' bust' : '');
  const h = [];
  for (let i=S.turns.length-1; i>=0 && h.length<30; i--){
    const t = S.turns[i];
    h.push(`<div><b>${esc(S.players[t.p])}</b>: ${t.n ? t.darts.map(d=>d.label).join(', ') : '(pominięta)'} ${t.bust ? '→ <span style="color:#ef4b62">bust</span>' : '= '+t.total}${t.fin?' <span style="color:#efe6cf">✓ checkout</span>':''}</div>`);
  }
  $('hist').innerHTML = h.join('');
  drawMarks();
}

/* ---------- EVENTS ---------- */
$('btnMiss').onclick = () => { marks.push([-1000,-1000]); addDart(0,0,'0'); };
$('btnUndo').onclick = undo;
$('btnNext').onclick = nextPlayer;
$('btnNew').onclick = () => confirmBox('Nowa gra?', 'Bieżący, niezapisany leg zostanie usunięty. Zapisane statystyki zostają.', 'Tak, nowa gra', () => { hideModal('finModal'); S.phase='setup'; S.pending=null; save(); render(); });
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => {
  tab = b.dataset.tab;
  document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('sel', x===b));
  $('tabBoard').style.display = tab==='board' ? '' : 'none';
  $('tabKeys').style.display = tab==='keys' ? '' : 'none';
});
let mult = 1;
function setMult(m){
  mult = m;
  document.querySelectorAll('[data-mult]').forEach(b => b.classList.toggle('sel', +b.dataset.mult===m));
  const b25 = document.querySelector('[data-num="25"]');
  if (b25){ b25.disabled = m===3; b25.textContent = m===2 ? 'Bull' : '25'; }
}
$('nums').innerHTML = Array.from({length:20},(_,i)=>`<button class="btn" data-num="${i+1}">${i+1}</button>`).join('')
  + `<button class="btn wide" data-num="25">25</button><button class="btn wide danger" data-num="0">Pudło</button><button class="btn" data-act="undo" title="Cofnij">↶</button>`;
$('mults').onclick = e => { const m = e.target.dataset.mult; if (m) setMult(mult===+m && +m!==1 ? 1 : +m); };
function pickDart(n){
  if (!canThrow()) return;
  const m = n===0 ? 0 : mult;
  if (n===25 && m===3) return;
  const label = n===0 ? '0' : n===25 ? (m===2?'Bull':'25') : (m===3?'T':m===2?'D':'') + n;
  marks.push([-1000,-1000]);
  addDart(n*m, m, label);
  setMult(1);
}
$('nums').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act==='undo'){ undo(); return; }
  if (b.dataset.num!==undefined) pickDart(+b.dataset.num);
};
let kbuf = '';
document.addEventListener('keydown', e => {
  if (S.phase!=='game' || view!=='main' || tab!=='keys' || e.target.tagName==='INPUT') return;
  const k = e.key.toLowerCase();
  if (k==='d') setMult(mult===2?1:2);
  else if (k==='t') setMult(mult===3?1:3);
  else if (k==='s') setMult(1);
  else if (/^\d$/.test(k)){ kbuf=(kbuf+k).slice(-2); }
  else if (k==='enter'){ const n=+(kbuf||0); kbuf=''; if (n===0||n===25||(n>=1&&n<=20)) pickDart(n); }
  else if (k==='backspace'){ if (kbuf) kbuf=kbuf.slice(0,-1); else undo(); }
  else return;
  e.preventDefault();
});

/* ---------- BACKUP ---------- */
function download(name, text){
  const blob = new Blob([text], { type: /\.csv$/i.test(name) ? 'text/csv;charset=utf-8' : 'application/json' });
  const url = URL.createObjectURL(blob);
  const el = document.createElement('a'); el.href = url; el.download = name;
  document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
$('btnExport').onclick = () => {
  const d = new Date(), pad = n => String(n).padStart(2,'0');
  download(`dart-statystyki-${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}.json`, JSON.stringify({ app:'dart-scorer', version:1, exported:d.toISOString(), stats:ST }, null, 1));
};
$('btnImport').onclick = () => requireAdmin(() => $('importFile').click(), 'Wczytanie kopii zmienia statystyki, więc jest chronione hasłem.');
$('importFile').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let data;
  try{ data = JSON.parse(await f.text()); }catch(err){ confirmBox('Błędny plik', 'To nie jest kopia statystyk z tej aplikacji.', 'OK', null); return; }
  const legs = data && data.stats && Array.isArray(data.stats.legs) ? data.stats.legs : (Array.isArray(data.legs) ? data.legs : null);
  if (!legs){ confirmBox('Błędny plik', 'Nie znaleziono legów w pliku.', 'OK', null); return; }
  confirmBox('Wczytać kopię?', `Plik zawiera ${legWord(legs.length)}. Te, których jeszcze nie ma, zostaną dopisane do obecnych (${legWord(ST.legs.length)}).`, 'Wczytaj', () => {
    const seen = new Set(ST.legs.map(L => L.d + '|' + L.players.map(p=>p.n).join(',')));
    legs.forEach(L => { const k = L.d + '|' + L.players.map(p=>p.n).join(','); if (!seen.has(k)){ ST.legs.push(L); seen.add(k); } });
    ST.legs.sort((x,y) => x.d < y.d ? -1 : 1);
    const rs = (data.stats && Array.isArray(data.stats.roster)) ? data.stats.roster : [];
    rs.forEach(rr => { if (rr && rr.n && !allPlayers().some(p => p.key === rr.n.toLowerCase())) roster().push(rr); });
    saveStats(); render();
  });
};

/* ---------- TABLET HELPERS: fullscreen, screen awake ---------- */
let wakeLock = null;
async function keepAwake(){
  try{ if ('wakeLock' in navigator && document.visibilityState === 'visible') wakeLock = await navigator.wakeLock.request('screen'); }catch(e){}
}
document.addEventListener('visibilitychange', keepAwake);
document.addEventListener('pointerdown', () => { if (!wakeLock || wakeLock.released) keepAwake(); });
$('btnFull').onclick = () => {
  const d = document;
  if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
  else { const el = d.documentElement; const fn = el.requestFullscreen || el.webkitRequestFullscreen; if (fn) fn.call(el); }
};
if ('serviceWorker' in navigator && location.protocol !== 'file:'){
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  // after a new version takes over, reload once so the new files are used right away
  if (navigator.serviceWorker.controller){
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded){ reloaded = true; location.reload(); } });
  }
}

/* ---------- START ---------- */
(async () => {
  const stored = await DB.get('stats');
  if (stored && Array.isArray(stored.legs)) ST = stored;
  try{ if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); }catch(e){}
  { const vv = lsGet('dart-view'); if (vv && vv.view && Date.now() - vv.t < 600000){ view = vv.view; profKey = vv.prof || null; } }
  buildBoard();
  render();
  if (S.phase==='game' && S.pending) showPending();
  keepAwake();
})();
})();
