/* ============================================================
   合租生活管家 · 纯前端静态版（localStorage 演示）
   ============================================================ */
'use strict';

const MEMBER_COLORS = ['#FF7A59','#4FB286','#5B8DEF','#F4B400','#A569BD','#EF6C9C','#26C6DA','#8D6E63'];
const AVATARS = ['🦊','🐼','🐨','🐯','🦁','🐱','🐰','🐻','🐸','🐵'];
const CATS = [
  {key:'rent', name:'房租', ico:'🏠'},
  {key:'water', name:'水费', ico:'💧'},
  {key:'elec', name:'电费', ico:'⚡'},
  {key:'net', name:'网费', ico:'📶'},
  {key:'prop', name:'物业费', ico:'🏢'},
  {key:'food', name:'聚餐/买菜', ico:'🍜'},
  {key:'other', name:'其他', ico:'📦'},
];
const CLEAN_TEMPLATES = [
  {name:'倒垃圾', ico:'🗑️'},
  {name:'拖地', ico:'🧽'},
  {name:'公共区擦拭', ico:'🧴'},
  {name:'卫生间清洁', ico:'🚽'},
  {name:'厨房收拾', ico:'🍳'},
];
const PACT_TEMPLATES = [
  '公共区域保持整洁，垃圾满即倒',
  '23:00 后保持安静，戴耳机外放音乐',
  '不随意带陌生人留宿，需提前告知',
  '养宠物须经全员同意',
  '水电房租每月 5 号前结清并公示',
  '公用物品用完及时补货或登记',
];

const DB_KEY = 'hezu_guanjia_v1';

/* ---------- 工具 ---------- */
const $ = (s, r=document) => r.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const fmt = n => '¥' + (Math.round(n * 100) / 100).toLocaleString('zh-CN', {minimumFractionDigits: 0, maximumFractionDigits: 2});
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayStr = () => fmtDate(new Date());
function fmtDate(d){ const z = n => String(n).padStart(2,'0'); return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate()); }
function addDays(str, n){ const d = new Date(str+'T00:00:00'); d.setDate(d.getDate()+n); return fmtDate(d); }
function daysFromToday(str){ const a = new Date(str+'T00:00:00'); const b = new Date(todayStr()+'T00:00:00'); return Math.round((a-b)/86400000); }
function monthKey(str){ return str.slice(0,7); }

/* ---------- 存储 ---------- */
let DB = load();
function load(){
  try{ const r = JSON.parse(localStorage.getItem(DB_KEY)); if(r) return r; }catch(e){}
  return { currentRoomId:null, rooms:[] };
}
function save(){ localStorage.setItem(DB_KEY, JSON.stringify(DB)); }

function getRoom(id){ return DB.rooms.find(r => r.id === id); }
function curRoom(){ return getRoom(DB.currentRoomId); }
function member(id){ const r = curRoom(); return r ? r.members.find(m => m.id === id) : null; }
function memberName(id){ const m = member(id); return m ? m.name : '未知'; }
function memberAva(id, cls=''){ const m = member(id); if(!m) return ''; return `<span class="ava ${cls}" style="background:${m.color}">${m.emoji||m.name[0]}</span>`; }

/* ---------- 结算算法 ---------- */
function computeNet(room){
  const net = {}; room.members.forEach(m => net[m.id] = 0);
  room.expenses.forEach(e => {
    net[e.payerId] += e.amount;
    const parts = e.participantIds;
    if(e.splitType === 'custom'){
      parts.forEach(pid => net[pid] -= (Number(e.customShares[pid]) || 0));
    } else {
      const share = e.amount / parts.length;
      parts.forEach(pid => net[pid] -= share);
    }
  });
  return net;
}
function settle(net){
  const cr = [], db = [];
  Object.entries(net).forEach(([id, v]) => {
    if(v > 0.005) cr.push({id, amt:v});
    else if(v < -0.005) db.push({id, amt:-v});
  });
  cr.sort((a,b)=>b.amt-a.amt); db.sort((a,b)=>b.amt-a.amt);
  const tx = []; let ci=0, di=0;
  while(ci<cr.length && di<db.length){
    const c = cr[ci], d = db[di];
    const pay = Math.min(c.amt, d.amt);
    tx.push({from:d.id, to:c.id, amt:pay});
    c.amt -= pay; d.amt -= pay;
    if(c.amt <= 0.005) ci++;
    if(d.amt <= 0.005) di++;
  }
  return tx;
}

/* ---------- 演示数据 ---------- */
function seedDemo(){
  const r = {
    id: uid(), name:'阳光合租屋',
    members:[
      {id:uid(), name:'小明', emoji:'🦊', color:MEMBER_COLORS[0]},
      {id:uid(), name:'小红', emoji:'🐼', color:MEMBER_COLORS[1]},
      {id:uid(), name:'阿强', emoji:'🐯', color:MEMBER_COLORS[2]},
    ],
    expenses:[],
    cleaning:{ tasks:[], entries:[] },
    items:[],
    pact:{ rules:[] },
  };
  const [m1,m2,m3] = r.members;
  const mk = (cat, amount, payer, parts, note, dayOff=0) => ({
    id:uid(), cat, amount, payerId:payer.id, participantIds:parts.map(p=>p.id), splitType:'equal',
    date: addDays(todayStr(), -dayOff), note
  });
  r.expenses = [
    mk('rent', 3000, m1, [m1,m2,m3], '9月房租'),
    mk('elec', 240, m2, [m1,m2,m3], '8月电费', 2),
    mk('net', 120, m3, [m1,m2,m3], '宽带续费', 4),
    mk('food', 360, m1, [m1,m2,m3], '周末火锅', 1),
    mk('water', 90, m2, [m1,m2,m3], '水费', 6),
  ];
  r.cleaning.tasks = CLEAN_TEMPLATES.slice(0,4).map(t => ({id:uid(), name:t.name, ico:t.ico}));
  r.cleaning.entries = genSchedule(r, todayStr(), 8);
  r.items = [
    {id:uid(), name:'抽纸', qty:3, unit:'包', threshold:1, price:25, lastBuyerId:m2.id, note:'客厅+卫生间', updatedAt:todayStr()},
    {id:uid(), name:'洗洁精', qty:1, unit:'瓶', threshold:1, price:18, lastBuyerId:m3.id, note:'厨房', updatedAt:todayStr()},
    {id:uid(), name:'垃圾袋', qty:2, unit:'卷', threshold:1, price:12, lastBuyerId:m1.id, note:'', updatedAt:todayStr()},
    {id:uid(), name:'洗衣液', qty:0, unit:'瓶', threshold:1, price:40, lastBuyerId:null, note:'已用尽', updatedAt:todayStr()},
  ];
  r.pact.rules = [
    {id:uid(), text:PACT_TEMPLATES[0], createdBy:m1.id, confirmedBy:[m1.id,m2.id,m3.id]},
    {id:uid(), text:PACT_TEMPLATES[1], createdBy:m2.id, confirmedBy:[m1.id,m2.id]},
    {id:uid(), text:PACT_TEMPLATES[4], createdBy:m3.id, confirmedBy:[m1.id,m2.id,m3.id]},
  ];
  DB.rooms.push(r);
  DB.currentRoomId = r.id;
  save();
}

function genSchedule(room, startDate, days){
  const tasks = room.cleaning.tasks;
  const mems = room.members;
  if(!tasks.length || !mems.length) return [];
  const out = [];
  for(let i=0;i<days;i++){
    const task = tasks[i % tasks.length];
    const mem = mems[i % mems.length];
    out.push({ id:uid(), taskId:task.id, assigneeId:mem.id, date:addDays(startDate,i), status:'todo' });
  }
  return out;
}

/* 首次进入若无房间则播种演示数据 */
if(!DB.rooms.length){ seedDemo(); }
else if(!DB.currentRoomId && DB.rooms[0]){ DB.currentRoomId = DB.rooms[0].id; save(); }

/* ============================================================
   渲染
   ============================================================ */
let view = 'overview';

function render(){
  const r = curRoom();
  renderRoomSwitch(r);
  const c = $('#content');
  if(!r){ c.innerHTML = emptyState('🏡','还没有房间','点击下方按钮创建你的合租房间'); return; }
  if(view==='overview') c.innerHTML = viewOverview(r);
  else if(view==='expenses') c.innerHTML = viewExpenses(r, exptab);
  else if(view==='cleaning') c.innerHTML = viewCleaning(r);
  else if(view==='items') c.innerHTML = viewItems(r);
  else if(view==='pact') c.innerHTML = viewPact(r);
  document.querySelectorAll('.nav-item,.bnav-item').forEach(b => b.classList.toggle('active', b.dataset.view===view));
  window.scrollTo(0,0);
}

function emptyState(ico, t, s){
  return `<div class="card empty"><div class="e-ico">${ico}</div><div class="e-txt">${esc(t)}</div><div class="muted" style="margin-top:6px">${esc(s)}</div>
    <button class="btn btn-primary" style="margin-top:16px" data-action="manage-room">⚙️ 管理房间</button></div>`;
}

function renderRoomSwitch(r){
  const el = $('#roomSwitch');
  if(!r){ el.innerHTML = `<button class="room-pill" data-action="manage-room">+ 创建房间</button>`; return; }
  const mini = r.members.map(m => `<span class="ava sm" style="background:${m.color}" title="${esc(m.name)}">${m.emoji||m.name[0]}</span>`).join('');
  el.innerHTML = `
    <div class="room-pill" data-action="switch-room">🏡 ${esc(r.name)} <span class="caret">▾</span></div>
    <div class="members-mini">${mini}</div>`;
}

/* ---------- 概览 ---------- */
function viewOverview(r){
  const net = computeNet(r);
  const tx = settle(net);
  const mk = monthKey(todayStr());
  const monthExp = r.expenses.filter(e => monthKey(e.date)===mk).reduce((s,e)=>s+e.amount,0);
  const pending = tx.reduce((s,t)=>s+t.amt,0);
  const todoClean = r.cleaning.entries.filter(e => e.date>=todayStr() && e.status==='todo').length;
  const lowItems = r.items.filter(it => it.qty <= it.threshold).length;

  const recent = [...r.expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5);
  const upcoming = [...r.cleaning.entries].filter(e=>e.date>=todayStr()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,3);
  const lowList = r.items.filter(it=>it.qty<=it.threshold).slice(0,4);

  const catName = k => (CATS.find(c=>c.key===k)||{}).name || k;

  return `
  <div class="stat-grid">
    <div class="stat"><div class="s-ico">💸</div><div class="s-val">${fmt(monthExp)}</div><div class="s-lbl">本月支出</div></div>
    <div class="stat ${pending>0?'warn':'green'}"><div class="s-ico">🤝</div><div class="s-val">${pending>0?fmt(pending):'已结清'}</div><div class="s-lbl">待结清金额</div></div>
    <div class="stat"><div class="s-ico">🧹</div><div class="s-val">${todoClean}</div><div class="s-lbl">待办清洁</div></div>
    <div class="stat ${lowItems?'warn':'green'}"><div class="s-ico">🛒</div><div class="s-val">${lowItems}</div><div class="s-lbl">待补货物品</div></div>
  </div>

  <div class="card" style="margin-bottom:18px">
    <div class="section-head"><div class="section-title">📊 收支速览</div>
      <button class="btn btn-sm btn-ghost" data-action="expenses-nav">查看账本 →</button></div>
    <div class="row" style="border:none;padding-bottom:4px"><div class="grow muted tiny">室友</div><div class="right tiny muted">净结余（正=应收回 / 负=应付）</div></div>
    ${r.members.map(m=>{
      const v = net[m.id]||0; const cls = v>=0?'green':'gray';
      return `<div class="row"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(m.id)}<b>${esc(m.name)}</b></div>
        <div class="right"><span class="pill ${cls}">${v>=0?'+':'-'}${fmt(Math.abs(v))}</span></div></div>`;
    }).join('')}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px">
    <div class="card">
      <div class="section-head"><div class="section-title">🧾 最近账目</div></div>
      ${recent.length? recent.map(e=>`
        <div class="row"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(e.payerId)}
          <div class="grow"><b>${catName(e.cat)}</b> <span class="muted tiny">· ${esc(e.note||'')}</span><div class="muted tiny">${e.date}</div></div></div>
        <div class="right"><b>${fmt(e.amount)}</b></div></div>`).join('')
        : '<div class="muted">还没有账目，去记一笔吧～</div>'}
    </div>
    <div class="card">
      <div class="section-head"><div class="section-title">🔔 待办提醒</div></div>
      ${upcoming.length? upcoming.map(e=>{
        const t = r.cleaning.tasks.find(x=>x.id===e.taskId);
        const d = daysFromToday(e.date);
        return `<div class="row"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(e.assigneeId)}
          <div class="grow"><b>${t?t.ico+' '+t.name:'清洁'}</b><div class="muted tiny">${e.date} ${d===0?'· 今天':d>0?'· '+d+'天后':''}</div></div></div>
          <span class="pill warn">待办</span></div>`;
      }).join('') : '<div class="muted">暂无排班</div>'}
      ${lowList.length? `<div style="margin-top:8px;border-top:1px dashed var(--border);padding-top:8px">${lowList.map(it=>`<div class="row" style="padding:8px 0"><div class="grow">🛒 <b>${esc(it.name)}</b> <span class="muted tiny">仅剩 ${it.qty}${it.unit}</span></div><span class="pill warn">补货</span></div>`).join('')}</div>`:''}
    </div>
  </div>`;
}

/* ---------- 费用分摊 ---------- */
function expSeg(tab){
  const b = t => `<button class="${tab===t?'on':''}" data-action="exp-tab" data-tab="${t}">${t==='list'?'📒 账本':t==='settle'?'🤝 结算':'📈 报表'}</button>`;
  return `<div class="seg" data-group="exptab" style="max-width:340px;margin-bottom:16px">${b('list')}${b('settle')}${b('report')}</div>`;
}

function viewExpenses(r, tab='list'){
  const catName = k => { const c = CATS.find(x=>x.key===k); return c? c.ico+' '+c.name : k; };

  if(tab==='settle'){
    const net = computeNet(r); const tx = settle(net);
    return `<div class="section-head"><div class="section-title">💰 费用分摊</div>
        <button class="btn btn-primary" data-action="add-expense">＋ 记一笔</button></div>
      ${expSeg('settle')}
      <div class="card" style="margin-bottom:16px"><div class="section-head" style="margin-bottom:8px"><div class="section-title" style="font-size:16px">每人净结余</div></div>
        ${r.members.map(m=>{ const v=net[m.id]||0; return `<div class="row" style="padding:8px 0"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(m.id)}<b>${esc(m.name)}</b></div><span class="pill ${v>=0?'green':'gray'}">${v>=0?'应收 ':'应付 '}${fmt(Math.abs(v))}</span></div>`;}).join('')}
      </div>
      <div class="card"><div class="section-head" style="margin-bottom:8px"><div class="section-title" style="font-size:16px">最省心的结清方案</div></div>
        ${tx.length? tx.map(t=>`<div class="row" style="padding:10px 0"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(t.from)}<b>${memberName(t.from)}</b><span class="muted">→</span>${memberAva(t.to)}<b>${memberName(t.to)}</b></div><div class="right"><span class="pill">${fmt(t.amt)}</span></div></div>`).join('') : '<div class="empty"><div class="e-ico">🎉</div><div class="e-txt">账目已平，无需转账</div></div>'}
      </div>`;
  }

  if(tab==='report'){
    const mk = monthKey(todayStr());
    return `<div class="section-head"><div class="section-title">💰 费用分摊</div>
        <button class="btn btn-primary" data-action="add-expense">＋ 记一笔</button></div>
      ${expSeg('report')}
      <div class="section-head"><div class="section-title">📈 ${mk} 月度报表</div></div>
      <div class="card">${r.members.map(m=>{
        const paid = r.expenses.filter(e=>e.payerId===m.id && monthKey(e.date)===mk).reduce((s,e)=>s+e.amount,0);
        const owed = r.expenses.filter(e=>monthKey(e.date)===mk && e.participantIds.includes(m.id)).reduce((s,e)=> s + (e.splitType==='custom'? (Number(e.customShares[m.id])||0) : e.amount/e.participantIds.length),0);
        const bal = paid - owed;
        return `<div class="row" style="padding:10px 0"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(m.id)}<b>${esc(m.name)}</b></div>
          <div class="right" style="font-size:13px">垫付 <b>${fmt(paid)}</b> · 应付 <b>${fmt(owed)}</b> · <span class="pill ${bal>=0?'green':'gray'}">${bal>=0?'结余 +':'-'} ${fmt(Math.abs(bal))}</span></div></div>`;
      }).join('')}</div>`;
  }

  // 默认：账本列表
  const grouped = {};
  [...r.expenses].sort((a,b)=>b.date.localeCompare(a.date)).forEach(e=>{
    (grouped[e.date.slice(0,7)] = grouped[e.date.slice(0,7)]||[]).push(e);
  });
  const listHtml = `
    <div class="section-head"><div class="section-title">💰 费用分摊</div>
      <button class="btn btn-primary" data-action="add-expense">＋ 记一笔</button></div>
    ${expSeg('list')}
    ${Object.keys(grouped).length? Object.keys(grouped).sort().reverse().map(m=>`
      <div style="margin:18px 0 6px;font-weight:800;color:var(--primary-dark)">📅 ${m}</div>
      ${grouped[m].map(e=>`
        <div class="card" style="margin-bottom:10px;padding:14px 16px">
          <div class="row" style="border:none;padding:0">
            <div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(e.payerId)}
              <div class="grow"><b>${catName(e.cat)}</b> <span class="muted tiny">· ${esc(e.note||'无备注')}</span>
                <div class="muted tiny">${e.date} · 垫付 ${memberName(e.payerId)} · ${e.splitType==='custom'?'自定义分摊':'均摊 '+e.participantIds.length+'人'}</div></div></div>
            <div class="right"><b style="font-size:17px">${fmt(e.amount)}</b>
              <button class="btn btn-sm btn-danger" style="margin-left:8px" data-action="del-expense" data-id="${e.id}">删</button></div>
          </div>
        </div>`).join('')}
    `).join('') : '<div class="card empty"><div class="e-ico">💰</div><div class="e-txt">还没有账目</div><button class="btn btn-primary" style="margin-top:14px" data-action="add-expense">＋ 记第一笔</button></div>'}
  `;
  return listHtml;
}

/* ---------- 清洁排班 ---------- */
function viewCleaning(r){
  const tasks = r.cleaning.tasks;
  const entries = [...r.cleaning.entries].sort((a,b)=>a.date.localeCompare(b.date));
  const tName = id => { const t = tasks.find(x=>x.id===id); return t? t.ico+' '+t.name : '清洁'; };
  return `
  <div class="section-head"><div class="section-title">🧹 清洁值日排班</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" data-action="add-task">＋ 任务</button>
      <button class="btn btn-primary" data-action="gen-schedule">🔄 生成轮值表</button>
    </div></div>

  <div class="card" style="margin-bottom:18px"><div class="section-head" style="margin-bottom:8px"><div class="section-title" style="font-size:16px">清洁任务清单</div></div>
    ${tasks.length? `<div class="chk-group">${tasks.map(t=>`<span class="chk on">${t.ico} ${esc(t.name)} <button class="btn btn-sm" data-action="del-task" data-id="${t.id}" style="padding:0 4px;color:var(--danger)">✕</button></span>`).join('')}</div>` : '<span class="muted">暂无任务，点击「任务」添加</span>'}
  </div>

  ${entries.length? `<div class="sched-grid">${entries.map(e=>{
    const d = daysFromToday(e.date);
    const due = e.date>=todayStr() && d<=2 && e.status==='todo';
    const cls = e.status==='done'?'done':(due?'due':'');
    const tag = e.status==='done'?'<span class="pill green">已完成</span>':(due?'<span class="pill warn">即将到期</span>':'<span class="pill gray">待办</span>');
    return `<div class="sched-cell ${cls}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div><div style="font-size:15px;font-weight:800">${tName(e.taskId)}</div>
        <div class="muted tiny">${e.date} ${d===0?'· 今天':d>0?'· '+d+'天后':d+'天前'}</div></div>${tag}</div>
      <div style="display:flex;align-items:center;gap:8px;margin:10px 0">
        ${memberAva(e.assigneeId,'lg')}<b>${memberName(e.assigneeId)}</b></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        ${e.status!=='done'?`<button class="btn btn-sm btn-accent" data-action="done-clean" data-id="${e.id}">✓ 完成</button>`:''}
        <button class="btn btn-sm btn-ghost" data-action="swap-clean" data-id="${e.id}">🔁 调班</button>
        ${e.status!=='done'?`<button class="btn btn-sm btn-ghost" data-action="skip-clean" data-id="${e.id}">略过</button>`:''}
      </div></div>`;
  }).join('')}</div>`
  : '<div class="card empty"><div class="e-ico">🧹</div><div class="e-txt">还没有排班</div><button class="btn btn-primary" style="margin-top:14px" data-action="gen-schedule">生成轮值表</button></div>'}
  `;
}

/* ---------- 公共物品 ---------- */
function viewItems(r){
  const low = r.items.filter(it=>it.qty<=it.threshold);
  return `
  <div class="section-head"><div class="section-title">🛒 公共物品登记</div>
    <button class="btn btn-primary" data-action="add-item">＋ 登记物品</button></div>
  ${low.length? `<div class="card" style="margin-bottom:16px;border:2px solid var(--warn)"><div class="section-head" style="margin-bottom:6px"><div class="section-title" style="font-size:16px">⚠️ 补货提醒</div></div>
    ${low.map(it=>`<div class="row" style="padding:8px 0"><div class="grow">🛒 <b>${esc(it.name)}</b> <span class="muted tiny">剩余 ${it.qty}${it.unit} / 阈值 ${it.threshold}</span></div>
      <button class="btn btn-sm btn-accent" data-action="buy-item" data-id="${it.id}">补货</button></div>`).join('')}</div>`:''}

  ${r.items.length? r.items.map(it=>{
    const pct = Math.min(100, Math.round(it.qty / Math.max(it.threshold*3,1) * 100));
    const isLow = it.qty<=it.threshold;
    return `<div class="card" style="margin-bottom:12px;padding:16px">
      <div class="row" style="border:none;padding:0;margin-bottom:6px">
        <div class="grow"><b style="font-size:16px">${esc(it.name)}</b>
          <div class="muted tiny">${it.qty}${it.unit} · 阈值 ${it.threshold}${it.unit} · 单价 ${it.price?fmt(it.price):'—'}${it.lastBuyerId?' · 上次 '+memberName(it.lastBuyerId):''}${it.note?' · '+esc(it.note):''}</div></div>
        <span class="pill ${isLow?'warn':'green'}">${isLow?'需补货':'充足'}</span>
      </div>
      <div class="bar ${isLow?'low':''}"><i style="width:${pct}%"></i></div>
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-sm btn-ghost" data-action="consume-item" data-id="${it.id}">− 消耗1</button>
        <button class="btn btn-sm btn-accent" data-action="buy-item" data-id="${it.id}">补货</button>
        <button class="btn btn-sm btn-ghost" data-action="edit-item" data-id="${it.id}">编辑</button>
        <button class="btn btn-sm btn-danger" data-action="del-item" data-id="${it.id}">删除</button>
      </div></div>`;
  }).join('') : '<div class="card empty"><div class="e-ico">🛒</div><div class="e-txt">还没有登记物品</div><button class="btn btn-primary" style="margin-top:14px" data-action="add-item">登记第一件</button></div>'}
  `;
}

/* ---------- 室友公约 ---------- */
function viewPact(r){
  const rules = r.pact.rules;
  return `
  <div class="section-head"><div class="section-title">📜 室友公约</div>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost" data-action="pact-templates">📋 模板</button>
      <button class="btn btn-primary" data-action="add-pact">＋ 新增条款</button>
    </div></div>
  ${rules.length? rules.map(rule=>`
    <div class="pact-item">
      <div class="pact-text">${esc(rule.text)}</div>
      <div class="confirms">
        ${r.members.map(m=>{
          const ok = rule.confirmedBy.includes(m.id);
          return `<span class="confirm-chip ${ok?'ok':''}" data-action="toggle-confirm" data-id="${rule.id}" data-mid="${m.id}" style="cursor:pointer">${ok?'✓ ':''}${memberAva(m.id,'sm')} ${esc(m.name)}</span>`;
        }).join('')}
        <button class="btn btn-sm btn-danger" data-action="del-pact" data-id="${rule.id}" style="margin-left:auto">删除</button>
      </div>
    </div>`).join('') : '<div class="card empty"><div class="e-ico">📜</div><div class="e-txt">还没有公约</div><button class="btn btn-primary" style="margin-top:14px" data-action="add-pact">制定第一条</button></div>'}
  <div class="card" style="margin-top:8px;background:var(--accent-soft);border:none">
    <div class="muted tiny">💡 点击成员头像可标记「已知晓/同意」，公约达成全员确认后更具约束力。可「模板」一键填入常见合租规则。</div>
  </div>`;
}

/* ============================================================
   弹窗系统
   ============================================================ */
let modalConfirm = null;
function openModal(title, bodyHtml, opts={}){
  const {confirmText='保存', onConfirm=null, hideConfirm=false} = opts;
  modalConfirm = onConfirm;
  $('#modal').innerHTML = `
    <h3>${title}</h3>
    <div id="modalBody">${bodyHtml}</div>
    ${hideConfirm?'':`<div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end">
      <button class="btn btn-ghost" data-action="modal-cancel">取消</button>
      <button class="btn btn-primary" data-action="modal-confirm">${confirmText}</button></div>`}
  `;
  $('#modalMask').hidden = false;
}
function closeModal(){ $('#modalMask').hidden = true; modalConfirm = null; }

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(t._t); t._t = setTimeout(()=>t.hidden=true, 1800);
}

/* ============================================================
   交互动作
   ============================================================ */
function memberCheckGroup(room, selected){
  return `<div class="chk-group" id="mchk">${room.members.map(m=>`
    <span class="chk ${selected.includes(m.id)?'on':''}" data-action="toggle-chk" data-mid="${m.id}">${memberAva(m.id,'sm')} ${esc(m.name)}</span>`).join('')}</div>`;
}

function renderCustomSplit(){
  const box = $('#customBox'); if(!box) return;
  const seg = $('#splitSeg'); if(!seg){ box.style.display='none'; return; }
  if(seg.querySelector('.on').dataset.val !== 'custom'){ box.style.display='none'; return; }
  const r = curRoom(); if(!r) return;
  const parts = [...$('#mchk').querySelectorAll('.chk.on')].map(c=>c.dataset.mid);
  const amt = parseFloat($('#eamt').value)||0;
  const each = parts.length? (amt/parts.length).toFixed(2):0;
  box.style.display = 'block';
  box.innerHTML = `<div class="muted tiny" style="margin-bottom:6px">为每人填写应摊金额（合计需=${amt?amt.toFixed(2):0}）</div>` +
    parts.map(pid=>`<div class="field" style="margin-bottom:8px"><label>${memberName(pid)}</label><input id="cs_${pid}" type="number" step="0.01" value="${each}"/></div>`).join('');
}
function memberSelect(room, val, id='payer'){
  return `<select id="${id}">${room.members.map(m=>`<option value="${m.id}" ${m.id===val?'selected':''}>${esc(m.name)}</option>`).join('')}</select>`;
}

function actManageRoom(){
  const r = curRoom();
  const memHtml = r? r.members.map(m=>`<div class="row" style="padding:8px 0"><div class="grow" style="display:flex;align-items:center;gap:10px">${memberAva(m.id,'lg')}
    <input id="mname_${m.id}" value="${esc(m.name)}" style="border:none;font-weight:700;font-size:15px;width:120px" />
    <span class="muted tiny">${m.color}</span></div>
    <button class="btn btn-sm btn-danger" data-action="room-del-member" data-id="${m.id}">移除</button></div>`).join('') : '';
  const body = `
    <div class="field"><label>当前房间名称</label><input id="roomName" value="${r?esc(r.name):''}"/></div>
    <div class="field"><label>室友（点击头像可在记账时选择）</label>${memHtml || '<div class="muted">暂无室友</div>'}</div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <input id="newMem" placeholder="添加室友姓名，回车或点添加" style="flex:1;padding:10px;border:1px solid var(--border);border-radius:12px"/>
      <button class="btn btn-accent" data-action="room-add-member">＋ 添加</button></div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px dashed var(--border);padding-top:14px">
      <button class="btn btn-ghost" data-action="seed-demo">🌱 载入演示数据</button>
      <button class="btn btn-ghost" data-action="room-create">🏡 新建房间</button>
    </div>`;
  openModal('⚙️ 房间管理', body, {confirmText:'保存', onConfirm(){
    if(r){
      r.name = $('#roomName').value.trim() || r.name;
      r.members.forEach(m => { const i=$('#mname_'+m.id); if(i) m.name = i.value.trim()||m.name; });
      save(); render(); toast('已保存');
    }
    return true;
  }});
}

function actSwitchRoom(){
  const body = `<div>${DB.rooms.map(r=>`<div class="row" style="padding:10px 0;cursor:pointer" data-action="room-switch-to" data-id="${r.id}">
    <div class="grow" style="display:flex;align-items:center;gap:10px">🏡 <b>${esc(r.name)}</b> <span class="muted tiny">${r.members.length}人</span></div>
    ${r.id===DB.currentRoomId?'<span class="pill green">当前</span>':'<span class="pill gray">切换</span>'}</div>`).join('')}
    <button class="btn btn-primary btn-block" style="margin-top:10px" data-action="room-create">🏡 新建房间</button></div>`;
  openModal('🏡 切换房间', body, {hideConfirm:true});
}

function actAddExpense(){
  const r = curRoom();
  const allIds = r.members.map(m=>m.id);
  const catOpts = CATS.map(c=>`<option value="${c.key}">${c.ico} ${c.name}</option>`).join('');
  const payer = r.members[0].id;
  const body = `
    <div class="field"><label>分类</label><select id="ecat">${catOpts}</select></div>
    <div class="field"><label>金额（元）</label><input id="eamt" type="number" min="0" step="0.01" placeholder="0.00"/></div>
    <div class="field"><label>垫付人</label>${memberSelect(r, payer)}</div>
    <div class="field"><label>参与分摊的室友</label>${memberCheckGroup(r, allIds)}</div>
    <div class="field"><label>分摊方式</label>
      <div class="seg" data-group="split" id="splitSeg">
        <button class="on" data-action="seg" data-group="split" data-val="equal">均摊</button>
        <button data-action="seg" data-group="split" data-val="custom">自定义</button>
      </div>
      <div id="customBox" style="display:none;margin-top:10px"></div>
    </div>
    <div class="field"><label>日期</label><input id="edate" type="date" value="${todayStr()}"/></div>
    <div class="field"><label>备注</label><input id="enote" placeholder="例如：9月房租 / 周末火锅"/></div>`;
  openModal('＋ 记一笔', body, {confirmText:'保存', onConfirm(){
    const cat = $('#ecat').value;
    const amount = parseFloat($('#eamt').value);
    const payerId = $('#payer').value;
    const parts = [...$('#mchk').querySelectorAll('.chk.on')].map(c=>c.dataset.mid);
    const splitType = $('#splitSeg .on').dataset.val;
    const date = $('#edate').value || todayStr();
    const note = $('#enote').value.trim();
    if(!(amount>0)){ toast('请输入正确金额'); return false; }
    if(!parts.length){ toast('至少选择一名参与人'); return false; }
    let customShares = {};
    if(splitType==='custom'){
      let sum=0; parts.forEach(pid=>{ const v=parseFloat($('#cs_'+pid).value)||0; customShares[pid]=v; sum+=v; });
      if(Math.abs(sum-amount)>0.02){ toast('自定义金额合计需等于总金额'); return false; }
    }
    r.expenses.push({id:uid(), cat, amount, payerId, participantIds:parts, splitType, customShares, date, note});
    save(); render(); toast('已记录'); return true;
  }});
}

function actGenSchedule(){
  const r = curRoom();
  if(!r.cleaning.tasks.length){ toast('请先添加清洁任务'); return; }
  const body = `
    <div class="field"><label>起始日期</label><input id="gsStart" type="date" value="${todayStr()}"/></div>
    <div class="field"><label>排班天数</label><input id="gsDays" type="number" min="1" max="60" value="14"/></div>
    <div class="muted tiny">将按「任务列表」与「室友顺序」循环轮值生成。</div>`;
  openModal('🔄 生成轮值表', body, {confirmText:'生成', onConfirm(){
    const start = $('#gsStart').value || todayStr();
    const days = Math.max(1, Math.min(60, parseInt($('#gsDays').value)||14));
    r.cleaning.entries = r.cleaning.entries.filter(e=>e.date<start).concat(genSchedule(r, start, days));
    save(); render(); toast('排班已生成'); return true;
  }});
}

function actAddTask(){
  const r = curRoom();
  const body = `<div class="field"><label>任务名称</label><input id="tname" placeholder="例如：倒垃圾"/></div>
    <div class="field"><label>图标 emoji</label><input id="tico" value="🧹"/></div>`;
  openModal('＋ 清洁任务', body, {confirmText:'添加', onConfirm(){
    const name = $('#tname').value.trim(); if(!name){ toast('请输入名称'); return false; }
    r.cleaning.tasks.push({id:uid(), name, ico:$('#tico').value.trim()||'🧹'});
    save(); render(); toast('已添加'); return true;
  }});
}

function actAddItem(){
  const r = curRoom();
  const body = `
    <div class="field"><label>物品名称</label><input id="iname" placeholder="例如：抽纸"/></div>
    <div class="field"><label>当前数量</label><input id="iqty" type="number" min="0" step="1" value="1"/></div>
    <div class="field"><label>单位</label><input id="iunit" value="个"/></div>
    <div class="field"><label>补货阈值（≤此值提醒）</label><input id="ithr" type="number" min="0" step="1" value="1"/></div>
    <div class="field"><label>单价（选填）</label><input id="iprice" type="number" min="0" step="0.01" placeholder="0.00"/></div>
    <div class="field"><label>上次购买人</label>${memberSelect(r, r.members[0].id, 'ibuyer')}</div>
    <div class="field"><label>备注</label><input id="inote" placeholder="存放位置等"/></div>`;
  openModal('＋ 登记物品', body, {confirmText:'保存', onConfirm(){
    const name = $('#iname').value.trim(); if(!name){ toast('请输入名称'); return false; }
    r.items.push({id:uid(), name,
      qty: Math.max(0, parseInt($('#iqty').value)||0),
      unit: $('#iunit').value.trim()||'个',
      threshold: Math.max(0, parseInt($('#ithr').value)||0),
      price: parseFloat($('#iprice').value)||0,
      lastBuyerId: $('#ibuyer').value,
      note: $('#inote').value.trim(), updatedAt: todayStr()});
    save(); render(); toast('已登记'); return true;
  }});
}

function actEditItem(id){
  const r = curRoom(); const it = r.items.find(x=>x.id===id); if(!it) return;
  const body = `
    <div class="field"><label>物品名称</label><input id="iname" value="${esc(it.name)}"/></div>
    <div class="field"><label>当前数量</label><input id="iqty" type="number" min="0" step="1" value="${it.qty}"/></div>
    <div class="field"><label>单位</label><input id="iunit" value="${esc(it.unit)}"/></div>
    <div class="field"><label>补货阈值</label><input id="ithr" type="number" min="0" step="1" value="${it.threshold}"/></div>
    <div class="field"><label>单价</label><input id="iprice" type="number" min="0" step="0.01" value="${it.price||''}"/></div>
    <div class="field"><label>上次购买人</label>${memberSelect(r, it.lastBuyerId||r.members[0].id, 'ibuyer')}</div>
    <div class="field"><label>备注</label><input id="inote" value="${esc(it.note||'')}"/></div>`;
  openModal('编辑物品', body, {confirmText:'保存', onConfirm(){
    it.name=$('#iname').value.trim()||it.name;
    it.qty=Math.max(0,parseInt($('#iqty').value)||0);
    it.unit=$('#iunit').value.trim()||'个';
    it.threshold=Math.max(0,parseInt($('#ithr').value)||0);
    it.price=parseFloat($('#iprice').value)||0;
    it.lastBuyerId=$('#ibuyer').value; it.note=$('#inote').value.trim(); it.updatedAt=todayStr();
    save(); render(); toast('已更新'); return true;
  }});
}

function actAddPact(){
  const r = curRoom();
  const body = `<div class="field"><label>公约条款</label><textarea id="ptext" rows="3" placeholder="例如：公共区域保持整洁，垃圾满即倒"></textarea></div>`;
  openModal('＋ 新增公约', body, {confirmText:'添加', onConfirm(){
    const text = $('#ptext').value.trim(); if(!text){ toast('请输入内容'); return false; }
    r.pact.rules.push({id:uid(), text, createdBy:r.members[0].id, confirmedBy:[]});
    save(); render(); toast('已添加'); return true;
  }});
}

function actPactTemplates(){
  const r = curRoom();
  const body = `<div class="muted tiny" style="margin-bottom:8px">点击模板可一键添加为公约条款：</div>` +
    PACT_TEMPLATES.map((t,i)=>`<div class="row" style="padding:8px 0;cursor:pointer" data-action="pact-use-tpl" data-i="${i}"><div class="grow">${esc(t)}</div><span class="pill gray">添加</span></div>`).join('');
  openModal('📋 公约模板', body, {hideConfirm:true});
}

/* ---------- 事件委托 ---------- */
function onAction(action, el){
  const r = curRoom();
  switch(action){
    case 'manage-room': actManageRoom(); break;
    case 'switch-room': actSwitchRoom(); break;
    case 'room-switch-to': { const id=el.dataset.id; DB.currentRoomId=id; save(); closeModal(); render(); break; }
    case 'room-create': {
      const name = prompt('新房间名称：', '我们的小窝');
      if(name){ const nr={id:uid(), name:name.trim(), members:[{id:uid(),name:'我',emoji:'🦊',color:MEMBER_COLORS[0]}], expenses:[], cleaning:{tasks:[],entries:[]}, items:[], pact:{rules:[]}}; DB.rooms.push(nr); DB.currentRoomId=nr.id; save(); closeModal(); render(); toast('已创建'); }
      break;
    }
    case 'room-add-member': {
      const inp = $('#newMem'); const name = inp.value.trim(); if(!name) break;
      const used = r.members.length;
      r.members.push({id:uid(), name, emoji:AVATARS[used%AVATARS.length], color:MEMBER_COLORS[used%MEMBER_COLORS.length]});
      save(); actManageRoom(); break;
    }
    case 'room-del-member': {
      const id=el.dataset.id;
      if(r.members.length<=1){ toast('至少保留一名室友'); break; }
      if(confirm('确定移除该室友？相关账目中的记录将保留但显示为未知。')){ r.members=r.members.filter(m=>m.id!==id); save(); actManageRoom(); }
      break;
    }
    case 'seed-demo': { if(confirm('载入演示数据将新增一个示例房间，确认？')){ seedDemo(); closeModal(); render(); toast('演示数据已载入'); } break; }

    case 'add-expense': actAddExpense(); break;
    case 'del-expense': { r.expenses=r.expenses.filter(e=>e.id!==el.dataset.id); save(); render(); break; }
    case 'exp-tab': { view='expenses'; exptab=el.dataset.tab; render(); break; }
    case 'expenses-nav': view='expenses'; exptab='list'; render(); break;

    case 'gen-schedule': actGenSchedule(); break;
    case 'add-task': actAddTask(); break;
    case 'del-task': { r.cleaning.tasks=r.cleaning.tasks.filter(t=>t.id!==el.dataset.id); r.cleaning.entries=r.cleaning.entries.filter(e=>e.taskId!==el.dataset.id); save(); render(); break; }
    case 'done-clean': { const e=r.cleaning.entries.find(x=>x.id===el.dataset.id); if(e){e.status='done'; save(); render();} break; }
    case 'skip-clean': { const e=r.cleaning.entries.find(x=>x.id===el.dataset.id); if(e){e.status='skipped'; save(); render();} break; }
    case 'swap-clean': {
      const e=r.cleaning.entries.find(x=>x.id===el.dataset.id); if(!e) break;
      const body = `<div class="field"><label>改派给</label>${memberSelect(r, e.assigneeId, 'swapMem')}</div>`;
      openModal('🔁 调班', body, {confirmText:'确定', onConfirm(){
        e.assigneeId=$('#swapMem').value; e.status='todo'; save(); render(); toast('已调班'); return true;
      }});
      break;
    }

    case 'add-item': actAddItem(); break;
    case 'edit-item': actEditItem(el.dataset.id); break;
    case 'del-item': { r.items=r.items.filter(it=>it.id!==el.dataset.id); save(); render(); break; }
    case 'consume-item': { const it=r.items.find(x=>x.id===el.dataset.id); if(it){ it.qty=Math.max(0,it.qty-1); it.updatedAt=todayStr(); save(); render(); } break; }
    case 'buy-item': {
      const it=r.items.find(x=>x.id===el.dataset.id); if(!it) break;
      const body=`<div class="field"><label>补货后数量（${esc(it.unit)}）</label><input id="bqty" type="number" min="0" step="1" value="${Math.max(it.threshold,1)}"/></div>
        <div class="field"><label>购买人</label>${memberSelect(r, it.lastBuyerId||r.members[0].id, 'bbuyer')}</div>`;
      openModal('🛒 补货', body, {confirmText:'确定', onConfirm(){
        it.qty=Math.max(0,parseInt($('#bqty').value)||0); it.lastBuyerId=$('#bbuyer').value; it.updatedAt=todayStr(); save(); render(); toast('已补货'); return true;
      }});
      break;
    }

    case 'add-pact': actAddPact(); break;
    case 'pact-templates': actPactTemplates(); break;
    case 'pact-use-tpl': { const t=PACT_TEMPLATES[+el.dataset.i]; r.pact.rules.push({id:uid(), text:t, createdBy:r.members[0].id, confirmedBy:[]}); save(); actPactTemplates(); break; }
    case 'del-pact': { r.pact.rules=r.pact.rules.filter(x=>x.id!==el.dataset.id); save(); render(); break; }
    case 'toggle-confirm': {
      const rule=r.pact.rules.find(x=>x.id===el.dataset.id); const mid=el.dataset.mid;
      if(rule){ const i=rule.confirmedBy.indexOf(mid); if(i>=0) rule.confirmedBy.splice(i,1); else rule.confirmedBy.push(mid); save(); render(); }
      break;
    }

    case 'seg': {
      const seg=el.closest('.seg');
      seg.querySelectorAll('button').forEach(b=>b.classList.remove('on'));
      el.classList.add('on');
      if(el.dataset.group==='split') renderCustomSplit();
      break;
    }
    case 'toggle-chk': {
      el.classList.toggle('on');
      renderCustomSplit();
      break;
    }
    case 'modal-confirm': { if(modalConfirm){ const ok=modalConfirm(); if(ok) closeModal(); } break; }
    case 'modal-cancel': closeModal(); break;
  }
}

/* 费用 tab 持久化 */
let exptab = 'list';

/* ---------- 绑定 ---------- */
document.addEventListener('click', e => {
  // 导航
  const nav = e.target.closest('.nav-item,.bnav-item');
  if(nav){ view = nav.dataset.view; if(view==='expenses') exptab='list'; render(); return; }
  // 动作
  const act = e.target.closest('[data-action]');
  if(act){ onAction(act.dataset.action, act); }
});
$('#modalMask').addEventListener('click', e => { if(e.target.id==='modalMask') closeModal(); });

/* 启动 */
render();
