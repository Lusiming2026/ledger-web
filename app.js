/* ============================================================================
 * 记账 · 网页版（本地存储，无需登录）
 * 领域模型对齐原 KMP 工程 shared 模块（Money/Account/Transaction/Category/Budget/Report）
 * 金额一律用「分」(Long) 存储，展示时 ÷100。
 * ==========================================================================*/
'use strict';

/* ------------------------------ 常量与枚举 ------------------------------ */
const AccountType = { CASH:'cash', BANK_CARD:'bank_card', WECHAT:'wechat', ALIPAY:'alipay' };
const AccountTypeLabel = { cash:'现金', bank_card:'银行卡', wechat:'微信', alipay:'支付宝' };
const AccountTypeIcon = { cash:'💰', bank_card:'💳', wechat:'💬', alipay:'🅰️' };

const TransactionType = { EXPENSE:'expense', INCOME:'income', TRANSFER:'transfer' };
const TransactionTypeLabel = { expense:'支出', income:'收入', transfer:'转账' };
const CategoryKind = { EXPENSE:'expense', INCOME:'income' };

const MAX_AMOUNT_CENTS = 99999999999; // ≈ 10 亿元，对齐原 MAX_AMOUNT_CENTS
const BUDGET_THRESHOLDS = [80, 100];

/* ------------------------------ 存储 key ------------------------------ */
const LS_KEY = 'ledger.data.v1';

/* ------------------------------ 默认种子（对齐 DefaultSeed.kt） ------------------------------ */
const EXPENSE_NAMES = ['餐饮','交通','购物','娱乐','学习','日用','通讯','医疗','人情','其他'];
const INCOME_NAMES  = ['生活费','兼职','奖学金','红包','其他收入'];
const EXPENSE_ICONS = { '餐饮':'🍜','交通':'🚌','购物':'🛍️','娱乐':'🎮','学习':'📚','日用':'🏠','通讯':'📱','医疗':'🏥','人情':'🎁','其他':'⋯' };
const INCOME_ICONS  = { '生活费':'💰','兼职':'💼','奖学金':'🎓','红包':'🧧','其他收入':'⋯' };
const EXPENSE_COLORS = ['#FF7043','#42A5F5','#AB47BC','#EF5350','#26A69A','#8D6E63','#29B6F6','#EC407A','#FFA726','#78909C'];
const INCOME_COLORS  = ['#66BB6A','#9CCC65','#26C6DA','#FFCA28','#78909C'];
const DEFAULT_ACCOUNT_ID = 'acc_default_cash';

/* ------------------------------ 工具 ------------------------------ */
const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));
const now = () => Date.now();
const uid = (p='') => p + '_' + Math.random().toString(36).slice(2,10) + now().toString(36);
const esc = s => String(s==null?'':s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* 金额格式化：分 → "1,234.56" */
function fmtCents(cents, withSign=false){
  const v = Math.round(cents) / 100;
  let s = v.toFixed(2);
  // 千分位
  const [i, d] = s.split('.');
  const ii = i.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  s = ii + '.' + d;
  if(withSign && cents > 0) s = '+' + s;
  return s;
}
function fmtCentsNoDec(cents){ return '¥' + fmtCents(cents); }
function fmtYuan(cents){ return '¥' + fmtCents(cents); }
function parseAmountToCents(str){
  if(str==null || str==='') return null;
  // 去掉空格、逗号
  let s = String(str).replace(/[,\s]/g, '');
  if(!/^\d*\.?\d*$/.test(s)) return null;
  if(s === '' || s === '.') return null;
  const [i='0', d=''] = s.split('.');
  if(i==='' && d==='') return null;
  const intPart = parseInt(i||'0', 10);
  const frac = (d + '00').slice(0,2);
  const cents = intPart*100 + parseInt(frac, 10);
  if(!Number.isFinite(cents)) return null;
  return cents;
}

/* 日期工具 */
function fmtDate(ms){
  const d = new Date(ms);
  const M = d.getMonth()+1, D = d.getDate();
  return M + '月' + D + '日';
}
function fmtDateFull(ms){
  const d = new Date(ms);
  const y=d.getFullYear(), M=d.getMonth()+1, D=d.getDate();
  const w='日一二三四五六'[d.getDay()];
  return y+'-'+String(M).padStart(2,'0')+'-'+String(D).padStart(2,'0')+' 周'+w;
}
function fmtDateTime(ms){
  const d = new Date(ms);
  const M=d.getMonth()+1, D=d.getDate(), h=d.getHours(), m=String(d.getMinutes()).padStart(2,'0');
  return M+'月'+D+'日 '+h+':'+m;
}
function ymKey(ms){ const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); }
function currentYm(){ return ymKey(now()); }
function dayKey(ms){ const d=new Date(ms); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function todayStart(){
  const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
}
function localDateToInput(ms){
  const d = new Date(ms);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function inputToLocalMs(dateStr){
  // "YYYY-MM-DD" → 本地当天 12:00（避免时区偏移）
  const [y,m,d] = dateStr.split('-').map(Number);
  return new Date(y, m-1, d, 12, 0, 0).getTime();
}

/* ============================================================================
 * 数据层（localStorage）
 * ==========================================================================*/
let db = load();
function load(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){ console.warn('load fail', e); }
  return null;
}
function persist(){
  localStorage.setItem(LS_KEY, JSON.stringify(db));
}

/* 首次初始化：种子分类 + 默认现金账户 */
function ensureInit(){
  if(!db){
    const t = now();
    db = { accounts:[], categories:[], transactions:[], budgets:[], notifications:[], reconciliations:[] };
    // 分类
    EXPENSE_NAMES.forEach((name, i) => db.categories.push({
      categoryId:'cat_exp_'+i, name, kind:CategoryKind.EXPENSE, icon:EXPENSE_ICONS[name],
      color:EXPENSE_COLORS[i], isSystem:true, sortOrder:i, isArchived:false
    }));
    INCOME_NAMES.forEach((name, i) => db.categories.push({
      categoryId:'cat_inc_'+i, name, kind:CategoryKind.INCOME, icon:INCOME_ICONS[name],
      color:INCOME_COLORS[i], isSystem:true, sortOrder:i, isArchived:false
    }));
    // 默认现金账户
    db.accounts.push({
      accountId:DEFAULT_ACCOUNT_ID, name:'现金', type:AccountType.CASH,
      initialBalance:0, currentBalance:0, sortOrder:0, isArchived:false, createdAt:t, updatedAt:t
    });
    persist();
  }
}

/* ------------------------------ 查询辅助 ------------------------------ */
function accounts(includeArchived=false){ return db.accounts.filter(a => includeArchived || !a.isArchived).sort((a,b)=>a.sortOrder-b.sortOrder); }
function categories(kind=null, includeArchived=false){
  return db.categories.filter(c => (includeArchived || !c.isArchived) && (!kind || c.kind===kind)).sort((a,b)=>a.sortOrder-b.sortOrder);
}
function categoryById(id){ return db.categories.find(c => c.categoryId===id); }
function accountById(id){ return db.accounts.find(a => a.accountId===id); }
function liveTransactions(){
  return db.transactions.filter(t => !t.deletedAt).sort((a,b)=>b.occurredAt-a.occurredAt);
}
function transactionsInRange(startMs, endMs){
  return liveTransactions().filter(t => t.occurredAt>=startMs && t.occurredAt<endMs);
}

/* ============================================================================
 * 领域逻辑
 * ==========================================================================*/
/* 记账：联动账户余额（对齐 AddTransactionUseCase） */
function addTransaction(input){
  const t = now();
  const tx = {
    transactionId: uid('tx'),
    type: input.type,
    amount: input.amount,          // 分，>0
    categoryId: input.categoryId ?? null,
    fromAccountId: input.fromAccountId ?? null,
    toAccountId: input.toAccountId ?? null,
    note: input.note ?? null,
    occurredAt: input.occurredAt ?? now(),
    createdAt: t, updatedAt: t, deletedAt: null
  };
  // 校验（对齐 TransactionValidator）
  const err = validateTransaction(tx);
  if(err) return { ok:false, error:err };

  // 余额联动
  if(tx.type === TransactionType.EXPENSE){
    const a = accountById(tx.fromAccountId);
    a.currentBalance -= tx.amount;
    a.updatedAt = t;
  } else if(tx.type === TransactionType.INCOME){
    const a = accountById(tx.toAccountId);
    a.currentBalance += tx.amount;
    a.updatedAt = t;
  } else { // transfer
    const f = accountById(tx.fromAccountId);
    const tt = accountById(tx.toAccountId);
    f.currentBalance -= tx.amount; f.updatedAt = t;
    tt.currentBalance += tx.amount; tt.updatedAt = t;
  }
  db.transactions.push(tx);
  persist();
  return { ok:true, tx };
}

function validateTransaction(tx){
  if(!(tx.amount > 0)) return '金额必须大于 0';
  if(tx.amount > MAX_AMOUNT_CENTS) return '金额超出上限';
  if(tx.type === TransactionType.EXPENSE){
    if(!tx.fromAccountId) return '请选择支出账户';
    if(!tx.categoryId) return '请选择分类';
  } else if(tx.type === TransactionType.INCOME){
    if(!tx.toAccountId) return '请选择收入账户';
    if(!tx.categoryId) return '请选择分类';
  } else { // transfer
    if(!tx.fromAccountId || !tx.toAccountId) return '请选择转出/转入账户';
    if(tx.fromAccountId === tx.toAccountId) return '转出与转入账户不能相同';
  }
  return null;
}

/* 编辑交易：先回滚原交易余额，再应用新交易 */
function updateTransaction(id, newInput){
  const idx = db.transactions.findIndex(t => t.transactionId===id);
  if(idx < 0) return { ok:false, error:'流水不存在' };
  const old = db.transactions[idx];
  if(old.deletedAt) return { ok:false, error:'流水已删除' };
  // 回滚旧余额
  applyBalance(old, -1);
  // 构建新
  const t = now();
  const tx = { ...old, ...newInput, amount:newInput.amount, updatedAt:t };
  const err = validateTransaction(tx);
  if(err){ applyBalance(old, 1); return { ok:false, error:err }; }
  applyBalance(tx, 1);
  db.transactions[idx] = tx;
  persist();
  return { ok:true, tx };
}

/* 删除（软删除 + 回滚余额） */
function deleteTransaction(id){
  const idx = db.transactions.findIndex(t => t.transactionId===id);
  if(idx < 0) return false;
  const tx = db.transactions[idx];
  if(tx.deletedAt) return false;
  applyBalance(tx, -1);
  tx.deletedAt = now(); tx.updatedAt = now();
  persist();
  return true;
}

/* 余额联动：sign=1 应用，sign=-1 回滚 */
function applyBalance(tx, sign){
  const d = sign;
  if(tx.type === TransactionType.EXPENSE){
    const a = accountById(tx.fromAccountId); if(a){ a.currentBalance -= tx.amount*d; }
  } else if(tx.type === TransactionType.INCOME){
    const a = accountById(tx.toAccountId); if(a){ a.currentBalance += tx.amount*d; }
  } else {
    const f = accountById(tx.fromAccountId); if(f){ f.currentBalance -= tx.amount*d; }
    const tt = accountById(tx.toAccountId); if(tt){ tt.currentBalance += tx.amount*d; }
  }
}

/* 账户 */
function addAccount(input){
  const t = now();
  const a = {
    accountId: uid('acc'), name: input.name.trim(), type: input.type,
    initialBalance: input.initialBalance ?? 0, currentBalance: input.initialBalance ?? 0,
    sortOrder: db.accounts.length, isArchived:false, createdAt:t, updatedAt:t
  };
  if(!a.name) return { ok:false, error:'请输入账户名' };
  db.accounts.push(a); persist(); return { ok:true, a };
}
function archiveAccount(id){
  const a = accountById(id); if(!a) return;
  a.isArchived = true; a.updatedAt = now(); persist();
}

/* 对账：直接覆盖 current_balance，留痕 */
function reconcile(accountId, balance, note){
  const a = accountById(accountId); if(!a) return;
  const r = { reconciliationId:uid('rec'), accountId, balance, reconciledAt:now(), note:note??null };
  a.currentBalance = balance; a.updatedAt = now();
  db.reconciliations.push(r); persist();
}

/* 预算 */
function budgetFor(year, month){
  return db.budgets.find(b => b.year===year && b.month===month);
}
function setBudget(year, month, amountCents){
  const b = budgetFor(year, month);
  const t = now();
  if(b){ b.amount = amountCents; b.updatedAt = t; }
  else { db.budgets.push({ budgetId:uid('bud'), amount:amountCents, year, month, createdAt:t, updatedAt:t }); }
  persist();
}
function monthSpent(year, month){
  const start = new Date(year, month-1, 1).getTime();
  const end = new Date(year, month, 1).getTime();
  return transactionsInRange(start, end)
    .filter(t => t.type===TransactionType.EXPENSE)
    .reduce((s,t)=>s+t.amount, 0);
}
function budgetStatus(){
  const d = new Date();
  const y = d.getFullYear(), m = d.getMonth()+1;
  const b = budgetFor(y, m);
  const spent = monthSpent(y, m);
  const budgetCents = b ? b.amount : 0;
  const remaining = budgetCents - spent;
  const ratio = budgetCents>0 ? spent/budgetCents : 0;
  return {
    yearMonth: y+'-'+String(m).padStart(2,'0'),
    hasBudget: !!b, budgetCents, spentCents:spent, remainingCents:remaining,
    usageRatio:ratio, usagePercent:Math.floor(ratio*100),
    progressFraction:Math.min(1, Math.max(0, ratio))
  };
}

/* 报表 */
function reportSummary(start, end){
  const ts = transactionsInRange(start, end).filter(t => t.countsInReport!==false);
  // countsInReport：transfer 排除
  let income=0, expense=0;
  ts.forEach(t => {
    if(t.type===TransactionType.INCOME) income += t.amount;
    else if(t.type===TransactionType.EXPENSE) expense += t.amount;
  });
  return { incomeCents:income, expenseCents:expense, balanceCents:income-expense };
}
function expenseShares(start, end){
  const map = new Map();
  transactionsInRange(start, end).forEach(t => {
    if(t.type!==TransactionType.EXPENSE) return;
    const c = categoryById(t.categoryId);
    const key = t.categoryId || '__none__';
    if(!map.has(key)) map.set(key, { categoryId:t.categoryId, name:c?c.name:'未分类', icon:c?c.icon:'❓', color:c?c.color:'#999', amountCents:0 });
    map.get(key).amountCents += t.amount;
  });
  const total = Array.from(map.values()).reduce((s,v)=>s+v.amountCents, 0);
  return Array.from(map.values()).map(v => ({ ...v, ratio: total>0 ? v.amountCents/total : 0 })).sort((a,b)=>b.amountCents-a.amountCents);
}
function trendPoints(start, end){
  // 按日聚合
  const map = new Map();
  transactionsInRange(start, end).forEach(t => {
    const k = dayKey(t.occurredAt);
    if(!map.has(k)) map.set(k, { bucketStartMillis: new Date(new Date(t.occurredAt).setHours(0,0,0,0)).getTime(), label:'', expenseCents:0, incomeCents:0 });
    const p = map.get(k);
    if(t.type===TransactionType.EXPENSE) p.expenseCents += t.amount;
    else if(t.type===TransactionType.INCOME) p.incomeCents += t.amount;
  });
  return Array.from(map.values()).sort((a,b)=>a.bucketStartMillis-b.bucketStartMillis).map(p => {
    const d = new Date(p.bucketStartMillis);
    p.label = (d.getMonth()+1)+'-'+String(d.getDate()).padStart(2,'0');
    p.balanceCents = p.incomeCents - p.expenseCents;
    return p;
  });
}

/* 总资产 = 所有未归档账户 currentBalance 之和 */
function totalAssets(){
  return accounts().reduce((s,a)=>s+a.currentBalance, 0);
}

/* ============================================================================
 * CSV 导入导出
 * ==========================================================================*/
function exportCSV(){
  const rows = [['类型','金额(元)','分类','账户','日期','备注']];
  liveTransactions().forEach(t => {
    const type = TransactionTypeLabel[t.type];
    const cat = t.type===TransactionType.TRANSFER ? '转账' : (categoryById(t.categoryId)?.name || '未分类');
    const acc = t.type===TransactionType.EXPENSE ? (accountById(t.fromAccountId)?.name||'') :
               t.type===TransactionType.INCOME ? (accountById(t.toAccountId)?.name||'') :
               ((accountById(t.fromAccountId)?.name||'')+'→'+(accountById(t.toAccountId)?.name||''));
    const amt = (t.type===TransactionType.EXPENSE ? '-' : '') + (t.amount/100).toFixed(2);
    rows.push([type, amt, cat, acc, fmtDateFull(t.occurredAt), t.note||'']);
  });
  return rows.map(r => r.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\n');
}

/* ============================================================================
 * 加密备份（Web Crypto，AES-256-GCM）
 * ==========================================================================*/
const enc = new TextEncoder();
const dec = new TextDecoder();
function bufToB64(buf){ let s=''; const a=new Uint8Array(buf); for(let i=0;i<a.length;i++) s+=String.fromCharCode(a[i]); return btoa(s); }
function b64ToBuf(b64){ const s=atob(b64); const a=new Uint8Array(s.length); for(let i=0;i<s.length;i++) a[i]=s.charCodeAt(i); return a; }
async function deriveKey(pass, salt){
  const m = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' },
    m, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
  );
}
async function exportEncrypted(pass){
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const plain = JSON.stringify({ v:1, exportedAt:now(), data: db });
  const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, enc.encode(plain));
  // 格式：magic(8) + salt(16) + iv(12) + ciphertext
  const magic = enc.encode('LEDGER1');
  const out = new Uint8Array(magic.length + salt.length + iv.length + ct.byteLength);
  out.set(magic, 0); out.set(salt, magic.length); out.set(iv, magic.length+salt.length);
  out.set(new Uint8Array(ct), magic.length+salt.length+iv.length);
  return bufToB64(out);
}
async function importEncrypted(b64, pass){
  try{
    const buf = b64ToBuf(b64);
    const magic = dec.decode(buf.slice(0,7));
    if(magic !== 'LEDGER1') return { ok:false, error:'不是有效的记账备份文件' };
    const salt = buf.slice(7, 23);
    const iv = buf.slice(23, 35);
    const ct = buf.slice(35);
    const key = await deriveKey(pass, salt);
    const plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, ct);
    const obj = JSON.parse(dec.decode(plain));
    if(!obj.data) return { ok:false, error:'备份内容损坏' };
    return { ok:true, data:obj.data };
  }catch(e){
    return { ok:false, error:'密码错误或文件损坏' };
  }
}

/* ------------------------------ Toast ------------------------------ */
let toastTimer;
function toast(msg){
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 1800);
}

/* ------------------------------ 弹窗 ------------------------------ */
function showSheet(html){
  $('#modalSheet').innerHTML = html;
  $('#modalMask').classList.add('show');
}
function closeSheet(){
  $('#modalMask').classList.remove('show');
}
$('#modalMask').addEventListener('click', e => { if(e.target === $('#modalMask')) closeSheet(); });
