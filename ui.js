/* ============================================================================
 * UI 层：页面渲染 + 路由 + 事件
 * ==========================================================================*/

/* ------------------------------ 路由 ------------------------------ */
const routes = {
  home:    { title:'记账',       back:false, act:null },
  record:  { title:'记一笔',     back:true,  act:null },
  txnList: { title:'账单',       back:true,  act:null },
  account: { title:'账户',       back:true,  act:null },
  budget:  { title:'预算',       back:true,  act:null },
  category:{ title:'分类管理',   back:true,  act:null },
  report:  { title:'报表',       back:true,  act:null },
  settings:{ title:'设置',       back:true,  act:null },
};
let curRoute = 'home';
let recordState = null;   // 记账页临时状态
let listFilter = { type:null, month:null };  // 账单筛选

function go(route, param){
  if(!routes[route]) route = 'home';
  curRoute = route;
  const r = routes[route];
  $('#pageTitle').textContent = r.title;
  $('#backBtn').style.display = r.back ? 'flex' : 'none';
  $('#topAct').style.display = r.act ? 'block' : 'none';
  if(route==='txnList' && param) listFilter = param;
  render();
  $('#main').scrollTop = 0;
}

function render(){
  const main = $('#main');
  switch(curRoute){
    case 'home': main.innerHTML = renderHome(); break;
    case 'record': main.innerHTML = renderRecord(); break;
    case 'txnList': main.innerHTML = renderTxnList(); break;
    case 'account': main.innerHTML = renderAccount(); break;
    case 'budget': main.innerHTML = renderBudget(); break;
    case 'category': main.innerHTML = renderCategory(); break;
    case 'report': main.innerHTML = renderReport(); break;
    case 'settings': main.innerHTML = renderSettings(); break;
  }
  bindEvents();
}

$('#backBtn').addEventListener('click', () => {
  if(curRoute === 'record' || curRoute==='txnList' || curRoute==='account' ||
     curRoute==='budget' || curRoute==='category' || curRoute==='report' || curRoute==='settings'){
    go('home');
  }
});

/* ------------------------------ 底部 Tab ------------------------------ */
function renderTabbar(){
  const tabs = [
    { k:'home', ic:'🏠', nm:'首页' },
    { k:'txnList', ic:'📋', nm:'账单' },
    { k:'__fab__' },
    { k:'report', ic:'📊', nm:'报表' },
    { k:'settings', ic:'⚙️', nm:'设置' },
  ];
  $('#tabbar').innerHTML = tabs.map(t => {
    if(t.k==='__fab__'){
      return '<div class="tab fab"><button class="fab-btn" data-nav="record">＋</button></div>';
    }
    return '<button class="tab '+(curRoute===t.k?'on':'')+'" data-nav="'+t.k+'"><span class="ic">'+t.ic+'</span><span>'+t.nm+'</span></button>';
  }).join('');
  $$('#tabbar .tab[data-nav], #tabbar .fab-btn').forEach(el => {
    el.addEventListener('click', () => go(el.dataset.nav));
  });
}

/* ------------------------------ 首页 ------------------------------ */
function renderHome(){
  const bs = budgetStatus();
  const accs = accounts();
  const total = totalAssets();
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth()+1, 1).getTime();
  const sum = reportSummary(start, end);

  // 预算条
  let budgetHtml = '';
  if(bs.hasBudget){
    const cls = bs.usageRatio > 1 ? 'over' : (bs.usageRatio >= 0.8 ? 'warn' : '');
    budgetHtml = `
      <div style="margin-top:14px">
        <div class="lbl" style="display:flex;justify-content:space-between">
          <span>本月预算 ${fmtYuan(bs.budgetCents)}</span>
          <span>${bs.usagePercent}%</span>
        </div>
        <div class="budget-bar ${cls}"><div class="fill" style="width:${Math.min(100,bs.usagePercent)}%"></div></div>
        <div class="lbl" style="display:flex;justify-content:space-between;margin-top:4px">
          <span>已支出 ${fmtYuan(bs.spentCents)}</span>
          <span style="color:${bs.remainingCents<0?'#ff5252':'rgba(255,255,255,.85)'}">${bs.remainingCents<0?'超支 ':''}剩余 ${fmtYuan(Math.abs(bs.remainingCents))}</span>
        </div>
      </div>`;
  } else {
    budgetHtml = `<div style="margin-top:14px;display:flex;justify-content:space-between;align-items:center">
      <span class="lbl">尚未设置本月预算</span>
      <button style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:5px 12px;border-radius:14px;font-size:12px" data-go="budget">去设置</button>
    </div>`;
  }

  const accHtml = accs.length ? accs.map(a => `
    <div class="acc row">
      <div class="ic">${AccountTypeIcon[a.type]||'💰'}</div>
      <div class="grow">
        <div class="bold">${esc(a.name)}</div>
        <div class="muted small">${AccountTypeLabel[a.type]||''}</div>
      </div>
      <div class="num" style="color:${a.currentBalance<0?'var(--income)':'var(--text)'}">${fmtYuan(a.currentBalance)}</div>
    </div>`).join('') : '<div class="empty"><div class="big">🏦</div>暂无账户</div>';

  // 最近流水
  const recent = liveTransactions().slice(0,5);
  const recentHtml = recent.length ? recent.map(t => txnRow(t)).join('') : '<div class="empty"><div class="big">📝</div>还没有记账，点下方 ＋ 开始</div>';

  return `
    <div class="hero">
      <div class="lbl">总资产（元）</div>
      <div class="balance">${fmtCents(total)}</div>
      <div class="stats">
        <div class="stat"><div class="k">本月收入</div><div class="v">${fmtCents(sum.incomeCents)}</div></div>
        <div class="stat"><div class="k">本月支出</div><div class="v">${fmtCents(sum.expenseCents)}</div></div>
        <div class="stat"><div class="k">本月结余</div><div class="v">${fmtCents(sum.balanceCents)}</div></div>
      </div>
      ${budgetHtml}
    </div>

    <div class="section-title">账户</div>
    <div class="card" style="padding:0 16px">
      <div class="acc-list">${accHtml}</div>
    </div>
    <div class="row between" style="margin-top:4px">
      <div class="muted small">共 ${accs.length} 个账户</div>
      <button class="act" style="color:var(--primary)" data-go="account">管理账户 ›</button>
    </div>

    <div class="section-title">最近账单</div>
    <div>${recentHtml}</div>
    ${recent.length ? `<div style="text-align:center;margin-top:8px"><button class="btn-ghost" data-go="txnList">查看全部</button></div>` : ''}
  `;
}

function txnRow(t){
  const type = t.type;
  const amtSign = type===TransactionType.EXPENSE ? '-' : (type===TransactionType.INCOME ? '+' : '');
  const amtCls = type===TransactionType.EXPENSE ? 'expense-c' : (type===TransactionType.INCOME ? 'income-c' : 'transfer-c');
  let icon='', name='', sub='';
  if(type===TransactionType.TRANSFER){
    icon = '🔄'; name = '转账';
    sub = (accountById(t.fromAccountId)?.name||'')+' → '+(accountById(t.toAccountId)?.name||'');
  } else {
    const c = categoryById(t.categoryId);
    icon = c ? c.icon : '❓'; name = c ? c.name : '未分类';
    const acc = type===TransactionType.EXPENSE ? accountById(t.fromAccountId) : accountById(t.toAccountId);
    sub = (acc?.name||'') + (t.note ? ' · '+t.note : '');
  }
  const color = categoryById(t.categoryId)?.color || '#999';
  return `
    <div class="txn" data-id="${t.transactionId}">
      <div class="cat-ic" style="background:${type===TransactionType.TRANSFER?'#1565c0':color}">${icon}</div>
      <div class="grow">
        <div class="bold">${esc(name)}</div>
        <div class="note">${esc(sub)}</div>
      </div>
      <div class="amt ${amtCls}">${amtSign}${fmtCents(t.amount)}</div>
    </div>`;
}

/* ------------------------------ 记账页 ------------------------------ */
function renderRecord(){
  if(!recordState){
    recordState = { type:TransactionType.EXPENSE, categoryId:null, accountId:null,
      fromAccountId:null, toAccountId:null, amountStr:'', note:'', occurredAt:now() };
  }
  const s = recordState;
  const isTransfer = s.type===TransactionType.TRANSFER;
  const kind = s.type===TransactionType.EXPENSE ? CategoryKind.EXPENSE : CategoryKind.INCOME;
  const cats = categories(kind);
  const accs = accounts();

  const segHtml = `
    <div class="seg">
      <div class="s ${s.type===TransactionType.EXPENSE?'on':''}" data-type="expense">支出</div>
      <div class="s ${s.type===TransactionType.INCOME?'on':''}" data-type="income">收入</div>
      <div class="s ${s.type===TransactionType.TRANSFER?'on':''}" data-type="transfer">转账</div>
    </div>`;

  let catHtml = '';
  if(!isTransfer){
    catHtml = `
      <div class="cat-grid">
        ${cats.map(c => `
          <div class="c ${s.categoryId===c.categoryId?'sel':''}" data-cat="${c.categoryId}">
            <div class="ic" style="background:${c.color}">${c.icon}</div>
            <div class="nm">${esc(c.name)}</div>
          </div>`).join('')}
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="act" style="color:var(--primary)" data-go="category">分类管理 ›</button>
      </div>`;
  }

  let accHtml = '';
  if(isTransfer){
    accHtml = `
      <div class="f-label">转出账户</div>
      <div class="chip-row">${accs.map(a => `<button class="chip ${s.fromAccountId===a.accountId?'on':''}" data-acc="from:${a.accountId}">${AccountTypeIcon[a.type]} ${esc(a.name)}</button>`).join('')}</div>
      <div class="f-label">转入账户</div>
      <div class="chip-row">${accs.map(a => `<button class="chip ${s.toAccountId===a.accountId?'on':''}" data-acc="to:${a.accountId}">${AccountTypeIcon[a.type]} ${esc(a.name)}</button>`).join('')}</div>`;
  } else {
    const cur = s.type===TransactionType.EXPENSE ? s.fromAccountId : s.toAccountId;
    const accKey = s.type===TransactionType.EXPENSE ? 'from' : 'to';
    accHtml = `
      <div class="f-label">${s.type===TransactionType.EXPENSE?'支出账户':'收入账户'}</div>
      <div class="chip-row">${accs.map(a => `<button class="chip ${cur===a.accountId?'on':''}" data-acc="${accKey}:${a.accountId}">${AccountTypeIcon[a.type]} ${esc(a.name)}</button>`).join('')}</div>`;
  }

  return `
    ${segHtml}
    <div class="amount-input">
      <span class="cur">¥</span>
      <input id="amountInp" type="text" inputmode="decimal" placeholder="0.00" value="${s.amountStr}">
    </div>
    ${catHtml}
    ${accHtml}
    <div class="f-label">日期</div>
    <div class="field"><input id="dateInp" type="date" value="${localDateToInput(s.occurredAt)}"></div>
    <div class="f-label">备注（可选）</div>
    <div class="field"><textarea id="noteInp" rows="2" placeholder="添加备注…">${esc(s.note||'')}</textarea></div>
    <button class="btn-primary" id="saveBtn">保存</button>
  `;
}

function submitRecord(){
  const s = recordState;
  const cents = parseAmountToCents(s.amountStr);
  if(cents == null){ toast('请输入有效金额'); return; }
  const dateStr = $('#dateInp').value;
  const occurredAt = dateStr ? inputToLocalMs(dateStr) : now();
  const input = {
    type: s.type, amount: cents, categoryId: s.categoryId,
    fromAccountId: s.type===TransactionType.EXPENSE||s.type===TransactionType.TRANSFER ? s.fromAccountId : null,
    toAccountId: s.type===TransactionType.INCOME||s.type===TransactionType.TRANSFER ? s.toAccountId : null,
    note: $('#noteInp').value.trim() || null, occurredAt
  };
  let r;
  if(s.editingId){
    r = updateTransaction(s.editingId, input);
  } else {
    r = addTransaction(input);
  }
  if(!r.ok){ toast(r.error); return; }
  toast(s.editingId ? '已更新' : '已记账');
  recordState = null;
  go('home');
}

/* ------------------------------ 账单列表 ------------------------------ */
function renderTxnList(){
  let ts = liveTransactions();
  const filter = listFilter || { type:null, month:null };
  if(filter.type) ts = ts.filter(t => t.type===filter.type);
  if(filter.month){
    const [y,m] = filter.month.split('-').map(Number);
    const start = new Date(y, m-1, 1).getTime();
    const end = new Date(y, m, 1).getTime();
    ts = ts.filter(t => t.occurredAt>=start && t.occurredAt<end);
  }

  // 筛选条
  const filterHtml = `
    <div class="chip-row" style="margin-bottom:12px">
      <button class="chip ${!filter.type?'on':''}" data-filter-type="">全部</button>
      <button class="chip ${filter.type==='expense'?'on':''}" data-filter-type="expense">支出</button>
      <button class="chip ${filter.type==='income'?'on':''}" data-filter-type="income">收入</button>
      <button class="chip ${filter.type==='transfer'?'on':''}" data-filter-type="transfer">转账</button>
      <input type="month" id="monthFilter" class="chip" style="border:1px solid var(--line);background:${filter.month?'var(--primary-soft)':'#e9e9ed'}" value="${filter.month||''}">
    </div>`;

  if(!ts.length) return filterHtml + '<div class="empty"><div class="big">📭</div>暂无账单记录</div>';

  // 按日期分组
  const groups = new Map();
  ts.forEach(t => {
    const k = dayKey(t.occurredAt);
    if(!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  });
  let html = filterHtml;
  Array.from(groups.keys()).sort((a,b)=>b.localeCompare(a)).forEach(k => {
    const items = groups.get(k);
    const sum = items.reduce((s,t)=> s + (t.type===TransactionType.EXPENSE ? -t.amount : t.type===TransactionType.INCOME ? t.amount : 0), 0);
    const d = new Date(items[0].occurredAt);
    const w = '日一二三四五六'[d.getDay()];
    html += `<div class="group-label">${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} 周${w}  ·  结余 ${sum>=0?'+':''}${fmtCents(sum)}</div>`;
    html += items.map(t => txnRow(t)).join('');
  });
  return html;
}

/* ------------------------------ 账户页 ------------------------------ */
function renderAccount(){
  const accs = accounts(true);
  const archived = accs.filter(a=>a.isArchived);
  const active = accs.filter(a=>!a.isArchived);
  return `
    <div class="card">
      <div class="row between" style="margin-bottom:8px">
        <div class="bold">总资产</div>
        <div class="num" style="font-size:20px">${fmtYuan(totalAssets())}</div>
      </div>
      ${active.map(a => accountRow(a)).join('')}
    </div>
    <button class="btn-ghost" id="addAccBtn">＋ 添加账户</button>
    ${archived.length ? `<div class="section-title">已归档</div><div class="card">${archived.map(a => accountRow(a)).join('')}</div>` : ''}
  `;
}
function accountRow(a){
  return `
    <div class="acc row" data-id="${a.accountId}">
      <div class="ic">${AccountTypeIcon[a.type]||'💰'}</div>
      <div class="grow">
        <div class="bold">${esc(a.name)}</div>
        <div class="muted small">${AccountTypeLabel[a.type]||''}${a.isArchived?' · 已归档':''}</div>
      </div>
      <div class="num">${fmtYuan(a.currentBalance)}</div>
      <button class="act" style="color:var(--text-2)" data-act="acc:${a.accountId}">⋯</button>
    </div>`;
}

function showAddAccount(){
  showSheet(`
    <h3>添加账户</h3>
    <div class="f-label">账户名称</div>
    <div class="field"><input id="accName" type="text" placeholder="如：工行卡、微信"></div>
    <div class="f-label">账户类型</div>
    <div class="chip-row" id="accTypeRow">
      ${Object.values(AccountType).map(k => `<button class="chip" data-acc-type="${k}">${AccountTypeIcon[k]} ${AccountTypeLabel[k]}</button>`).join('')}
    </div>
    <div class="f-label">初始余额（元，可负）</div>
    <div class="field"><input id="accBalance" type="text" inputmode="decimal" placeholder="0.00" value="0.00"></div>
    <button class="btn-primary" id="accSave">保存</button>
  `);
  let selType = AccountType.CASH;
  $$('#accTypeRow .chip').forEach(ch => ch.addEventListener('click', () => {
    selType = ch.dataset.accType;
    $$('#accTypeRow .chip').forEach(x=>x.classList.remove('on'));
    ch.classList.add('on');
  }));
  $('#accTypeRow .chip').classList.add('on');
  $('#accSave').addEventListener('click', () => {
    const name = $('#accName').value;
    const cents = parseAmountToCents($('#accBalance').value);
    if(!name){ toast('请输入账户名'); return; }
    const r = addAccount({ name, type:selType, initialBalance: cents==null?0:cents });
    if(!r.ok){ toast(r.error); return; }
    closeSheet(); toast('账户已添加'); go('account');
  });
}

function showAccountMenu(id){
  const a = accountById(id); if(!a) return;
  showSheet(`
    <h3>${esc(a.name)}</h3>
    <div class="item" data-act="reconcile"><span>⚖️</span>对账（更新余额）</div>
    <div class="item" data-act="archive"><span>📦</span>${a.isArchived?'取消归档':'归档账户'}</div>
  `);
  $('#modalSheet').dataset.accId = id;
}

/* ------------------------------ 预算页 ------------------------------ */
function renderBudget(){
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth()+1;
  const b = budgetFor(y, m);
  const spent = monthSpent(y, m);
  const bs = budgetStatus();

  // 近 6 个月历史
  let hist = '';
  for(let i=5; i>=0; i--){
    const dd = new Date(y, m-1-i, 1);
    const yy = dd.getFullYear(), mm = dd.getMonth()+1;
    const hb = budgetFor(yy, mm);
    const hs = monthSpent(yy, mm);
    const ratio = hb && hb.amount>0 ? hs/hb.amount : 0;
    const pct = Math.floor(ratio*100);
    hist += `
      <div class="acc row">
        <div class="grow"><div class="bold">${yy}年${mm}月</div>
          <div class="muted small">${hb?'预算 '+fmtYuan(hb.amount):'未设预算'}</div></div>
        <div class="num" style="${ratio>1?'color:var(--income)':(ratio>=0.8?'color:var(--warn)':'')}">${pct}%</div>
      </div>`;
  }

  return `
    <div class="card">
      <div class="row between">
        <div class="bold" style="font-size:17px">${y}年${m}月预算</div>
      </div>
      ${b ? `
        <div style="font-size:28px;font-weight:800;margin:10px 0">${fmtYuan(b.amount)}</div>
        <div class="budget-bar ${bs.usageRatio>1?'over':(bs.usageRatio>=0.8?'warn':'')}" style="background:rgba(0,0,0,.08)">
          <div class="fill" style="width:${Math.min(100,bs.usagePercent)}%;background:${bs.usageRatio>1?'#ff5252':(bs.usageRatio>=0.8?'#ffd54f':'var(--primary)')}"></div>
        </div>
        <div class="muted small" style="margin-top:6px">已支出 ${fmtYuan(spent)} · 剩余 ${fmtYuan(bs.remainingCents)}（${bs.usagePercent}%）</div>
      ` : `
        <div class="muted" style="padding:10px 0">本月还没有设置预算</div>
      `}
      <button class="btn-primary" id="editBudgetBtn">${b?'修改预算':'设置预算'}</button>
    </div>
    <div class="section-title">历史预算</div>
    <div class="card" style="padding:0 16px"><div class="acc-list">${hist}</div></div>
  `;
}
function showEditBudget(){
  const d = new Date();
  const y=d.getFullYear(), m=d.getMonth()+1;
  const b = budgetFor(y, m);
  showSheet(`
    <h3>${y}年${m}月预算</h3>
    <div class="f-label">预算金额（元）</div>
    <div class="field"><input id="budgetAmt" type="text" inputmode="decimal" placeholder="0.00" value="${b?(b.amount/100).toFixed(2):''}"></div>
    <button class="btn-primary" id="budgetSave">保存</button>
    ${b?`<button class="btn-ghost" id="budgetClear">清除预算</button>`:''}
  `);
  $('#budgetSave').addEventListener('click', () => {
    const cents = parseAmountToCents($('#budgetAmt').value);
    if(cents==null || cents<=0){ toast('请输入有效预算金额'); return; }
    setBudget(y, m, cents); closeSheet(); toast('预算已保存'); go('budget');
  });
  const clr = $('#budgetClear');
  if(clr) clr.addEventListener('click', () => {
    const b2 = budgetFor(y, m);
    if(b2){ db.budgets = db.budgets.filter(x=>x!==b2); persist(); }
    closeSheet(); toast('预算已清除'); go('budget');
  });
}

/* ------------------------------ 分类页 ------------------------------ */
function renderCategory(){
  const exp = categories(CategoryKind.EXPENSE, true);
  const inc = categories(CategoryKind.INCOME, true);
  return `
    <div class="section-title">支出分类</div>
    <div class="card" style="padding:0 16px"><div class="acc-list">${exp.map(catRow).join('')}</div></div>
    <div class="section-title">收入分类</div>
    <div class="card" style="padding:0 16px"><div class="acc-list">${inc.map(catRow).join('')}</div></div>
    <button class="btn-ghost" id="addCatBtn">＋ 添加分类</button>
  `;
}
function catRow(c){
  return `
    <div class="acc row" data-id="${c.categoryId}">
      <div class="cat-ic" style="background:${c.color}">${c.icon}</div>
      <div class="grow"><div class="bold">${esc(c.name)}</div><div class="muted small">${c.isArchived?'已归档':(c.isSystem?'系统分类':'自定义')}</div></div>
      <button class="act" style="color:var(--text-2)" data-act="cat:${c.categoryId}">⋯</button>
    </div>`;
}
function showAddCategory(){
  showSheet(`
    <h3>添加分类</h3>
    <div class="f-label">分类名称</div>
    <div class="field"><input id="catName" type="text" placeholder="如：宠物"></div>
    <div class="f-label">类型</div>
    <div class="chip-row" id="catKindRow">
      <button class="chip on" data-kind="expense">支出</button>
      <button class="chip" data-kind="income">收入</button>
    </div>
    <div class="f-label">图标</div>
    <div class="field"><input id="catIcon" type="text" placeholder="emoji，如 🐱" maxlength="2"></div>
    <div class="f-label">颜色</div>
    <div class="field"><input id="catColor" type="color" value="#7c4dff" style="height:40px;padding:4px"></div>
    <button class="btn-primary" id="catSave">保存</button>
  `);
  let selKind = 'expense';
  $$('#catKindRow .chip').forEach(ch => ch.addEventListener('click', () => {
    selKind = ch.dataset.kind;
    $$('#catKindRow .chip').forEach(x=>x.classList.remove('on'));
    ch.classList.add('on');
  }));
  $('#catSave').addEventListener('click', () => {
    const name = $('#catName').value.trim();
    if(!name){ toast('请输入分类名'); return; }
    const c = {
      categoryId: uid('cat'), name, kind: selKind, icon: $('#catIcon').value||'🏷️',
      color: $('#catColor').value, isSystem:false, sortOrder: db.categories.length, isArchived:false
    };
    db.categories.push(c); persist(); closeSheet(); toast('分类已添加'); go('category');
  });
}
function showCategoryMenu(id){
  const c = categoryById(id); if(!c) return;
  showSheet(`
    <h3>${esc(c.name)}</h3>
    <div class="item" data-act="rename"><span>✏️</span>重命名</div>
    <div class="item" data-act="archiveCat"><span>📦</span>${c.isArchived?'取消归档':'归档'}</div>
  `);
  $('#modalSheet').dataset.catId = id;
}

/* ------------------------------ 报表页 ------------------------------ */
function renderReport(){
  const d = new Date();
  const y=d.getFullYear(), m=d.getMonth()+1;
  const start = new Date(y, m-1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  const sum = reportSummary(start, end);
  const shares = expenseShares(start, end);
  const trend = trendPoints(start, end);

  // 分类占比条
  const colors = ['#FF7043','#42A5F5','#AB47BC','#EF5350','#26A69A','#FFA726','#66BB6A','#29B6F6','#8D6E63','#EC407A'];
  const shareBar = shares.length ? `
    <div class="share-bar">${shares.map((s,i) => `<div class="seg2" style="width:${s.ratio*100}%;background:${s.color}"></div>`).join('')}</div>
    ${shares.slice(0,8).map(s => `
      <div class="legend row between">
        <div class="row"><span class="dot" style="background:${s.color}"></span><span>${s.icon} ${esc(s.name)}</span></div>
        <div class="row"><span class="num">${fmtCents(s.amountCents)}</span><span class="muted small" style="width:36px;text-align:right">${Math.round(s.ratio*100)}%</span></div>
      </div>`).join('')}
  ` : '<div class="empty"><div class="big">📊</div>本月暂无支出数据</div>';

  // 趋势图
  let trendHtml = '';
  if(trend.length){
    const maxVal = Math.max(1, ...trend.map(p => Math.max(p.expenseCents, p.incomeCents)));
    trendHtml = `<div class="bar-chart">${trend.map(p => {
      const eh = Math.max(2, p.expenseCents/maxVal*100);
      const ih = Math.max(2, p.incomeCents/maxVal*100);
      return `<div class="b"><div class="bar" style="height:${eh}px;background:var(--expense)"></div><div class="bar" style="height:${ih}px;background:var(--income)"></div><span class="small muted">${p.label}</span></div>`;
    }).join('')}</div>
    <div class="row" style="justify-content:center;gap:16px;margin-top:4px">
      <span class="muted small"><span style="color:var(--expense)">■</span> 支出</span>
      <span class="muted small"><span style="color:var(--income)">■</span> 收入</span>
    </div>`;
  }

  return `
    <div class="card">
      <div class="row between" style="margin-bottom:8px">
        <div class="bold">${y}年${m}月</div>
      </div>
      <div class="row" style="gap:20px">
        <div><div class="muted small">收入</div><div class="num income-c" style="font-size:20px">${fmtYuan(sum.incomeCents)}</div></div>
        <div><div class="muted small">支出</div><div class="num expense-c" style="font-size:20px">${fmtYuan(sum.expenseCents)}</div></div>
        <div><div class="muted small">结余</div><div class="num" style="font-size:20px;color:${sum.balanceCents>=0?'var(--text)':'var(--income)'}">${fmtYuan(sum.balanceCents)}</div></div>
      </div>
    </div>

    <div class="section-title">支出分类占比</div>
    <div class="card">${shareBar}</div>

    <div class="section-title">每日收支趋势</div>
    <div class="card">${trendHtml || '<div class="empty">本月暂无数据</div>'}</div>
  `;
}

/* ------------------------------ 设置页 ------------------------------ */
function renderSettings(){
  const n = db.transactions.length;
  const nLive = liveTransactions().length;
  return `
    <div class="section-title">数据</div>
    <div class="card">
      <div class="item" data-act="export-csv"><span>📤</span><div class="grow"><div class="bold">导出 CSV</div><div class="muted small">用 Excel/表格软件打开</div></div></div>
      <div class="item" data-act="export-enc"><span>🔐</span><div class="grow"><div class="bold">加密备份</div><div class="muted small">AES-256 加密，可跨设备恢复</div></div></div>
      <div class="item" data-act="import-enc"><span>📥</span><div class="grow"><div class="bold">恢复备份</div><div class="muted small">从加密备份文件还原</div></div></div>
      <div class="item" data-act="clear"><span style="color:var(--danger)">🗑️</span><div class="grow"><div class="bold" style="color:var(--danger)">清空所有数据</div><div class="muted small">不可恢复，请先备份</div></div></div>
    </div>
    <div class="section-title">关于</div>
    <div class="card">
      <div class="row between"><span class="muted">流水总数</span><span class="num">${n}（有效 ${nLive}）</span></div>
      <div class="row between" style="margin-top:8px"><span class="muted">账户数</span><span class="num">${db.accounts.length}</span></div>
      <div class="row between" style="margin-top:8px"><span class="muted">分类数</span><span class="num">${db.categories.length}</span></div>
      <div class="row between" style="margin-top:8px"><span class="muted">版本</span><span class="num">1.0.0 · 本地存储</span></div>
    </div>
  `;
}

/* ============================================================================
 * 事件绑定
 * ==========================================================================*/
function bindEvents(){
  // 记账页
  if(curRoute === 'record'){
    $$('.seg .s').forEach(s => s.addEventListener('click', () => {
      recordState.type = s.dataset.type;
      // 切换类型时清空分类
      if(recordState.type !== 'expense' && recordState.type !== 'income') recordState.categoryId = null;
      else recordState.categoryId = null;
      render();
    }));
    $$('.cat-grid .c').forEach(c => c.addEventListener('click', () => {
      recordState.categoryId = c.dataset.cat;
      render();
    }));
    $$('.chip[data-acc]').forEach(ch => ch.addEventListener('click', () => {
      const [which, id] = ch.dataset.acc.split(':');
      if(which === 'from') recordState.fromAccountId = id;
      else recordState.toAccountId = id;
      render();
    }));
    const amtInp = $('#amountInp');
    if(amtInp){
      amtInp.addEventListener('input', () => { recordState.amountStr = amtInp.value; });
      amtInp.focus();
    }
    const noteInp = $('#noteInp');
    if(noteInp) noteInp.addEventListener('input', () => { recordState.note = noteInp.value; });
    const save = $('#saveBtn');
    if(save) save.addEventListener('click', submitRecord);
  }

  // 通用 data-go 跳转
  $$('[data-go]').forEach(el => el.addEventListener('click', () => go(el.dataset.go)));

  // 账单列表筛选
  $$('[data-filter-type]').forEach(el => el.addEventListener('click', () => {
    listFilter.type = el.dataset.filterType || null;
    render();
  }));
  const mf = $('#monthFilter');
  if(mf) mf.addEventListener('change', () => { listFilter.month = mf.value || null; render(); });

  // 流水点击 → 编辑/删除
  $$('.txn[data-id]').forEach(el => el.addEventListener('click', () => showTxnMenu(el.dataset.id)));

  // 账户
  const addAcc = $('#addAccBtn');
  if(addAcc) addAcc.addEventListener('click', showAddAccount);
  $$('[data-act^="acc:"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); showAccountMenu(el.dataset.act.split(':')[1]); }));

  // 分类
  const addCat = $('#addCatBtn');
  if(addCat) addCat.addEventListener('click', showAddCategory);
  $$('[data-act^="cat:"]').forEach(el => el.addEventListener('click', e => { e.stopPropagation(); showCategoryMenu(el.dataset.act.split(':')[1]); }));

  // 预算
  const eb = $('#editBudgetBtn');
  if(eb) eb.addEventListener('click', showEditBudget);

  // 设置项
  $$('#main .item[data-act]').forEach(el => el.addEventListener('click', () => {
    const act = el.dataset.act;
    if(act==='export-csv') doExportCSV();
    else if(act==='export-enc') showExportEnc();
    else if(act==='import-enc') showImportEnc();
    else if(act==='clear') showClearConfirm();
  }));
}

/* ------------------------------ 流水编辑/删除 ------------------------------ */
function showTxnMenu(id){
  const t = db.transactions.find(x => x.transactionId===id);
  if(!t) return;
  const type = TransactionTypeLabel[t.type];
  const cat = t.type===TransactionType.TRANSFER ? '转账' : (categoryById(t.categoryId)?.name||'未分类');
  showSheet(`
    <h3>${type} · ${fmtYuan(t.amount)}</h3>
    <div class="muted small" style="text-align:center;margin-bottom:8px">${cat} · ${fmtDateFull(t.occurredAt)}${t.note?' · '+esc(t.note):''}</div>
    <div class="item" data-tact="edit"><span>✏️</span>编辑</div>
    <div class="item" data-tact="del"><span style="color:var(--danger)">🗑️</span><span style="color:var(--danger)">删除</span></div>
  `);
  $('#modalSheet').dataset.txnId = id;
}

/* ------------------------------ 数据操作 ------------------------------ */
function doExportCSV(){
  const csv = exportCSV();
  download('\uFEFF' + csv, 'ledger-export-'+currentYm()+'.csv', 'text/csv;charset=utf-8');
  toast('CSV 已导出');
}
function showExportEnc(){
  showSheet(`
    <h3>加密备份</h3>
    <div class="muted small" style="text-align:center;margin-bottom:8px">设置一个密码，备份内容将用 AES-256 加密</div>
    <div class="field"><input id="encPass" type="password" placeholder="设置密码"></div>
    <div class="field"><input id="encPass2" type="password" placeholder="确认密码"></div>
    <button class="btn-primary" id="encDo">生成备份文件</button>
  `);
  $('#encDo').addEventListener('click', async () => {
    const p1 = $('#encPass').value, p2 = $('#encPass2').value;
    if(!p1){ toast('请输入密码'); return; }
    if(p1 !== p2){ toast('两次密码不一致'); return; }
    const b64 = await exportEncrypted(p1);
    download(b64, 'ledger-backup-'+currentYm()+'.enc', 'application/octet-stream');
    closeSheet(); toast('备份已生成');
  });
}
function showImportEnc(){
  showSheet(`
    <h3>恢复备份</h3>
    <div class="field"><input id="impFile" type="file" accept=".enc"></div>
    <div class="field"><input id="impPass" type="password" placeholder="备份密码"></div>
    <button class="btn-primary" id="impDo">恢复</button>
  `);
  $('#impDo').addEventListener('click', async () => {
    const f = $('#impFile').files[0];
    if(!f){ toast('请选择备份文件'); return; }
    const pass = $('#impPass').value;
    if(!pass){ toast('请输入密码'); return; }
    const text = await f.text();
    const r = await importEncrypted(text.trim(), pass);
    if(!r.ok){ toast(r.error); return; }
    db = r.data; persist();
    closeSheet(); toast('恢复成功'); go('home');
  });
}
function showClearConfirm(){
  showSheet(`
    <h3>清空所有数据</h3>
    <div class="muted" style="text-align:center;margin-bottom:12px">此操作不可恢复，建议先导出备份</div>
    <button class="btn-primary" id="clearDo" style="background:var(--danger)">确认清空</button>
    <button class="btn-ghost" id="clearCancel">取消</button>
  `);
  $('#clearDo').addEventListener('click', () => {
    localStorage.removeItem(LS_KEY);
    db = null; ensureInit();
    closeSheet(); toast('已清空'); go('home');
  });
  $('#clearCancel').addEventListener('click', closeSheet);
}

function download(content, filename, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}

/* ------------------------------ 全局事件委托（弹窗内动态按钮） ------------------------------ */
// 弹窗里的按钮统一通过 #modalSheet 委托处理
$('#modalSheet').addEventListener('click', e => {
  const el = e.target.closest('[data-tact], [data-act]');
  if(!el) return;

  // 流水菜单
  if(el.dataset.tact){
    const id = $('#modalSheet').dataset.txnId;
    if(el.dataset.tact === 'edit'){ closeSheet(); editTransactionUI(id); }
    else if(el.dataset.tact === 'del'){ closeSheet(); confirmDeleteTxn(id); }
    return;
  }

  // 账户菜单 / 分类菜单（data-act）
  const act = el.dataset.act;
  if(act === 'reconcile'){ closeSheet(); showReconcile($('#modalSheet').dataset.accId); }
  else if(act === 'archive'){ closeSheet(); doArchiveAccount($('#modalSheet').dataset.accId); }
  else if(act === 'rename'){ closeSheet(); showRenameCategory($('#modalSheet').dataset.catId); }
  else if(act === 'archiveCat'){ closeSheet(); doArchiveCategory($('#modalSheet').dataset.catId); }
});

/* 流水编辑：进入记账页并回填 */
function editTransactionUI(id){
  const t = db.transactions.find(x => x.transactionId===id);
  if(!t) return;
  recordState = {
    type: t.type, categoryId: t.categoryId,
    fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
    amountStr: (t.amount/100).toFixed(2), note: t.note||'', occurredAt: t.occurredAt,
    editingId: id
  };
  go('record');
}
function confirmDeleteTxn(id){
  const t = db.transactions.find(x => x.transactionId===id);
  if(!t) return;
  showSheet(`
    <h3>删除这笔记录？</h3>
    <div class="muted" style="text-align:center;margin-bottom:12px">${TransactionTypeLabel[t.type]} ${fmtYuan(t.amount)}</div>
    <button class="btn-primary" id="delDo" style="background:var(--danger)">删除</button>
    <button class="btn-ghost" id="delCancel">取消</button>
  `);
  $('#delDo').addEventListener('click', () => {
    deleteTransaction(id); closeSheet(); toast('已删除'); render();
  });
  $('#delCancel').addEventListener('click', closeSheet);
}

/* 对账 */
function showReconcile(accId){
  const a = accountById(accId); if(!a) return;
  showSheet(`
    <h3>对账 · ${esc(a.name)}</h3>
    <div class="muted small" style="text-align:center;margin-bottom:8px">当前余额 ${fmtYuan(a.currentBalance)}</div>
    <div class="field"><input id="recBalance" type="text" inputmode="decimal" placeholder="实际余额" value="${(a.currentBalance/100).toFixed(2)}"></div>
    <div class="field"><input id="recNote" type="text" placeholder="备注（可选）"></div>
    <button class="btn-primary" id="recSave">确认对账</button>
  `);
  $('#recSave').addEventListener('click', () => {
    const cents = parseAmountToCents($('#recBalance').value);
    if(cents==null){ toast('请输入有效余额'); return; }
    reconcile(accId, cents, $('#recNote').value.trim()||null);
    closeSheet(); toast('对账完成'); render();
  });
}
function doArchiveAccount(id){
  const a = accountById(id); if(!a) return;
  if(!a.isArchived){
    showSheet(`
      <h3>归档账户「${esc(a.name)}」？</h3>
      <div class="muted" style="text-align:center;margin-bottom:12px">归档后不再出现在记账选择器，历史流水保留</div>
      <button class="btn-primary" id="arcDo">确认归档</button>
      <button class="btn-ghost" id="arcCancel">取消</button>
    `);
    $('#arcDo').addEventListener('click', () => { archiveAccount(id); closeSheet(); toast('已归档'); render(); });
    $('#arcCancel').addEventListener('click', closeSheet);
  } else {
    a.isArchived = false; a.updatedAt = now(); persist(); toast('已取消归档'); render();
  }
}

/* 分类操作 */
function showRenameCategory(id){
  const c = categoryById(id); if(!c) return;
  showSheet(`
    <h3>重命名分类</h3>
    <div class="field"><input id="renameInp" type="text" value="${esc(c.name)}"></div>
    <div class="field"><input id="renameIcon" type="text" value="${esc(c.icon)}" maxlength="2" placeholder="emoji"></div>
    <div class="field"><input id="renameColor" type="color" value="${c.color}" style="height:40px;padding:4px"></div>
    <button class="btn-primary" id="renameSave">保存</button>
  `);
  $('#renameSave').addEventListener('click', () => {
    const name = $('#renameInp').value.trim();
    if(!name){ toast('请输入名称'); return; }
    c.name = name; c.icon = $('#renameIcon').value||c.icon; c.color = $('#renameColor').value;
    persist(); closeSheet(); toast('已保存'); render();
  });
}
function doArchiveCategory(id){
  const c = categoryById(id); if(!c) return;
  c.isArchived = !c.isArchived; persist();
  toast(c.isArchived?'已归档':'已取消归档'); render();
}

/* ------------------------------ 启动 ------------------------------ */
ensureInit();
renderTabbar();
go('home');
