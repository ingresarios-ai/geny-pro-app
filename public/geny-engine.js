/* Geny Pro SaaS Client Engine — Powered by INGRESARIOS (Next.js + Supabase) */
window.bootGenyPro = function bootGenyPro(BOOT) {
  if (window.__GENY_RUNNING__) {
    window.__GENY_REMOUNT__?.(BOOT);
    return;
  }
  window.__GENY_RUNNING__ = true;

  const fail = (code, message, extra) => Object.assign(new Error(message || code), { code }, extra || {});
  async function api(path, opt) {
    let r;
    try { r = await fetch(path, opt); } catch (e) { throw fail('server_unavailable', 'Sin conexión', { retryable: true }); }
    if (r.status === 401) { location.href = '/login'; throw fail('permission_denied', 'Sesión expirada'); }
    if (r.status === 403) { throw fail('permission_denied', 'Sin permiso'); }
    if (r.status === 429) {
      const errBody = await r.json().catch(() => ({}));
      throw fail('rate_limited', errBody.error || 'Límite alcanzado');
    }
    if (r.status === 501) {
      const errBody = await r.json().catch(() => ({}));
      throw fail('server_not_connected', errBody.error || 'Servicio sin configurar');
    }
    if (r.status >= 500) {
      const errBody = await r.json().catch(() => ({}));
      throw fail('server_unavailable', errBody.error || 'Servicio no disponible', { retryable: true });
    }
    if (!r.ok) { throw fail('tool_error', (await r.text()).slice(0, 200)); }
    return r.json();
  }

  const rankingDoc = {
    async set(data) { await api('/api/ranking', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }); },
    async delete() { await api('/api/ranking', { method: 'DELETE' }); }
  };
  const db = {
    doc(p) { return p.startsWith('ranking/') ? rankingDoc : null; },
    collection(p) {
      if (p === 'ranking') {
        return {
          async get() {
            const j = await api('/api/ranking');
            return { docs: (j.docs || []).map(d => ({ id: d.id, data: () => d.data })) };
          }
        };
      }
      return null;
    }
  };
  const user = { id: async () => BOOT.userId, isOwner: async () => false, canEdit: async () => true };
  const mcp = {
    async callTool(server, tool, input) {
      if (server !== 'FMP') throw fail('server_not_connected');
      const q = new URLSearchParams({ tool });
      Object.entries(input || {}).forEach(([k, v]) => q.set(k, String(v)));
      return api('/api/fmp?' + q.toString());
    }
  };
  async function sample(input, opts = {}) {
    const tools = opts.tools || [];
    const spec = tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema || { type: 'object', properties: {} } }));
    let messages = (typeof input === 'string' ? [{ role: 'user', content: input }] : input).map(m => ({ role: m.role, content: m.content }));
    let text = '';
    for (let i = 0; i < 4; i++) {
      const j = await api('/api/geny', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages, context: opts.context || '', tools: spec })
      });
      const blocks = j.content || [];
      text = blocks.filter(b => b.type === 'text').map(b => b.text).join('').trim() || text;
      const uses = blocks.filter(b => b.type === 'tool_use');
      if (!uses.length || j.stop_reason !== 'tool_use') {
        opts.onText?.({ text, delta: text });
        return { text, truncated: j.stop_reason === 'max_tokens' };
      }
      const results = [];
      for (const u of uses) {
        const t = tools.find(x => x.name === u.name);
        let out, bad = false;
        try {
          if (!t) throw new Error('Herramienta desconocida');
          out = await t.execute(u.input);
        } catch (e) {
          out = String(e?.message || e);
          bad = true;
        }
        results.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out ?? null), is_error: bad });
      }
      messages = [...messages, { role: 'assistant', content: blocks }, { role: 'user', content: results }];
    }
    opts.onText?.({ text, delta: text });
    return { text: text || 'Listo.', truncated: false };
  }

  window.claude = {
    use: async (n) => n === 'db' ? db : n === 'user' ? user : n === 'mcp' ? mcp : n === 'sample' ? sample : null
  };

  window.jrBump = function jrBump(k) {
    S.jr = S.jr || {};
    S.jr.n = S.jr.n || {};
    S.jr.n[k] = (S.jr.n[k] || 0) + 1;
    save();
  };

/* ---------- iconos ---------- */
const I={
home:'<path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10"/>',
chat:'<path d="M4 5h16v11H9l-5 4z"/><circle cx="9" cy="10.5" r=".8" fill="currentColor"/><circle cx="12" cy="10.5" r=".8" fill="currentColor"/><circle cx="15" cy="10.5" r=".8" fill="currentColor"/>',
wallet:'<path d="M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1zM4 7l11-3v3"/><rect x="14" y="11" width="6" height="4" rx="1"/>',
candles:'<path d="M6 3v18M12 3v18M18 3v18"/><rect x="4" y="7" width="4" height="7" rx="1"/><rect x="10" y="10" width="4" height="6" rx="1"/><rect x="16" y="6" width="4" height="8" rx="1"/>',
target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><path d="M12 12 20 4M17 4h3v3"/>',
lotus:'<path d="M12 19c-3-2-4-5-4-8 0-2 2-5 4-7 2 2 4 5 4 7 0 3-1 6-4 8z"/><path d="M12 19c-4 0-8-2-9-6 2-1 4-1 6 0M12 19c4 0 8-2 9-6-2-1-4-1-6 0"/>',
bars:'<path d="M4 20h16"/><rect x="5" y="13" width="3" height="5"/><rect x="10.5" y="9" width="3" height="9"/><rect x="16" y="4" width="3" height="14"/>',
cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="14" r=".9" fill="currentColor"/><circle cx="12" cy="14" r=".9" fill="currentColor"/><circle cx="16" cy="14" r=".9" fill="currentColor"/><circle cx="8" cy="17.5" r=".9" fill="currentColor"/><circle cx="12" cy="17.5" r=".9" fill="currentColor"/>',
clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h6M9 18h4"/>',
cap:'<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5"/>',
trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
play:'<circle cx="12" cy="12" r="9"/><path d="M10 8l6 4-6 4z"/>',
inf:'<path d="M7 9c-3 0-4 1.5-4 3s1 3 4 3 7-6 10-6 4 1.5 4 3-1 3-4 3-7-6-10-6z"/>',
bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
db:'<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
up:'<path d="M3 20l6-6 4 4 8-9M15 9h6v6"/>',
ok:'<path d="M5 12l5 5 9-10"/>',
chev:'<path d="M9 5l7 7-7 7"/>'};
const ic=(n,cls='',sw=1.8)=>`<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${I[n]}</svg>`;

/* ---------- utilidades ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iso=d=>new Date(d).toLocaleDateString('en-CA');
const today=()=>iso(Date.now());
const daysAgo=n=>iso(Date.now()-n*864e5);
const uid=()=>Math.random().toString(36).slice(2,10);
const money=n=>(n<0?'-':'')+'$'+Math.abs(n).toLocaleString('es-MX',{minimumFractionDigits:Math.abs(n)%1?2:0,maximumFractionDigits:2});
const clamp=n=>Math.max(0,Math.min(100,Math.round(n)));
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>el.hidden=true,2600)}

/* ---------- Reto 21 ---------- */
const MISIONES=["Escribe por qué quieres ser trader y cuánto riesgo aceptas por operación.","Registra todos tus gastos del día en Mi Dinero.","Define tu setup principal y sus reglas de entrada en una nota.","Calcula tu tasa de ahorro del mes.","Haz tu check-in de mentalidad antes de abrir la plataforma.","Registra tus operaciones con emoción y nota en la bitácora.","Revisa tu semana con el ciclo PEDEM completo.","Define tu stop máximo diario y escríbelo visible.","Opera solo en simulador o con tamaño mínimo y documenta.","Identifica tu emoción más frecuente en la bitácora.","Crea una meta financiera con monto y fecha.","Analiza tus 3 peores operaciones: ¿qué regla rompiste?","Rutina matutina completa: plan, lectura, sin redes.","Calcula tu esperanza matemática con tus datos.","Recorta un gasto hormiga y muévelo a ahorro.","Día sin operar por impulso: solo setups del plan.","Revisa tu fondo de emergencia y ajusta la meta.","Pregúntale a Geny qué patrón ve en tu bitácora.","Escribe tu plan de la próxima semana (Planear).","Compara tu progreso con el diagnóstico inicial.","Cierra el reto: escribe tus 3 aprendizajes y tu siguiente nivel."];

/* ---------- estado ---------- */
function seed(){
  const t=(d,a,dir,e,s,q,setup,plan,emo,nota)=>({id:uid(),fecha:daysAgo(d),activo:a,dir,entrada:e,salida:s,cantidad:q,setup,plan,emo,nota});
  const m=(d,tipo,cat,monto,nota)=>({id:uid(),fecha:daysAgo(d),tipo,cat,monto,nota});
  const checks={};[1,2,3,4,5,6].forEach(i=>checks[daysAgo(i)]={animo:3+(i%3===0?1:0),energia:3+(i%2),control:i===4?2:4,h:{rutina:i!==4,plan:true,bitacora:i%2===0,ejercicio:i%3!==0,lectura:i<4,impulso:i!==4}});
  return {v:1,ejemplo:true,nombre:(BOOT.firstName||"Trader"),
    reto:{inicio:daysAgo(6),hechos:[daysAgo(6),daysAgo(5),daysAgo(4),daysAgo(3),daysAgo(2),daysAgo(1)]},
    diag:{paso:1,hecho:false,areas:{finanzas:true,inversiones:false,trading:true,mentalidad:false,metas:false},resp:{}},
    pedem:{planear:true,ejecutar:true,documentar:false,evaluar:false,mejorar:false},
    movs:[m(9,'ingreso','Salario',3200,'Quincena'),m(8,'gasto','Vivienda',900,''),m(7,'gasto','Comida',240,''),m(6,'ahorro','Fondo emergencia',400,''),m(5,'gasto','Transporte',90,''),m(3,'gasto','Ocio',120,'Cine y cena'),m(2,'ingreso','Trading',310,'Retiro de ganancias'),m(1,'gasto','Comida',85,'')],
    trades:[t(6,'SPY','long',512.4,515.1,10,'Geny Trend',true,'Calma','Entrada en retroceso al VWAP'),t(5,'QQQ','short',441.2,442.6,10,'Ruptura',false,'FOMO','Entré tarde, sin confirmación'),t(4,'AAPL','long',228.5,231.9,15,'Geny Trend',true,'Confianza',''),t(3,'TSLA','long',251,247.2,8,'Reditum Sniper',false,'Revancha','Después de una pérdida'),t(2,'SPY','long',516,518.7,10,'Geny Trend',true,'Calma','Plan cumplido'),t(1,'NVDA','short',132.8,130.9,20,'Reditum Sniper',true,'Calma','Rechazo en resistencia diaria'),{...t(2,'MES','long',5120.25,5131.5,2,'Geny Trend',true,'Calma','Rebote en el POC de la sesión anterior'),tipo:'futuros',mult:5},{...t(1,'SPY','short',1.35,.4,2,'Reditum Sniper',true,'Confianza','Cerrado al 70 % del crédito'),tipo:'opciones',estrategia:'Bull put spread',mult:100,strikes:'495/490',venc:daysAgo(-12)}],
    metas:[{id:uid(),titulo:'Fondo de emergencia 6 meses',area:'Finanzas',objetivo:9000,actual:3400,fecha:daysAgo(-150)},{id:uid(),titulo:'Cuenta de trading a $5.000',area:'Trading',objetivo:5000,actual:2650,fecha:daysAgo(-90)},{id:uid(),titulo:'60 días de rutina matutina',area:'Hábitos',objetivo:60,actual:18,fecha:daysAgo(-42)}],
    checks,chat:[],r21:seedR21()};
}
function blank(){return {v:1,ejemplo:false,nombre:(BOOT.firstName||"Trader"),reto:{inicio:today(),hechos:[]},diag:{paso:1,hecho:false,areas:{finanzas:false,inversiones:false,trading:false,mentalidad:false,metas:false},resp:{}},pedem:{planear:false,ejecutar:false,documentar:false,evaluar:false,mejorar:false},movs:[],trades:[],metas:[],checks:{},chat:[]}}

const LS_KEY='genyPro:'+(BOOT.userId||'anon');
const UI_KEY='genyUiMode:'+(BOOT.userId||'anon');
let S=BOOT.initialState&&BOOT.initialState.v?BOOT.initialState:null;
if(!S){try{S=JSON.parse(localStorage.getItem(LS_KEY))}catch(e){}}
if(!S||!S.v)S=seed();
let uiMode=S.uiMode||(()=>{try{return localStorage.getItem(UI_KEY)}catch(e){return null}})()||'guided';
if(uiMode!=='classic'&&uiMode!=='guided')uiMode='guided';
const isGuided=()=>uiMode==='guided';

let lastSentJson=BOOT.initialState&&BOOT.initialState.v?JSON.stringify(BOOT.initialState):'';
let lastSentMod='';
let lastModAt=0;

const store={ref:true,busy:false,again:false,t:null};
function save(){
  try{localStorage.setItem(LS_KEY,JSON.stringify(S))}catch(e){}
  clearTimeout(store.t);store.t=setTimeout(flush,650);
}
async function flush(){
  const curJson=JSON.stringify(S);
  const curMod=typeof route==='function'?route():'inicio';
  if(curJson===lastSentJson&&(curMod===lastSentMod||Date.now()-lastModAt<120000))return;
  if(store.busy){store.again=true;return}
  store.busy=true;
  try{
    const r=await fetch('/api/state',{
      method:'PUT',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({state:S,currentModule:curMod,clientDate:today()})
    });
    if(r.status===401)location.href='/login';
    else if(r.status===403)location.href='/renovar';
    else if(r.ok){lastSentJson=curJson;lastSentMod=curMod;lastModAt=Date.now();}
  }catch(e){console.warn('sync',e)}
  store.busy=false;if(store.again){store.again=false;flush()}
}
if(!BOOT.initialState||!BOOT.initialState.v){setTimeout(flush,800)}

/* ---------- métricas ---------- */
const pnl=t=>(t.pnlManual!=null&&!(t.entrada>0&&t.salida>0)?+t.pnlManual:(t.salida-t.entrada)*t.cantidad*(+t.mult||1)*(t.dir==='short'?-1:1))-(+t.comision||0);
function lastDays(n){return Array.from({length:n},(_,i)=>daysAgo(n-1-i))}
function finanzas(){
  const ing=S.movs.filter(m=>m.tipo==='ingreso').reduce((a,m)=>a+ +m.monto,0);
  const gas=S.movs.filter(m=>m.tipo==='gasto').reduce((a,m)=>a+ +m.monto,0);
  const aho=S.movs.filter(m=>m.tipo==='ahorro').reduce((a,m)=>a+ +m.monto,0);
  return {ing,gas,aho,bal:ing-gas-aho,tasa:ing?aho/ing:0};
}
function tstats(){
  const ps=S.trades.map(pnl),w=ps.filter(p=>p>0),l=ps.filter(p=>p<=0);
  const gw=w.reduce((a,b)=>a+b,0),gl=Math.abs(l.reduce((a,b)=>a+b,0));
  return {n:ps.length,total:ps.reduce((a,b)=>a+b,0),wr:ps.length?w.length/ps.length:0,pf:gl?gw/gl:(gw?Infinity:0),exp:ps.length?ps.reduce((a,b)=>a+b,0)/ps.length:0,plan:ps.length?S.trades.filter(t=>t.plan).length/ps.length:0,doc:ps.length?S.trades.filter(t=>t.nota&&t.emo).length/ps.length:0};
}
function scores(){
  const f=finanzas(),days7=lastDays(7);
  const reg=days7.filter(d=>S.movs.some(m=>m.fecha===d)).length;
  const fin=S.movs.length?clamp(Math.min(f.tasa/.2,1)*70+reg/7*30+ (f.bal>=0?0:-15)):0;
  const t=tstats();const tra=t.n?clamp(t.plan*60+t.doc*40):0;
  const cs=days7.map(d=>S.checks[d]).filter(Boolean);
  const men=cs.length?clamp(cs.reduce((a,c)=>a+(c.animo+c.energia+c.control*2)/20,0)/7*100):0;
  const hab=cs.length?clamp(cs.reduce((a,c)=>a+Object.values(c.h).filter(Boolean).length,0)/(7*6)*100):0;
  const gen=Math.round((fin+tra+men+hab)/4);
  return {fin,tra,men,hab,gen};
}
function retoDia(){return Math.min(21,S.reto.hechos.length+(S.reto.hechos.includes(today())?0:1))}
function avisos(){
  const a=[];
  if(!S.reto.hechos.includes(today())&&S.reto.hechos.length<21)a.push(`Reto 21: tu misión del día ${retoDia()} está pendiente.`);
  if(!S.checks[today()])a.push('Aún no haces tu check-in de mentalidad de hoy.');
  if(!S.diag.hecho)a.push('Completa el diagnóstico inicial para personalizar tu plan.');
  const sinNota=S.trades.filter(t=>!t.nota).length;if(sinNota)a.push(`${sinNota} operación(es) en tu bitácora no tienen nota.`);
  return a;
}
function avisosRich(){
  const a=[];
  if(!S.reto.hechos.includes(today())&&S.reto.hechos.length<21)a.push({txt:`Reto 21: tu misión del día ${retoDia()} está pendiente.`,go:'reto21'});
  if(!S.checks[today()])a.push({txt:'Aún no haces tu check-in de mentalidad de hoy.',go:'mentalidad'});
  if(!S.diag.hecho)a.push({txt:'Completa el diagnóstico inicial para personalizar tu plan.',act:'diag'});
  const sinNota=S.trades.filter(t=>!t.nota).length;if(sinNota)a.push({txt:`${sinNota} operación(es) en tu bitácora no tienen nota.`,go:'trading'});
  return a;
}

/* ---------- navegación ---------- */
const TABS=[['inicio','Inicio','home'],['geny','Mi Geny','chat'],['dinero','Mi Dinero','wallet'],['trading','Mi Trading','candles'],['opciones','Estrategias','payoff'],['radar','Radar','radar'],['reto21','Reto 21','cal'],['replay','Replay','play'],['metas','Mis Metas','target'],['mentalidad','Mi Mentalidad','lotus'],['progreso','Mi Progreso','bars']];
const PILLARS=[
  ['inicio','Inicio','home',['inicio','progreso']],
  ['reto21','Reto 21','cal',['reto21']],
  ['trading','Trading','candles',['trading','radar','opciones','replay']],
  ['dinero','Finanzas','wallet',['dinero','metas']],
  ['mentalidad','Mentalidad','lotus',['mentalidad']]
];
const SUBNAVS={
  inicio:[
    ['inicio','Mi guía de hoy','Por dónde empezar'],
    ['progreso','Mi progreso y PEDEM','Métricas y ciclo semanal']
  ],
  trading:[
    ['trading','Bitácora','Tus operaciones y métricas'],
    ['radar','Radar','Escanea oportunidades'],
    ['opciones','Estrategias','Simulador de opciones'],
    ['replay','Market Replay','Practica vela por vela']
  ],
  dinero:[
    ['dinero','Mi Dinero','Ingresos, gastos y ahorro'],
    ['metas','Mis Metas','Objetivos con fecha']
  ]
};
const pillarOf=r=>PILLARS.find(([,,,rs])=>rs.includes(r))?.[0]||null;
function subnavHtml(r){
  const pk=pillarOf(r),list=pk?SUBNAVS[pk]:null;
  if(!list)return '';
  return `<nav class="subnav" aria-label="Secciones del módulo">${list.map(([k,l,d])=>`<button type="button" data-go="${k}" ${k===r?'aria-current="page"':''}><span>${l}</span><small>${d}</small></button>`).join('')}</nav>`;
}
function syncUiModeAttr(){
  document.documentElement.dataset.ui=uiMode;
  document.querySelectorAll('#modeSwitch [data-ui]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.ui===uiMode?'true':'false'));
}
function setUiMode(m){
  const next=m==='classic'?'classic':'guided';
  if(next===uiMode)return;
  uiMode=next;
  try{localStorage.setItem(UI_KEY,uiMode)}catch(e){}
  S.uiMode=uiMode;
  if(uiMode==='classic'&&$('#genyDrawer')?.open)closeGenyDrawer?.(true);
  save();syncUiModeAttr();render();
  toast(uiMode==='classic'?'Vista Original activada (11 pestañas clásicas)':'Vista Nueva activada (navegación guiada y simplificada)');
}
function route(){const h=location.hash.slice(1);return TABS.some(t=>t[0]===h)?h:'inicio'}
let skipNextHashRender=false;
function go(v){
  const target=TABS.some(t=>t[0]===v)?v:'inicio';
  if(location.hash.slice(1)!==target){
    skipNextHashRender=true;
    location.hash=target;
    setTimeout(()=>{skipNextHashRender=false},0);
  }
  render();
  window.scrollTo({top:0});
}
addEventListener('hashchange',()=>{if(skipNextHashRender){skipNextHashRender=false;return}render()});

function render(){
  const tabsEl=$('#tabs'),viewEl=$('#view');
  if(!tabsEl||!viewEl)return;
  const r=route();
  syncUiModeAttr();
  const guided=isGuided();
  const mob=$('#mobTabs'),fab=$('#genyFab'),demoEl=$('#demo'),bellDotEl=$('#bellDot');
  if(guided){
    const pk=pillarOf(r);
    tabsEl.innerHTML=PILLARS.map(([k,l,i])=>`<button type="button" class="tab" data-go="${k}" ${k===pk?'aria-current="page"':''}>${ic(i)}<span>${l}</span>${k==='reto21'?`<span class="tab-badge">${S.reto.hechos.length}/21</span>`:''}</button>`).join('');
    if(mob){
      mob.hidden=false;
      mob.innerHTML=PILLARS.map(([k,l,i])=>`<button type="button" class="mob-tab" data-go="${k}" ${k===pk?'aria-current="page"':''}>${ic(i)}<span>${l}</span></button>`).join('');
    }
    if(fab)fab.hidden=(r==='geny');
    if(demoEl)demoEl.hidden=!S.ejemplo||(r==='inicio'&&!S.onboarded);
    const backBtn=r==='geny'?'<div style="margin:14px 0 0"><button type="button" class="btn sm ghost" data-go="inicio">← Volver al inicio</button></div>':'';
    viewEl.innerHTML=r==='inicio'?subnavHtml(r)+inicioGuided():backBtn+subnavHtml(r)+VIEWS[r]();
  }else{
    tabsEl.innerHTML=TABS.map(([k,l,i])=>`<button type="button" class="tab" data-go="${k}" ${k===r?'aria-current="page"':''}>${ic(i)}${l}</button>`).join('');
    if(mob)mob.hidden=true;
    if(fab)fab.hidden=true;
    if(demoEl)demoEl.hidden=!S.ejemplo;
    viewEl.innerHTML=VIEWS[r]();
  }
  if(bellDotEl)bellDotEl.hidden=!avisos().length;
  document.querySelectorAll('#tabs [aria-current="page"], .subnav [aria-current="page"]').forEach(el=>{
    try{el.scrollIntoView({block:'nearest',inline:'nearest',container:'nearest'})}
    catch(_){el.scrollIntoView({block:'nearest',inline:'nearest'})}
  });
  if(r==='geny')afterChat();
  if(r==='reto21')rkMaybe();
  if(r==='opciones')opcDraw();
  if(r==='replay')mountReplay();else if(typeof CH!=='undefined'&&CH){stopPlay();try{CH.chart.remove()}catch(e){}CH=null}
}

/* ---------- vistas ---------- */
const BOT=`<svg viewBox="0 0 300 320" aria-label="Geny, tu mentora" role="img">
<defs><radialGradient id="hd" cx="40%" cy="30%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#C9D3DC"/></radialGradient><linearGradient id="vz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B2733"/><stop offset="1" stop-color="#05090D"/></linearGradient></defs>

<line x1="150" y1="40" x2="150" y2="72" stroke="#C9D3DC" stroke-width="8"/><circle cx="150" cy="32" r="15" fill="#2FA8FF"/><circle cx="145" cy="27" r="5" fill="#BFE6FF"/>
<rect x="88" y="190" width="124" height="90" rx="40" fill="url(#hd)"/><path d="M150 214l20 40h-11l-9-18-9 18h-11z" fill="#8CFF2E"/>
<rect x="56" y="68" width="188" height="150" rx="62" fill="url(#hd)"/><circle cx="58" cy="143" r="20" fill="#DDE4EA" stroke="#8CFF2E" stroke-width="5"/><circle cx="242" cy="143" r="20" fill="#DDE4EA" stroke="#8CFF2E" stroke-width="5"/>
<rect x="80" y="92" width="140" height="104" rx="44" fill="url(#vz)"/>
<g class="eyes"><ellipse cx="122" cy="135" rx="15" ry="17" fill="#22E6FF"/><ellipse cx="178" cy="135" rx="15" ry="17" fill="#22E6FF"/></g>
<path d="M128 166q22 18 44 0" stroke="#22E6FF" stroke-width="7" fill="none" stroke-linecap="round"/>
<path d="M232 230l40-46" stroke="#8CFF2E" stroke-width="5" stroke-linecap="round"/><path d="M258 182h16v16" stroke="#8CFF2E" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`;

const BOT_PRO=`<svg viewBox="0 0 120 120" aria-label="Geny AI" role="img">
<defs>
  <linearGradient id="gpBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#141D26"/><stop offset="100%" stop-color="#080C11"/></linearGradient>
  <linearGradient id="gpShell" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#243140"/><stop offset="55%" stop-color="#131B24"/><stop offset="100%" stop-color="#0B1017"/></linearGradient>
  <linearGradient id="gpVisor" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#05080C"/><stop offset="50%" stop-color="#0A1318"/><stop offset="100%" stop-color="#05080C"/></linearGradient>
</defs>
<rect x="4" y="4" width="112" height="112" rx="22" fill="url(#gpBg)" stroke="#243242" stroke-width="1.2"/>
<path d="M18 14h10M92 14h10M18 106h10M92 106h10" stroke="#33465A" stroke-width="1.2" stroke-linecap="round"/>
<path d="M40 24h40l14 16v30l-12 16H38L26 70V40z" fill="url(#gpShell)" stroke="#384B61" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M44 24v8h32v-8" fill="none" stroke="#2C3D50" stroke-width="1"/>
<rect x="31" y="44" width="58" height="18" rx="4" fill="url(#gpVisor)" stroke="#7CE828" stroke-opacity=".42" stroke-width="1"/>
<path class="gp-wave" d="M36 53h11l3.5-5 4.5 10 4-7 3.5 4 3-2H84" fill="none" stroke="#7CE828" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="36" cy="53" r="1.6" fill="#7CE828"/><circle cx="84" cy="53" r="1.6" fill="#38BDF8"/>
<path d="M36 86l8 14h32l8-14" fill="#0E151D" stroke="#28384A" stroke-width="1.1"/>
<path d="M60 89l6.5 11h-3.6L60 95l-2.9 5h-3.6z" fill="#7CE828"/><path d="M60 95l2.9 5h-5.8z" fill="#3E8F00"/>
</svg>`;

function ring(p,size=150,sw=16){const r=(size-sw)/2,c=2*Math.PI*r,pro=isGuided(),id=pro?'rgPro':'rg';return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="#1B2631" stroke-width="${sw}" fill="none"/><circle cx="${size/2}" cy="${size/2}" r="${r}" stroke="url(#${id})" stroke-width="${sw}" fill="none" stroke-linecap="round" stroke-dasharray="${c*p/100} ${c}"/><defs><linearGradient id="${id}"><stop offset="0" stop-color="${pro?'#10B981':'#C8FF2E'}"/><stop offset="1" stop-color="${pro?'#7CE828':'#3FD800'}"/></linearGradient></defs></svg>`}
const AREAS=[['fin','Finanzas','bars','var(--profit)'],['tra','Trading','candles','var(--violet)'],['men','Mentalidad','lotus','var(--cyan)'],['hab','Hábitos','bolt','var(--amber)']];
const areaBars=s=>AREAS.map(([k,l,i,c])=>`<div class="area"><div class="lbl"><span style="color:${c}">${ic(i)}<span style="color:var(--fg)">${l}</span></span><span class="num">${s[k]}%</span></div><div class="bar"><i style="width:${s[k]}%;background:${c}"></i></div></div>`).join('');
const PEDEM=[['planear','Planear','Definir mi plan de la semana'],['ejecutar','Ejecutar','Operar según mi estrategia'],['documentar','Documentar','Registrar mis operaciones'],['evaluar','Evaluar','Analizar mis resultados'],['mejorar','Mejorar','Ajustar y optimizar']];
const pedemList=()=>`<ul class="pedem">${PEDEM.map(([k,l,d])=>`<li><button data-act="pedem" data-k="${k}" aria-pressed="${!!S.pedem[k]}"><span class="chk ${S.pedem[k]?'on':''}">${S.pedem[k]?ic('ok','',3):''}</span><span><b>${l}</b> – ${d}</span></button></li>`).join('')}</ul>`;
const DAREAS=[['finanzas','Mis finanzas personales','wallet','var(--amber)'],['inversiones','Mis inversiones','bars','var(--profit)'],['trading','Mi trading','candles','var(--blue)'],['mentalidad','Mi mentalidad y hábitos','lotus','var(--magenta)'],['metas','Mis metas financieras','target','var(--violet)']];

function inicioGuided(){
  const s=scores(),d=retoDia(),f=finanzas(),t=tstats(),hoy=today();
  const tradesHoy=S.trades.filter(x=>x.fecha===hoy).length,movsHoy=S.movs.filter(x=>x.fecha===hoy).length;
  const demoBar=(S.ejemplo&&!S.onboarded)?`
    <section class="panel g-demo-bar" aria-label="Modo demostración">
      <div>
        <span class="g-eyebrow">ENTORNO DE DEMOSTRACIÓN</span>
        <strong>Estás visualizando registros simulados para evaluar la terminal.</strong>
        <span class="muted" style="font-size:13px">Inicializa tu cuenta en limpio antes de registrar operaciones o capital real.</span>
      </div>
      <div class="inline">
        <button type="button" class="btn sm" data-act="startFresh">Inicializar cuenta en cero</button>
        <button type="button" class="btn sm ghost" data-act="keepDemo">Mantener vista demo</button>
      </div>
    </section>`:'';

  const isSetup=!S.diag.hecho||(!S.ejemplo&&S.movs.length===0&&S.trades.length===0);
  let roadTitle='',roadDone=0,steps=[];
  if(isSetup){
    const d1=!!S.diag.hecho;
    const d2=!S.ejemplo&&(S.movs.length>0||S.trades.length>0);
    const d3=!S.ejemplo&&S.reto.hechos.length>0;
    roadDone=(d1?1:0)+(d2?1:0)+(d3?1:0);
    roadTitle='PROTOCOLO DE CONFIGURACIÓN';
    steps=[
      {done:d1,tag:'01 · CALIBRACIÓN',t:'Perfil de riesgo y metas',p:d1?'Parámetros calibrados. Puedes recalibrar en cualquier momento.':'Define experiencia, reglas base y objetivo financiero medible (1 min).',btn:`<button type="button" class="btn sm ${d1?'ghost':''}" data-act="diag">${d1?'Recalibrar perfil':'Calibrar perfil'}</button>`},
      {done:d2,tag:'02 · LÍNEA BASE',t:'Flujo de capital o bitácora',p:d2?'Registros base detectados en cuenta.':'Registra tu capital operativo en Finanzas o documenta tu primera ejecución.',btn:`<div class="inline"><button type="button" class="btn sm ${d1&&!d2?'':'ghost'}" data-go="dinero">Finanzas</button><button type="button" class="btn sm ghost" data-act="nuevoTrade">+ Operación</button></div>`},
      {done:d3,tag:`03 · CONSISTENCIA · DÍA ${d}/21`,t:`Sesión ${d} del Reto 21`,p:esc(MISIONES[d-1]),btn:`<button type="button" class="btn sm ${d1&&d2&&!d3?'':'ghost'}" data-go="reto21">Abrir Reto 21</button>`}
    ];
  }else{
    const c1=!!S.checks[hoy],c2=tradesHoy>0||movsHoy>0,c3=S.reto.hechos.includes(hoy);
    roadDone=(c1?1:0)+(c2?1:0)+(c3?1:0);
    roadTitle='PROTOCOLO DE SESIÓN DIARIA';
    steps=[
      {done:c1,tag:'01 · PRE-MERCADO',t:'Estado cognitivo y reglas',p:c1?`Check-in validado hoy (control ${S.checks[hoy]?.control||'–'}/5).`:'Evalúa ánimo, energía y control emocional antes de abrir gráficos.',btn:`<button type="button" class="btn sm ${c1?'ghost':''}" data-go="mentalidad">${c1?'Ver registro':'Hacer check-in'}</button>`},
      {done:c2,tag:'02 · EJECUCIÓN',t:'Bitácora y flujo diario',p:c2?`${tradesHoy} operaci${tradesHoy===1?'ón':'ones'} y ${movsHoy} movimiento(s) hoy.`:'Documenta entradas, salidas, múltiplo R y apego al plan de trading.',btn:`<div class="inline"><button type="button" class="btn sm ${c1&&!c2?'':'ghost'}" data-act="nuevoTrade">+ Operación</button><button type="button" class="btn sm ghost" data-go="dinero">+ Finanzas</button></div>`},
      {done:c3,tag:`03 · CIERRE · DÍA ${d}/21`,t:'Revisión post-mercado',p:c3?'Sesión de hoy auditada y cerrada.':esc(MISIONES[d-1]),btn:`<button type="button" class="btn sm ${c1&&c2&&!c3?'':'ghost'}" data-go="reto21">${c3?'Ver bitácora':'Cerrar día '+d}</button>`}
    ];
  }
  const curIdx=steps.findIndex(x=>!x.done);
  const brief=!S.diag.hecho
    ?'Perfil técnico pendiente de calibración. Completa el diagnóstico inicial para parametrizar tu gestión de riesgo y objetivos.'
    :t.n>0
      ?`Bitácora activa: ${t.n} operaciones con ${(t.plan*100).toFixed(0)}% de apego al plan y expectativa de ${money(+t.exp.toFixed(2))} por trade. ${S.checks[hoy]?'Check-in pre-mercado validado hoy.':'Pendiente validar check-in pre-mercado de hoy.'}`
      :'Cuenta inicializada en limpio. Registra tu línea base en Finanzas o documenta tu primera ejecución en Bitácora.';

  return `<div class="g-home">
    ${demoBar}
    <div class="g-topbar">
      <div>
        <span class="g-eyebrow">TERMINAL OPERATIVA · ${hoy}${S.ejemplo?' · DEMO':''}</span>
        <h1>Panel de ${esc(S.nombre)}</h1>
      </div>
      <div class="inline">
        <button type="button" class="btn sm ghost" data-go="dinero">${ic('wallet')}Registrar flujo</button>
        <button type="button" class="btn sm" data-act="nuevoTrade">${ic('candles')}Nueva operación</button>
      </div>
    </div>

    <div class="g-ribbon">
      <div class="g-kpi"><span class="g-eyebrow">P&amp;L NETO BITÁCORA</span><b class="num ${t.total>=0?'up':'down'}">${money(+t.total.toFixed(2))}</b><small class="num">${t.n} ops · WR ${(t.wr*100).toFixed(0)}%</small></div>
      <div class="g-kpi"><span class="g-eyebrow">DISCIPLINA &amp; FACTOR</span><b class="num">${(t.plan*100).toFixed(0)}%</b><small class="num">PF ${t.pf===Infinity?'∞':t.pf.toFixed(2)} · Exp ${money(+t.exp.toFixed(2))}</small></div>
      <div class="g-kpi"><span class="g-eyebrow">LIQUIDEZ DISPONIBLE</span><b class="num ${f.bal<0?'down':'up'}">${money(Math.round(f.bal))}</b><small class="num">Tasa ahorro ${(f.tasa*100).toFixed(1)}%</small></div>
      <div class="g-kpi"><span class="g-eyebrow">PROTOCOLO RETO 21</span><b class="num">Día ${d}/21</b><small class="num">${S.reto.hechos.length} sesiones cerradas</small></div>
    </div>

    <section class="panel g-copilot" aria-label="Geny AI Co-Pilot">
      <div class="g-copilot-avatar">${BOT_PRO}</div>
      <div class="g-copilot-body">
        <div class="g-copilot-head">
          <span class="g-eyebrow"><i class="g-led"></i>GENY AI · CO-PILOT CUANTITATIVO</span>
          <button type="button" class="btn sm ghost" data-act="openGeny">Abrir consola IA</button>
        </div>
        <p class="g-copilot-brief">${esc(brief)}</p>
        <form class="g-copilot-form" id="gQuickGeny">
          <input id="gQuickQ" type="text" placeholder="Consulta a Geny AI sobre riesgo, métricas, opciones o registra una operación…" aria-label="Consulta rápida para Geny AI">
          <button type="submit" class="btn sm">Analizar</button>
        </form>
      </div>
    </section>

    <section class="panel glow">
      <div class="g-roadmap-head">
        <span class="g-eyebrow">${roadTitle}</span>
        <span class="tag up num">${roadDone}/3 completados</span>
      </div>
      <div class="g-steps">
        ${steps.map((st,i)=>`<div class="g-step ${st.done?'done':i===curIdx?'cur':''}">
          <div>
            <div class="g-step-top"><span class="g-step-num">${st.done?'✓':'0'+(i+1)}</span><span class="g-eyebrow">${st.tag}</span></div>
            <h3>${st.t}</h3>
            <p>${st.p}</p>
          </div>
          <div>${st.btn}</div>
        </div>`).join('')}
      </div>
    </section>

    <div class="g-summary">
      <div class="panel">
        <div class="ph"><span class="g-eyebrow">ÍNDICE DE DESEMPEÑO INTEGRAL</span><button type="button" class="btn sm ghost" data-go="progreso">Ciclo PEDEM →</button></div>
        <div class="ringwrap"><div class="ring">${ring(s.gen,132,12)}<b>${s.gen}%</b></div><div class="areas">${areaBars(s)}</div></div>
      </div>
      <div class="panel">
        <div class="ph"><span class="g-eyebrow">MÓDULOS DE ANÁLISIS Y EJECUCIÓN</span></div>
        <div class="g-tools">
          <button type="button" class="g-mod-btn" data-go="radar">${ic('radar')}<span><b>Radar de Mercado</b><small>Tendencia multi-marco y VR</small></span></button>
          <button type="button" class="g-mod-btn" data-go="opciones">${ic('payoff')}<span><b>Estrategias Opciones</b><small>Black-Scholes y griegas</small></span></button>
          <button type="button" class="g-mod-btn" data-go="replay">${ic('play')}<span><b>Market Replay</b><small>Simulación y Volume Profile</small></span></button>
          <button type="button" class="g-mod-btn" data-go="metas">${ic('target')}<span><b>Objetivos Capital</b><small>${S.metas.length} meta(s) activas</small></span></button>
        </div>
      </div>
    </div>
  </div>`;
}

const VIEWS={
inicio(){
  const s=scores(),d=retoDia(),pr=Math.round(S.reto.hechos.length/21*100);
  const paso=S.diag.hecho?5:S.diag.paso;
  return `<div class="home">
  <aside class="side left">
    <p class="tagline">Tu mentora inteligente de inteligencia financiera, trading y alto rendimiento.</p>
    <div class="bot">${BOT}</div>
    <div class="pills">
      ${[['Aprende','cap','geny'],['Mide','bars','progreso'],['Planifica','cal','metas'],['Mejora','trophy','mentalidad'],['Ejecuta','play','trading'],['Evoluciona','inf','progreso']].map(([l,i,g])=>`<button type="button" class="pill" data-go="${g}">${ic(i)}${l}</button>`).join('')}
    </div>
  </aside>
  <section class="center">
    <div class="hello">
      <div><h1>¡Hola, ${esc(S.nombre)}!</h1><p>Soy Geny, tu mentora de inteligencia financiera. ¿Qué quieres hacer hoy?</p></div>
      <button type="button" class="panel glow reto" data-go="reto21" aria-label="Abrir la bitácora del Reto 21">${ic('cal','cal')}<span class="rt"><h3>Reto 21</h3><span class="muted" style="color:#C7D3DE">Día ${d} de 21</span><span class="row"><span class="bar"><i style="width:${pr}%;background:var(--lime)"></i></span><b class="num">${pr}%</b></span></span>${ic('chev','',2)}</button>
    </div>
    <div class="actions">
      <button type="button" class="act" style="--c:#6A4BFF" data-go="geny">${ic('chat')}Conversar con Geny</button>
      <button type="button" class="act" style="--c:#19C93A" data-act="nuevoTrade">${ic('candles')}Registrar operación</button>
      <button type="button" class="act" style="--c:#E0A400" data-go="dinero">${ic('wallet')}Actualizar mis finanzas</button>
      <button type="button" class="act" style="--c:#1487E8" data-act="avanzarPlan">${ic('clip')}Avanzar en mi plan</button>
      <button type="button" class="act" style="--c:#9B2BE0" data-go="metas">${ic('target')}Revisar mis metas</button>
    </div>
    <div class="duo">
      <div class="panel"><div class="ph"><h2>Mi progreso general</h2><button type="button" class="chev" data-go="progreso" aria-label="Ver progreso">${ic('chev','',2)}</button></div>
        <div class="ringwrap"><div class="ring">${ring(s.gen)}<b>${s.gen}%</b></div><div class="areas">${areaBars(s)}</div></div></div>
      <div class="panel"><div class="ph"><h2>Mi plan actual (PEDEM)</h2><button type="button" class="chev" data-go="progreso" aria-label="Ver plan">${ic('chev','',2)}</button></div>${pedemList()}</div>
    </div>
    <div class="mods">
      ${[['dinero','Mi Dinero','Organiza, ahorra y fortalece tus finanzas','db','#00FF94'],['trading','Mi Trading','Estrategias, bitácora y métricas de desempeño','candles','#2FA8FF'],['mentalidad','Mi Mentalidad','Disciplina, enfoque y control emocional','lotus','#B04BFF'],['metas','Mis Metas','Define, planifica y da seguimiento','target','#D24BFF']].map(([g,t,p,i,c])=>`<button type="button" class="mod" style="--c:${c}" data-go="${g}">${ic(i,'ic')}${ic('chev','go',2.4)}<h3>${t}</h3><p>${p}</p></button>`).join('')}
    </div>
  </section>
  <aside class="side">
    <div class="panel glow diag">
      <h2>${ic('clip')}Diagnóstico inicial</h2>
      <div class="steps" aria-label="Paso ${Math.min(paso,4)} de 4">${[1,2,3,4].map(n=>`${n>1?'<i></i>':''}<span class="step ${n<paso?'done':n===paso?'cur':''}">${n<paso?'✓':n}</span>`).join('')}</div>
      <p class="c">${S.diag.hecho?'Diagnóstico completo. Tu plan ya está personalizado.':'Conozcámonos mejor. Este diagnóstico me ayudará a personalizar tu plan.'}</p>
      <ul class="chklist">${DAREAS.map(([k,l,i,c])=>`<li><span style="color:${c}">${ic(i)}</span>${l}<span class="box ${S.diag.areas[k]?'on':''}" aria-label="${S.diag.areas[k]?'completo':'pendiente'}">${S.diag.areas[k]?ic('ok','',3):''}</span></li>`).join('')}</ul>
      <button type="button" class="btn" style="width:100%" data-act="diag">${S.diag.hecho?'Repetir diagnóstico':S.diag.paso>1?'Continuar diagnóstico':'Comenzar diagnóstico'}</button>
    </div>
    <div class="panel glow allin"><h3>${ic('up')}Todo en un solo lugar</h3><p>Educación, herramientas, seguimiento y acompañamiento con inteligencia artificial.</p></div>
  </aside></div>`;
},

geny(){
  if(isGuided()){
    return `<div class="vhead"><div class="inline" style="gap:12px;align-items:center"><div class="g-vhead-bot">${BOT_PRO}</div><div><span class="g-eyebrow">CONSOLA IA · INGRESARIOS</span><h1>Geny AI · Co-Pilot Operativo</h1><p>Análisis sobre tu bitácora, gestión de riesgo, estructura de opciones y finanzas.</p></div></div></div>
    <div class="chips">${['¿Qué patrón ves en mi bitácora?','¿Cómo voy con mi tasa de ahorro?','Dame mi plan PEDEM para esta semana','Registra un gasto de $45 en comida'].map(c=>`<button type="button" class="chip" data-act="chip">${c}</button>`).join('')}</div>
    <div class="panel chat"><div class="msgs" id="msgs">${S.chat.length?S.chat.map(m=>`<div class="msg ${m.role==='user'?'me':'g'}">${esc(m.content)}</div>`).join(''):`<div class="msg g">Sesión iniciada, ${esc(S.nombre)}. Veo ${S.trades.length} operaciones en bitácora y ${S.movs.length} movimientos registrados. ¿Qué analizamos hoy?</div>`}</div>
    <form class="compose" id="compose"><textarea id="q" placeholder="Escribe una consulta cuantitativa o pídeme registrar un movimiento/trade…" aria-label="Mensaje para Geny AI"></textarea><button type="submit" class="btn" id="send">Enviar</button></form></div>
    <p class="risk">Herramienta educativa. No constituye asesoría financiera personalizada ni recomendación de compra o venta; operar implica riesgo de pérdida.</p>`;
  }
  return `<div class="vhead"><div><h1>Mi Geny</h1><p>Pregúntame sobre tus finanzas, tu bitácora o tu mentalidad. Leo tus datos para darte respuestas concretas y puedo registrar operaciones, movimientos y metas por ti.</p></div></div>
  <div class="chips">${['¿Qué patrón ves en mi bitácora?','¿Cómo voy con mi tasa de ahorro?','Dame mi plan para esta semana','Registra un gasto de $45 en comida'].map(c=>`<button type="button" class="chip" data-act="chip">${c}</button>`).join('')}</div>
  <div class="panel chat"><div class="msgs" id="msgs">${S.chat.length?S.chat.map(m=>`<div class="msg ${m.role==='user'?'me':'g'}">${esc(m.content)}</div>`).join(''):`<div class="msg g">¡Hola, ${esc(S.nombre)}! Soy Geny. Veo ${S.trades.length} operaciones en tu bitácora y ${S.movs.length} movimientos de dinero. ¿Por dónde empezamos?</div>`}</div>
  <form class="compose" id="compose"><textarea id="q" placeholder="Escríbele a Geny…" aria-label="Mensaje para Geny"></textarea><button type="submit" class="btn" id="send">Enviar</button></form></div>
  <p class="risk">Geny es una herramienta educativa. No da recomendaciones de inversión personalizadas y operar implica riesgo de pérdida.</p>`;
},

dinero(){
  const f=finanzas(),cats={};S.movs.filter(m=>m.tipo==='gasto').forEach(m=>cats[m.cat]=(cats[m.cat]||0)+ +m.monto);
  const mx=Math.max(1,...Object.values(cats));
  return `<div class="vhead"><div><h1>Mi Dinero</h1><p>Registra ingresos, gastos y ahorro. La meta sana es ahorrar al menos el 20 % de lo que entra.</p></div></div>
  <div class="stats">
   <div class="stat"><div class="k">Ingresos</div><div class="v up">${money(f.ing)}</div></div>
   <div class="stat"><div class="k">Gastos</div><div class="v down">${money(f.gas)}</div></div>
   <div class="stat"><div class="k">Ahorro</div><div class="v">${money(f.aho)}</div></div>
   <div class="stat"><div class="k">Disponible</div><div class="v ${f.bal<0?'down':''}">${money(f.bal)}</div></div>
   <div class="stat"><div class="k">Tasa de ahorro</div><div class="v ${f.tasa>=.2?'up':''}">${(f.tasa*100).toFixed(1)}%</div></div>
  </div>
  <div class="grid2">
   <div class="panel"><div class="ph"><h2>Nuevo movimiento</h2></div>
    <form class="f" data-form="mov">
     <div class="seg" role="radiogroup" aria-label="Tipo">${['ingreso','gasto','ahorro'].map((t,i)=>`<label><input type="radio" name="tipo" value="${t}" ${i===1?'checked':''}><span>${t[0].toUpperCase()+t.slice(1)}</span></label>`).join('')}</div>
     <div class="r2"><label>Monto<input id="m-monto" name="monto" type="number" step="0.01" min="0" required placeholder="0.00"></label><label>Fecha<input id="m-fecha" name="fecha" type="date" value="${today()}"></label></div>
     <label>Categoría<input id="m-cat" name="cat" list="catlist" required placeholder="Comida, Vivienda, Salario…"></label>
     <datalist id="catlist">${['Salario','Trading','Vivienda','Comida','Transporte','Ocio','Educación','Salud','Deudas','Fondo emergencia','Inversión'].map(c=>`<option value="${c}">`).join('')}</datalist>
     <label>Nota<input id="m-nota" name="nota" placeholder="Opcional"></label>
     <button class="btn">Guardar movimiento</button>
    </form></div>
   <div style="display:grid;gap:18px;min-width:0">
    <div class="panel"><div class="ph"><h2>Gastos por categoría</h2></div>${Object.keys(cats).length?`<div class="cats">${Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<div class="area"><div class="lbl"><span>${esc(c)}</span><span class="num">${money(v)}</span></div><div class="bar"><i style="width:${v/mx*100}%;background:var(--amber)"></i></div></div>`).join('')}</div>`:'<div class="empty">Registra tu primer gasto y verás aquí en qué se va tu dinero.</div>'}</div>
    <div class="panel"><div class="ph"><h2>Movimientos</h2></div>${S.movs.length?`<div class="tbl"><table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Nota</th><th class="n">Monto</th><th></th></tr></thead><tbody>${[...S.movs].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(m=>`<tr><td class="num">${m.fecha}</td><td><span class="tag" style="color:${m.tipo==='ingreso'?'var(--profit)':m.tipo==='gasto'?'var(--loss)':'var(--cyan)'}">${m.tipo}</span></td><td>${esc(m.cat)}</td><td class="muted">${esc(m.nota)}</td><td class="n">${money(+m.monto)}</td><td><button class="x" data-act="del" data-col="movs" data-id="${m.id}" aria-label="Borrar">✕</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">Aún no hay movimientos.${isGuided()?'<div style="margin-top:10px"><button type="button" class="btn sm" data-act="focusInput" data-target="m-monto">Registrar primer movimiento</button></div>':''}</div>`}</div>
   </div></div>`;
},

trading(){
  const t=tstats();let acc=0;const eq=[0,...S.trades.slice().sort((a,b)=>a.fecha.localeCompare(b.fecha)).map(x=>acc+=pnl(x))];
  const mn=Math.min(...eq),mx=Math.max(...eq),W=600,H=140,pad=10;
  const pts=eq.map((v,i)=>`${pad+i*(W-2*pad)/Math.max(1,eq.length-1)},${H-pad-(v-mn)/((mx-mn)||1)*(H-2*pad)}`).join(' ');
  const emos={},tipos={};S.trades.forEach(x=>{emos[x.emo]=emos[x.emo]||{n:0,p:0};emos[x.emo].n++;emos[x.emo].p+=pnl(x);const k=tipoLbl(x);tipos[k]=tipos[k]||{n:0,w:0,p:0};tipos[k].n++;tipos[k].p+=pnl(x);if(pnl(x)>0)tipos[k].w++});
  return `<div class="vhead"><div><h1>Mi Trading</h1><p>Tu bitácora de operaciones. Documentar cada trade con su emoción es lo que convierte resultados en aprendizaje.</p></div><div class="inline"><button type="button" class="btn ghost" data-act="r21import">Importar Excel</button><button type="button" class="btn ghost" data-go="opciones">Simular estrategia de opciones</button><button type="button" class="btn ghost" data-go="replay">Practicar en replay</button><button type="button" class="btn" data-act="nuevoTrade">Registrar operación</button></div></div>
  <div class="stats">
   <div class="stat"><div class="k">P&amp;L total</div><div class="v ${t.total>=0?'up':'down'}">${money(+t.total.toFixed(2))}</div></div>
   <div class="stat"><div class="k">Win rate</div><div class="v">${(t.wr*100).toFixed(0)}%</div></div>
   <div class="stat"><div class="k">Profit factor</div><div class="v">${t.pf===Infinity?'∞':t.pf.toFixed(2)}</div></div>
   <div class="stat"><div class="k">Esperanza por trade</div><div class="v ${t.exp>=0?'up':'down'}">${money(+t.exp.toFixed(2))}</div></div>
   <div class="stat"><div class="k">Disciplina (siguió plan)</div><div class="v">${(t.plan*100).toFixed(0)}%</div></div>
  </div>
  <div class="duo" style="margin-bottom:18px">
   <div class="panel"><div class="ph"><h2>Curva de capital</h2><span class="muted num" style="font-size:13px">${t.n} operaciones</span></div>${t.n?`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="Curva de P&L acumulado"><line x1="0" x2="${W}" y1="${H-pad-(0-mn)/((mx-mn)||1)*(H-2*pad)}" y2="${H-pad-(0-mn)/((mx-mn)||1)*(H-2*pad)}" stroke="#2A3846" stroke-dasharray="4 4"/><polygon points="${pad},${H-pad} ${pts} ${W-pad},${H-pad}" fill="rgba(0,255,148,.08)"/><polyline points="${pts}" fill="none" stroke="var(--profit)" stroke-width="2.5"/><circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="5" fill="var(--profit)"/></svg>`:'<div class="empty">Tu curva aparece con la primera operación.</div>'}</div>
   <div class="panel"><div class="ph"><h2>Resultado por emoción</h2></div>${Object.keys(emos).length?`<div class="tbl"><table><thead><tr><th>Emoción</th><th class="n">Trades</th><th class="n">P&amp;L</th></tr></thead><tbody>${Object.entries(emos).sort((a,b)=>b[1].p-a[1].p).map(([e,v])=>`<tr><td>${esc(e)}</td><td class="n">${v.n}</td><td class="n ${v.p>=0?'up':'down'}">${money(+v.p.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sin datos todavía.</div>'}</div>
  </div>
  <div class="panel" style="margin-bottom:18px"><div class="ph"><h2>Resultado por tipo y estrategia</h2></div>${Object.keys(tipos).length?`<div class="tbl"><table><thead><tr><th>Tipo</th><th class="n">Trades</th><th class="n">Acierto</th><th class="n">P&amp;L</th></tr></thead><tbody>${Object.entries(tipos).sort((a,b)=>b[1].p-a[1].p).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="n">${v.n}</td><td class="n">${Math.round(v.w/v.n*100)}%</td><td class="n ${v.p>=0?'up':'down'}">${money(+v.p.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Sin datos todavía.</div>'}</div>
  <div class="panel"><div class="ph"><h2>Bitácora</h2></div>${S.trades.length?`<div class="tbl"><table><thead><tr><th>Fecha</th><th>Activo</th><th>Tipo</th><th>Dir.</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">Cant.</th><th>Setup</th><th>Plan</th><th>Emoción</th><th>Nota</th><th class="n">P&amp;L</th><th></th></tr></thead><tbody>${[...S.trades].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(x=>{const p=pnl(x);return `<tr><td class="num">${x.fecha}</td><td><b>${esc(x.activo)}</b></td><td style="min-width:120px">${esc(tipoLbl(x))}${x.tipo==='opciones'&&(x.strikes||x.venc)?`<br><span class="muted" style="font-size:12px">${esc([x.strikes,x.venc&&'vence '+x.venc].filter(Boolean).join(' · '))}</span>`:''}</td><td><span class="tag">${x.tipo==='opciones'?(x.dir==='short'?'Crédito':'Débito'):(x.dir==='long'?'Compra':'Venta')}</span></td><td class="n">${x.entrada??'—'}</td><td class="n">${x.salida??'—'}</td><td class="n">${x.cantidad}</td><td>${esc(x.setup)}</td><td>${x.plan?'<span class="up">Sí</span>':'<span class="down">No</span>'}</td><td>${esc(x.emo)}</td><td class="muted" style="min-width:160px">${esc(x.nota)}</td><td class="n ${p>=0?'up':'down'}">${money(+p.toFixed(2))}</td><td><button class="x" data-act="del" data-col="trades" data-id="${x.id}" aria-label="Borrar">✕</button></td></tr>`}).join('')}</tbody></table></div>`:`<div class="empty">Tu bitácora está vacía. Registra tu primera operación, aunque sea en simulador.${isGuided()?'<div style="margin-top:10px"><button type="button" class="btn sm" data-act="nuevoTrade">Registrar mi primera operación</button></div>':''}</div>`}</div>
  <p class="risk">Herramienta educativa. Los resultados pasados no garantizan resultados futuros; operar implica riesgo de pérdida de capital.</p>`;
},

metas(){
  return `<div class="vhead"><div><h1>Mis Metas</h1><p>Una meta clara tiene monto, fecha y un número que puedes mover cada semana.</p></div></div>
  <div class="grid2">
   <div class="panel"><div class="ph"><h2>Nueva meta</h2></div><form class="f" data-form="meta">
    <label>¿Qué quieres lograr?<input id="g-titulo" name="titulo" required placeholder="Ej.: Fondo de emergencia de 6 meses"></label>
    <label>Área<select id="g-area" name="area">${['Finanzas','Trading','Inversiones','Mentalidad','Hábitos'].map(a=>`<option>${a}</option>`).join('')}</select></label>
    <div class="r2"><label>Objetivo<input id="g-obj" name="objetivo" type="number" min="1" step="any" required></label><label>Avance actual<input id="g-act" name="actual" type="number" min="0" step="any" value="0"></label></div>
    <label>Fecha límite<input id="g-fecha" name="fecha" type="date" value="${daysAgo(-90)}"></label>
    <button class="btn">Crear meta</button></form></div>
   <div>${S.metas.length?`<div class="goals">${S.metas.map(m=>{const p=clamp(m.actual/m.objetivo*100),dl=Math.ceil((new Date(m.fecha)-new Date(today()))/864e5);return `<div class="goal"><div class="t"><div><span class="tag">${esc(m.area)}</span><h3 style="margin-top:6px">${esc(m.titulo)}</h3></div><button class="x" data-act="del" data-col="metas" data-id="${m.id}" aria-label="Borrar meta">✕</button></div>
     <div class="lbl area"><div class="lbl"><span class="num">${(+m.actual).toLocaleString('es-CO')} / ${(+m.objetivo).toLocaleString('es-CO')}</span><span class="num">${p}%</span></div><div class="bar"><i style="width:${p}%;background:${p>=100?'var(--profit)':'var(--magenta)'}"></i></div></div>
     <span class="muted" style="font-size:13px">${p>=100?'¡Meta cumplida!':dl>=0?`Faltan ${dl} días`:`Venció hace ${-dl} días`}</span>
     <div class="inline"><input type="number" step="any" id="upd-${m.id}" aria-label="Nuevo avance" placeholder="Nuevo avance"><button class="btn sm ghost" data-act="updMeta" data-id="${m.id}">Actualizar avance</button></div></div>`}).join('')}</div>`:`<div class="empty">Crea tu primera meta. Empieza por una que puedas medir esta semana.${isGuided()?'<div style="margin-top:10px"><button type="button" class="btn sm" data-act="focusInput" data-target="g-titulo">Crear mi primera meta</button></div>':''}</div>`}</div>
  </div>`;
},

mentalidad(){
  const c=S.checks[today()]||{animo:0,energia:0,control:0,h:{}};
  const H=[['rutina','Rutina matutina completa'],['plan','Revisé mi plan antes de operar'],['bitacora','Llené mi bitácora'],['ejercicio','Hice ejercicio'],['lectura','Leí 20 minutos'],['impulso','No operé por impulso']];
  const sc=(k,l)=>`<div class="q"><span>${l}</span><div class="scale" role="group" aria-label="${l}">${[1,2,3,4,5].map(n=>`<button data-act="score" data-k="${k}" data-n="${n}" aria-pressed="${c[k]===n}">${n}</button>`).join('')}</div></div>`;
  return `<div class="vhead"><div><h1>Mi Mentalidad</h1><p>Un check-in de un minuto antes de abrir la plataforma. Tu estado define tu ejecución.</p></div></div>
  <div class="grid2">
   <div class="panel"><div class="ph"><h2>Check-in de hoy</h2><span class="muted num" style="font-size:13px">${today()}</span></div>
    ${sc('animo','Estado de ánimo')}${sc('energia','Energía')}${sc('control','Control emocional')}</div>
   <div class="panel"><div class="ph"><h2>Hábitos de alto rendimiento</h2></div><div class="habits">${H.map(([k,l])=>`<button class="habit" data-act="habit" data-k="${k}" aria-pressed="${!!c.h[k]}"><span class="chk ${c.h[k]?'on':''}">${c.h[k]?ic('ok','',3):''}</span>${l}</button>`).join('')}</div></div>
  </div>
  <div class="panel" style="margin-top:18px"><div class="ph"><h2>Sesiones guiadas</h2><span class="muted" style="font-size:13px">${(()=>{const w=(S.sesiones||[]).filter(x=>lastDays(7).includes(x.fecha));return w.length?`Esta semana: ${Math.round(w.reduce((a,x)=>a+x.seg,0)/60)} min en ${w.length} sesiones`:'Aún no practicas esta semana'})()}</span></div>
   <div class="sesiones">${Object.entries(SESIONES).map(([k,s])=>`<button class="sesion" data-act="sesion" data-k="${k}"><b>${s.t}</b><span>${s.d}</span><span class="go">Empezar</span></button>`).join('')}</div>
   <p class="hint" style="margin-top:12px">La respiración lenta y el ensayo mental son prácticas comunes en alto rendimiento para bajar la reactividad emocional. Úsalas antes de abrir la plataforma y después de una pérdida.</p></div>
  <div class="panel" style="margin-top:18px"><div class="ph"><h2>Últimos 7 días</h2><span class="muted" style="font-size:13px">Control emocional y hábitos cumplidos</span></div>
   <div class="week">${lastDays(7).map(d=>{const x=S.checks[d];return `<div class="day" style="${x?'border-color:rgba(192,75,255,.6)':''}">${new Date(d+'T12:00').toLocaleDateString('es',{weekday:'short'})}<b>${x?x.control||'–':'–'}</b><span class="muted">${x?Object.values(x.h).filter(Boolean).length+'/6':''}</span></div>`}).join('')}</div></div>`;
},

progreso(){
  const s=scores(),done=S.reto.hechos.includes(today()),d=retoDia();
  return `<div class="vhead"><div><h1>Mi Progreso</h1><p>Lo que se mide, se mejora. Estas cifras salen de lo que registras en cada módulo.</p></div></div>
  <div class="duo">
   <div class="panel"><div class="ph"><h2>Progreso general</h2></div><div class="ringwrap"><div class="ring">${ring(s.gen)}<b>${s.gen}%</b></div><div class="areas">${areaBars(s)}</div></div>
    <p class="muted" style="font-size:13px;margin:14px 0 0">Finanzas: tasa de ahorro y constancia de registro. Trading: disciplina con el plan y bitácora completa. Mentalidad: tus check-ins. Hábitos: hábitos cumplidos en 7 días.</p></div>
   <div class="panel"><div class="ph"><h2>Plan PEDEM de la semana</h2><button type="button" class="btn sm ghost" data-act="pedemReset">Nueva semana</button></div>${pedemList()}</div>
  </div>
  <div class="panel" style="margin-top:18px"><div class="ph"><h2>Reto 21</h2><span class="num muted">${S.reto.hechos.length}/21 misiones</span></div>
   <div class="days21">${Array.from({length:21},(_,i)=>`<div class="d21 ${i<S.reto.hechos.length?'on':i===S.reto.hechos.length&&!done?'today':''}" title="${esc(MISIONES[i])}">${i+1}</div>`).join('')}</div>
   ${S.reto.hechos.length>=21?`<div class="mission"><h3>¡Reto 21 completado! 🏆</h3><p>Terminaste las 21 misiones. Ahora repite el ciclo PEDEM con metas más grandes.</p><button type="button" class="btn ghost sm" data-act="retoReset">Reiniciar reto</button></div>`:
   `<div class="mission"><h3>Misión del día ${d}</h3><p>${esc(MISIONES[d-1])}</p>${done?'<span class="up">Misión de hoy completada. Vuelve mañana por la siguiente.</span>':`<button type="button" class="btn" data-go="reto21">Abrir el día ${d} en la bitácora</button>`}</div>`}</div>`;
}};

/* ---------- modales ---------- */
function modal(html){$('#modalRoot').innerHTML=`<div class="modal" data-act="closeBg"><div class="panel" role="dialog" aria-modal="true">${html}</div></div>`;setTimeout(()=>$('#modalRoot input,#modalRoot button')?.focus(),30)}
function closeModal(){$('#modalRoot').innerHTML=''}
const TIPOS=[['acciones','Acciones'],['futuros','Futuros'],['opciones','Opciones']];
const ESTRATEGIAS=[['Compra de call','d'],['Compra de put','d'],['Venta de put (cash secured)','c'],['Covered call','c'],['Bull call spread','d'],['Bear put spread','d'],['Bull put spread','c'],['Bear call spread','c'],['Iron condor','c'],['Iron butterfly','c'],['Long straddle','d'],['Short straddle','c'],['Long strangle','d'],['Short strangle','c'],['Butterfly','d'],['Calendar spread','d'],['Diagonal spread','d'],['Collar','d'],['Otra de débito','d'],['Otra de crédito','c']];
const FUT_MULT={MES:5,ES:50,MNQ:2,NQ:20,MYM:.5,YM:5,M2K:5,RTY:50,MCL:100,CL:1000,MGC:10,GC:100,SI:5000,NG:10000,ZB:1000,ZN:1000,'6E':125000};
const futMult=a=>{a=String(a||'').toUpperCase().replace(/^\//,'');const k=Object.keys(FUT_MULT).sort((x,y)=>y.length-x.length).find(k=>a.startsWith(k));return k?FUT_MULT[k]:''};
const tipoLbl=x=>x.tipo==='opciones'?`Opciones · ${x.estrategia||'Otra'}`:x.tipo==='futuros'?'Futuros':'Acciones';
function tradeModal(fechaPre){
  modal(`<div class="ph"><h2>Registrar operación</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></div>
  <form class="f" data-form="trade" id="tradeForm">
   <div class="seg" role="radiogroup" aria-label="Tipo de inversión">${TIPOS.map(([v,l],i)=>`<label><input type="radio" name="tipo" value="${v}" ${i===0?'checked':''}><span>${l}</span></label>`).join('')}</div>
   <div class="r2"><label>Activo<input id="t-activo" name="activo" required placeholder="SPY, AAPL, ES, NQ…"></label><label>Fecha<input id="t-fecha" name="fecha" type="date" value="${fechaPre||today()}"></label></div>
   <div class="f for-opc" hidden>
    <label>Estrategia<select id="t-estr" name="estrategia">${ESTRATEGIAS.map(([n,k])=>`<option value="${n}">${n} (${k==='c'?'crédito':'débito'})</option>`).join('')}</select></label>
    <div class="r2"><label>Vencimiento<input id="t-venc" name="venc" type="date"></label><label>Strikes<input id="t-strikes" name="strikes" placeholder="Ej.: 495/490"></label></div>
   </div>
   <div class="seg for-dir" role="radiogroup" aria-label="Dirección"><label><input type="radio" name="dir" value="long" checked><span>Compra (long)</span></label><label><input type="radio" name="dir" value="short"><span>Venta (short)</span></label></div>
   <div class="r2"><label><span id="l-e">Precio de entrada</span><input id="t-e" name="entrada" type="number" step="any" required></label><label><span id="l-s">Precio de salida</span><input id="t-s" name="salida" type="number" step="any" required></label></div>
   <label class="for-stop">Stop (opcional, para medir la operación en R)<input id="t-stop" name="stop" type="number" step="any"></label>
   <div class="r2"><label><span id="l-q">Cantidad (acciones)</span><input id="t-q" name="cantidad" type="number" step="any" min="0" value="1" required></label><label class="for-mult" hidden><span id="l-m">Valor del punto ($)</span><input id="t-mult" name="mult" type="number" step="any" min="0"></label></div>
   <p class="hint" id="t-hint" hidden></p>
   <div class="r2"><label>Setup<select id="t-setup" name="setup">${['Geny Trend','Reditum Sniper','Ruptura','Reversión','Otro'].map(x=>`<option>${x}</option>`).join('')}</select></label><label>Emoción al entrar<select id="t-emo" name="emo">${['Calma','Confianza','Ansiedad','FOMO','Miedo','Revancha'].map(x=>`<option>${x}</option>`).join('')}</select></label></div>
   <label>¿Seguiste tu plan?<select id="t-plan" name="plan"><option value="1">Sí</option><option value="0">No</option></select></label>
   <label>Nota para tu bitácora<textarea id="t-nota" name="nota" placeholder="¿Por qué entraste? ¿Qué harías distinto?"></textarea></label>
   <button class="btn">Guardar en bitácora</button></form>`);
  syncTradeForm();
}
function syncTradeForm(){
  const f=$('#tradeForm');if(!f)return;
  const tipo=f.querySelector('input[name=tipo]:checked').value,m=$('#t-mult');
  f.querySelector('.for-opc').hidden=tipo!=='opciones';
  f.querySelector('.for-dir').hidden=tipo==='opciones';
  f.querySelector('.for-mult').hidden=tipo==='acciones';
  f.querySelector('.for-stop').hidden=tipo==='opciones';
  $('#l-e').textContent=tipo==='opciones'?'Prima de entrada':'Precio de entrada';
  $('#l-s').textContent=tipo==='opciones'?'Prima de salida':'Precio de salida';
  $('#l-q').textContent={acciones:'Cantidad (acciones)',futuros:'Contratos',opciones:'Contratos'}[tipo];
  $('#l-m').textContent=tipo==='opciones'?'Multiplicador':'Valor del punto ($)';
  if(tipo==='futuros'&&(!m.value||m.dataset.auto)){const v=futMult($('#t-activo').value);m.value=v;m.dataset.auto=v?'1':'';m.placeholder='ES = 50, MES = 5'}
  if(tipo==='opciones'&&(!m.value||m.dataset.auto)){m.value=100;m.dataset.auto='1'}
  const credito=tipo==='opciones'&&(ESTRATEGIAS.find(([n])=>n===$('#t-estr').value)||[])[1]==='c';
  const h=$('#t-hint');h.hidden=tipo==='acciones';
  h.textContent=tipo==='futuros'?'El P&L se calcula como puntos × valor del punto × contratos.'
    :credito?'Estrategia de crédito: la entrada es la prima neta que recibiste y la salida lo que pagaste al cerrar (0 si expiró sin valor). Se multiplica × 100 por contrato.'
    :'Estrategia de débito: la entrada es la prima neta que pagaste y la salida lo que recibiste al cerrar (0 si expiró sin valor). Se multiplica × 100 por contrato.';
}
document.addEventListener('change',e=>{const t=e.target instanceof Element?e.target:null;if(t?.closest('#tradeForm'))syncTradeForm()});
document.addEventListener('input',e=>{if(e.target.id==='t-activo')syncTradeForm();if(e.target.id==='t-mult')e.target.dataset.auto=''});
const DQ=[
 {t:'Mis finanzas personales',a:['finanzas'],qs:[['registro','¿Llevas registro de tus gastos?',['Nunca','A veces','Siempre']],['ahorro','¿Qué parte de tus ingresos ahorras?',['Nada','Menos del 10 %','10 a 20 %','Más del 20 %']],['fondo','¿Tienes fondo de emergencia?',['No','1 a 3 meses','Más de 3 meses']]]},
 {t:'Mis inversiones y mi trading',a:['inversiones','trading'],qs:[['exp','¿Cuánta experiencia tienes operando?',['Ninguna','Menos de 1 año','1 a 3 años','Más de 3 años']],['plan','¿Tienes un plan de trading escrito?',['No','Lo tengo en la cabeza','Sí, escrito']],['bit','¿Registras tus operaciones en una bitácora?',['No','A veces','Siempre']]]},
 {t:'Mi mentalidad y hábitos',a:['mentalidad'],qs:[['perdida','Después de una pérdida, normalmente…',['Busco recuperarla rápido','Me frustro y paro','La analizo con calma']],['rutina','¿Tienes rutina antes de operar?',['No','A veces','Todos los días']],['sueno','¿Cuántas horas duermes?',['Menos de 6','6 a 7','Más de 7']]]},
 {t:'Mis metas financieras',a:['metas'],meta:true}];
function diagModal(){
  if(S.diag.hecho){S.diag={paso:1,hecho:false,areas:{finanzas:false,inversiones:false,trading:false,mentalidad:false,metas:false},resp:{}};save()}
  const p=S.diag.paso,st=DQ[p-1];
  modal(`<div class="ph"><h2>Paso ${p} de 4 · ${st.t}</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></div>
  <form class="f" data-form="diag">${st.meta?`
   <label>¿Cuál es tu meta financiera principal?<input id="d-meta" name="titulo" required placeholder="Ej.: Vivir del trading a medio tiempo"></label>
   <div class="r2"><label>Monto objetivo<input id="d-monto" name="objetivo" type="number" min="1" step="any" required></label><label>¿Para cuándo?<input id="d-fecha" name="fecha" type="date" value="${daysAgo(-365)}"></label></div>`:
   st.qs.map(([k,q,os])=>`<div class="q"><span>${q}</span><div class="seg">${os.map((o,i)=>`<label><input type="radio" name="${k}" value="${i}" required ${S.diag.resp[k]==i?'checked':''}><span>${o}</span></label>`).join('')}</div></div>`).join('')}
   <div class="inline" style="justify-content:space-between">${p>1?'<button type="button" class="btn ghost sm" data-act="diagBack">Atrás</button>':'<span></span>'}<button class="btn">${p<4?'Siguiente':'Terminar diagnóstico'}</button></div></form>`);
}


/* ---------- sesiones guiadas de mentalidad ---------- */
const SESIONES={
 caja:{t:'Respiración en caja',d:'3 min · calma el sistema nervioso antes de operar',seg:180,fases:[['Inhala',4,1],['Sostén',4,1],['Exhala',4,0],['Sostén',4,0]]},
 visual:{t:'Visualización pre-mercado',d:'5 min · ensaya tu plan antes de abrir la plataforma',seg:300,fases:[['Inhala',5,1],['Exhala',5,0]],pasos:[
  'Siéntate cómodo, cierra los ojos y respira profundo tres veces.',
  'Visualiza tu plan de hoy: los niveles clave, tu setup y tu riesgo máximo.',
  'Imagina que el precio llega a tu zona. Ves la señal y ejecutas sin dudar.',
  'Imagina que la operación va en tu contra y toca tu stop. Lo aceptas con calma: es parte del plan.',
  'Imagina que llega a tu objetivo. Cierras según el plan, sin codicia.',
  'Repite tu frase ancla: "Opero mi plan, no mis emociones".',
  'Abre los ojos. Escribe en una línea tu intención para hoy.']},
 reset:{t:'Reset después de una pérdida',d:'2 min · corta la revancha antes de que empiece',seg:120,fases:[['Inhala',4,1],['Sostén',7,1],['Exhala',8,0]],pasos:[
  'Suelta el mouse y aléjate de la pantalla.',
  'Respira 4-7-8: el exhale largo baja las pulsaciones.',
  'Nombra lo que sientes: ¿frustración, miedo, rabia? Solo nómbralo.',
  'Pregúntate: ¿seguí mi plan? Si sí, fue una pérdida bien tomada.',
  'Decide: pausa por hoy o continúa solo con setups A+.']}};
let PL=null;
function startSesion(k){
  const s=SESIONES[k];if(!s)return;
  modal(`<div class="ph"><h2>${s.t}</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></div>
   <div class="breathbox" id="breathBox"><div class="breath" id="breath"></div><b id="bPhase" aria-live="polite">Prepárate</b></div>
   <p class="bstep" id="bStep">${s.pasos?esc(s.pasos[0]):'Sigue el círculo: crece al inhalar y se encoge al exhalar.'}</p>
   <div class="bar" style="margin:6px 0 4px"><i id="bBar" style="width:0%;background:var(--magenta)"></i></div>
   <div class="inline" style="justify-content:space-between"><span class="num muted" id="bLeft">${Math.floor(s.seg/60)}:00</span>
    <span class="inline"><button class="btn sm ghost" id="bPause" type="button">Pausar</button><button class="btn sm" id="bEnd" type="button">Terminar</button></span></div>`);
  PL={k,s,el:0,last:Date.now(),paused:false,fase:-1};
  $('#bPause').onclick=()=>{PL.paused=!PL.paused;$('#bPause').textContent=PL.paused?'Seguir':'Pausar'};
  $('#bEnd').onclick=()=>endSesion(false);
  clearInterval(startSesion.t);startSesion.t=setInterval(tickSesion,200);
}
function tickSesion(){
  if(!PL||!$('#breathBox')){clearInterval(startSesion.t);PL=null;return}
  const now=Date.now();if(!PL.paused)PL.el+=(now-PL.last)/1000;PL.last=now;
  const s=PL.s,el=PL.el;
  if(el>=s.seg){endSesion(true);return}
  const cyc=s.fases.reduce((a,f)=>a+f[1],0);let t=el%cyc,i=0;while(t>=s.fases[i][1]){t-=s.fases[i][1];i++}
  const [nom,dur,grande]=s.fases[i];
  if(i!==PL.fase){PL.fase=i;const b=$('#breath');b.style.transition=`transform ${dur}s ease-in-out`;b.style.transform=`scale(${grande?1:.55})`}
  $('#bPhase').textContent=`${nom} ${Math.ceil(dur-t)}`;
  if(s.pasos){const p=s.pasos[Math.min(s.pasos.length-1,Math.floor(el/(s.seg/s.pasos.length)))];if($('#bStep').textContent!==p)$('#bStep').textContent=p}
  const left=Math.ceil(s.seg-el);$('#bLeft').textContent=`${Math.floor(left/60)}:${String(left%60).padStart(2,'0')}`;
  $('#bBar').style.width=(el/s.seg*100)+'%';
}
function endSesion(completa){
  clearInterval(startSesion.t);const p=PL;PL=null;closeModal();if(!p)return;
  const seg=Math.round(Math.min(p.el,p.s.seg));
  if(seg>=60){S.sesiones=S.sesiones||[];S.sesiones.push({fecha:today(),tipo:p.k,seg});save();render();toast(completa?`${p.s.t} completada. Bien hecho`:`Registramos ${Math.round(seg/60)} min de práctica`)}
  else toast('Sesión cancelada. Se registra a partir de 1 minuto');
}


/* ---------- Bitácora del Reto 21 ---------- */
// S.r21 = {riesgoR, sel, dias:{1:{fecha, plan:{...}, rev:{...}, cerrado}}}
const REGLAS=[['sinstop','Operé sin stop'],['movistop','Moví el stop'],['sobreop','Sobreoperé'],['tamano','Tamaño excesivo'],['revancha','Revancha'],['fomo','Entré por FOMO'],['fuera','Fuera de mi horario o setup'],['riesgo','Pasé mi riesgo máximo del día']];
const EMOS=['Calma','Confianza','Ansiedad','FOMO','Miedo','Revancha','Euforia','Frustración'];
const SETUPS=['Geny Trend','Reditum Sniper','Ruptura','Reversión','Otro'];
function seedR21(){
  const rv=(d,dis,plan,reglas,emo,bien,error,leccion)=>({fecha:daysAgo(d),cerrado:true,
    plan:{sesgo:d%2?'Alcista':'Neutral',niveles:'VAH 514 · POC 511 · VAL 508',setup:'Geny Trend',riesgoMax:150,maxOps:3,intencion:'Solo setups A+, nada de revancha'},
    rev:{siguio:plan,reglas,emo,disciplina:dis,bien,error,leccion}});
  return {riesgoR:100,sel:7,dias:{
    1:rv(6,9,'Sí',[],'Calma','Esperé el retroceso al VWAP','','La paciencia paga'),
    2:rv(5,4,'No',['fomo','fuera'],'FOMO','Corté rápido la pérdida','Entré tarde sin confirmación','Si llego tarde, no entro'),
    3:rv(4,8,'Sí',[],'Confianza','Respeté mi tamaño','Cerré antes del objetivo','Dejar correr las ganadoras'),
    4:rv(3,3,'No',['revancha','movistop'],'Revancha','Paré después de la segunda','Operé para recuperar','Después de una pérdida: reset de 2 minutos'),
    5:rv(2,9,'Sí',[],'Calma','Plan cumplido de principio a fin','','Repetir la rutina de hoy'),
    6:rv(1,8,'Parcial',['sobreop'],'Calma','Buen spread de crédito','Hice una operación de más','Máximo 3 operaciones')}};
}
function r21(){
  if(!S.r21){S.r21={riesgoR:100,sel:1,dias:{}};(S.reto?.hechos||[]).forEach((f,i)=>{S.r21.dias[i+1]={fecha:f,cerrado:true,plan:{},rev:{}}})}
  return S.r21}
const r21Cerrados=()=>Object.values(r21().dias).filter(d=>d.cerrado).length;
const r21Actual=()=>Math.min(21,r21Cerrados()+1);
const r21Dia=n=>{const R2=r21();R2.dias[n]=R2.dias[n]||{fecha:'',cerrado:false,plan:{},rev:{}};return R2.dias[n]};
function r21Sugerida(){const used=Object.values(r21().dias).map(x=>x.fecha).filter(Boolean).sort();if(!used.includes(today()))return today();return iso(new Date(used[used.length-1]+'T12:00').getTime()+864e5)}
const r21Fecha=n=>{const d=r21().dias[n];return d?.fecha||(n===r21Actual()?r21Sugerida():'')};
const r21Trades=n=>{const f=r21Fecha(n);return f?S.trades.filter(t=>t.fecha===f):[]};
function riesgoDe(t){const r=t.stop&&t.entrada?Math.abs(t.entrada-t.stop)*t.cantidad*(+t.mult||1):0;return r>0?r:(+r21().riesgoR||0)}
const rMult=t=>{const r=riesgoDe(t);return r>0?pnl(t)/r:null};
function r21Stats(){
  const dias=[...Array(21)].map((_,i)=>{const n=i+1,d=r21().dias[n]||{},ts=r21Trades(n),p=ts.reduce((a,t)=>a+pnl(t),0);
    return{n,d,ts,pnl:p,ops:ts.length,R:ts.reduce((a,t)=>a+(rMult(t)||0),0),dis:+d.rev?.disciplina||null}});
  const ts=dias.flatMap(x=>x.ts),ps=ts.map(pnl),w=ps.filter(x=>x>0),l=ps.filter(x=>x<=0);
  const gw=w.reduce((a,b)=>a+b,0),gl=Math.abs(l.reduce((a,b)=>a+b,0));
  let eq=0,peak=0,dd=0;ts.slice().sort((a,b)=>(a.fecha+(a.hora||'')).localeCompare(b.fecha+(b.hora||''))).forEach(t=>{eq+=pnl(t);peak=Math.max(peak,eq);dd=Math.min(dd,eq-peak)});
  const Rs=ts.map(rMult).filter(x=>x!=null);
  const cer=dias.filter(x=>x.d.cerrado),diss=cer.map(x=>x.dis).filter(Boolean);
  let racha=0;for(let i=cer.length-1;i>=0;i--){if((cer[i].dis||0)>=7)racha++;else break}
  const reglas={};cer.forEach(x=>(x.d.rev?.reglas||[]).forEach(k=>{reglas[k]=reglas[k]||{n:0,p:0};reglas[k].n++;reglas[k].p+=x.pnl}));
  const by=f=>{const o={};ts.forEach(t=>{const k=f(t)||'Sin registrar';o[k]=o[k]||{n:0,w:0,p:0};o[k].n++;o[k].p+=pnl(t);if(pnl(t)>0)o[k].w++});return o};
  const conPlan=cer.filter(x=>x.d.rev?.siguio==='Sí').length;
  return{dias,ts,n:ts.length,total:ps.reduce((a,b)=>a+b,0),wr:ts.length?w.length/ts.length:0,pf:gl?gw/gl:(gw?Infinity:0),
    avgW:w.length?gw/w.length:0,avgL:l.length?gl/l.length:0,expR:Rs.length?Rs.reduce((a,b)=>a+b,0)/Rs.length:null,dd,
    dis:diss.length?diss.reduce((a,b)=>a+b,0)/diss.length:null,racha,reglas,plan:cer.length?conPlan/cer.length:null,cerrados:cer.length,
    porEmo:by(t=>t.emo),porSetup:by(t=>t.setup),porTipo:by(tipoLbl),porHora:by(t=>t.hora?t.hora.slice(0,2)+':00':''),
    mejor:dias.filter(x=>x.ops).sort((a,b)=>b.pnl-a.pnl)[0],peor:dias.filter(x=>x.ops).sort((a,b)=>a.pnl-b.pnl)[0]};
}
const fmtR=r=>r==null?'—':(r>=0?'+':'')+r.toFixed(2)+'R';
function r21Chart(st){
  const W=640,H=170,pl=44,pr=10,pt=12,pb=24,days=st.dias,mx=Math.max(1,...days.map(d=>Math.abs(d.pnl)));
  let c=0;const cum=days.map(d=>c+=d.pnl),cmx=Math.max(1,...cum.map(Math.abs));
  const x=i=>pl+(i+.5)*(W-pl-pr)/21,bw=(W-pl-pr)/21*.6,y0=pt+(H-pt-pb)/2,ys=v=>y0-v/mx*((H-pt-pb)/2),yc=v=>y0-v/cmx*((H-pt-pb)/2);
  const last=r21Cerrados()||0,pts=cum.slice(0,Math.max(1,last)).map((v,i)=>`${x(i)},${yc(v)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto" role="img" aria-label="P&L por día del reto y acumulado">
   <line x1="${pl}" x2="${W-pr}" y1="${y0}" y2="${y0}" stroke="#2A3846"/>
   <text x="${pl-6}" y="${pt+8}" fill="#8395A8" font-size="10" text-anchor="end" font-family="DM Mono">${money(Math.round(mx))}</text>
   <text x="${pl-6}" y="${H-pb}" fill="#8395A8" font-size="10" text-anchor="end" font-family="DM Mono">-${money(Math.round(mx))}</text>
   ${days.map((d,i)=>d.ops?`<rect x="${x(i)-bw/2}" y="${Math.min(y0,ys(d.pnl))}" width="${bw}" height="${Math.max(1,Math.abs(ys(d.pnl)-y0))}" rx="2" fill="${d.pnl>=0?'rgba(0,255,148,.55)':'rgba(255,77,109,.6)'}"><title>Día ${d.n}: ${money(+d.pnl.toFixed(2))}</title></rect>`:'').join('')}
   <polyline points="${pts}" fill="none" stroke="#8CFF2E" stroke-width="2"/>
   ${days.map((d,i)=>(i%5===0||i===20)?`<text x="${x(i)}" y="${H-6}" fill="#8395A8" font-size="10" text-anchor="middle" font-family="DM Mono">${d.n}</text>`:'').join('')}
  </svg>`;
}
const tbl=(o,titulo)=>{const e=Object.entries(o);return e.length?`<div class="tbl"><table><thead><tr><th>${titulo}</th><th class="n">Trades</th><th class="n">Acierto</th><th class="n">P&amp;L</th></tr></thead><tbody>${e.sort((a,b)=>b[1].p-a[1].p).map(([k,v])=>`<tr><td>${esc(k)}</td><td class="n">${v.n}</td><td class="n">${Math.round(v.w/v.n*100)}%</td><td class="n ${v.p>=0?'up':'down'}">${money(+v.p.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="padding:14px">Sin datos todavía.</div>'};

VIEWS.reto21=function(){
  const R2=r21(),act=r21Actual(),st=r21Stats();
  let sel=R2.sel&&R2.sel<=act?R2.sel:act;R2.sel=sel;
  const d=r21Dia(sel),fecha=r21Fecha(sel),ts=r21Trades(sel),p=d.plan||{},rv=d.rev||{};
  const dp=ts.reduce((a,t)=>a+pnl(t),0),dR=ts.reduce((a,t)=>a+(rMult(t)||0),0);
  const alertas=[];
  if(p.maxOps&&ts.length>p.maxOps)alertas.push(`Hiciste ${ts.length} operaciones y tu máximo era ${p.maxOps}.`);
  if(p.riesgoMax&&dp<-p.riesgoMax)alertas.push(`Perdiste ${money(+(-dp).toFixed(2))}, más que tu riesgo máximo del día (${money(+p.riesgoMax)}).`);
  if(ts.some(t=>!t.stop&&t.tipo!=='opciones'))alertas.push('Hay operaciones sin stop registrado: el R se calcula con tu riesgo por operación por defecto.');
  const futuro=n=>n>act;
  return `<div class="vhead"><div><h1>Bitácora Reto 21</h1><p>Un día, una misión: planeas antes de abrir, registras cada operación y cierras el día con tu revisión. Así se construye el hábito.</p></div>
   <div class="inline"><button class="btn ghost sm" data-act="r21plantilla">Descargar plantilla Excel</button><button class="btn ghost sm" data-act="r21export">Exportar a Excel</button><button class="btn sm" data-act="r21import">Importar Excel o CSV</button></div></div>
  <div class="stats">
   <div class="stat"><div class="k">Días cerrados</div><div class="v">${st.cerrados}/21</div></div>
   <div class="stat"><div class="k">P&amp;L del reto</div><div class="v ${st.total>=0?'up':'down'}">${money(+st.total.toFixed(2))}</div></div>
   <div class="stat"><div class="k">Acierto · trades</div><div class="v">${(st.wr*100).toFixed(0)}% · ${st.n}</div></div>
   <div class="stat"><div class="k">Expectativa</div><div class="v ${(st.expR||0)>=0?'up':'down'}">${fmtR(st.expR)}</div></div>
   <div class="stat"><div class="k">Profit factor</div><div class="v">${st.pf===Infinity?'∞':st.pf.toFixed(2)}</div></div>
   <div class="stat"><div class="k">Drawdown máx.</div><div class="v down">${money(+st.dd.toFixed(2))}</div></div>
   <div class="stat"><div class="k">Disciplina media</div><div class="v">${st.dis?st.dis.toFixed(1)+'/10':'—'}</div></div>
   <div class="stat"><div class="k">Racha disciplinada</div><div class="v">${st.racha} día${st.racha===1?'':'s'}</div></div>
  </div>
  <div class="panel" style="margin-bottom:18px"><div class="ph"><h2>Tus 21 días</h2><span class="muted" style="font-size:13px">Toca un día para ver su plan, sus operaciones y su revisión</span></div>
   <div class="r21grid">${st.dias.map(x=>{const fut=futuro(x.n),c=x.d.cerrado;
     return `<button class="r21d ${x.n===sel?'sel':''} ${c?'done':''} ${x.ops?(x.pnl>=0?'pos':'neg'):''}" data-act="r21sel" data-n="${x.n}" ${fut?'disabled':''} aria-pressed="${x.n===sel}" aria-label="Día ${x.n}${c?', cerrado':''}">
      <b>${x.n}</b><span class="num">${x.ops?money(Math.round(x.pnl)):fut?'':'—'}</span>${c?`<i>${x.dis?x.dis+'/10':'✓'}</i>`:x.n===act?'<i class="hoy">Hoy</i>':''}</button>`}).join('')}</div>
   <div style="margin-top:14px">${r21Chart(st)}</div>
   <p class="hint">Barras: P&amp;L de cada día. Línea verde: P&amp;L acumulado del reto.</p></div>

  <div class="panel glow" style="margin-bottom:18px"><div class="ph"><h2>Día ${sel} ${fecha?`<span class="tag num" style="vertical-align:middle">${fecha}</span>`:''} ${d.cerrado?'<span class="tag up">Cerrado</span>':''}</h2>
    <div class="inline">${sel>1?`<button class="btn sm ghost" data-act="r21sel" data-n="${sel-1}">Día anterior</button>`:''}${sel<act?`<button class="btn sm ghost" data-act="r21sel" data-n="${sel+1}">Día siguiente</button>`:''}</div></div>
   <div class="mission" style="margin:0 0 16px"><h3>Misión del día ${sel}</h3><p style="margin-bottom:0">${esc(MISIONES[sel-1])}</p></div>
   <div class="r21cols">
    <form class="f" data-form="r21plan">
     <h3 class="r21h">1. Plan pre-mercado</h3>
     <label>Fecha de este día<input id="p-fecha" name="fecha" type="date" value="${fecha}" required ${d.cerrado?'readonly':''}></label>
     <div class="r2"><label>Sesgo del día<select id="p-sesgo" name="sesgo">${['','Alcista','Bajista','Neutral','No operar'].map(o=>`<option ${p.sesgo===o?'selected':''} value="${o}">${o||'Elige…'}</option>`).join('')}</select></label>
      <label>Setup que buscas<select id="p-setup" name="setup">${['',...SETUPS].map(o=>`<option ${p.setup===o?'selected':''} value="${o}">${o||'Elige…'}</option>`).join('')}</select></label></div>
     <label>Niveles clave<input id="p-niv" name="niveles" value="${esc(p.niveles||'')}" placeholder="Ej.: VAH 514 · POC 511 · VAL 508"></label>
     <div class="r2"><label>Riesgo máximo del día ($)<input id="p-riesgo" name="riesgoMax" type="number" min="0" step="any" value="${p.riesgoMax??''}"></label>
      <label>Máximo de operaciones<input id="p-ops" name="maxOps" type="number" min="0" step="1" value="${p.maxOps??''}"></label></div>
     <label>Intención del día<input id="p-int" name="intencion" value="${esc(p.intencion||'')}" placeholder="Ej.: Solo setups A+, nada de revancha"></label>
     <button class="btn ghost">Guardar plan</button>
    </form>
    <div>
     <h3 class="r21h">2. Operaciones del día</h3>
     <div class="daystats"><span>P&amp;L <b class="${dp>=0?'up':'down'}">${money(+dp.toFixed(2))}</b></span><span>R <b>${fmtR(ts.length?dR:null)}</b></span><span>Ops <b>${ts.length}${p.maxOps?' / '+p.maxOps:''}</b></span></div>
     ${alertas.map(a=>`<p class="r21alert">${esc(a)}</p>`).join('')}
     ${ts.length?`<div class="tbl"><table><thead><tr><th>Operación</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">R</th><th class="n">P&amp;L</th></tr></thead><tbody>${ts.map(t=>{const r=rMult(t);return `<tr><td><b>${esc(t.activo)}</b>${t.hora?` <span class="muted num">${esc(t.hora)}</span>`:''}<br><span class="muted" style="font-size:12px">${esc(tipoLbl(t))} · ${t.dir==='short'?(t.tipo==='opciones'?'Crédito':'Venta'):(t.tipo==='opciones'?'Débito':'Compra')}${t.setup?' · '+esc(t.setup):''}${t.emo?' · '+esc(t.emo):''}</span></td><td class="n">${t.entrada??'—'}</td><td class="n">${t.salida??'—'}</td><td class="n">${fmtR(r)}</td><td class="n ${pnl(t)>=0?'up':'down'}">${money(+pnl(t).toFixed(2))}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty" style="padding:16px">Sin operaciones este día. Regístralas una por una o impórtalas desde Excel.</div>'}
     <div class="inline" style="margin-top:10px">${fecha?`<button class="btn sm" data-act="r21trade">Registrar operación</button>`:''}<button class="btn sm ghost" data-act="r21import">Importar Excel</button></div>
    </div>
    <form class="f" data-form="r21rev">
     <h3 class="r21h">3. Revisión post-mercado</h3>
     <div class="seg" role="radiogroup" aria-label="¿Seguiste tu plan?">${['Sí','Parcial','No'].map(o=>`<label><input type="radio" name="siguio" value="${o}" ${rv.siguio===o?'checked':''}><span>${o==='Sí'?'Seguí mi plan':o==='Parcial'?'Lo seguí a medias':'No lo seguí'}</span></label>`).join('')}</div>
     <fieldset class="r21reglas"><legend>Reglas que rompiste</legend>${REGLAS.map(([k,l])=>`<label class="ck"><input type="checkbox" name="regla" value="${k}" ${(rv.reglas||[]).includes(k)?'checked':''}>${l}</label>`).join('')}</fieldset>
     <div class="r2"><label>Emoción dominante<select id="r-emo" name="emo">${['',...EMOS].map(o=>`<option ${rv.emo===o?'selected':''} value="${o}">${o||'Elige…'}</option>`).join('')}</select></label>
      <label>Disciplina (1 a 10)<input id="r-dis" name="disciplina" type="number" min="1" max="10" step="1" value="${rv.disciplina??''}" required></label></div>
     <label>Qué hice bien<textarea id="r-bien" name="bien" rows="2">${esc(rv.bien||'')}</textarea></label>
     <label>Error principal<textarea id="r-error" name="error" rows="2">${esc(rv.error||'')}</textarea></label>
     <label>Lección para mañana<textarea id="r-lec" name="leccion" rows="2">${esc(rv.leccion||'')}</textarea></label>
     <button class="btn">${d.cerrado?'Actualizar revisión':`Cerrar día ${sel}`}</button>
    </form>
   </div></div>

  ${rkPanel()}
  <div class="duo" style="margin-bottom:18px">
   <div class="panel"><div class="ph"><h2>Reglas que más rompes</h2></div>${Object.keys(st.reglas).length?`<div class="tbl"><table><thead><tr><th>Regla</th><th class="n">Días</th><th class="n">P&amp;L de esos días</th></tr></thead><tbody>${Object.entries(st.reglas).sort((a,b)=>b[1].n-a[1].n).map(([k,v])=>`<tr><td>${esc(REGLAS.find(r=>r[0]===k)?.[1]||k)}</td><td class="n">${v.n}</td><td class="n ${v.p>=0?'up':'down'}">${money(+v.p.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="padding:14px">Ninguna regla rota en los días cerrados.</div>'}</div>
   <div class="panel"><div class="ph"><h2>Resultado por emoción</h2></div>${tbl(st.porEmo,'Emoción')}</div>
   <div class="panel"><div class="ph"><h2>Resultado por setup</h2></div>${tbl(st.porSetup,'Setup')}</div>
   <div class="panel"><div class="ph"><h2>Por tipo y estrategia</h2></div>${tbl(st.porTipo,'Tipo')}</div>
   ${Object.keys(st.porHora).some(k=>k!=='Sin registrar')?`<div class="panel"><div class="ph"><h2>Resultado por hora</h2></div>${tbl(st.porHora,'Hora')}</div>`:''}
   <div class="panel"><div class="ph"><h2>Lecturas del reto</h2></div><ul class="r21ins">
    ${st.mejor?`<li>Tu mejor día fue el <b>${st.mejor.n}</b> (${money(+st.mejor.pnl.toFixed(2))}) y el peor el <b>${st.peor.n}</b> (${money(+st.peor.pnl.toFixed(2))}).</li>`:''}
    ${st.plan!=null?`<li>Seguiste tu plan completo en el <b>${Math.round(st.plan*100)}%</b> de los días cerrados.</li>`:''}
    ${st.avgL?`<li>Ganancia media <b class="up">${money(+st.avgW.toFixed(2))}</b> contra pérdida media <b class="down">${money(+st.avgL.toFixed(2))}</b> (relación ${(st.avgW/st.avgL).toFixed(2)}).</li>`:''}
    <li>Riesgo por operación por defecto (1R): <span class="inline" style="display:inline-flex"><input id="r21-R" type="number" min="1" step="any" value="${R2.riesgoR||''}" style="width:90px" aria-label="Riesgo por operación en dólares"><button class="btn sm ghost" data-act="r21R">Guardar</button></span></li>
   </ul><button class="btn sm ghost" data-act="r21geny">Pedirle a Geny un análisis del reto</button></div>
  </div>
  <p class="risk">Herramienta educativa. Los resultados pasados no garantizan resultados futuros; operar implica riesgo de pérdida de capital.</p>`;
};

/* ---------- Importar desde Excel / CSV ---------- */
const CAMPOS=[
 ['fecha','Fecha',1,['fecha','date','dia','fecha apertura','open date','fecha entrada','entry date','datetime','trade date','opened','open time','fecha/hora','time']],
 ['hora','Hora',0,['hora','hour','hora entrada','entry time']],
 ['activo','Activo',1,['activo','simbolo','symbol','ticker','instrumento','instrument','asset','underlying','subyacente','contrato','par','mercado/activo']],
 ['tipo','Tipo de inversión',0,['tipo','type','asset class','clase','tipo de activo','tipo de inversion','security type','sec type','mercado','market']],
 ['dir','Dirección',0,['direccion','side','lado','accion','action','buy/sell','operacion','long/short','posicion','position','compra/venta','b/s']],
 ['entrada','Precio de entrada',0,['entrada','precio entrada','precio de entrada','entry','entry price','open price','precio apertura','apertura','avg entry','buy price','prima entrada','open']],
 ['salida','Precio de salida',0,['salida','precio salida','precio de salida','exit','exit price','close price','precio cierre','cierre','avg exit','sell price','prima salida','close']],
 ['cantidad','Cantidad / contratos',0,['cantidad','qty','quantity','contratos','contracts','shares','acciones','size','tamano','volumen','volume','lotes','lots']],
 ['stop','Stop',0,['stop','stop loss','sl','stoploss','s/l']],
 ['mult','Multiplicador',0,['multiplicador','multiplier','valor punto','valor del punto','point value','mult']],
 ['estrategia','Estrategia (opciones)',0,['estrategia','strategy','estrategia opciones']],
 ['setup','Setup',0,['setup','patron','sistema','system','senal','signal']],
 ['emo','Emoción',0,['emocion','emotion','estado emocional','emociones']],
 ['plan','¿Siguió el plan?',0,['plan','siguio plan','siguio el plan','followed plan','segui el plan','cumplio plan','segui plan']],
 ['pnl','P&L / resultado',0,['pnl','p&l','p/l','resultado','ganancia','profit','net','net p&l','realized p&l','ganancia/perdida','beneficio','utilidad','net profit','profit/loss','g/p']],
 ['comision','Comisión',0,['comision','commission','fees','fee','comisiones','commissions']],
 ['nota','Nota',0,['nota','notas','note','notes','comentario','comentarios','comment','comments','observaciones']]];
const norm=s=>String(s??'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();
function numVal(v,dec=IMP?.dec){
  if(typeof v==='number')return v;if(v==null)return NaN;let s=String(v).trim().replace(/[$€£\s]|USD|COP|MXN/gi,'');if(!s)return NaN;
  let neg=/^\(.*\)$/.test(s);s=s.replace(/[()]/g,'');
  const c=s.lastIndexOf(','),d=s.lastIndexOf('.');
  if(dec===',')s=s.replace(/\./g,'').replace(',','.');
  else if(dec==='.')s=s.replace(/,/g,'');
  else if(c>-1&&d>-1)s=c>d?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(c>-1)s=/^-?\d{1,3}(,\d{3})+$/.test(s)?s.replace(/,/g,''):s.replace(',','.');
  const n=parseFloat(s);return neg?-n:n}
function fechaVal(v,fmt){
  const pad=n=>String(n).padStart(2,'0');
  if(v instanceof Date&&!isNaN(v))return{fecha:`${v.getFullYear()}-${pad(v.getMonth()+1)}-${pad(v.getDate())}`,hora:v.getHours()||v.getMinutes()?`${pad(v.getHours())}:${pad(v.getMinutes())}`:''};
  if(typeof v==='number'&&v>20000&&v<80000){const d=new Date(Math.round((v-25569)*864e5));return{fecha:d.toISOString().slice(0,10),hora:v%1?d.toISOString().slice(11,16):''}}
  const s=String(v??'').trim();let m,f='',h='';
  if((m=s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/)))f=`${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  else if((m=s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{2,4})/))){let y=+m[3];if(y<100)y+=2000;const [a,b]=fmt==='mdy'?[m[2],m[1]]:[m[1],m[2]];if(+b>12||+a>31)return null;f=`${y}-${pad(b)}-${pad(a)}`}
  if((m=s.match(/(\d{1,2}):(\d{2})/)))h=`${pad(m[1])}:${m[2]}`;
  return f?{fecha:f,hora:h}:null}
const dirVal=v=>{const s=norm(v);if(!s)return null;if(/^(sell|s|short|venta|v|sld|sold|vender|vendido|corto|credito|credit)(\b|$)/.test(s))return'short';if(/^(buy|b|long|compra|c|bot|bought|comprar|comprado|largo|debito|debit)(\b|$)/.test(s))return'long';return null};
const tipoVal=v=>{const s=norm(v);if(!s)return null;if(/opc|option|opt|call|put/.test(s))return'opciones';if(/fut/.test(s))return'futuros';if(/acc|stock|equity|etf|share|cfd/.test(s))return'acciones';return null};
const siNo=v=>{const s=norm(v);if(/^(s|si|y|yes|true|1|x|ok)$/.test(s))return true;if(/^(n|no|false|0)$/.test(s))return false;return null};
let IMP=null;
function autoMap(head){
  const H=head.map(norm),used=new Set(),map={};
  for(const pass of ['eq','inc'])for(const [k,,,syn] of CAMPOS){if(map[k]!=null)continue;
    const i=H.findIndex((h,j)=>!used.has(j)&&h&&syn.some(s=>pass==='eq'?h===s:(s.length>2&&(h.startsWith(s+' ')||h.endsWith(' '+s)||h.includes(s)))));
    if(i>-1){map[k]=i;used.add(i)}}
  return map}
function detectHeader(rows){let best=0,score=-1;rows.slice(0,25).forEach((r,i)=>{const m=Object.keys(autoMap(r.map(String))).length;if(m>score){score=m;best=i}});return best}
async function leerArchivo(file){
  if(!window.XLSX){toast('No se pudo cargar el lector de Excel. Recarga la página e intenta de nuevo');return}
  try{
    const csv=/\.(csv|txt)$/i.test(file.name);
    const wb=csv?XLSX.read(await file.text(),{type:'string',raw:true}):XLSX.read(new Uint8Array(await file.arrayBuffer()),{type:'array',cellDates:true});
    IMP={file:file.name,wb,sheet:wb.SheetNames[0],fmt:'dmy',dedupe:true,decUser:''};cargarHoja();impModal();
  }catch(e){console.error(e);toast('No pude leer el archivo. Verifica que sea un Excel (.xlsx o .xls) o un CSV')}
}
function cargarHoja(){
  const ws=IMP.wb.Sheets[IMP.sheet];
  IMP.rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:'',blankrows:false});
  IMP.hr=detectHeader(IMP.rows);IMP.map=autoMap((IMP.rows[IMP.hr]||[]).map(String));detectDec();
}
// ¿El archivo usa coma o punto como separador decimal? Se decide mirando las columnas de precios y montos.
function detectDec(){if(IMP.decUser){IMP.dec=IMP.decUser;return}let co=0,pu=0;const cols=['entrada','salida','pnl','comision','stop'].map(k=>IMP.map[k]).filter(i=>i!=null);
  IMP.rows.slice(IMP.hr+1,IMP.hr+300).forEach(r=>cols.forEach(i=>{const v=r[i];if(typeof v!=='string')return;const t=v.trim();if(/\d,\d{1,2}\)?$/.test(t)||/\d\.\d{3},/.test(t))co++;if(/\d\.\d{1,2}\)?$/.test(t)||/\d,\d{3}\./.test(t))pu++}));
  IMP.dec=co>pu?',':pu>co?'.':''}
function filaATrade(r){
  const g=k=>IMP.map[k]!=null?r[IMP.map[k]]:'';
  const fh=fechaVal(g('fecha'),IMP.fmt);if(!fh)return{err:'Fecha no reconocida'};
  const activo=String(g('activo')||'').trim().toUpperCase().slice(0,20);if(!activo)return{err:'Falta el activo'};
  let entrada=numVal(g('entrada')),salida=numVal(g('salida')),cant=numVal(g('cantidad'));const pnlM=numVal(g('pnl'));
  let dir=dirVal(g('dir'));if(isFinite(cant)&&cant<0){cant=-cant;dir=dir||'short'}dir=dir||'long';
  const precios=entrada>0&&salida>0&&cant>0;
  if(!precios&&!isFinite(pnlM))return{err:'Faltan precios y cantidad, o el P&L'};
  const estrategia=String(g('estrategia')||'').trim();
  let tipo=tipoVal(g('tipo'))||(estrategia||/\b(C|P|CALL|PUT)\b|\d+[CP]\d*$/.test(activo)?'opciones':futMult(activo)?'futuros':'acciones');
  let mult=numVal(g('mult'));if(!(mult>0))mult=tipo==='futuros'?(+futMult(activo)||1):tipo==='opciones'?100:1;
  const est=ESTRATEGIAS.find(([n])=>norm(n)===norm(estrategia));
  if(tipo==='opciones'&&est&&!dirVal(g('dir')))dir=est[1]==='c'?'short':'long';
  const plan=siNo(g('plan')),stop=numVal(g('stop')),com=numVal(g('comision'));
  const emo=String(g('emo')||'').trim(),setup=String(g('setup')||'').trim()||'Otro';
  const t={id:uid(),fecha:fh.fecha,hora:fh.hora||(IMP.map.hora!=null?(fechaVal('2000-01-01 '+String(g('hora')),'dmy')?.hora||''):''),tipo,activo,dir,
    entrada:precios?entrada:null,salida:precios?salida:null,cantidad:precios?cant:(cant>0?cant:1),mult,stop:stop>0?stop:null,
    setup,plan:plan==null?true:plan,emo:emo?emo[0].toUpperCase()+emo.slice(1):'',nota:String(g('nota')||'').trim().slice(0,500),fuente:'excel'};
  if(tipo==='opciones')Object.assign(t,{estrategia:est?est[0]:(estrategia||'Otra'),venc:'',strikes:''});
  if(isFinite(pnlM)&&!precios)t.pnlManual=pnlM;
  if(com>0)t.comision=Math.abs(com);
  return{t}}
const dupKey=t=>[t.fecha,t.hora||'',t.activo,t.entrada,t.salida,t.cantidad,t.pnlManual??''].join('|');
function impModal(){
  const head=(IMP.rows[IMP.hr]||[]).map(String),data=IMP.rows.slice(IMP.hr+1).filter(r=>r.some(c=>String(c).trim()!==''));
  const res=data.map(filaATrade),ok=res.filter(x=>x.t),existing=new Set(S.trades.map(dupKey));
  const dups=ok.filter(x=>existing.has(dupKey(x.t))).length,nuevos=IMP.dedupe?ok.length-dups:ok.length;
  const fechasReto=new Set(Object.values(r21().dias).map(d=>d.fecha).concat(today()));
  const enReto=ok.filter(x=>fechasReto.has(x.t.fecha)).length;
  const faltan=CAMPOS.filter(c=>c[2]&&IMP.map[c[0]]==null).map(c=>c[1]);
  IMP.listos=ok.map(x=>x.t).filter(t=>!IMP.dedupe||!existing.has(dupKey(t)));
  const opt=(k)=>`<select id="map-${k}" data-map="${k}"><option value="">— No usar —</option>${head.map((h,i)=>`<option value="${i}" ${IMP.map[k]===i?'selected':''}>${esc(h||'Columna '+(i+1))}</option>`).join('')}</select>`;
  modal(`<div class="ph"><h2>Importar operaciones</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></div>
   <p class="hint" style="margin-bottom:12px">Archivo: <b>${esc(IMP.file)}</b> · ${data.length} filas. Revisa que cada dato apunte a la columna correcta de tu Excel.</p>
   <div class="f">
    <div class="mapgrid">${IMP.wb.SheetNames.length>1?`<label>Hoja<select id="imp-sheet">${IMP.wb.SheetNames.map(n=>`<option ${n===IMP.sheet?'selected':''}>${esc(n)}</option>`).join('')}</select></label>`:''}
     <label>Fila de encabezados<input id="imp-hr" type="number" min="1" max="${IMP.rows.length}" value="${IMP.hr+1}"></label>
     <label>Separador decimal<select id="imp-dec"><option value="" ${!IMP.decUser?'selected':''}>Automático${IMP.dec?` (${IMP.dec===','?'coma':'punto'})`:''}</option><option value="," ${IMP.decUser===','?'selected':''}>Coma: 1.234,56</option><option value="." ${IMP.decUser==='.'?'selected':''}>Punto: 1,234.56</option></select></label>
     <label>Formato de fecha<select id="imp-fmt"><option value="dmy" ${IMP.fmt==='dmy'?'selected':''}>Día/mes/año</option><option value="mdy" ${IMP.fmt==='mdy'?'selected':''}>Mes/día/año</option></select></label></div>
    <div class="mapgrid">${CAMPOS.map(([k,l,req])=>`<label>${l}${req?' *':''}${opt(k)}</label>`).join('')}</div>
    <p class="hint">* Obligatorio. Cada fila necesita precios de entrada y salida con cantidad, o una columna de P&amp;L. Si falta el tipo, lo deduzco del activo (ES, NQ, MES… son futuros).</p>
    <label class="ck"><input type="checkbox" id="imp-dedupe" ${IMP.dedupe?'checked':''}>Omitir operaciones que ya están en mi bitácora (${dups})</label>
   </div>
   ${faltan.length?`<p class="r21alert">Falta indicar la columna de: ${faltan.join(', ')}.</p>`:''}
   <div class="tbl" style="margin-top:12px;max-height:240px;overflow:auto"><table><thead><tr><th>Fila</th><th>Fecha</th><th>Activo</th><th>Tipo</th><th>Dir.</th><th class="n">Entrada</th><th class="n">Salida</th><th class="n">Cant.</th><th class="n">P&amp;L</th><th>Estado</th></tr></thead><tbody>
    ${res.slice(0,12).map((x,i)=>x.t?`<tr><td class="num">${IMP.hr+2+i}</td><td class="num">${x.t.fecha}${x.t.hora?' '+x.t.hora:''}</td><td>${esc(x.t.activo)}</td><td>${esc(tipoLbl(x.t))}</td><td>${x.t.dir==='long'?'Compra':'Venta'}</td><td class="n">${x.t.entrada??'—'}</td><td class="n">${x.t.salida??'—'}</td><td class="n">${x.t.cantidad}</td><td class="n ${pnl(x.t)>=0?'up':'down'}">${money(+pnl(x.t).toFixed(2))}</td><td>${existing.has(dupKey(x.t))?'<span class="muted">Ya existe</span>':'<span class="up">Lista</span>'}</td></tr>`:`<tr><td class="num">${IMP.hr+2+i}</td><td colspan="8" class="muted">${esc(String(data[i].slice(0,5).join(' · ')).slice(0,80))}</td><td class="down">${esc(x.err)}</td></tr>`).join('')}
   </tbody></table></div>
   <p class="hint" style="margin-top:8px">${ok.length} filas válidas · ${res.length-ok.length} con errores · ${enReto} caen en días de tu Reto 21. ${res.length>12?'Se muestran las primeras 12.':''}</p>
   <div class="inline" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost sm" data-act="close">Cancelar</button><button class="btn" data-act="impOk" ${nuevos&&!faltan.length?'':'disabled'}>Importar ${nuevos} operaci${nuevos===1?'ón':'ones'}</button></div>`);
  $('#modalRoot .panel').classList.add('wide');
}
document.addEventListener('change',e=>{
  if(!IMP)return;const id=e.target.id;
  if(id==='imp-sheet'){IMP.sheet=e.target.value;cargarHoja();impModal()}
  else if(id==='imp-hr'){const v=Math.max(1,Math.min(IMP.rows.length,+e.target.value||1))-1;IMP.hr=v;IMP.map=autoMap((IMP.rows[v]||[]).map(String));detectDec();impModal()}
  else if(id==='imp-fmt'){IMP.fmt=e.target.value;impModal()}
  else if(id==='imp-dec'){IMP.decUser=e.target.value;detectDec();impModal()}
  else if(id==='imp-dedupe'){IMP.dedupe=e.target.checked;impModal()}
  else if(e.target.dataset.map){const k=e.target.dataset.map,v=e.target.value;if(v==='')delete IMP.map[k];else{Object.keys(IMP.map).forEach(x=>{if(IMP.map[x]===+v)delete IMP.map[x]});IMP.map[k]=+v}impModal()}
});

/* ---------- Exportar a Excel ---------- */
async function guardarArchivo(nombre,bytes){
  const blob=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  try{const dl=window.claude?.use?await claude.use('downloads'):null;
    if(dl){await dl.save({filename:nombre,data:blob});toast('Archivo listo: '+nombre);return}}
  catch(e){if(e?.code==='declined')return;console.warn(e)}
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nombre;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
}
const filaExcel=t=>({Fecha:t.fecha,Hora:t.hora||'','Tipo de inversión':t.tipo||'acciones',Activo:t.activo,Estrategia:t.estrategia||'',Dirección:t.tipo==='opciones'?(t.dir==='short'?'Crédito':'Débito'):(t.dir==='short'?'Venta':'Compra'),
  'Precio de entrada':t.entrada??'','Precio de salida':t.salida??'',Cantidad:t.cantidad,Multiplicador:+t.mult||1,Stop:t.stop??'',Comisión:t.comision??'',
  'P&L':+pnl(t).toFixed(2),R:rMult(t)==null?'':+rMult(t).toFixed(2),Setup:t.setup||'','¿Siguió el plan?':t.plan?'Sí':'No',Emoción:t.emo||'',Nota:t.nota||''});
function libro(hojas){const wb=XLSX.utils.book_new();hojas.forEach(([n,rows,anchos])=>{const ws=XLSX.utils.json_to_sheet(rows);if(anchos)ws['!cols']=anchos.map(w=>({wch:w}));XLSX.utils.book_append_sheet(wb,ws,n)});return XLSX.write(wb,{type:'array',bookType:'xlsx'})}
function exportarReto(){
  if(!window.XLSX){toast('No se pudo cargar el generador de Excel. Recarga la página');return}
  const st=r21Stats();
  const dias=st.dias.filter(x=>x.d.fecha||x.ops).map(x=>{const p=x.d.plan||{},r=x.d.rev||{};return{Día:x.n,Fecha:x.d.fecha||r21Fecha(x.n),Misión:MISIONES[x.n-1],Sesgo:p.sesgo||'',Setup:p.setup||'','Niveles clave':p.niveles||'','Riesgo máx. ($)':p.riesgoMax??'','Máx. operaciones':p.maxOps??'',Intención:p.intencion||'',
    Operaciones:x.ops,'P&L':+x.pnl.toFixed(2),R:+x.R.toFixed(2),'¿Siguió el plan?':r.siguio||'','Reglas rotas':(r.reglas||[]).map(k=>REGLAS.find(z=>z[0]===k)?.[1]).join(', '),Emoción:r.emo||'',Disciplina:r.disciplina??'','Qué hice bien':r.bien||'','Error principal':r.error||'',Lección:r.leccion||'',Estado:x.d.cerrado?'Cerrado':'Abierto'}});
  const resumen=[['Días cerrados',`${st.cerrados}/21`],['Operaciones',st.n],['P&L del reto',+st.total.toFixed(2)],['Acierto',`${(st.wr*100).toFixed(0)}%`],['Profit factor',st.pf===Infinity?'∞':+st.pf.toFixed(2)],['Expectativa (R)',st.expR==null?'':+st.expR.toFixed(2)],['Drawdown máximo',+st.dd.toFixed(2)],['Disciplina media',st.dis?+st.dis.toFixed(1):''],['Riesgo por operación (1R)',r21().riesgoR||'']].map(([a,b])=>({Indicador:a,Valor:b}));
  guardarArchivo(`bitacora-reto21-${today()}.xlsx`,libro([['Resumen',resumen,[28,16]],['Días del reto',dias,[6,12,40,10,14,24,14,14,30,12,10,8,14,30,12,10,30,30,30,10]],['Operaciones del reto',st.ts.map(filaExcel)],['Bitácora completa',S.trades.map(filaExcel)]]));
}
function plantilla(){
  if(!window.XLSX){toast('No se pudo cargar el generador de Excel. Recarga la página');return}
  const ej=[{Fecha:today(),Hora:'09:45','Tipo de inversión':'Acciones',Activo:'SPY',Estrategia:'',Dirección:'Compra','Precio de entrada':512.4,'Precio de salida':515.1,Cantidad:10,Multiplicador:1,Stop:510.9,Comisión:1,'P&L':'',Setup:'Geny Trend','¿Siguió el plan?':'Sí',Emoción:'Calma',Nota:'Retroceso al VWAP'},
   {Fecha:today(),Hora:'10:20','Tipo de inversión':'Futuros',Activo:'MES',Estrategia:'',Dirección:'Venta','Precio de entrada':5131.5,'Precio de salida':5126,Cantidad:2,Multiplicador:5,Stop:5135,Comisión:2.5,'P&L':'',Setup:'Reditum Sniper','¿Siguió el plan?':'Sí',Emoción:'Confianza',Nota:'Rechazo en VAH'},
   {Fecha:today(),Hora:'11:05','Tipo de inversión':'Opciones',Activo:'SPY',Estrategia:'Bull put spread',Dirección:'Crédito','Precio de entrada':1.35,'Precio de salida':0.4,Cantidad:2,Multiplicador:100,Stop:'',Comisión:2.6,'P&L':'',Setup:'Geny Trend','¿Siguió el plan?':'Sí',Emoción:'Calma',Nota:'Strikes 495/490'}];
  const ins=[['Una fila por operación cerrada.'],['Fecha: día/mes/año o año-mes-día. Puede incluir la hora.'],['Tipo de inversión: Acciones, Futuros u Opciones.'],['Dirección: Compra/Venta (o Long/Short). En opciones: Débito o Crédito.'],['Opciones: precios = prima neta por acción; el multiplicador es 100.'],['Futuros: el multiplicador es el valor del punto (ES 50, MES 5, NQ 20, MNQ 2).'],['Si tu bróker solo da el resultado, deja los precios vacíos y llena P&L.'],['Stop: opcional, sirve para medir cada operación en R.'],['También puedes importar el Excel o CSV que exporta tu bróker: Geny Pro reconoce las columnas.']].map(([x])=>({Instrucciones:x}));
  guardarArchivo('plantilla-bitacora-reto21.xlsx',libro([['Operaciones',ej,[12,7,16,8,18,10,16,16,9,13,9,10,8,16,16,11,28]],['Instrucciones',ins,[90]]]));
}


/* ---------- Clasificación de la tribu ---------- */
const ALIAS_A=['Toro','Oso','Tiburón','Búho','Zorro','Halcón','Pulpo','Llama','Tortuga','Ardilla','Pingüino','Mapache','Delfín','Canguro','Perezoso','Flamenco','Cangrejo','Ballena','Jaguar','Cóndor','Camaleón','Erizo','Koala','Gallo'];
const ALIAS_B=['Sin Stop','del Scalping','Zen','de la Vela Verde','Anti-FOMO','del POC','Theta','Cazarrupturas','Paciente','del Gap','Disciplinado','de Wall Street','Calculador','sin Revancha','del Breakeven','Teflón','del Spread','Madrugador','Trendy','del Volumen','Cero Drama','de Acero','Tranquilo','Francotirador'];
const aliasNuevo=()=>ALIAS_A[Math.random()*ALIAS_A.length|0]+' '+ALIAS_B[Math.random()*ALIAS_B.length|0];
function misMetricas(){const st=r21Stats();return{R:+st.ts.reduce((a,t)=>a+(rMult(t)||0),0).toFixed(2),pnl:+st.total.toFixed(2),wr:Math.round(st.wr*100),dis:st.dis?+st.dis.toFixed(1):null,dias:st.cerrados,n:st.n}}
const RK={orden:'R',filas:null,yo:null,cargando:false,err:'',at:0};
const RK_ORD=[['R','Resultado (R)'],['pnl','P&L'],['dis','Disciplina'],['dias','Días cerrados']];
const RK_EJ=[['Pulpo del Scalping',11.4,1830,64,8.2,12,24],['Perezoso Anti-FOMO',8.1,940,58,8.9,14,15],['Tiburón Zen',6.7,2210,52,7.4,10,31],['Flamenco del POC',3.2,410,55,9.1,16,12],['Toro Sin Stop',-4.8,-760,38,4.6,8,27]];
function rkFilas(){
  let f=(RK.filas||[]).map(x=>({alias:String(x.alias||'Trader anónimo').slice(0,40),R:+x.R||0,pnl:+x.pnl||0,wr:+x.wr||0,dis:x.dis==null?null:+x.dis,dias:+x.dias||0,n:+x.n||0,yo:!!x.yo}));
  if(S.ejemplo)f=f.concat(RK_EJ.map(([alias,R,pnl,wr,dis,dias,n])=>({alias,R,pnl,wr,dis,dias,n,ej:true})));
  const k=RK.orden;return f.sort((a,b)=>((b[k]??-1e9)-(a[k]??-1e9))||(b.dias-a.dias))}
function rkTabla(){
  if(RK.err&&!S.ejemplo)return `<div class="empty" style="padding:16px">${esc(RK.err)}</div>`;
  if(!RK.filas&&!S.ejemplo)return '<div class="empty" style="padding:16px">Cargando la clasificación…</div>';
  const f=rkFilas(),med=['🥇','🥈','🥉'],yo=f.findIndex(x=>x.yo);
  return `<div class="tbl"><table class="rk"><thead><tr><th class="n">#</th><th>Alias</th><th class="n">Resultado</th><th class="n">P&amp;L</th><th class="n">Acierto</th><th class="n">Disciplina</th><th class="n">Días</th></tr></thead><tbody>
   ${f.slice(0,25).map((x,i)=>`<tr class="${x.yo?'yo':''}"><td class="n">${med[i]||i+1}</td><td><b>${esc(x.alias)}</b>${x.yo?' <span class="tag up">Tú</span>':''}${x.ej?' <span class="tag muted">ejemplo</span>':''}</td><td class="n ${x.R>=0?'up':'down'}">${fmtR(x.R)}</td><td class="n ${x.pnl>=0?'up':'down'}">${money(Math.round(x.pnl))}</td><td class="n">${x.n?x.wr+'%':'—'}</td><td class="n">${x.dis?x.dis.toFixed(1):'—'}</td><td class="n">${x.dias}/21</td></tr>`).join('')}
   ${yo>=25?`<tr class="yo"><td class="n">${yo+1}</td><td><b>${esc(f[yo].alias)}</b> <span class="tag up">Tú</span></td><td class="n">${fmtR(f[yo].R)}</td><td class="n">${money(Math.round(f[yo].pnl))}</td><td class="n">${f[yo].wr}%</td><td class="n">${f[yo].dis??'—'}</td><td class="n">${f[yo].dias}/21</td></tr>`:''}
  </tbody></table></div>
  ${RK.err?`<p class="hint" style="margin-top:8px">${esc(RK.err)}</p>`:''}
  ${f.filter(x=>!x.ej).length<2?'<p class="hint" style="margin-top:8px">Por ahora la clasificación tiene pocos participantes. Se llena a medida que la tribu cierra sus días del reto.</p>':''}`;
}
function rkPanel(){
  const en=RK.yo?RK.yo.enRanking!==false:true,al=RK.yo?.alias||'';
  return `<div class="panel" id="rkPanel" style="margin-bottom:18px"><div class="ph"><h2>Clasificación de la tribu</h2>
    <div class="tfs" role="group" aria-label="Ordenar por">${RK_ORD.map(([k,l])=>`<button type="button" data-act="rkOrden" data-o="${k}" aria-pressed="${RK.orden===k}">${l}</button>`).join('')}</div></div>
   <p class="hint" style="margin-bottom:10px">Resultados del Reto 21. Todos aparecen con un alias cómico, nadie ve tu nombre ni tu correo. El resultado se mide en R (lo que ganas por cada unidad de riesgo), así una cuenta pequeña compite igual que una grande.</p>
   ${rkTabla()}
   <div class="inline rkme">${en?`<span>Tu alias: <b>${esc(al||'…')}</b></span><button class="btn sm ghost" data-act="rkAlias">Darme otro alias</button><button class="btn sm ghost" data-act="rkSalir">Salir de la clasificación</button>`:`<span class="muted">No apareces en la clasificación.</span><button class="btn sm ghost" data-act="rkEntrar">Entrar con un alias</button>`}</div>
  </div>`;
}
async function rkRefresh(){
  if(RK.cargando)return;RK.cargando=true;RK.err='';
  try{await RKB.publicar();const r=await RKB.cargar();RK.filas=r.filas;RK.yo=r.yo;RK.at=Date.now()}
  catch(e){RK.err=e?.message||'No pude cargar la clasificación. Intenta de nuevo en un momento.'}
  RK.cargando=false;
  const pn=$('#rkPanel');if(pn)pn.outerHTML=rkPanel();
}
const rkMaybe=()=>{if(Date.now()-RK.at>30000)rkRefresh()};
async function rkAccion(a){try{RK.yo=await RKB.accion(a);RK.at=0;await rkRefresh();toast(a==='alias'?`Tu nuevo alias: ${RK.yo.alias}`:a==='salir'?'Saliste de la clasificación':'Entraste a la clasificación')}catch(e){toast(e?.message||'No pude guardar el cambio. Intenta de nuevo')}}
// Clasificación en la versión publicada: cada persona escribe solo su fila en ranking/<su id>.
const RKB={db:undefined,id:null,last:'',
 async init(){if(RKB.db!==undefined)return RKB.db;try{if(!window.claude?.use){RKB.db=null;return null}const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);RKB.db=db;RKB.id=db&&user?await user.id():null}catch(e){RKB.db=null}return RKB.db},
 async cargar(){const db=await RKB.init();if(!db||!RKB.id)throw new Error('La clasificación no está disponible por ahora.');
   const snap=await db.collection('ranking').get();
   return{filas:snap.docs.map(d=>({...(d.data()||{}),yo:d.id===RKB.id})),yo:{alias:S.alias,enRanking:S.enRanking!==false}}},
 async publicar(force){const db=await RKB.init();if(!db||!RKB.id)return;if(!S.alias){S.alias=aliasNuevo();save()}
   const m=misMetricas(),key=JSON.stringify([m,S.alias,S.enRanking]);if(!force&&key===RKB.last)return;RKB.last=key;
   const ref=db.doc('ranking/'+RKB.id);
   try{if(S.enRanking===false)await ref.delete();else await ref.set({alias:S.alias,...m,at:new Date().toISOString()})}
   catch(e){if(e?.code==='not_granted'||e?.code==='permission_denied')throw new Error('Tu acceso a esta página es de solo lectura, así que no puedes aparecer en la clasificación.');throw e}},
 async accion(a){if(a==='alias'){S.alias=aliasNuevo();S.enRanking=true}if(a==='salir')S.enRanking=false;if(a==='entrar'){S.enRanking=true;S.alias=S.alias||aliasNuevo()}save();await RKB.publicar(true);return{alias:S.alias,enRanking:S.enRanking!==false}}};

/* ---------- eventos ---------- */
function closePop(){const p=$('#pop');if(p)p.hidden=true;$('#bell')?.setAttribute('aria-expanded','false');$('#me')?.setAttribute('aria-expanded','false')}
function openBellPop(){
  const p=$('#pop'),bell=$('#bell');if(!p||!bell)return;
  if(!p.hidden&&p.dataset.k==='bell'){closePop();return}
  p.dataset.k='bell';
  if(isGuided()){const a=avisosRich();p.innerHTML=`<h3>Avisos</h3>${a.length?`<div class="pop-list">${a.map(x=>`<button type="button" class="bell-item" ${x.go?`data-go="${x.go}"`:`data-act="${x.act}"`}><span>${esc(x.txt)}</span><b>Ir →</b></button>`).join('')}</div>`:'<p class="muted">Todo al día. Buen trabajo.</p>'}`;}
  else{const a=avisos();p.innerHTML=`<h3>Avisos</h3>${a.length?`<ul>${a.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'<p class="muted">Todo al día. Buen trabajo.</p>'}`;}
  p.hidden=false;bell.setAttribute('aria-expanded','true');$('#me')?.setAttribute('aria-expanded','false');
}
function openMePop(){
  const p=$('#pop'),me=$('#me');if(!p||!me)return;
  if(!p.hidden&&p.dataset.k==='me'){closePop();return}
  p.dataset.k='me';
  p.innerHTML=`<h3>Mi cuenta</h3><div style="font-size:12.5px;color:var(--muted);margin-bottom:10px;display:grid;gap:4px"><span style="color:var(--fg);font-weight:500">${esc(BOOT.email||'')}</span><span><span class="badge active">${esc(BOOT.membershipLabel||'Membresía activa')}</span></span></div><form class="f" data-form="meName"><label>¿Cómo te llamo?<input id="nombre" value="${esc(S.nombre)}" maxlength="30"></label><button type="button" class="btn sm" data-act="saveName">Guardar nombre</button></form><div class="inline" style="margin-top:12px"><button type="button" class="btn sm ghost" data-act="loadDemo">Cargar ejemplo</button><button type="button" class="btn sm ghost" data-act="askReset">Borrar mis datos</button></div><div class="inline" style="margin-top:10px;padding-top:10px;border-top:1px solid var(--line);justify-content:space-between"><a href="/actualizar-clave" class="btn sm ghost">Cambiar clave</a><button type="button" class="btn sm danger" data-act="signOut">Cerrar sesión</button></div><p class="muted" style="font-size:11.5px;margin:10px 0 0">Sincronizado en la nube con tu cuenta Geny Pro.</p>`;
  p.hidden=false;me.setAttribute('aria-expanded','true');$('#bell')?.setAttribute('aria-expanded','false');
}
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target:null;if(!t)return;
  if(t.closest('#bell')){openBellPop();return}
  if(t.closest('#me')){openMePop();return}
  if(t.closest('#genyFab')){closePop();openGenyDrawer();return}
  if(t.closest('#genyDrawerClose')){closeGenyDrawer();return}
  if(t.closest('#genyDrawerFull')){closeGenyDrawer(true);go('geny');return}
  const dChip=t.closest('#dChips button');if(dChip){const dq=$('#dQ');if(dq){dq.value=dChip.textContent;sendChat(true)}return}
  const uiBtn=t.closest('#modeSwitch [data-ui]');if(uiBtn){closePop();setUiMode(uiBtn.dataset.ui);return}
  const g=t.closest('[data-go]');if(g){closePop();if($('#genyDrawer')?.open)closeGenyDrawer(true);go(g.dataset.go);return}
  const b=t.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='closeBg'&&t!==b)return;
  if(b.closest('.pop')&&a!=='askReset')closePop();
  const A={
   closeBg:closeModal,close:closeModal,
   rkOrden(){RK.orden=b.dataset.o;const pn=$('#rkPanel');if(pn)pn.outerHTML=rkPanel()},
   rkAlias(){rkAccion('alias')},rkSalir(){rkAccion('salir')},rkEntrar(){rkAccion('entrar')},
   r21sel(){r21().sel=+b.dataset.n;save();render()},
   r21trade(){tradeModal(r21Fecha(r21().sel))},
   r21import(){const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls,.xlsm,.csv,.txt';i.onchange=()=>{if(i.files[0])leerArchivo(i.files[0])};i.click()},
   impOk(){if(!IMP?.listos?.length)return;const n=IMP.listos.length;S.trades.push(...IMP.listos);if(!S.pedem.documentar)S.pedem.documentar=true;IMP=null;closeModal();save();render();toast(`${n} operaci${n===1?'ón importada':'ones importadas'} a tu bitácora`)},
   r21export(){exportarReto()},r21plantilla(){plantilla()},
   r21R(){const v=+$('#r21-R').value;if(!(v>0)){toast('Escribe un monto mayor que cero');return}r21().riesgoR=v;save();render();toast('Riesgo por operación guardado')},
   r21geny(){go('geny');setTimeout(()=>{const q=$('#q');if(q){q.value='Analiza mi Reto 21: las reglas que más rompo, mis mejores y peores días y qué debo cambiar en los próximos días.';q.focus()}},60)},
   sesion(){startSesion(b.dataset.k)},nuevoTrade:tradeModal,diag:diagModal,
   diagBack(){S.diag.paso--;save();diagModal()},
   pedem(){S.pedem[b.dataset.k]=!S.pedem[b.dataset.k];save();render()},
   pedemReset(){Object.keys(S.pedem).forEach(k=>S.pedem[k]=false);save();render();toast('Nueva semana: empieza por Planear')},
   avanzarPlan(){const k=PEDEM.find(([k])=>!S.pedem[k]);if(!k){toast('Ciclo PEDEM completo esta semana. ¡Bien!');return}S.pedem[k[0]]=true;save();render();toast(`Paso “${k[1]}” marcado como hecho`)},
   mision(){if(!S.reto.hechos.includes(today()))S.reto.hechos.push(today());save();render();toast('Misión completada')},
   retoReset(){S.reto={inicio:today(),hechos:[]};save();render()},
   del(){S[b.dataset.col]=S[b.dataset.col].filter(x=>x.id!==b.dataset.id);save();render();toast('Eliminado')},
   updMeta(){const v=parseFloat($('#upd-'+b.dataset.id).value);if(isNaN(v)){toast('Escribe un número para actualizar el avance');return}S.metas.find(m=>m.id===b.dataset.id).actual=v;save();render();toast('Avance actualizado')},
   score(){const c=S.checks[today()]||(S.checks[today()]={animo:0,energia:0,control:0,h:{}});c[b.dataset.k]=+b.dataset.n;save();render()},
   habit(){const c=S.checks[today()]||(S.checks[today()]={animo:0,energia:0,control:0,h:{}});c.h[b.dataset.k]=!c.h[b.dataset.k];save();render()},
   chip(){$('#q').value=b.textContent;sendChat(false)},
   openGeny(){openGenyDrawer()},
   focusInput(){const el=document.getElementById(b.dataset.target||'');if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.focus()}},
   startFresh(){const n=S.nombre,jr=S.jr,al=S.alias,rk=S.enRanking,ui=S.uiMode;S=blank();S.nombre=n;if(jr)S.jr=jr;if(al)S.alias=al;if(rk!==undefined)S.enRanking=rk;if(ui)S.uiMode=ui;S.onboarded=true;save();render();toast('¡Listo! Empiezas desde cero con tus propios datos')},
   keepDemo(){S.onboarded=true;save();render();toast('Explorando con el ejemplo. Arriba puedes limpiar los datos cuando quieras')},
   clearDemo(){const n=S.nombre,jr=S.jr,al=S.alias,rk=S.enRanking,ui=S.uiMode;S=blank();S.nombre=n;if(jr)S.jr=jr;if(al)S.alias=al;if(rk!==undefined)S.enRanking=rk;if(ui)S.uiMode=ui;S.onboarded=true;save();render();toast('Listo. Empiezas con tus propios datos')},
   askReset(){$('#pop').innerHTML=`<h3>¿Borrar todos tus datos?</h3><p class="muted" style="font-size:13px;margin:0 0 10px">Se eliminan bitácora, movimientos, metas y check-ins. No se puede deshacer.</p><div class="inline"><button type="button" class="btn sm danger" data-act="doReset">Sí, borrar</button><button type="button" class="btn sm ghost" data-act="closePop">Cancelar</button></div>`},
   doReset(){const n=S.nombre,jr=S.jr,al=S.alias,rk=S.enRanking,ui=S.uiMode;S=blank();S.nombre=n;if(jr)S.jr=jr;if(al)S.alias=al;if(rk!==undefined)S.enRanking=rk;if(ui)S.uiMode=ui;S.onboarded=true;save();closePop();render();toast('Datos borrados')},
   loadDemo(){const n=S.nombre,jr=S.jr,al=S.alias,rk=S.enRanking,ui=S.uiMode;S=seed();S.nombre=n;if(jr)S.jr=jr;if(al)S.alias=al;if(rk!==undefined)S.enRanking=rk;if(ui)S.uiMode=ui;save();closePop();render();toast('Datos de ejemplo cargados')},
   saveName(){S.nombre=($('#nombre').value||'Trader').trim().slice(0,30);save();closePop();render();toast('Nombre guardado')},
   signOut(){if(window.__GENY_SIGNOUT__)window.__GENY_SIGNOUT__();else location.href='/login'},
   closePop
  };
  A[a]?.();
});
document.addEventListener('submit',e=>{
  e.preventDefault();const f=e.target,d=Object.fromEntries(new FormData(f));
  if(f.id==='compose'){sendChat(false);return}
  if(f.id==='dCompose'){sendChat(true);return}
  if(f.id==='gQuickGeny'){const qEl=$('#gQuickQ'),v=(qEl?.value||'').trim();if(qEl)qEl.value='';if(!v){openGenyDrawer();return}openGenyDrawer().then(()=>{const dq=$('#dQ');if(dq){dq.value=v;sendChat(true)}});return}
  const k=f.dataset.form;
  if(k==='meName'){S.nombre=($('#nombre')?.value||'Trader').trim().slice(0,30);save();closePop();render();toast('Nombre guardado');return}
  if(k==='mov'){S.movs.push({id:uid(),fecha:d.fecha||today(),tipo:d.tipo,cat:d.cat.trim(),monto:+d.monto,nota:d.nota});toast('Movimiento guardado')}
  if(k==='r21plan'||k==='r21rev'){
  if(k==='r21plan'){const n=r21().sel,dd=r21Dia(n);
    if(!d.fecha){toast('Elige la fecha de este día');return}
    const otro=Object.entries(r21().dias).find(([m,x])=>+m!==n&&x.fecha===d.fecha);if(otro){toast(`Esa fecha ya es el día ${otro[0]} del reto`);return}
    dd.fecha=d.fecha;dd.plan={sesgo:d.sesgo,setup:d.setup,niveles:(d.niveles||'').trim(),riesgoMax:d.riesgoMax?+d.riesgoMax:null,maxOps:d.maxOps?+d.maxOps:null,intencion:(d.intencion||'').trim()};
    if(!S.pedem.planear)S.pedem.planear=true;toast('Plan guardado')}
  if(k==='r21rev'){const n=r21().sel,dd=r21Dia(n),dis=+d.disciplina;
    if(!d.siguio){toast('Indica si seguiste tu plan');return}
    if(!(dis>=1&&dis<=10)){toast('Califica tu disciplina de 1 a 10');return}
    dd.fecha=dd.fecha||r21Fecha(n);
    dd.rev={siguio:d.siguio,reglas:[...f.querySelectorAll('input[name=regla]:checked')].map(x=>x.value),emo:d.emo||'',disciplina:dis,bien:(d.bien||'').trim(),error:(d.error||'').trim(),leccion:(d.leccion||'').trim()};
    const nuevo=!dd.cerrado;dd.cerrado=true;
    if(nuevo){if(!S.reto.hechos.includes(dd.fecha))S.reto.hechos.push(dd.fecha);r21().sel=Math.min(21,n+1);if(!S.pedem.evaluar)S.pedem.evaluar=true}
    toast(nuevo?`Día ${n} cerrado. ¡Misión cumplida!`:'Revisión actualizada')}
  }
  if(k==='trade'){const opc=d.tipo==='opciones',cred=opc&&(ESTRATEGIAS.find(([n])=>n===d.estrategia)||[])[1]==='c';S.trades.push({id:uid(),fecha:d.fecha||today(),tipo:d.tipo,activo:d.activo.trim().toUpperCase(),dir:opc?(cred?'short':'long'):d.dir,entrada:+d.entrada,salida:+d.salida,cantidad:+d.cantidad,stop:d.stop?+d.stop:null,mult:d.tipo==='acciones'?1:(+d.mult||(opc?100:1)),...(opc?{estrategia:d.estrategia,venc:d.venc||'',strikes:(d.strikes||'').trim()}:{}),setup:d.setup,plan:d.plan==='1',emo:d.emo,nota:d.nota});if(!S.pedem.documentar)S.pedem.documentar=true;closeModal();toast('Operación guardada en tu bitácora')}
  if(k==='meta'){S.metas.push({id:uid(),titulo:d.titulo,area:d.area,objetivo:+d.objetivo,actual:+d.actual||0,fecha:d.fecha});toast('Meta creada')}
  if(k==='diag'){
    const st=DQ[S.diag.paso-1];
    if(st.meta){S.metas.push({id:uid(),titulo:d.titulo,area:'Finanzas',objetivo:+d.objetivo,actual:0,fecha:d.fecha});S.diag.resp.meta=d.titulo}
    else Object.assign(S.diag.resp,d);
    st.a.forEach(x=>S.diag.areas[x]=true);
    if(S.diag.paso<4){S.diag.paso++;save();render();diagModal();return}
    S.diag.hecho=true;closeModal();toast('Diagnóstico completo. Tu meta principal ya está en Mis Metas');
  }
  save();render();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closePop()}
  if(e.target.id==='q'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat(false)}
  if(e.target.id==='dQ'&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat(true)}});
document.addEventListener('click',e=>{const t=e.target instanceof Element?e.target:null;if(!t||!t.closest('.icons'))closePop()});

/* ---------- Geny (IA) + Drawer Deslizable ---------- */
let sending=false;
function afterChat(){const m=$('#msgs');if(m)m.scrollTop=m.scrollHeight;const dm=$('#dMsgs');if(dm)dm.scrollTop=dm.scrollHeight}
function drawerChipsFor(r){
  return ({
    radar:['¿Qué estrategia del Radar me conviene?','¿Cómo interpreto el VR?','Arma mi plan PEDEM semanal'],
    opciones:['Explícame esta estrategia y su riesgo','¿Qué pasa si sube la volatilidad?','¿Cómo elijo strikes más seguros?'],
    trading:['¿Qué patrón ves en mi bitácora?','¿Cómo voy con mi disciplina?','Analiza mis errores por emoción'],
    dinero:['¿Cómo va mi tasa de ahorro?','¿Dónde puedo recortar gastos?','Registra un gasto de $35 en comida'],
    metas:['¿Cómo acelero mi meta principal?','Crea una meta de ahorro a 6 meses'],
    reto21:['¿Cómo voy en el Reto 21?','Ayúdame con la misión de hoy','¿Qué regla rompo más?'],
    mentalidad:['Dame un reset rápido tras una pérdida','¿Cómo mejoro mi rutina pre-mercado?']
  }[r])||['¿Por dónde empiezo hoy?','¿Qué patrón ves en mi bitácora?','¿Cómo va mi tasa de ahorro?','Registra un gasto de $45 en comida'];
}
function renderDrawerChat(){
  const chips=$('#dChips'),dm=$('#dMsgs'),av=$('#dAvatar');
  if(av&&!av.innerHTML)av.innerHTML=BOT_PRO;
  if(chips)chips.innerHTML=drawerChipsFor(route()).map(c=>`<button type="button" class="chip">${esc(c)}</button>`).join('');
  if(dm)dm.innerHTML=S.chat.length?S.chat.map(m=>`<div class="msg ${m.role==='user'?'me':'g'}">${esc(m.content)}</div>`).join(''):`<div class="msg g">Consola Geny AI lista, ${esc(S.nombre)}. Consulta sobre el módulo actual o pídeme registrar una operación, gasto o meta.</div>`;
  afterChat();
}
let gd=null,gdSc=null,gdSh=null,gdFab=null,gdObs=null,drawerOpening=false,drawerOpenTimer=null,drawerCloseTimer=null;
function closeGenyDrawer(immediate=false){
  drawerOpening=false;clearTimeout(drawerOpenTimer);clearTimeout(drawerCloseTimer);
  if(!gd||!gd.open)return;
  if(immediate||!gdSc||gdSc.scrollLeft<=2){
    if(gdSc)gdSc.scrollTo({left:0,behavior:'instant'});
    gd.close();
    if(gdFab)gdFab.setAttribute('aria-expanded','false');
    return;
  }
  gdSc.scrollTo({left:0,behavior:'auto'});
  drawerCloseTimer=setTimeout(()=>{
    if(gd?.open&&!drawerOpening){
      if(gdSc)gdSc.scrollTo({left:0,behavior:'instant'});
      gd.close();
      if(gdFab)gdFab.setAttribute('aria-expanded','false');
    }
  },450);
}
async function openGenyDrawer(){
  bindDom();
  if(!gd||!gdSc||!gdSh)return go('geny');
  renderDrawerChat();
  drawerOpening=true;clearTimeout(drawerOpenTimer);clearTimeout(drawerCloseTimer);
  if(!gd.open)gd.showModal();
  if(!CSS.supports('scroll-initial-target','nearest')){
    gdSc.scrollTo({left:0,behavior:'instant'});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  }
  gdSc.scrollTo({left:gdSh.offsetWidth,behavior:'auto'});
  drawerOpenTimer=setTimeout(()=>{drawerOpening=false},420);
  if(gdFab)gdFab.setAttribute('aria-expanded','true');
}
function bindDom(){
  const nextGd=$('#genyDrawer'),nextSc=$('#genyDrawerScroller'),nextSh=$('#genyDrawerSheet');
  gd=nextGd;gdSc=nextSc;gdSh=nextSh;gdFab=$('#genyFab');
  if(gd&&gdSc&&gdSh&&!gd.dataset.bound){
    gd.dataset.bound='1';
    if(!CSS.supports('animation-timeline: scroll()')){
      gdSc.addEventListener('scroll',()=>{
        const ratio=Math.max(0,Math.min(1,gdSc.scrollLeft/Math.max(1,gdSh.offsetWidth)));
        gd.style.setProperty('--drawer-backdrop',String(ratio));
      });
    }
    if(gdObs){try{gdObs.disconnect()}catch(_){}}
    const visThresh=1/Math.max(320,window.innerWidth);
    gdObs=new IntersectionObserver(entries=>{
      const entry=entries[entries.length-1];
      if(!entry||!gd?.open)return;
      if(entry.intersectionRatio>=0.25)drawerOpening=false;
      if(!drawerOpening&&entry.intersectionRatio<visThresh){
        gd.close();
        if(gdFab)gdFab.setAttribute('aria-expanded','false');
      }else if(entry.intersectionRatio>=0.98&&gdFab){
        gdFab.setAttribute('aria-expanded','true');
      }
    },{root:gd,threshold:[visThresh,0.25,0.98]});
    gdObs.observe(gdSh);
    gd.addEventListener('click',e=>{if(!gdSh.contains(e.target))closeGenyDrawer()});
    gd.addEventListener('cancel',e=>{if(e.cancelable){e.preventDefault();closeGenyDrawer()}});
  }
}
function contexto(){
  const s=scores(),f=finanzas(),t=tstats();
  return `DATOS ACTUALES DEL USUARIO (${today()}):
Nombre: ${S.nombre}. Progreso: general ${s.gen}%, finanzas ${s.fin}%, trading ${s.tra}%, mentalidad ${s.men}%, hábitos ${s.hab}%.
Reto 21: ${S.reto.hechos.length}/21 misiones. Misión actual: ${MISIONES[retoDia()-1]}
PEDEM semana: ${PEDEM.map(([k,l])=>l+(S.pedem[k]?' ✓':' pendiente')).join(', ')}.
Finanzas: ingresos ${f.ing}, gastos ${f.gas}, ahorro ${f.aho}, tasa ahorro ${(f.tasa*100).toFixed(1)}%.
Movimientos recientes: ${S.movs.slice(-15).map(m=>`${m.fecha} ${m.tipo} ${m.cat} ${m.monto}`).join('; ')||'ninguno'}.
Trading: ${t.n} trades, P&L ${t.total.toFixed(2)}, win rate ${(t.wr*100).toFixed(0)}%, siguió plan ${(t.plan*100).toFixed(0)}%.
Bitácora reciente: ${S.trades.slice(-15).map(x=>`${x.fecha} ${x.activo} ${x.dir} ${x.setup} plan:${x.plan?'sí':'no'} emoción:${x.emo} P&L:${pnl(x).toFixed(2)} nota:"${x.nota}"`).join(' | ')||'vacía'}.
Metas: ${S.metas.map(m=>`${m.titulo} ${m.actual}/${m.objetivo} para ${m.fecha}`).join('; ')||'ninguna'}.
Check-ins 7 días: ${lastDays(7).map(d=>S.checks[d]?`${d} ánimo ${S.checks[d].animo} control ${S.checks[d].control}`:null).filter(Boolean).join('; ')||'ninguno'}.
Diagnóstico: ${S.diag.hecho?JSON.stringify(S.diag.resp):'sin completar'}.
Bitácora Reto 21: ${Object.entries(r21().dias).filter(([,x])=>x.cerrado).map(([n,x])=>`día ${n} (${x.fecha}) disciplina ${x.rev?.disciplina??'-'}, siguió plan ${x.rev?.siguio||'-'}, reglas rotas: ${(x.rev?.reglas||[]).join('/')||'ninguna'}, lección: ${x.rev?.leccion||'-'}`).join(' | ')||'sin días cerrados'}.`;
}
const SYS=`Eres Geny, mentora de inteligencia financiera, trading y alto rendimiento de INGRESARIOS. Hablas en español latino, cálida, directa y motivadora, con frases cortas y humor ligero; usa emojis con moderación. Usas el método PEDEM (Planear, Ejecutar, Documentar, Evaluar, Mejorar) y dices "bitácora", nunca "journal". Basa tus respuestas en los datos del usuario cuando sean relevantes y cita cifras concretas. Es educativo: no prometas rentabilidad ni des recomendaciones personalizadas de comprar o vender un activo concreto; recuerda la gestión del riesgo cuando aplique. Si el usuario pide registrar algo, usa la herramienta correspondiente y confirma lo que guardaste. Responde en texto plano, sin markdown con # ni tablas; máximo 180 palabras salvo que pidan más.`;
const TOOLS=[
 {name:'registrar_movimiento',description:'Guarda un ingreso, gasto o ahorro en Mi Dinero.',inputSchema:{type:'object',properties:{tipo:{type:'string',enum:['ingreso','gasto','ahorro']},categoria:{type:'string'},monto:{type:'number'},nota:{type:'string'},fecha:{type:'string',description:'YYYY-MM-DD; hoy si no se indica'}},required:['tipo','categoria','monto']},
  execute(i){S.movs.push({id:uid(),fecha:i.fecha||today(),tipo:i.tipo,cat:i.categoria,monto:+i.monto,nota:i.nota||''});save();return {ok:true}}},
 {name:'registrar_operacion',description:'Guarda una operación en la bitácora de trading.',inputSchema:{type:'object',properties:{activo:{type:'string'},dir:{type:'string',enum:['long','short']},entrada:{type:'number'},salida:{type:'number'},cantidad:{type:'number'},setup:{type:'string'},siguio_plan:{type:'boolean'},emocion:{type:'string'},nota:{type:'string'}},required:['activo','dir','entrada','salida','cantidad']},
  execute(i){S.trades.push({id:uid(),fecha:today(),activo:String(i.activo).toUpperCase(),dir:i.dir,entrada:+i.entrada,salida:+i.salida,cantidad:+i.cantidad,setup:i.setup||'Otro',plan:i.siguio_plan!==false,emo:i.emocion||'Calma',nota:i.nota||''});save();return {ok:true}}},
 {name:'crear_meta',description:'Crea una meta medible en Mis Metas.',inputSchema:{type:'object',properties:{titulo:{type:'string'},area:{type:'string'},objetivo:{type:'number'},actual:{type:'number'},fecha:{type:'string'}},required:['titulo','objetivo']},
  execute(i){S.metas.push({id:uid(),titulo:i.titulo,area:i.area||'Finanzas',objetivo:+i.objetivo,actual:+i.actual||0,fecha:i.fecha||daysAgo(-90)});save();return {ok:true}}}];
async function sendChat(inDrawer=false){
  const q=inDrawer?$('#dQ'):$('#q'),btn=inDrawer?$('#dSend'):$('#send'),box=inDrawer?$('#dMsgs'):$('#msgs');
  if(!q||!box||sending)return;const text=q.value.trim();if(!text)return;
  q.value='';sending=true;if(btn)btn.disabled=true;
  S.chat.push({role:'user',content:text});window.jrBump?.('geny');
  const liveId=inDrawer?'dLive':'live';
  box.insertAdjacentHTML('beforeend',`<div class="msg me">${esc(text)}</div><div class="msg g" id="${liveId}">Pensando…</div>`);afterChat();
  const live=document.getElementById(liveId);
  let toolRan=false;
  const wrappedTools=TOOLS.map(t=>({...t,execute(inp){toolRan=true;return t.execute(inp)}}));
  try{
    const sample=window.claude?.use?await claude.use('sample'):null;
    if(!sample){live.textContent='No estoy disponible en este momento. Mientras tanto, todos los módulos funcionan sin mí.';S.chat.pop();return}
    const hist=S.chat.slice(-12,-1).map(m=>({role:m.role,content:m.content}));
    while(hist.length&&hist[0].role!=='user')hist.shift();
    const msgs=[...hist,{role:'user',content:text}];
    const r=await sample(msgs,{cache:false,context:contexto(),tools:wrappedTools,onText:u=>{live.textContent=u.text;afterChat()}});
    live.textContent=r.text+(r.truncated?'\n\n(Respuesta recortada. Pídemelo por partes.)':'');
    S.chat.push({role:'assistant',content:live.textContent});S.chat=S.chat.slice(-40);save();
    if(toolRan&&inDrawer)render();
  }catch(err){
    S.chat.pop();
    const rawMsg=typeof err?.message==='string'?err.message.trim():'';
    const isGeneric=!rawMsg||rawMsg==='Sin conexión'||rawMsg==='Servicio no disponible';
    live.textContent=!isGeneric?rawMsg:err?.code==='rate_limited'?'Estoy recibiendo muchos mensajes. Espera un minuto y vuelve a escribirme.':err?.code==='not_granted'?'Necesito tu permiso para responder. Actívalo en el menú de permisos de esta app.':'No pude responder ahora. Intenta de nuevo en un momento.';
  }finally{live.removeAttribute('id');sending=false;if(btn)btn.disabled=false;$('#bellDot').hidden=!avisos().length}
}

/* ---------- Market replay ---------- */
// R.bars son las velas base (la temporalidad que llegó del proveedor). R.idx cuenta velas base.
// R.view son las velas agrupadas al marco de tiempo elegido (R.tf); la última puede estar "formándose".
const TFS=[[60,'1m'],[300,'5m'],[900,'15m'],[1800,'30m'],[3600,'1H'],[14400,'4H'],[86400,'D'],[604800,'S']];
const INT_SEC={'1min':60,'5min':300,'15min':900,'30min':1800,'1hour':3600,'4hour':14400,'1day':86400,'1week':604800};
const R={interval:'15min',sym:'DEMO',src:'Datos simulados',bars:[],view:[],idx:0,baseSec:300,tf:900,playing:false,speed:4,pos:null,trades:[],lines:[],ema:true,profile:'tpo',pscope:'session',tool:null,timer:null,sent:0,loading:false,err:'',aviso:''};
let CH=null,EMA20=[],EMA50=[];
const IND_DEF={estilo:'velas',filasS:24,filasV:48,va:70,ancho:26,colPoc:'#ffc21a',colVa:'#8a5cff',lineas:true,etiquetas:true,emaR:20,emaL:50,colR:'#00d2ff',colL:'#ffc21a',volumen:true};
const ind=()=>({...IND_DEF,...((typeof S!=='undefined'&&S&&S.ind)||{})});
const ESTILOS=[['velas','Velas'],['barras','Barras'],['linea','Línea'],['area','Área']];
const isLineStyle=()=>['linea','area'].includes(ind().estilo);
const toS=b=>isLineStyle()?{time:b.time,value:b.close}:{...b};
function mkMain(chart){const e=ind().estilo;
  if(e==='barras')return chart.addBarSeries({upColor:'#00FF94',downColor:'#FF4D6D',thinBars:false});
  if(e==='linea')return chart.addLineSeries({color:'#8CFF2E',lineWidth:2});
  if(e==='area')return chart.addAreaSeries({lineColor:'#8CFF2E',topColor:'rgba(140,255,46,.28)',bottomColor:'rgba(140,255,46,0)',lineWidth:2});
  return chart.addCandlestickSeries({upColor:'#00FF94',downColor:'#FF4D6D',borderVisible:false,wickUpColor:'#00FF94',wickDownColor:'#FF4D6D'})}
const hexA=(h,a)=>{const n=parseInt(String(h).slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`};
function indPanel(){const c=ind();
  const n=(k,l,min,max)=>`<label>${l}<input type="number" id="ind-${k}" data-ind="${k}" min="${min}" max="${max}" value="${c[k]}"></label>`;
  const col=(k,l)=>`<label class="colr">${l}<input type="color" id="ind-${k}" data-ind="${k}" value="${c[k]}"></label>`;
  const ck=(k,l)=>`<label class="ck"><input type="checkbox" id="ind-${k}" data-ind="${k}" ${c[k]?'checked':''}>${l}</label>`;
  return `<div class="indpanel f" id="indPanel" ${R.cfgOpen?'':'hidden'}>
   <fieldset><legend>Market / Volume Profile</legend><div class="r2">${n('filasS','Filas por sesión',8,120)}${n('filasV','Filas en rango visible',10,200)}</div><div class="r2">${n('va','Área de valor (%)',50,95)}${n('ancho','Ancho perfil visible (%)',10,60)}</div><div class="r2">${col('colPoc','Color POC')}${col('colVa','Color área de valor')}</div>${ck('lineas','Líneas POC, VAH y VAL')}${ck('etiquetas','Etiquetas de precio')}</fieldset>
   <fieldset><legend>Medias móviles (EMA)</legend><div class="r2">${n('emaR','Periodo rápida',2,400)}${col('colR','Color rápida')}</div><div class="r2">${n('emaL','Periodo lenta',2,400)}${col('colL','Color lenta')}</div></fieldset>
   <fieldset><legend>Volumen</legend>${ck('volumen','Mostrar volumen')}<button type="button" class="btn sm ghost" data-r="indReset" style="justify-self:start;margin-top:8px">Restablecer valores</button><p class="hint">Los cambios se aplican al instante y se guardan en tu cuenta.</p></fieldset>
  </div>`}
function applyInd(){const c=ind();document.querySelectorAll('[data-r="estilo"]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.v===c.estilo));if(CH&&CH.estilo!==c.estilo){mountReplay();return}const eb=document.querySelector('[data-r="ema"]');if(eb)eb.textContent=`EMA ${c.emaR}/${c.emaL}`;
  if(!CH)return;CH.e20.applyOptions({color:c.colR});CH.e50.applyOptions({color:c.colL});CH.vol.applyOptions({visible:c.volumen});fullDraw()}
document.addEventListener('input',e=>{const k=e.target.dataset?.ind;if(!k||typeof S==='undefined'||!S)return;const el=e.target;let v;
  if(el.type==='checkbox')v=el.checked;else if(el.type==='color')v=el.value;else{v=Math.round(+el.value);if(!isFinite(v)||v<+el.min||v>+el.max)return}
  S.ind={...(S.ind||{}),[k]:v};save();applyInd()});
function rng(seed){return()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646}}
function sampleBars(){
  // 15 sesiones simuladas de 5 minutos (9:30 a 16:00), con volumen en forma de U.
  const r=rng(7),out=[];let p=500,day=Date.UTC(2025,2,3)/1000;
  for(let s=0;s<15;){const dow=new Date(day*1000).getUTCDay();if(dow===0||dow===6){day+=86400;continue}
    const bias=(r()-.5)*.004;
    for(let k=0;k<78;k++){const t=day+9.5*3600+k*300,o=p,c=o*(1+bias/78*4+(r()-.5)*.0045),h=Math.max(o,c)*(1+r()*.0015),l=Math.min(o,c)*(1-r()*.0015);
      const u=Math.abs(k-39)/39;out.push({time:t,open:+o.toFixed(2),high:+h.toFixed(2),low:+l.toFixed(2),close:+c.toFixed(2),volume:Math.round((40+160*u*u)*1000*(.6+r()*.8))});p=c}
    s++;day+=86400}
  return out}
const snapSec=s=>TFS.reduce((b,[v])=>Math.abs(v-s)<Math.abs(b-s)?v:b,TFS[0][0]);
function setBars(bars,sym,src,tfWanted){
  bars=bars.filter(b=>isFinite(b.open)&&isFinite(b.close)).sort((a,b)=>a.time-b.time).filter((b,i,a)=>!i||b.time!==a[i-1].time);
  if(bars.length<20){R.err='Se necesitan al menos 20 velas para hacer replay.';return false}
  const gaps=bars.slice(1,60).map((b,i)=>b.time-bars[i].time).sort((a,b)=>a-b);
  const baseSec=snapSec(gaps[Math.floor(gaps.length/2)]);
  const tf=tfWanted&&tfWanted>=baseSec?tfWanted:baseSec;
  Object.assign(R,{bars,sym,src,baseSec,tf,idx:Math.min(bars.length,Math.max(20,Math.floor(bars.length*.4))),pos:null,trades:[],lines:[],sent:0,err:''});
  stopPlay();return true}
function bucket(t,tf=R.tf){
  if(tf>=604800){const d=Math.floor(t/86400),dow=(d+4)%7;return(d-((dow+6)%7))*86400}
  if(tf>=86400)return Math.floor(t/86400)*86400;
  return Math.floor(t/tf)*tf}
function aggregate(bars){const out=[];for(const b of bars)merge(out,b);return out}
function merge(out,b){const t=bucket(b.time),l=out[out.length-1];
  if(l&&l.time===t){l.high=Math.max(l.high,b.high);l.low=Math.min(l.low,b.low);l.close=b.close;l.volume+=b.volume||0;return false}
  out.push({time:t,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume||0});return true}
const fmtT=t=>{const s=new Date(t*1000).toISOString();return R.baseSec<86400?s.slice(0,16).replace('T',' '):s.slice(0,10)};
function emaCalc(n){const k=2/(n+1);let e;return R.view.map((b,i)=>{e=i?b.close*k+e*(1-k):b.close;return{time:b.time,value:+e.toFixed(4)}})}

/* Market Profile / Volume Profile dibujado dentro del gráfico */
function profileOf(bars,mode,rows){
  let lo=Infinity,hi=-Infinity;for(const b of bars){if(b.low<lo)lo=b.low;if(b.high>hi)hi=b.high}
  if(!isFinite(lo)||hi<=lo)return null;
  const step=(hi-lo)/rows,c=new Array(rows).fill(0);
  const useVol=mode==='vol'&&bars.some(b=>b.volume>0);
  for(const b of bars){const i0=Math.min(rows-1,Math.floor((b.low-lo)/step)),i1=Math.min(rows-1,Math.floor((b.high-lo)/step)),w=useVol?(b.volume||0)/(i1-i0+1):1;for(let i=i0;i<=i1;i++)c[i]+=w}
  let poc=0;for(let i=1;i<rows;i++)if(c[i]>c[poc])poc=i;
  const total=c.reduce((a,b)=>a+b,0);let a=poc,z=poc,acc=c[poc];
  while(acc<total*ind().va/100&&(a>0||z<rows-1)){const up=z<rows-1?c[z+1]:-1,dn=a>0?c[a-1]:-1;if(up>=dn){z++;acc+=up}else{a--;acc+=dn}}
  return{lo,step,c,poc,va:[a,z],max:c[poc],rows,price:i=>lo+(i+.5)*step}}
function drawProfile(ctx,W){
  if(R.profile==='off'||!CH||!R.view.length)return;
  const C=ind();
  const ts=CH.chart.timeScale(),rg=ts.getVisibleLogicalRange();if(!rg)return;
  const i0=Math.max(0,Math.floor(rg.from)),i1=Math.min(R.view.length-1,Math.ceil(rg.to));if(i1<i0)return;
  const y=p=>CH.candle.priceToCoordinate(p);
  const paint=(P,xStart,width,dir)=>{
    for(let i=0;i<P.rows;i++){if(!P.c[i])continue;
      const yTop=y(P.lo+(i+1)*P.step),yBot=y(P.lo+i*P.step);if(yTop==null||yBot==null)continue;
      const len=P.c[i]/P.max*width,h=Math.max(1,Math.abs(yBot-yTop)-1);
      ctx.fillStyle=i===P.poc?hexA(C.colPoc,.8):(i>=P.va[0]&&i<=P.va[1])?hexA(C.colVa,.45):hexA(C.colVa,.17);
      ctx.fillRect(dir>0?xStart:xStart-len,Math.min(yTop,yBot)+.5,len,h)}};
  const line=(price,x0,x1,color,dash,label)=>{if(!C.lineas)return;const yy=y(price);if(yy==null)return;ctx.strokeStyle=color;ctx.setLineDash(dash);ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x0,Math.round(yy)+.5);ctx.lineTo(x1,Math.round(yy)+.5);ctx.stroke();ctx.setLineDash([]);
    if(label&&C.etiquetas){ctx.fillStyle=color;ctx.font='10px "DM Mono",monospace';ctx.fillText(label,x0+3,yy-3)}};
  let P=null;
  if(R.pscope==='session'&&R.tf<86400){
    const sp=ts.options().barSpacing;let s=i0;
    while(s<=i1){const d=Math.floor(R.view[s].time/86400);let e=s;while(e+1<R.view.length&&Math.floor(R.view[e+1].time/86400)===d)e++;
      let a=s;while(a>0&&Math.floor(R.view[a-1].time/86400)===d)a--;
      const Q=profileOf(R.view.slice(a,e+1).length>2?R.bars.slice(R.bars.findIndex(b=>Math.floor(b.time/86400)===d),R.idx).filter(b=>Math.floor(b.time/86400)===d):R.view.slice(a,e+1),R.profile,C.filasS);
      const x0=ts.logicalToCoordinate(a),x1=ts.logicalToCoordinate(e);
      if(Q&&x0!=null&&x1!=null){const width=Math.max(20,(x1-x0+sp)*.9);paint(Q,x0-sp/2,width,1);
        line(Q.price(Q.poc),x0-sp/2,x1+sp/2,hexA(C.colPoc,.9),[4,3],'POC');
        line(Q.lo+(Q.va[1]+1)*Q.step,x0-sp/2,x1+sp/2,hexA(C.colVa,.85),[2,3]);
        line(Q.lo+Q.va[0]*Q.step,x0-sp/2,x1+sp/2,hexA(C.colVa,.85),[2,3]);P=Q}
      s=e+1}
  }else{
    const base=R.bars.slice(0,R.idx).filter(b=>b.time>=R.view[i0].time&&b.time<(R.view[i1+1]?.time??Infinity));
    P=profileOf(base.length>2?base:R.view.slice(i0,i1+1),R.profile,C.filasV);
    if(P){paint(P,W,W*C.ancho/100,-1);
      line(P.price(P.poc),0,W,hexA(C.colPoc,.9),[5,4],'POC '+P.price(P.poc).toFixed(2));
      line(P.lo+(P.va[1]+1)*P.step,0,W,hexA(C.colVa,.85),[2,4],'VAH '+(P.lo+(P.va[1]+1)*P.step).toFixed(2));
      line(P.lo+P.va[0]*P.step,0,W,hexA(C.colVa,.85),[2,4],'VAL '+(P.lo+P.va[0]*P.step).toFixed(2))}
  }
  R.lastProf=P?{poc:P.price(P.poc),vah:P.lo+(P.va[1]+1)*P.step,val:P.lo+P.va[0]*P.step}:null;
  queueMicrotask(profHud);
}
function profHud(){const el=$('#rp-prof');if(!el)return;const p=R.lastProf;
  const t=R.profile==='off'||!p?'':`${R.profile==='vol'?'Volume':'Market'} Profile ${R.pscope==='session'&&R.tf<86400?'(sesión actual)':'(visible)'}: POC ${p.poc.toFixed(2)} · VAH ${p.vah.toFixed(2)} · VAL ${p.val.toFixed(2)}`;
  if(el.textContent!==t)el.textContent=t}
const profilePrimitive={_p:null,attached(p){this._p=p},detached(){this._p=null},updateAllViews(){},
  paneViews(){return[{zOrder:()=>'bottom',renderer:()=>({draw(target){target.useMediaCoordinateSpace(({context,mediaSize})=>drawProfile(context,mediaSize.width))}})}]},
  refresh(){this._p?.requestUpdate()}};

VIEWS.replay=function(){
  const tfs=TFS.filter(([s])=>s>=R.baseSec&&(s%R.baseSec===0||s>=86400));
  return `<div class="vhead"><div><h1>Market Replay</h1><p>Retrocede el mercado, oculta el futuro y opera vela por vela como si fuera en vivo. Practica tu setup sin arriesgar dinero.</p></div></div>
  <div class="rp"><div style="min-width:0">
   <form class="rp-bar" id="rpLoad">
    <input type="text" id="rp-sym" value="${esc(R.sym==='DEMO'?'SPY':R.sym)}" aria-label="Símbolo" maxlength="15" title="Ej.: SPY, AAPL, ^GSPC, ES=F, EURUSD=X, BTCUSDT">
    <input type="date" id="rp-from" value="${daysAgo(R.interval==='1day'||R.interval==='1week'?730:30)}" aria-label="Desde">
    <input type="date" id="rp-to" value="${today()}" aria-label="Hasta">
    <select id="rp-int" aria-label="Temporalidad a descargar">${[['1week','Semanal'],['1day','Diario'],['4hour','4 horas'],['1hour','1 hora'],['30min','30 min'],['15min','15 min'],['5min','5 min'],['1min','1 min']].map(([v,l])=>`<option value="${v}" ${R.interval===v?'selected':''}>${l}</option>`).join('')}</select>
    <button class="btn sm">${R.loading?'Cargando…':'Cargar datos'}</button>
    <label class="btn sm ghost" style="cursor:pointer">Subir CSV<input type="file" id="rp-csv" accept=".csv,text/csv" hidden></label>
    <button type="button" class="btn sm ghost" data-r="demo">Simulados</button>
   </form>
   <div class="tfrow">
    <div class="inline">
    <div class="tfs" role="group" aria-label="Estilo del gráfico">${ESTILOS.map(([v,l])=>`<button type="button" data-r="estilo" data-v="${v}" aria-pressed="${ind().estilo===v}">${l}</button>`).join('')}</div>
    <div class="tfs" role="group" aria-label="Marco de tiempo">${tfs.map(([s,l])=>`<button type="button" data-r="tf" data-s="${s}" aria-pressed="${R.tf===s}">${l}</button>`).join('')}</div>
    </div>
    <div class="inds">
     <select id="rp-prof-mode" aria-label="Perfil">${[['off','Sin perfil'],['tpo','Market Profile (TPO)'],['vol','Volume Profile']].map(([v,l])=>`<option value="${v}" ${R.profile===v?'selected':''}>${l}</option>`).join('')}</select>
     <select id="rp-prof-scope" aria-label="Rango del perfil" ${R.tf>=86400?'disabled':''}>${[['session','Por sesión'],['visible','Rango visible']].map(([v,l])=>`<option value="${v}" ${R.pscope===v?'selected':''}>${l}</option>`).join('')}</select>
     <button type="button" class="btn sm ghost tool" data-r="ema" aria-pressed="${R.ema}">EMA ${ind().emaR}/${ind().emaL}</button>
     <button type="button" class="btn sm ghost tool" data-r="cfg" aria-expanded="${!!R.cfgOpen}" aria-pressed="${!!R.cfgOpen}" aria-controls="indPanel">Configurar</button>
    </div>
   </div>
   ${indPanel()}
   <div class="chartbox" id="chart"><div class="msg0" id="chartMsg" hidden></div></div>
   <p class="srcnote prof" id="rp-prof"></p>
   <div class="ctrl">
    <button class="btn" data-r="play" id="rp-play">${R.playing?'Pausar':'Reproducir'}</button>
    <button class="btn ghost" data-r="step">Siguiente vela</button>
    <select id="rp-speed" aria-label="Velocidad" class="btn ghost" style="padding:9px 12px">${[1,2,4,8,15,30].map(s=>`<option value="${s}" ${R.speed===s?'selected':''}>${s} velas/s</option>`).join('')}</select>
    <input type="range" id="rp-pos" min="20" max="${R.bars.length}" value="${R.idx}" aria-label="Punto del replay">
   </div>
   <div class="ctrl">
    <button class="btn sm ghost tool" data-r="tool" data-t="inicio" aria-pressed="${R.tool==='inicio'}">Elegir inicio en el gráfico</button>
    <button class="btn sm ghost tool" data-r="tool" data-t="linea" aria-pressed="${R.tool==='linea'}">Línea horizontal</button>
    <button class="btn sm ghost" data-r="clearLines">Borrar líneas</button>
   </div>
   <p class="srcnote" id="rp-src"></p>
   ${R.aviso?`<p class="srcnote" style="color:var(--amber)">${esc(R.aviso)}</p>`:''}
  </div>
  <aside class="hud">
   <div class="panel"><div class="ph"><h2>${esc(R.sym)}</h2><span class="tag" id="rp-date"></span></div>
    <div class="hud">
     <div class="row"><span class="muted">Precio</span><b id="rp-px"></b></div>
     <div class="row"><span class="muted">Posición</span><b id="rp-posi"></b></div>
     <div class="row"><span class="muted">P&amp;L abierto</span><b id="rp-open"></b></div>
     <div class="row"><span class="muted">P&amp;L realizado</span><b id="rp-real"></b></div>
     <div class="row"><span class="muted">Trades · acierto</span><b id="rp-wr"></b></div>
    </div></div>
   <div class="panel"><div class="ph"><h2>Orden</h2></div>
    <div class="f">
     <div class="r2"><label>Cantidad<input id="rp-qty" type="number" min="1" step="any" value="10"></label><label>Stop<input id="rp-sl" type="number" step="any" placeholder="Opcional"></label></div>
     <label>Objetivo<input id="rp-tp" type="number" step="any" placeholder="Opcional"></label>
     <div class="buysell"><button type="button" class="btn buy" data-r="buy">Comprar</button><button type="button" class="btn sell" data-r="sell">Vender</button></div>
     <button type="button" class="btn ghost" data-r="close">Cerrar posición</button>
    </div>
    <p class="srcnote">Atajos: <span class="kbd">Espacio</span> reproducir · <span class="kbd">→</span> vela · <span class="kbd">B</span> comprar · <span class="kbd">S</span> vender · <span class="kbd">C</span> cerrar</p></div>
   <div class="panel"><div class="ph"><h2>Operaciones</h2><button class="btn sm ghost" data-r="send">Enviar a bitácora</button></div><div class="rtrades" id="rp-list"></div></div>
  </aside></div>
  <p class="risk">Simulación educativa con datos históricos retrasados. Los resultados en replay no garantizan resultados en vivo; operar implica riesgo de pérdida.</p>`;
};

function mountReplay(retry=0){
  if(!R.bars.length)setBars(sampleBars(),'DEMO','Datos simulados (velas de 5 min)',900);
  if(CH){try{CH.chart.remove()}catch(e){}CH=null}
  const box=$('#chart');if(!box)return;
  if(!window.LightweightCharts){const msg=$('#chartMsg');if(msg){msg.hidden=false;msg.textContent=retry<25?'Cargando graficador…':'No se pudo cargar el graficador. Recarga la página.'}if(retry<25)setTimeout(()=>{if(route()==='replay')mountReplay(retry+1)},200);return}
  const msg=$('#chartMsg');if(msg)msg.hidden=true;
  const chart=LightweightCharts.createChart(box,{autoSize:true,layout:{background:{type:'solid',color:'#0A0F15'},textColor:'#8395A8',fontFamily:'DM Mono, monospace'},
    grid:{vertLines:{color:'#121B25'},horzLines:{color:'#121B25'}},crosshair:{mode:0},rightPriceScale:{borderColor:'#1E2B38'},
    timeScale:{borderColor:'#1E2B38',timeVisible:R.tf<86400,rightOffset:12,shiftVisibleRangeOnNewBar:true}});
  const candle=mkMain(chart);
  const vol=chart.addHistogramSeries({visible:ind().volumen,priceFormat:{type:'volume'},priceScaleId:'vol',lastValueVisible:false,priceLineVisible:false});
  chart.priceScale('vol').applyOptions({scaleMargins:{top:.82,bottom:0}});
  const e20=chart.addLineSeries({color:ind().colR,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  const e50=chart.addLineSeries({color:ind().colL,lineWidth:1,priceLineVisible:false,lastValueVisible:false,crosshairMarkerVisible:false});
  candle.attachPrimitive(profilePrimitive);
  CH={chart,candle,vol,e20,e50,plines:[],dlines:[],estilo:ind().estilo};
  chart.subscribeClick(p=>{
    if(!p.point)return;
    if(R.tool==='linea'){const price=candle.coordinateToPrice(p.point.y);if(price==null)return;R.lines.push(+price.toFixed(2));drawLines();setTool(null);return}
    if(R.tool==='inicio'&&p.time!=null){let i=-1;for(let k=0;k<R.bars.length;k++){if(bucket(R.bars[k].time)===p.time)i=k;else if(i>=0)break}
      if(i>=19){if(R.pos)closePos(R.bars[R.idx-1].close,'Cambio de inicio');R.idx=i+1;R.trades=[];R.sent=0;fullDraw(true)}setTool(null)}
  });
  fullDraw(true);
}
function volBar(b){return{time:b.time,value:b.volume||0,color:b.close>=b.open?'rgba(0,255,148,.35)':'rgba(255,77,109,.35)'}}
function fullDraw(fit){
  if(!CH)return;
  R.view=aggregate(R.bars.slice(0,R.idx));
  CH.candle.setData(R.view.map(toS));CH.vol.setData(R.view.map(volBar));
  EMA20=emaCalc(ind().emaR);EMA50=emaCalc(ind().emaL);
  CH.e20.setData(R.ema?EMA20:[]);CH.e50.setData(R.ema?EMA50:[]);
  if(fit)CH.chart.timeScale().setVisibleLogicalRange({from:Math.max(0,R.view.length-110),to:R.view.length+12});
  drawLines();drawPos();drawMarkers();hud();profilePrimitive.refresh();
}
function drawLines(){CH.dlines.forEach(l=>CH.candle.removePriceLine(l));CH.dlines=R.lines.map(price=>CH.candle.createPriceLine({price,color:'#8A5CFF',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:''}))}
function drawPos(){CH.plines.forEach(l=>CH.candle.removePriceLine(l));CH.plines=[];const p=R.pos;if(!p)return;
  CH.plines.push(CH.candle.createPriceLine({price:p.entry,color:'#E6F1FA',lineWidth:1,lineStyle:0,axisLabelVisible:true,title:p.dir==='long'?'Compra':'Venta'}));
  if(p.sl)CH.plines.push(CH.candle.createPriceLine({price:p.sl,color:'#FF4D6D',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Stop'}));
  if(p.tp)CH.plines.push(CH.candle.createPriceLine({price:p.tp,color:'#00FF94',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Objetivo'}))}
function drawMarkers(){const m=[],last=R.view[R.view.length-1]?.time??0;
  const mk=(t,dir)=>({time:bucket(t),position:dir==='long'?'belowBar':'aboveBar',color:dir==='long'?'#00FF94':'#FF4D6D',shape:dir==='long'?'arrowUp':'arrowDown',text:dir==='long'?'C':'V'});
  R.trades.forEach(t=>{m.push(mk(t.t0,t.dir));m.push({time:bucket(t.t1),position:'aboveBar',color:'#E6F1FA',shape:'circle',text:(t.pnl>=0?'+':'')+t.pnl.toFixed(0)})});
  if(R.pos)m.push(mk(R.pos.t0,R.pos.dir));
  CH.candle.setMarkers(m.filter(x=>x.time<=last).sort((a,b)=>a.time-b.time))}
const rpnl=(p,px)=>(px-p.entry)*p.qty*(p.dir==='short'?-1:1);
function hud(){
  const b=R.bars[R.idx-1];if(!b||!$('#rp-px'))return;
  $('#rp-date').textContent=fmtT(b.time);$('#rp-px').textContent=b.close.toFixed(2);
  $('#rp-posi').textContent=R.pos?`${R.pos.dir==='long'?'Compra':'Venta'} ${R.pos.qty} @ ${R.pos.entry.toFixed(2)}`:'Sin posición';
  const op=R.pos?rpnl(R.pos,b.close):0;const oe=$('#rp-open');oe.textContent=money(+op.toFixed(2));oe.className=op>0?'up':op<0?'down':'';
  const re=R.trades.reduce((a,t)=>a+t.pnl,0);const rr=$('#rp-real');rr.textContent=money(+re.toFixed(2));rr.className=re>0?'up':re<0?'down':'';
  const w=R.trades.filter(t=>t.pnl>0).length;$('#rp-wr').textContent=R.trades.length?`${R.trades.length} · ${Math.round(w/R.trades.length*100)}%`:'0';
  $('#rp-pos').max=R.bars.length;$('#rp-pos').value=R.idx;
  const lbl=TFS.find(([s])=>s===R.baseSec)?.[1]||'';
  $('#rp-src').textContent=`Fuente: ${R.src} · ${R.bars.length} velas base de ${lbl} · vela ${R.idx} de ${R.bars.length}`;
  $('#rp-list').innerHTML=R.trades.length?`<div class="tbl"><table><tbody>${R.trades.slice().reverse().map(t=>`<tr><td>${t.dir==='long'?'Compra':'Venta'} ${t.qty}</td><td class="num muted">${fmtT(t.t0)}</td><td class="n ${t.pnl>=0?'up':'down'}">${money(+t.pnl.toFixed(2))}</td></tr>`).join('')}</tbody></table></div>`:'<div class="empty" style="padding:14px">Aún no operas en este replay.</div>';
}
function step(){
  if(R.idx>=R.bars.length){stopPlay();toast('Llegaste al final de los datos');return}
  const b=R.bars[R.idx];R.idx++;
  merge(R.view,b);const v=R.view[R.view.length-1];
  if(CH){CH.candle.update(toS(v));CH.vol.update(volBar(v));
    if(R.ema){EMA20=emaCalc(ind().emaR);EMA50=emaCalc(ind().emaL);CH.e20.update(EMA20[EMA20.length-1]);CH.e50.update(EMA50[EMA50.length-1])}
    profilePrimitive.refresh()}
  const p=R.pos;
  if(p){const L=p.dir==='long';
    if(p.sl&&(L?b.low<=p.sl:b.high>=p.sl))closePos(L?Math.min(p.sl,b.open):Math.max(p.sl,b.open),'Stop');
    else if(p.tp&&(L?b.high>=p.tp:b.low<=p.tp))closePos(L?Math.max(p.tp,b.open):Math.min(p.tp,b.open),'Objetivo')}
  hud();
}
function stopPlay(){R.playing=false;clearInterval(R.timer);R.timer=null;const b=$('#rp-play');if(b)b.textContent='Reproducir'}
function play(){if(R.playing){stopPlay();return}R.playing=true;$('#rp-play').textContent='Pausar';R.timer=setInterval(step,1000/R.speed)}
function openPos(dir){
  if(R.pos){toast('Ya tienes una posición abierta. Ciérrala primero');return}
  const b=R.bars[R.idx-1],qty=parseFloat($('#rp-qty').value),sl=parseFloat($('#rp-sl').value),tp=parseFloat($('#rp-tp').value);
  if(!(qty>0)){toast('Escribe una cantidad mayor que cero');return}
  const L=dir==='long';
  if(sl&&(L?sl>=b.close:sl<=b.close)){toast(L?'En una compra el stop va por debajo del precio':'En una venta el stop va por encima del precio');return}
  if(tp&&(L?tp<=b.close:tp>=b.close)){toast(L?'En una compra el objetivo va por encima del precio':'En una venta el objetivo va por debajo del precio');return}
  R.pos={dir,qty,entry:b.close,t0:b.time,sl:sl||null,tp:tp||null};
  if(CH){drawPos();drawMarkers()}hud();toast(`${L?'Compra':'Venta'} a ${b.close.toFixed(2)}`)}
function closePos(px,why){
  const p=R.pos;if(!p){toast('No tienes posición abierta');return}
  if(px==null)px=R.bars[R.idx-1].close;
  R.trades.push({...p,exit:px,t1:R.bars[R.idx-1].time,pnl:rpnl(p,px),why:why||'Manual'});R.pos=null;
  if(CH){drawPos();drawMarkers()}hud();toast(`${why||'Posición cerrada'}: ${money(+rpnl(p,px).toFixed(2))}`)}
function setTool(t){R.tool=t;document.querySelectorAll('[data-r="tool"]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));if(t==='inicio')toast('Toca la vela donde quieres empezar el replay');if(t==='linea')toast('Toca el precio donde quieres la línea')}
async function loadReal(){
  const sym=$('#rp-sym').value.trim().toUpperCase(),from=$('#rp-from').value,to=$('#rp-to').value,interval=$('#rp-int').value;
  if(!sym){toast('Escribe un símbolo, por ejemplo SPY');return}
  const mcp=window.claude?.use?await claude.use('mcp'):null;
  if(!mcp){toast('Los precios no están disponibles por ahora. Usa CSV o datos simulados');return}
  R.interval=interval;R.loading=true;stopPlay();toast(`Cargando ${sym}…`);
  try{
    const res=await mcp.callTool('FMP','chart',{endpoint:'historical-price-eod-full',symbol:sym,from_date:from,to_date:to,interval});
    let rows=res?.payload;if(rows&&!Array.isArray(rows))rows=rows.historical||rows.data||rows.results;
    if(!Array.isArray(rows)||!rows.length)throw new Error(`No encontré datos para ${sym} en esas fechas.`);
    const bars=rows.map(x=>({time:Date.parse(x.date)/1000,open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+x.volume||0}));
    const prov=(res?.provider||res?.source)==='fmp'?'FMP':'Yahoo Finance';
    const intLbl={'1week':'semanal','1day':'diario','4hour':'1h → 4h','1hour':'1h','30min':'30m','15min':'15m','5min':'5m','1min':'1m'}[interval]||interval;
    if(!setBars(bars,sym,`${prov} (${intLbl})`,INT_SEC[interval]))throw new Error(R.err);
    const maxD={'1min':7,'5min':58,'15min':58,'30min':58,'1hour':720,'4hour':720}[interval];
    const spanD=(from&&to)?(Date.parse(to)-Date.parse(from))/864e5:0;
    R.aviso=(res?.clampedDays||(maxD&&spanD>maxD))?`Para velas de ${intLbl}, el historial gratuito cubre los últimos ${res?.clampedDays||maxD} días.`:'';
    R.loading=false;render();
  }catch(e){R.loading=false;toast(e?.code==='server_not_connected'?'Los precios no están disponibles por ahora. Usa CSV o datos simulados':e?.message||'No pude cargar los datos. Intenta de nuevo')}
}
function loadCSV(file){
  const fr=new FileReader();fr.onload=()=>{
    const lines=String(fr.result).trim().split(/\r?\n/);if(lines.length<2){toast('El CSV está vacío');return}
    const sep=lines[0].includes(';')?';':',',H=lines[0].toLowerCase().split(sep).map(h=>h.trim().replace(/"/g,''));
    const col=re=>H.findIndex(h=>re.test(h)),ci={t:col(/^(time|date|fecha|datetime|timestamp)/),o:col(/^open|apertura/),h:col(/^high|máximo|maximo/),l:col(/^low|mínimo|minimo/),c:col(/^close|cierre/),v:col(/^vol/)};
    if([ci.t,ci.o,ci.h,ci.l,ci.c].some(i=>i<0)){toast('El CSV necesita columnas time, open, high, low y close');return}
    const bars=lines.slice(1).map(ln=>{const c=ln.split(sep).map(x=>x.trim().replace(/"/g,''));let t=c[ci.t];t=/^\d+(\.\d+)?$/.test(t)?(+t>1e12?+t/1000:+t):Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(t)?t:t.replace(' ','T')+(/[zZ+]/.test(t)?'':'Z'))/1000;
      return{time:Math.floor(t),open:+c[ci.o],high:+c[ci.h],low:+c[ci.l],close:+c[ci.c],volume:ci.v>=0?+c[ci.v]||0:0}}).filter(b=>isFinite(b.time));
    const sym=file.name.replace(/\.csv$/i,'').split(/[_ ,]/)[0].toUpperCase().slice(0,12)||'CSV';
    if(setBars(bars,sym,'CSV subido')){R.aviso='';render();toast(`${bars.length} velas cargadas`)}else toast(R.err)};
  fr.readAsText(file)}
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target:null;if(!t)return;
  const b=t.closest('[data-r]');if(!b)return;const a=b.dataset.r;
  ({play,step,buy:()=>openPos('long'),sell:()=>openPos('short'),close:()=>closePos(),
    demo(){setBars(sampleBars(),'DEMO','Datos simulados (velas de 5 min)',900);R.aviso='';render()},
    tf(){R.tf=+b.dataset.s;document.querySelectorAll('[data-r="tf"]').forEach(x=>x.setAttribute('aria-pressed',x===b));
      const sc=$('#rp-prof-scope');if(sc)sc.disabled=R.tf>=86400;
      if(CH){CH.chart.applyOptions({timeScale:{timeVisible:R.tf<86400}});fullDraw(true)}},
    tool(){setTool(R.tool===b.dataset.t?null:b.dataset.t)},
    clearLines(){R.lines=[];if(CH)drawLines()},
    estilo(){S.ind={...(S.ind||{}),estilo:b.dataset.v};save();applyInd()},
    cfg(){R.cfgOpen=!R.cfgOpen;$('#indPanel').hidden=!R.cfgOpen;b.setAttribute('aria-expanded',R.cfgOpen);b.setAttribute('aria-pressed',R.cfgOpen)},
    indReset(){delete S.ind;save();$('#indPanel').outerHTML=indPanel();applyInd();toast('Valores restablecidos')},
    ema(){R.ema=!R.ema;b.setAttribute('aria-pressed',R.ema);fullDraw()},
    send(){const nuevos=R.trades.slice(R.sent);if(!nuevos.length){toast('No hay operaciones nuevas para enviar');return}
      nuevos.forEach(t=>S.trades.push({id:uid(),fecha:today(),activo:R.sym,dir:t.dir,entrada:+t.entry.toFixed(4),salida:+t.exit.toFixed(4),cantidad:t.qty,setup:'Replay (práctica)',plan:true,emo:'Calma',nota:`Market replay · vela ${fmtT(t.t0)} · salida: ${t.why}`}));
      R.sent=R.trades.length;save();toast(`${nuevos.length} operación(es) enviadas a tu bitácora`)}})[a]?.();
});
document.addEventListener('submit',e=>{if(e.target.id==='rpLoad'){e.preventDefault();e.stopImmediatePropagation();loadReal()}},true);
document.addEventListener('change',e=>{
  if(e.target.id==='rp-int'){R.interval=e.target.value;const fr=$('#rp-from');if(fr){const d={'1min':7,'5min':30,'15min':30,'30min':30,'1hour':90,'4hour':120,'1day':730,'1week':1095}[R.interval]||30;fr.value=daysAgo(d)}}
  if(e.target.id==='rp-csv'&&e.target.files[0])loadCSV(e.target.files[0]);
  if(e.target.id==='rp-speed'){R.speed=+e.target.value;if(R.playing){clearInterval(R.timer);R.timer=setInterval(step,1000/R.speed)}}
  if(e.target.id==='rp-estilo'&&S){S.ind={...(S.ind||{}),estilo:e.target.value};save();applyInd()}
  if(e.target.id==='rp-prof-mode'){R.profile=e.target.value;profilePrimitive.refresh();if(R.profile==='off')profHud()}
  if(e.target.id==='rp-prof-scope'){R.pscope=e.target.value;profilePrimitive.refresh()}
});
document.addEventListener('input',e=>{if(e.target.id==='rp-pos'){const v=+e.target.value;if(R.pos&&v<R.idx){e.target.value=R.idx;toast('Cierra tu posición antes de retroceder');return}R.idx=v;fullDraw()}});
document.addEventListener('keydown',e=>{
  if(route()!=='replay'||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.ctrlKey)return;
  const k=e.key.toLowerCase();
  if(k===' '){e.preventDefault();play()}else if(k==='arrowright'){e.preventDefault();step()}else if(k==='b')openPos('long');else if(k==='s')openPos('short');else if(k==='c')closePos();
});

/* ---------- Estrategias de opciones (constructor y simulador) ---------- */
// S.opc = estrategia en pantalla; S.estrats = estrategias guardadas.
// Precios teóricos con Black-Scholes (sin dividendos); el usuario puede escribir la prima real por pata.
I.payoff='<path d="M3 17h6l6-10h6"/><path d="M3 12h18" stroke-dasharray="1.5 3"/>';
const osN=x=>{const t=1/(1+.2316419*Math.abs(x)),d=.3989423*Math.exp(-x*x/2),p=d*t*(.3193815+t*(-.3565638+t*(1.781478+t*(-1.821256+t*1.330274))));return x>0?1-p:p};
const osPdf=x=>Math.exp(-x*x/2)/Math.sqrt(2*Math.PI);
function osBS(type,S0,K,T,v,r){
  const c=type==='c';
  if(T<=0||v<=0)return{p:c?Math.max(S0-K,0):Math.max(K-S0,0),d:c?(S0>K?1:0):(S0<K?-1:0),g:0,th:0,ve:0};
  if(S0<=0)return{p:c?0:K*Math.exp(-r*T),d:c?0:-1,g:0,th:0,ve:0};
  const sq=v*Math.sqrt(T),d1=(Math.log(S0/K)+(r+v*v/2)*T)/sq,d2=d1-sq,df=Math.exp(-r*T);
  return{p:c?S0*osN(d1)-K*df*osN(d2):K*df*osN(-d2)-S0*osN(-d1),d:c?osN(d1):osN(d1)-1,g:osPdf(d1)/(S0*sq),
    th:(-S0*osPdf(d1)*v/(2*Math.sqrt(T))-(c?1:-1)*r*K*df*osN(c?d2:-d2))/365,ve:S0*osPdf(d1)*Math.sqrt(T)/100}}
const opcStep=s=>s<25?.5:s<100?1:s<250?2.5:s<1000?5:s<3000?10:25;
const opcW=s=>{const st=opcStep(s);return Math.max(st,Math.round(s*.025/st)*st)};
const opcAtm=s=>{const st=opcStep(s);return Math.max(st,Math.round(s/st)*st)};
const OPC_LVL=[['1','Principiante'],['2','Intermedio'],['3','Avanzado'],['4','Experto']];
const OPC_BIAS={a:'Alcista',b:'Bajista',n:'Neutral',v:'Busca movimiento'};
// [nombre, nivel, grupo, sesgo, para qué sirve, patas: [lado, tipo, distancia al dinero, cantidad, vencimiento lejano]]
const OPC_TPL=[
 ['Compra de call','1','Básicas','a','Apuesta alcista: si sube, ganas sin techo; si no, pierdes solo la prima.',[[1,'c',0]]],
 ['Compra de put','1','Básicas','b','Apuesta bajista con riesgo limitado a la prima que pagas.',[[1,'p',0]]],
 ['Covered call','1','Renta','a','Tienes 100 acciones y cobras renta vendiendo un call. Limitas la ganancia arriba.',[[1,'s',0,100],[-1,'c',2]]],
 ['Venta de put','1','Renta','a','Cobras prima por comprometerte a comprar más abajo. Si el precio cae fuerte, la pérdida es grande.',[[-1,'p',-1]]],
 ['Put protectora','1','Otras','a','Un seguro para tus acciones: el put limita cuánto puedes perder.',[[1,'s',0,100],[1,'p',-2]]],
 ['Bull put spread','2','Spreads de crédito','a','Cobras un crédito y te lo quedas si el precio se sostiene arriba del put vendido.',[[-1,'p',-1],[1,'p',-3]]],
 ['Bear call spread','2','Spreads de crédito','b','Cobras un crédito y te lo quedas si el precio se queda debajo del call vendido.',[[-1,'c',1],[1,'c',3]]],
 ['Bull call spread','2','Spreads de débito','a','Alcista y más barato: vendes un call más arriba para financiar el que compras.',[[1,'c',0],[-1,'c',2]]],
 ['Bear put spread','2','Spreads de débito','b','Bajista y más barato: vendes un put más abajo para financiar el que compras.',[[1,'p',0],[-1,'p',-2]]],
 ['Iron butterfly','2','Neutrales','n','Vendes put y call en el dinero y compras alas: mucho crédito, rango estrecho.',[[1,'p',-2],[-1,'p',0],[-1,'c',0],[1,'c',2]]],
 ['Iron condor','2','Neutrales','n','Cobras crédito si el precio se queda dentro de un rango. Riesgo definido en ambos lados.',[[1,'p',-4],[-1,'p',-2],[-1,'c',2],[1,'c',4]]],
 ['Butterfly','2','Neutrales','n','Barata y precisa: gana más si el precio termina clavado en el strike central.',[[1,'c',-2],[-1,'c',0,2],[1,'c',2]]],
 ['Butterfly de puts','2','Neutrales','n','La misma mariposa armada con puts: apunta a que el precio termine en el strike central.',[[1,'p',2],[-1,'p',0,2],[1,'p',-2]]],
 ['Long straddle','2','Direccionales','v','Compras put y call en el dinero: ganas si el precio se mueve fuerte hacia cualquier lado.',[[1,'p',0],[1,'c',0]]],
 ['Long strangle','2','Direccionales','v','Como el straddle pero más barato: necesitas un movimiento más grande.',[[1,'p',-2],[1,'c',2]]],
 ['Iron butterfly inverso','2','Direccionales','v','Pagas un débito pequeño y ganas si el precio se aleja del centro. Riesgo y ganancia definidos.',[[-1,'p',-2],[1,'p',0],[1,'c',0],[-1,'c',2]]],
 ['Iron condor inverso','2','Direccionales','v','Ganas si el precio rompe el rango hacia cualquier lado. Riesgo y ganancia definidos.',[[-1,'p',-4],[1,'p',-2],[1,'c',2],[-1,'c',4]]],
 ['Calendar spread','2','Calendarios','n','Vendes el vencimiento cercano y compras el lejano en el mismo strike: gana con el paso del tiempo.',[[-1,'c',0],[1,'c',0,1,1]]],
 ['Calendar de puts','2','Calendarios','n','El calendario armado con puts: gana si el precio se queda cerca del strike mientras pasa el tiempo.',[[-1,'p',0],[1,'p',0,1,1]]],
 ['Diagonal spread','2','Calendarios','a','Call largo y lejano en lugar de acciones, más un call corto cercano que paga renta.',[[1,'c',-3,1,1],[-1,'c',2]]],
 ['Diagonal de puts','2','Calendarios','b','Put largo y lejano, más un put corto cercano que paga renta. Sesgo bajista.',[[1,'p',3,1,1],[-1,'p',-2]]],
 ['Collar','2','Otras','a','Proteges tus acciones con un put y lo pagas vendiendo un call.',[[1,'s',0,100],[1,'p',-2],[-1,'c',2]]],
 ['Venta de call','3','Descubiertas','b','Cobras prima apostando a que no sube. Sin acciones que la respalden, el riesgo no tiene tope.',[[-1,'c',1]]],
 ['Short straddle','3','Neutrales','n','Vendes put y call en el dinero. Mucho crédito y riesgo sin tope.',[[-1,'p',0],[-1,'c',0]]],
 ['Short strangle','3','Neutrales','n','Vendes put y call fuera del dinero. Rango amplio, pero el riesgo no tiene tope.',[[-1,'p',-2],[-1,'c',2]]],
 ['Condor de calls','3','Neutrales','n','Como la mariposa pero con una meseta más ancha de ganancia máxima.',[[1,'c',-4],[-1,'c',-2],[-1,'c',2],[1,'c',4]]],
 ['Covered short strangle','3','Renta','a','Acciones más put y call vendidos: doble renta, y te comprometes a comprar más si el precio cae.',[[1,'s',0,100],[-1,'p',-2],[-1,'c',2]]],
 ['Call ratio backspread','3','Ratios','a','Vendes un call y compras dos más arriba: gana fuerte si el precio se dispara.',[[-1,'c',0],[1,'c',2,2]]],
 ['Put ratio backspread','3','Ratios','b','Vendes un put y compras dos más abajo: gana fuerte si el precio se desploma.',[[-1,'p',0],[1,'p',-2,2]]],
 ['Call broken wing','3','Ratios','a','Mariposa con un ala más lejos: reduce o elimina el costo a cambio de más riesgo arriba.',[[1,'c',-1],[-1,'c',1,2],[1,'c',4]]],
 ['Put broken wing','3','Ratios','b','Mariposa de puts con un ala más lejos: menos costo, más riesgo abajo.',[[1,'p',1],[-1,'p',-1,2],[1,'p',-4]]],
 ['Call ratio spread','4','Ratios','n','Compras un call y vendes dos más arriba. Gana si sube poco; riesgo sin tope si se dispara.',[[1,'c',0],[-1,'c',2,2]]],
 ['Put ratio spread','4','Ratios','n','Compras un put y vendes dos más abajo. Gana si baja poco; riesgo grande si se desploma.',[[1,'p',0],[-1,'p',-2,2]]],
 ['Futuro sintético largo','4','Sintéticas','a','Call comprado y put vendido en el mismo strike: se comporta como tener 100 acciones.',[[1,'c',0],[-1,'p',0]]],
 ['Futuro sintético corto','4','Sintéticas','b','Put comprado y call vendido en el mismo strike: se comporta como estar corto en 100 acciones.',[[1,'p',0],[-1,'c',0]]],
 ['Jade lizard','4','Otras','a','Put vendido más bear call spread: si el crédito supera el ancho del spread, no hay riesgo arriba.',[[-1,'p',-2],[-1,'c',1],[1,'c',3]]],
 ['Strip','4','Otras','v','Straddle con doble put: busca movimiento con sesgo bajista.',[[1,'c',0],[1,'p',0,2]]],
 ['Strap','4','Otras','v','Straddle con doble call: busca movimiento con sesgo alcista.',[[1,'c',0,2],[1,'p',0]]],
 ['Guts','4','Otras','v','Compras call y put dentro del dinero: como un strangle, pero más caro y con más valor intrínseco.',[[1,'c',-1],[1,'p',1]]],
 ['Doble diagonal','4','Otras','n','Vendes un strangle cercano y compras uno más ancho y lejano: renta con alas de protección.',[[1,'p',-4,1,1],[-1,'p',-2],[-1,'c',2],[1,'c',4,1,1]]]];
const OPC_UI={menu:false};
let OPC_DRAG=null;
const opcTplOf=n=>OPC_TPL.find(x=>x[0]===n);
const opcSnap=d=>{for(let i=0;i<3;i++){const w=new Date(Date.now()+d*864e5).getDay();if(w!==0&&w!==6)break;d++}return d};
function opcBuild(name,spot,dte,w0){
  const t=opcTplOf(name)||opcTplOf('Bull call spread'),w=w0||opcW(spot),atm=opcAtm(spot),st=opcStep(spot);
  return t[5].map(([side,type,off,qty=1,far=0])=>({id:uid(),side,type,K:type==='s'?+(+spot).toFixed(2):+Math.max(st,atm+off*w).toFixed(2),dte:dte+(far?opcSnap(dte+28)-dte:0),qty,prem:null}))}
const opcOpts=o=>o.legs.filter(l=>l.type!=='s');
const opcH=o=>{const d=opcOpts(o).map(l=>l.dte);return d.length?Math.max(1,Math.min(...d)):30};
function opcAutoRng(o){const sd=(o.iv/100)*Math.sqrt(opcH(o)/365),ks=opcOpts(o).map(l=>Math.abs(l.K/o.spot-1)+.03);return Math.min(60,Math.max(3,Math.ceil(Math.max(2.6*sd,.06,...ks)*100)))}
function opcSet(o,name){o.tpl=name;o.legs=opcBuild(name,o.spot,o.dte);o.dOff=9999;o.ivAdj=0;o.rng=opcAutoRng(o)}
function opc(){
  if(!S.opc||!Array.isArray(S.opc.legs)){S.opc={sym:'SPY',spot:500,iv:18,r:4.5,dte:opcSnap(30),tpl:'',legs:[],dOff:9999,ivAdj:0,modo:'$',vista:'graf',src:''};opcSet(S.opc,'Bull call spread')}
  const o=S.opc;if(!(o.rng>0))o.rng=opcAutoRng(o);if(!o.vista)o.vista='graf';if(!['$','%','val','risk'].includes(o.modo))o.modo='$';
  return o}
const opcEntry=(o,l)=>l.type==='s'?l.K:l.prem!=null?l.prem:osBS(l.type,o.spot,l.K,l.dte/365,o.iv/100,o.r/100).p;
const opcVal=(o,l,px,t,adj)=>l.type==='s'?px:osBS(l.type,px,l.K,(l.dte-t)/365,Math.max(1,o.iv+adj)/100,o.r/100).p;
function opcPL(o,px,t,adj,en){let s=0;for(let i=0;i<o.legs.length;i++){const l=o.legs[i];s+=l.side*l.qty*(l.type==='s'?1:100)*(opcVal(o,l,px,t,adj)-en[i])}return s}
function opcStats(o,en,adj){
  const H=opcH(o),ks=o.legs.map(l=>l.K),top=Math.max(o.spot,...ks),far=top*5,xs=[.01],a=o.spot*.02,b=top*3,N=900;
  for(let i=0;i<=N;i++)xs.push(a+(b-a)*i/N);ks.forEach(k=>xs.push(k));xs.push(far);xs.sort((x,y)=>x-y);
  const ys=xs.map(x=>opcPL(o,x,H,adj,en)),n=xs.length;let mx=-Infinity,mn=Infinity;ys.forEach(y=>{if(y>mx)mx=y;if(y<mn)mn=y});
  const sl=ys[n-1]-opcPL(o,far*.9,H,adj,en),be=[];
  for(let i=1;i<n;i++){const y0=ys[i-1],y1=ys[i];if((y0<0)!==(y1<0)&&y0!==y1){const x=xs[i-1]+(0-y0)*(xs[i]-xs[i-1])/(y1-y0);if(!be.length||Math.abs(x-be[be.length-1])>o.spot*1e-4)be.push(x)}}
  const v=o.iv/100,T=H/365,r=o.r/100,cdf=x=>osN((Math.log(x/o.spot)-(r-v*v/2)*T)/(v*Math.sqrt(T)));
  let pop=ys[n-1]>0?1-cdf(xs[n-1]):0;for(let i=1;i<n;i++)if((ys[i-1]+ys[i])/2>0)pop+=cdf(xs[i])-cdf(xs[i-1]);
  let net=0;o.legs.forEach((l,i)=>{if(l.type!=='s')net+=l.side*l.qty*100*en[i]});
  return{mx,mn,unlUp:sl>1,unlDn:sl<-1,be,beUp:be.length?opcPL(o,be[0]*1.002,H,adj,en)>0:false,pop:Math.max(0,Math.min(1,pop)),net}}
function opcGreeks(o,t,adj){
  let d=0,g=0,th=0,ve=0;
  o.legs.forEach(l=>{const m=l.side*l.qty;if(l.type==='s'){d+=m;return}const x=osBS(l.type,o.spot,l.K,(l.dte-t)/365,Math.max(1,o.iv+adj)/100,o.r/100);d+=m*100*x.d;g+=m*100*x.g;th+=m*100*x.th;ve+=m*100*x.ve});
  return{d,g,th,ve}}
/* modelo normalizado (precio 100) para dibujar el payoff de cada plantilla y clasificar su riesgo */
const opcModelCache={};
function opcModel(name){
  if(opcModelCache[name])return opcModelCache[name];
  const t=opcTplOf(name),o={spot:100,iv:30,r:4.5,legs:t[5].map(([side,type,off,qty=1,far=0])=>({side,type,K:type==='s'?100:100+off*5,dte:30+(far?30:0),qty}))};
  const en=o.legs.map(l=>opcEntry(o,l)),ys=Array.from({length:49},(_,i)=>opcPL(o,76+i,30,0,en)),mn=Math.min(0,...ys),mx=Math.max(0,...ys),Y=y=>4+(mx-y)/((mx-mn)||1)*26,y0=Y(0).toFixed(1);
  const pts=ys.map((y,i)=>`${(i*110/48).toFixed(1)},${Y(y).toFixed(1)}`).join(' ');
  const svg=`<svg viewBox="0 0 110 34" preserveAspectRatio="none" aria-hidden="true"><polygon points="0,${y0} ${pts} 110,${y0}" fill="rgba(140,255,46,.12)"/><line x1="0" x2="110" y1="${y0}" y2="${y0}" stroke="#3A4856" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/><polyline points="${pts}" fill="none" stroke="#8CFF2E" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  return opcModelCache[name]={svg,st:opcStats(o,en,0)}}
function opcPrev(name){
  const t=opcTplOf(name);if(!t)return '<p class="muted" style="margin:0">Pasa el cursor por una estrategia para ver cómo gana y cómo pierde.</p>';
  const m=opcModel(name),st=m.st,col={a:'var(--profit)',b:'var(--loss)',n:'var(--fg)',v:'#E07BFF'}[t[3]];
  const leg=([side,type,off,qty=1,far=0])=>type==='s'?`${side>0?'Compra':'Vende en corto'} ${qty} acciones`:`${side>0?'Compra':'Vende'} ${qty>1?qty+' ':''}${type==='c'?'call':'put'}${qty>1?'s':''} ${off===0?'en el dinero':off>0?'arriba del precio':'debajo del precio'}${far?', vencimiento lejano':''}`;
  return `<div><h3>${t[0]} <span class="tag" style="color:${col};border-color:${col}">${OPC_BIAS[t[3]]}</span><span class="tag">${st.unlUp?'Ganancia ilimitada':'Ganancia limitada'}</span><span class="tag" ${st.unlDn||st.mn<-3000?'style="color:var(--loss);border-color:var(--loss)"':''}>${st.unlDn?'Pérdida ilimitada':st.mn<-3000?'Pérdida alta':'Pérdida limitada'}</span></h3>
   <p>${t[4]}</p><ul>${t[5].map(x=>`<li>${leg(x)}</li>`).join('')}</ul></div>${m.svg}`}
function opcMenu(o){
  return `<div class="panel os-menu" id="osMenu"><div class="os-lvls">${OPC_LVL.map(([k,n])=>{const subs=[...new Set(OPC_TPL.filter(t=>t[1]===k).map(t=>t[2]))];
    return `<div class="os-lvl"><h3>${n}</h3><div class="os-subs">${subs.map(s=>`<div><h4>${s}</h4>${OPC_TPL.filter(t=>t[1]===k&&t[2]===s).map(t=>`<button type="button" class="os-mi ${t[3]}" data-o="tpl" data-n="${t[0]}" aria-pressed="${o.tpl===t[0]}">${t[0]}</button>`).join('')}</div>`).join('')}</div></div>`}).join('')}</div>
   <div class="os-prev" id="osPrev">${opcPrev(o.tpl)}</div></div>`}
function opcExpStrip(o){
  const H=opcH(o),days=[],groups=[],far=new Set(opcOpts(o).map(l=>l.dte));
  for(let d=1;d<=77;d++){const dt=new Date(Date.now()+d*864e5),w=dt.getDay();if(w!==0&&w!==6)days.push({d,dt})}
  days.forEach(x=>{const k=x.dt.toLocaleDateString('es',{month:'short'})+" '"+String(x.dt.getFullYear()).slice(2);let g=groups[groups.length-1];if(!g||g.k!==k){g={k,a:[]};groups.push(g)}g.a.push(x)});
  return `<div class="os-exp" role="group" aria-label="Fecha de vencimiento">${groups.map(g=>`<div class="os-mo"><span>${g.a.length>2?g.k:g.k.slice(0,3)}</span><div>${g.a.map(x=>`<button type="button" data-o="exp" data-d="${x.d}" aria-pressed="${x.d===H}" class="${x.dt.getDay()===5?'fri ':''}${far.has(x.d)&&x.d!==H?'far':''}" aria-label="Vence el ${x.dt.toLocaleDateString('es',{weekday:'long',day:'numeric',month:'long'})}, en ${x.d} días">${x.dt.getDate()}</button>`).join('')}</div></div>`).join('')}</div>`}
const opcFecha=d=>d<=0?'Hoy':new Date(Date.now()+d*864e5).toLocaleDateString('es',{day:'numeric',month:'short'});
const osM=v=>(v<0?'-':'')+'$'+(Math.abs(v)>=100000?(Math.abs(v)/1000).toFixed(0)+'k':Math.round(Math.abs(v)).toLocaleString('es-MX'));
function osNice(lo,hi,n){const raw=(hi-lo)/n,p=Math.pow(10,Math.floor(Math.log10(raw))),f=raw/p,st=(f<1.5?1:f<3.5?2:f<7.5?5:10)*p,out=[];for(let v=Math.ceil(lo/st)*st;v<=hi+1e-9;v+=st)out.push(+v.toFixed(6));return out}
const opcMaxTxt=st=>st.unlUp?'Ilimitada':money(Math.round(Math.max(0,st.mx)));
const opcMinTxt=st=>st.unlDn?'Ilimitada':money(Math.round(Math.abs(Math.min(0,st.mn))));
const opcChip=l=>`${l.qty>1?l.qty+'× ':''}${+l.K}${l.type.toUpperCase()}`;
function opcGeo(o){
  const el=$('#osRail'),W=Math.max(280,el?el.clientWidth:800),pl=W<560?48:62,pr=12,lo=Math.max(.01,o.spot*(1-o.rng/100)),hi=o.spot*(1+o.rng/100);
  return{W,pl,pr,lo,hi,X:x=>pl+(x-lo)/(hi-lo)*(W-pl-pr),P:px=>lo+(px-pl)/(W-pl-pr)*(hi-lo)}}
const opcLegRow=(l,i)=>{const s=l.type==='s';return `<div class="os-leg">
  <button type="button" class="os-side ${l.side<0?'sell':''}" data-o="side" data-i="${i}" aria-label="Cambiar entre compra y venta">${l.side>0?'Compra':'Venta'}</button>
  <input type="number" min="1" step="1" value="${l.qty}" data-ol="qty" data-i="${i}" aria-label="${s?'Acciones':'Contratos'}">
  <select data-ol="type" data-i="${i}" aria-label="Tipo">${[['c','Call'],['p','Put'],['s','Acciones']].map(([v,n])=>`<option value="${v}" ${l.type===v?'selected':''}>${n}</option>`).join('')}</select>
  <div class="os-k"><button type="button" data-o="k" data-i="${i}" data-d="-1" aria-label="Bajar ${s?'precio':'strike'}">−</button><input type="number" min="0" step="any" value="${l.K}" data-ol="K" data-i="${i}" aria-label="${s?'Precio de compra':'Strike'}" placeholder="Strike"><button type="button" data-o="k" data-i="${i}" data-d="1" aria-label="Subir ${s?'precio':'strike'}">+</button></div>
  <input class="os-d" type="number" min="1" step="1" value="${s?'':l.dte}" ${s?'disabled':''} data-ol="dte" data-i="${i}" aria-label="Días al vencimiento" placeholder="Días">
  <input class="os-p" type="number" min="0" step="any" value="${s?'':l.prem??''}" ${s?'disabled':''} id="osp-${i}" data-ol="prem" data-i="${i}" aria-label="Prima por acción" placeholder="Prima">
  <button type="button" class="x" data-o="del" data-i="${i}" aria-label="Quitar pata">✕</button></div>`};
function opcPosModal(){
  const o=opc();
  modal(`<div id="osPos"><div class="ph"><h2>Posiciones</h2><button class="x" data-act="close" aria-label="Cerrar">✕</button></div>
   <div class="os-legs"><div class="os-lh"><span>Lado</span><span>Cant.</span><span>Tipo</span><span>Strike</span><span>Días</span><span>Prima</span><span></span></div>
    ${o.legs.length?o.legs.map(opcLegRow).join(''):'<div class="empty" style="padding:16px">Sin patas. Agrega la primera.</div>'}</div>
   <div class="inline" style="margin-top:12px"><button type="button" class="btn sm ghost" data-o="add" data-t="c">Agregar call</button><button type="button" class="btn sm ghost" data-o="add" data-t="p">Agregar put</button><button type="button" class="btn sm ghost" data-o="add" data-t="s">Agregar acciones</button></div>
   <div class="inline" style="margin-top:8px"><button type="button" class="btn sm ghost" data-o="flip">Invertir posiciones</button><button type="button" class="btn sm ghost" data-o="teo">Volver a primas teóricas</button></div>
   <p class="hint" style="margin-top:12px">1 contrato = 100 acciones. La prima en gris es la teórica: escribe encima la prima real de tu bróker para afinar el cálculo.</p></div>`);
  o.legs.forEach((l,i)=>{const el=$('#osp-'+i);if(el&&l.type!=='s')el.placeholder=osBS(l.type,o.spot,l.K,l.dte/365,o.iv/100,o.r/100).p.toFixed(2)});
}

VIEWS.opciones=function(){
  const o=opc(),H=opcH(o),t=opcTplOf(o.tpl),est=S.estrats||[],tab=o.vista==='tabla';
  const tf=(arr,cur,act,key)=>arr.map(([v,l])=>`<button type="button" data-o="${act}" data-v="${v}" aria-pressed="${cur===v}">${l}</button>`).join('');
  return `<div class="vhead"><div><h1>${esc(o.tpl)}</h1><p>${t?t[4]:'Combinaste las patas a tu manera. Revisa bien la pérdida máxima antes de operarla.'}</p></div>
   <div class="inline"><button class="btn sm ghost tool" data-o="menu" aria-expanded="${OPC_UI.menu}" aria-pressed="${OPC_UI.menu}" aria-controls="osMenu">Estrategias</button><button class="btn sm ghost" data-o="pos">Posiciones (${o.legs.length})</button><button class="btn sm ghost" data-o="geny">Que Geny me la explique</button><button class="btn sm" data-o="guardar">Guardar estrategia</button></div></div>
  ${OPC_UI.menu?opcMenu(o):''}
  <div class="panel os-main">
   <form class="os-top" id="osLoad">
    <label>Símbolo<input id="os-sym" data-of="sym" value="${esc(o.sym)}" maxlength="12" style="text-transform:uppercase"></label>
    <label>Precio<input id="os-spot" data-of="spot" type="number" min="0" step="any" value="${o.spot}"></label>
    <label>Volatilidad (%)<input id="os-iv" data-of="iv" type="number" min="1" max="300" step="any" value="${o.iv}"></label>
    <button class="btn sm">Traer precio</button><button type="button" class="btn sm ghost" data-o="recentrar">Recentrar strikes</button>
    <p class="hint">${esc(o.src||'Precio de ejemplo. Trae el último cierre o escribe el precio y la volatilidad que ves en tu bróker.')}</p>
   </form>
   <div class="os-row"><span class="os-lab">Vencimiento: <b>${H}d</b></span><span class="hint">Toca un día para mover el vencimiento. Los viernes van resaltados.</span></div>
   ${opcExpStrip(o)}
   <div class="os-row"><span class="os-lab">Strikes</span><span class="hint">Arrastra una ficha para mover su strike: arriba compras, abajo vendes.</span></div>
   <div class="os-rail" id="osRail"></div>
   <div class="os-st" id="osStats"></div>
   <div class="os-chart" id="osChart" ${tab?'hidden':''}></div>
   <div class="tbl" id="osHeat" ${tab?'':'hidden'}></div>
   <div class="os-date"><div class="os-row"><span>Fecha: <b id="osDateLbl"></b></span><span class="muted" id="osDateR"></span></div>
    <input type="range" id="os-date" min="0" max="${H}" step="1" value="${Math.min(H,o.dOff)}" aria-label="Fecha simulada"></div>
   <div class="os-sl">
    <label><span class="os-row"><span>Rango: <b id="osRngLbl"></b></span><button type="button" class="x" data-o="rngAuto" aria-label="Restablecer el rango">↺</button></span><input type="range" id="os-rng" min="2" max="60" step="0.5" value="${o.rng}"></label>
    <label><span class="os-row"><span>Volatilidad implícita: <b id="osIvLbl"></b></span><button type="button" class="x" data-o="ivReset" aria-label="Restablecer la volatilidad">↺</button></span><input type="range" id="os-ivadj" min="${-Math.max(0,Math.min(15,Math.round(o.iv)-3))}" max="40" step="1" value="${o.ivAdj}"></label>
   </div>
   <div class="daystats" id="osGreeks" style="margin:0"></div>
   <div class="os-tabs"><div class="tfs" role="group" aria-label="Vista">${tf([['tabla','Tabla'],['graf','Gráfica']],o.vista,'vista')}</div>
    <div class="tfs" role="group" aria-label="Qué medir">${tf([['$','Ganancia / pérdida $'],['%','Ganancia / pérdida %'],['val','Valor del contrato'],['risk','% del riesgo máximo']],o.modo,'modo')}</div></div>
   <p class="hint" id="osNote" hidden></p>
  </div>
  <div class="panel" style="margin:18px 0"><div class="ph"><h2>Estrategias guardadas</h2></div>
   ${est.length?`<div class="tbl"><table><thead><tr><th>Estrategia</th><th>Fecha</th><th>Patas</th><th></th></tr></thead><tbody>${est.map(x=>`<tr><td><b>${esc(x.nombre)}</b></td><td class="num">${esc(x.fecha)}</td><td class="muted">${esc(x.o.legs.map(l=>`${l.side>0?'+':'−'}${l.qty} ${l.type==='s'?'acc.':l.type==='c'?'call':'put'} ${l.K}`).join(' · '))}</td><td style="white-space:nowrap;text-align:right"><button class="btn sm ghost" data-o="abrir" data-id="${x.id}">Abrir</button> <button class="x" data-o="rm" data-id="${x.id}" aria-label="Borrar estrategia guardada">✕</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty">Guarda una estrategia para compararla después o planear tu próxima operación.</div>'}</div>
  <p class="risk">Simulador educativo. Las primas se calculan con el modelo Black-Scholes y una volatilidad estimada, no con la cadena real del mercado, así que los números reales van a ser distintos. No es una recomendación de inversión; operar opciones implica riesgo de pérdida.</p>`;
};

function opcRail(){
  const el=$('#osRail');if(!el)return;const o=opc(),g=opcGeo(o),st=opcStep(o.spot),ppx=(g.W-g.pl-g.pr)/(g.hi-g.lo);
  let ts=st,ls;[1,2,5,10,20,50,100,200].some(m=>{ts=st*m;return ts*ppx>=7});[1,2,5,10,20,50,100].some(m=>{ls=ts*m;return ls*ppx>=50});
  let h='';
  for(let v=Math.ceil(g.lo/ts)*ts;v<=g.hi+1e-9;v+=ts){const big=Math.abs(v/ls-Math.round(v/ls))<1e-6,x=g.X(v).toFixed(1);h+=`<i class="os-tk${big?' b':''}" style="left:${x}px"></i>${big?`<span class="os-tl" style="left:${x}px">${+v.toFixed(2)}</span>`:''}`}
  h+=`<span class="os-spot" style="left:${g.X(o.spot).toFixed(1)}px">${esc(o.sym)}</span>`;
  const put={1:[],'-1':[]};
  o.legs.forEach((l,i)=>{if(l.type==='s')return;const x=g.X(Math.min(g.hi,Math.max(g.lo,l.K))),row=put[l.side],l1=row.some(p=>Math.abs(p.x-x)<54&&!p.l1);row.push({x,l1});
    h+=`<button type="button" class="os-chip ${l.side>0?'buy':'sell'}${l1?' l1':''}" data-i="${i}" style="left:${x.toFixed(1)}px" aria-label="${l.side>0?'Compra':'Venta'} de ${l.qty} ${l.type==='c'?'call':'put'} strike ${l.K}. Flechas izquierda y derecha para mover el strike">${opcChip(l)}</button>`});
  el.innerHTML=h}

function opcDraw(skipRail){
  if(!$('#osRail'))return;
  const o=opc(),H=opcH(o),atExp=o.dOff>=H;o.dOff=Math.max(0,Math.min(H,Math.round(o.dOff)));
  const adj=o.ivAdj||0,dEl=$('#os-date');dEl.max=H;dEl.value=o.dOff;
  $('#osDateLbl').textContent=`${o.dOff?new Date(Date.now()+o.dOff*864e5).toLocaleDateString('es',{weekday:'short',day:'numeric',month:'short'}):'hoy'} (${o.dOff}d)`;
  $('#osDateR').textContent=atExp?'(al vencimiento)':`faltan ${H-o.dOff} día${H-o.dOff===1?'':'s'} para vencer · línea punteada: al vencimiento`;
  $('#osRngLbl').textContent=`±${o.rng}%`;
  $('#osIvLbl').textContent=`${Math.max(1,o.iv+adj)}%${adj?` (${adj>0?'+':''}${adj})`:''}`;
  if(!skipRail)opcRail();
  const box=$('#osChart'),heat=$('#osHeat'),note=$('#osNote');
  if(!o.legs.length){$('#osStats').innerHTML='';$('#osGreeks').innerHTML='';heat.innerHTML='';note.hidden=true;box.innerHTML='<div class="empty">Abre Posiciones y agrega una pata para ver la curva de ganancia y pérdida.</div>';return}
  const en=o.legs.map(l=>opcEntry(o,l)),st=opcStats(o,en,adj),gk=opcGreeks(o,o.dOff,adj),pc=x=>`${x>=o.spot?'+':''}${((x/o.spot-1)*100).toFixed(1)}%`;
  const beTxt=!st.be.length?'—':st.be.length===1?`${st.beUp?'Arriba de':'Debajo de'} ${st.be[0].toFixed(2)} (${pc(st.be[0])})`:st.be.length===2?`${st.beUp?'Entre':'Fuera de'} ${st.be[0].toFixed(2)} y ${st.be[1].toFixed(2)}`:st.be.map(x=>x.toFixed(2)).join(' · ');
  $('#osStats').innerHTML=[[st.net>=0?'Débito neto':'Crédito neto',money(+Math.abs(st.net).toFixed(2)),''],['Pérdida máxima',opcMinTxt(st),'down'],['Ganancia máxima',opcMaxTxt(st),'up'],['Probabilidad de ganar',(st.pop*100).toFixed(0)+'%',''],['Punto de equilibrio',beTxt,'']]
    .map(([k,v,c])=>`<div><span>${k}</span><b class="${c}">${v}</b></div>`).join('');
  $('#osGreeks').innerHTML=`<span>Delta <b>${gk.d.toFixed(1)}</b></span><span>Gamma <b>${gk.g.toFixed(2)}</b></span><span>Theta por día <b class="${gk.th>=0?'up':'down'}">${money(+gk.th.toFixed(2))}</b></span><span>Vega por punto de IV <b>${money(+gk.ve.toFixed(2))}</b></span>`;
  /* unidad elegida: dólares, % del costo, valor del contrato o % del riesgo máximo */
  const net=Math.abs(st.net),risk=st.unlDn||st.mn>=0?0:Math.abs(st.mn);let m=o.modo,why='';
  if(m==='%'&&net<1){m='$';why='Esta estrategia casi no tiene costo de entrada, así que el porcentaje no aplica: se muestra en dólares.'}
  if(m==='risk'&&risk<1){m='$';why='Esta estrategia no tiene un riesgo máximo definido, así que se muestra en dólares.'}
  note.hidden=!why;note.textContent=why;
  const T=m==='%'?v=>v/net*100:m==='risk'?v=>v/risk*100:m==='val'?v=>v+st.net:v=>v,F=m==='%'||m==='risk'?v=>v.toFixed(0)+'%':osM,t0=T(0);
  const {W,pl,pr,lo,hi,X,P}=opcGeo(o);

  if(o.vista!=='tabla'){
    const Hh=W<560?260:380,pt=16,pb=28,N=150,xs=Array.from({length:N+1},(_,i)=>lo+(hi-lo)*i/N);
    opcOpts(o).forEach(l=>{if(l.K>lo&&l.K<hi)xs.push(l.K)});xs.sort((a,b)=>a-b);
    const yM=xs.map(x=>T(opcPL(o,x,o.dOff,adj,en))),yE=atExp?null:xs.map(x=>T(opcPL(o,x,H,adj,en)));
    let ymn=Math.min(t0,...yM,...(yE||[])),ymx=Math.max(t0,...yM,...(yE||[]));const pad=((ymx-ymn)||1)*.1;ymn-=pad;ymx+=pad;
    const Y=y=>pt+(ymx-y)/(ymx-ymn)*(Hh-pt-pb),y0=Y(t0),f=n=>n.toFixed(1),pts=ys=>xs.map((x,i)=>`${f(X(x))},${f(Y(ys[i]))}`).join(' ');
    const area=`M${f(X(lo))},${f(y0)} L${pts(yM).replace(/ /g,' L')} L${f(X(hi))},${f(y0)} Z`,xt=osNice(lo,hi,W<560?4:10),yt=osNice(ymn,ymx,6),dec=hi-lo<20?2:0;
    box.innerHTML=`<svg width="${W}" height="${Hh}" role="img" aria-label="Curva de ganancia y pérdida de ${esc(o.tpl)}${atExp?' al vencimiento':' en la fecha simulada y al vencimiento'}">
     <defs><clipPath id="osUp"><rect x="${pl}" y="0" width="${W-pl-pr}" height="${f(Math.max(0,y0))}"/></clipPath><clipPath id="osDn"><rect x="${pl}" y="${f(y0)}" width="${W-pl-pr}" height="${f(Math.max(0,Hh-pb-y0))}"/></clipPath>
      <linearGradient id="osGu" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${pt}" y2="${f(y0)}"><stop offset="0" stop-color="#00FF94" stop-opacity=".75"/><stop offset="1" stop-color="#00FF94" stop-opacity=".04"/></linearGradient>
      <linearGradient id="osGd" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1="${f(y0)}" y2="${Hh-pb}"><stop offset="0" stop-color="#FF4D6D" stop-opacity=".04"/><stop offset="1" stop-color="#FF4D6D" stop-opacity=".75"/></linearGradient></defs>
     ${yt.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${f(Y(v))}" y2="${f(Y(v))}" stroke="#121B25"/><text x="${pl-8}" y="${f(Y(v)+4)}" text-anchor="end">${F(v)}</text>`).join('')}
     ${xt.map(v=>`<line x1="${f(X(v))}" x2="${f(X(v))}" y1="${pt}" y2="${Hh-pb}" stroke="#0F1720"/><text x="${f(X(v))}" y="${Hh-8}" text-anchor="middle">${v.toFixed(dec)}</text>`).join('')}
     <path d="${area}" fill="url(#osGu)" clip-path="url(#osUp)"/><path d="${area}" fill="url(#osGd)" clip-path="url(#osDn)"/>
     <line x1="${pl}" x2="${W-pr}" y1="${f(y0)}" y2="${f(y0)}" stroke="#C9D6E2" stroke-width="1"/>
     <line x1="${f(X(o.spot))}" x2="${f(X(o.spot))}" y1="${pt}" y2="${Hh-pb}" stroke="#00D2FF" stroke-dasharray="2 3"/>
     ${st.be.filter(x=>x>lo&&x<hi).map(x=>`<line x1="${f(X(x))}" x2="${f(X(x))}" y1="${pt}" y2="${Hh-pb}" stroke="#FFC21A" stroke-opacity=".7"/><text x="${f(X(x))}" y="${pt-4}" text-anchor="middle" style="fill:#FFC21A">${x.toFixed(2)}</text>`).join('')}
     ${yE?`<polyline points="${pts(yE)}" fill="none" stroke="#E6F1FA" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round"/>`:''}
     <polyline points="${pts(yM)}" fill="none" stroke="#00FF94" stroke-width="2.4" stroke-linejoin="round" clip-path="url(#osUp)"/><polyline points="${pts(yM)}" fill="none" stroke="#FF4D6D" stroke-width="2.4" stroke-linejoin="round" clip-path="url(#osDn)"/>
     <g id="osHov" style="display:none"><line y1="${pt}" y2="${Hh-pb}" stroke="#8395A8" stroke-dasharray="3 3"/><circle id="osHa" r="4.5" fill="#E6F1FA"/></g>
    </svg><div class="os-tip" id="osTip" hidden></div>`;
    const hov=$('#osHov'),tip=$('#osTip');
    box.onpointerleave=()=>{hov.style.display='none';tip.hidden=true};
    box.onpointermove=e=>{const mx=e.clientX-box.getBoundingClientRect().left;if(mx<pl||mx>W-pr){box.onpointerleave();return}
      const px=P(mx),a=opcPL(o,px,o.dOff,adj,en),b=yE?opcPL(o,px,H,adj,en):null;
      hov.style.display='';hov.setAttribute('transform',`translate(${f(mx)},0)`);$('#osHa').setAttribute('cy',f(Y(T(a))));
      tip.hidden=false;tip.innerHTML=`<b>${px.toFixed(2)}</b> <span class="muted">${pc(px)}</span><br>${atExp?'Al vencimiento':o.dOff?opcFecha(o.dOff):'Hoy'} <span class="${a>=0?'up':'down'}">${F(T(a))}</span>${yE?`<br>Al vencimiento <span class="${b>=0?'up':'down'}">${F(T(b))}</span>`:''}`;
      const tw=tip.offsetWidth;tip.style.left=(mx+14+tw>W?mx-14-tw:mx+14)+'px'};
    heat.innerHTML='';return}

  /* vista tabla: precio × fecha */
  box.innerHTML='';
  const nc=Math.min(H,W<560?4:W<900?7:11),ts=[...new Set(Array.from({length:nc+1},(_,i)=>Math.round(H*i/nc)))];
  const base=opcStep(o.spot),stp=base*Math.max(1,Math.ceil((hi-lo)/17/base)),rows=[];
  for(let p=Math.floor(hi/stp)*stp;p>=lo&&rows.length<30;p-=stp)rows.push(+p.toFixed(2));
  const near=rows.reduce((a,p)=>Math.abs(p-o.spot)<Math.abs(a-o.spot)?p:a,rows[0]);
  const cells=rows.map(p=>ts.map(t=>opcPL(o,p,t,adj,en))),mxa=Math.max(1,...cells.flat().map(Math.abs));
  heat.innerHTML=`<table class="os-heat"><thead><tr><th>Precio</th>${ts.map(t=>`<th>${t===0?'Hoy':t===H?'Vence':opcFecha(t)}</th>`).join('')}</tr></thead><tbody>
   ${rows.map((p,i)=>`<tr class="${p===near?'spot':''}"><td>${p.toFixed(base<1?2:base%1?1:0)} <span class="muted">${pc(p)}</span></td>${cells[i].map(v=>`<td style="background:rgba(${v>=0?'0,255,148':'255,77,109'},${(.06+.5*Math.abs(v)/mxa).toFixed(2)})">${F(T(v))}</td>`).join('')}</tr>`).join('')}
  </tbody></table>`;
}
function opcTexto(o){
  const en=o.legs.map(l=>opcEntry(o,l)),st=opcStats(o,en,0);
  const leg=l=>`${l.side>0?'compro':'vendo'} ${l.qty} ${l.type==='s'?`acciones a ${l.K}`:`${l.type==='c'?'call':'put'} strike ${l.K} a ${l.dte} días`}`;
  return `Explícame esta estrategia de opciones como a un alumno y dime sus riesgos: ${o.tpl} en ${o.sym} (precio ${o.spot}, volatilidad ${o.iv}%). Patas: ${o.legs.map(leg).join('; ')}. Prima neta: ${st.net>=0?'débito':'crédito'} de ${money(Math.round(Math.abs(st.net)))}. Ganancia máxima: ${opcMaxTxt(st)}. Pérdida máxima: ${opcMinTxt(st)}. Punto de equilibrio: ${st.be.map(x=>x.toFixed(2)).join(' y ')||'no tiene'}. ¿Cómo la planearía y gestionaría con PEDEM?`}
async function opcLoad(){
  const o=opc(),sym=($('#os-sym').value||'').trim().toUpperCase();
  if(!sym){toast('Escribe un símbolo, por ejemplo SPY');return}
  try{
    const mcp=window.claude?.use?await claude.use('mcp'):null;
    if(!mcp){toast('Los precios no están disponibles por ahora. Escribe el precio a mano');return}
    toast(`Buscando ${sym}…`);
    const res=await mcp.callTool('FMP','chart',{endpoint:'historical-price-eod-full',symbol:sym,from_date:daysAgo(75),to_date:today()});
    let rows=res?.payload;if(rows&&!Array.isArray(rows))rows=rows.historical||rows.data||rows.results;
    if(!Array.isArray(rows)||!rows.length)throw new Error(`No encontré datos para ${sym}. Revisa el símbolo.`);
    const cl=rows.map(x=>({d:String(x.date).slice(0,10),c:+x.close})).filter(x=>x.c>0).sort((a,b)=>a.d.localeCompare(b.d));
    if(!cl.length)throw new Error(`No encontré precios de cierre para ${sym}.`);
    const last=cl[cl.length-1],w=cl.slice(-31),rets=w.slice(1).map((x,i)=>Math.log(x.c/w[i].c));let hv=null;
    if(rets.length>=10){const mu=rets.reduce((a,b)=>a+b,0)/rets.length;hv=Math.sqrt(rets.reduce((a,b)=>a+(b-mu)**2,0)/(rets.length-1)*252)*100}
    o.sym=sym;o.spot=+last.c.toFixed(2);if(hv)o.iv=Math.max(5,Math.round(hv));
    o.src=`Último cierre de ${sym}: ${last.d} (${(res?.provider||res?.source)==='fmp'?'FMP':'Yahoo Finance'}).`+(hv?' La volatilidad es una estimación con los últimos 30 días; ajústala a la IV que ves en tu bróker.':'');
    opcSet(o,opcTplOf(o.tpl)?o.tpl:'Bull call spread');save();render();toast(`${sym} a ${o.spot}. Strikes recentrados`);
  }catch(e){toast(e?.code==='server_not_connected'?'Los precios no están disponibles por ahora. Escribe el precio a mano':e?.message||'No pude traer el precio. Escríbelo a mano')}
}
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target:null;if(!t)return;
  const b=t.closest('[data-o]');if(!b)return;const o=opc(),i=+b.dataset.i,a=b.dataset.o,pos=!!$('#osPos'),libre=()=>{o.tpl='Personalizada'};
  const A={menu(){OPC_UI.menu=!OPC_UI.menu;render()},
    tpl(){opcSet(o,b.dataset.n);OPC_UI.menu=false;save();render()},
    exp(){const H=opcH(o),d=+b.dataset.d,at=o.dOff>=H;o.legs.forEach(l=>{if(l.type!=='s')l.dte=Math.max(1,l.dte+d-H)});o.dte=d;o.dOff=at?9999:Math.min(o.dOff,d);save();render()},
    pos(){opcPosModal()},
    side(){o.legs[i].side*=-1;libre();save();render()},
    del(){o.legs.splice(i,1);libre();save();render()},
    k(){const l=o.legs[i],st=opcStep(o.spot);l.K=Math.max(st,+(l.K+ +b.dataset.d*st).toFixed(2));save();render()},
    add(){const t=b.dataset.t;o.legs.push({id:uid(),side:1,type:t,K:t==='s'?o.spot:opcAtm(o.spot),dte:opcH(o),qty:t==='s'?100:1,prem:null});libre();save();render()},
    flip(){o.legs.forEach(l=>l.side*=-1);libre();save();render()},
    teo(){o.legs.forEach(l=>l.prem=null);save();render();toast('Primas teóricas restablecidas')},
    recentrar(){if(!opcTplOf(o.tpl)){toast('Tu estrategia es personalizada: arrastra las fichas para mover los strikes');return}opcSet(o,o.tpl);save();render();toast('Strikes recentrados al precio actual')},
    vista(){o.vista=b.dataset.v;save();render()},
    modo(){o.modo=b.dataset.v;save();render()},
    rngAuto(){o.rng=opcAutoRng(o);save();render()},
    ivReset(){o.ivAdj=0;save();render()},
    guardar(){if(!o.legs.length){toast('Agrega al menos una pata antes de guardar');return}S.estrats=[{id:uid(),fecha:today(),nombre:`${o.tpl} en ${o.sym}`,o:JSON.parse(JSON.stringify(o))},...(S.estrats||[])].slice(0,30);save();render();toast('Estrategia guardada')},
    abrir(){const x=(S.estrats||[]).find(x=>x.id===b.dataset.id);if(!x)return;S.opc=JSON.parse(JSON.stringify(x.o));save();render();window.scrollTo({top:0});toast(`Abriste ${x.nombre}`)},
    rm(){S.estrats=(S.estrats||[]).filter(x=>x.id!==b.dataset.id);save();render();toast('Estrategia borrada')},
    geny(){if(!o.legs.length){toast('Agrega al menos una pata primero');return}const t=opcTexto(o);go('geny');setTimeout(()=>{const q=$('#q');if(q){q.value=t;q.focus()}},60)}};
  if(!A[a])return;A[a]();
  if(pos&&['side','del','k','add','flip','teo'].includes(a))opcPosModal();
});
document.addEventListener('input',e=>{
  const el=e.target,d=el.dataset||{};if(!d.of&&!d.ol&&!['os-date','os-ivadj','os-rng'].includes(el.id))return;
  const o=opc();
  if(el.id==='os-date')o.dOff=+el.value>=opcH(o)?9999:+el.value;
  else if(el.id==='os-ivadj')o.ivAdj=+el.value;
  else if(el.id==='os-rng')o.rng=+el.value;
  else if(d.of==='sym'){o.sym=el.value.trim().toUpperCase().slice(0,12);save();return}
  else if(d.of){const v=parseFloat(el.value);if(!(v>0))return;o[d.of]=v}
  else{const l=o.legs[+d.i];if(!l)return;
    if(d.ol==='type'){const was=l.type;l.type=el.value;l.prem=null;if(l.type==='s'){l.qty=100;l.K=o.spot}else if(was==='s'){l.qty=1;l.K=opcAtm(o.spot);l.dte=opcH(o)}o.tpl='Personalizada';save();render();if($('#osPos'))opcPosModal();return}
    if(d.ol==='prem'){const v=parseFloat(el.value);l.prem=el.value===''||!(v>=0)?null:v}
    else{const v=parseFloat(el.value);if(!(v>0))return;l[d.ol]=d.ol==='K'?v:Math.round(v)}}
  save();opcDraw();
});
/* el menú muestra la ficha de la estrategia bajo el cursor o el foco */
['mouseover','focusin'].forEach(ev=>document.addEventListener(ev,e=>{const b=e.target.closest?.('.os-mi');if(b){const p=$('#osPrev');if(p&&p.dataset.n!==b.dataset.n){p.dataset.n=b.dataset.n;p.innerHTML=opcPrev(b.dataset.n)}}}));
/* arrastrar una ficha del riel mueve el strike; un toque sin mover abre Posiciones */
document.addEventListener('pointerdown',e=>{const c=e.target.closest?.('.os-chip');if(!c)return;OPC_DRAG={i:+c.dataset.i,el:c,g:opcGeo(opc()),moved:false};try{c.setPointerCapture(e.pointerId)}catch(_){}c.classList.add('drag')});
document.addEventListener('pointermove',e=>{const d=OPC_DRAG;if(!d)return;const o=opc(),l=o.legs[d.i],st=opcStep(o.spot),r=$('#osRail');if(!l||!r)return;
  let k=Math.round(d.g.P(e.clientX-r.getBoundingClientRect().left)/st)*st;k=+Math.max(Math.ceil(d.g.lo/st)*st,Math.min(Math.floor(d.g.hi/st)*st,k)).toFixed(2);
  if(!(k>0)||k===l.K)return;l.K=k;d.moved=true;d.el.style.left=d.g.X(k).toFixed(1)+'px';d.el.textContent=opcChip(l);opcDraw(true)});
const opcDragEnd=()=>{const d=OPC_DRAG;if(!d)return;OPC_DRAG=null;if(d.moved){save();opcRail()}else{d.el.classList.remove('drag');opcPosModal()}};
document.addEventListener('pointerup',opcDragEnd);document.addEventListener('pointercancel',opcDragEnd);
document.addEventListener('keydown',e=>{const c=e.target.closest?.('.os-chip');if(!c||(e.key!=='ArrowLeft'&&e.key!=='ArrowRight'))return;e.preventDefault();
  const o=opc(),i=+c.dataset.i,l=o.legs[i],st=opcStep(o.spot);l.K=Math.max(st,+(l.K+(e.key==='ArrowRight'?st:-st)).toFixed(2));save();opcDraw();document.querySelector(`.os-chip[data-i="${i}"]`)?.focus()});
document.addEventListener('submit',e=>{if(e.target.id==='osLoad'){e.preventDefault();e.stopImmediatePropagation();opcLoad()}},true);
addEventListener('resize',()=>{if(route()==='opciones')opcDraw()});

/* ---------- Radar de oportunidades ---------- */
// Escanea un universo curado de acciones y ETF con opciones muy líquidas. Para cada uno lee tendencia (diaria y semanal)
// y volatilidad (rango de la volatilidad histórica de 20 días en 1 año) y sugiere la estrategia que mejor encaja.
// S.radar = preferencias; los resultados del escaneo viven en este navegador (localStorage 'genyRadar').
I.radar='<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/><path d="M12 12l6.4-6.4"/><circle cx="12" cy="12" r=".9" fill="currentColor"/>';
const RD_N={SPY:'S&P 500',QQQ:'Nasdaq 100',IWM:'Russell 2000',DIA:'Dow Jones',TLT:'Bonos del Tesoro 20+ años',GLD:'Oro',SLV:'Plata',XLF:'Sector financiero',XLE:'Sector energía',XLK:'Sector tecnología',SMH:'Semiconductores',EEM:'Mercados emergentes',FXI:'China',HYG:'Bonos de alto rendimiento',KRE:'Bancos regionales',ARKK:'ARK Innovation',XBI:'Biotecnología',USO:'Petróleo',GDX:'Mineras de oro',EWZ:'Brasil',NVDA:'Nvidia',TSLA:'Tesla',AAPL:'Apple',AMZN:'Amazon',MSFT:'Microsoft',META:'Meta',GOOGL:'Alphabet',AMD:'AMD',PLTR:'Palantir',NFLX:'Netflix',AVGO:'Broadcom',MU:'Micron',INTC:'Intel',BAC:'Bank of America',JPM:'JPMorgan',COIN:'Coinbase',MSTR:'Strategy',SOFI:'SoFi',UBER:'Uber',DIS:'Disney',BA:'Boeing',XOM:'Exxon Mobil',CVX:'Chevron',WMT:'Walmart',COST:'Costco',PYPL:'PayPal',CRM:'Salesforce',ORCL:'Oracle',QCOM:'Qualcomm',TSM:'TSMC',BABA:'Alibaba',NIO:'NIO',F:'Ford',GM:'General Motors',C:'Citigroup',WFC:'Wells Fargo',GS:'Goldman Sachs',PFE:'Pfizer',LLY:'Eli Lilly',UNH:'UnitedHealth',V:'Visa',HOOD:'Robinhood',SHOP:'Shopify'};
const RD_ETF=['SPY','QQQ','IWM','DIA','TLT','GLD','SLV','XLF','XLE','XLK','SMH','EEM','FXI','HYG','KRE','ARKK','XBI','USO','GDX','EWZ'];
const RD_T30=['SPY','QQQ','IWM','NVDA','TSLA','AAPL','AMZN','MSFT','META','GOOGL','AMD','PLTR','NFLX','AVGO','MU','INTC','BAC','JPM','COIN','MSTR','SOFI','UBER','TLT','GLD','SLV','XLF','XLE','SMH','BABA','DIS'];
const RD_T60=[...RD_T30,'DIA','EEM','FXI','HYG','KRE','ARKK','XBI','GDX','BA','XOM','CVX','WMT','COST','PYPL','CRM','ORCL','QCOM','TSM','NIO','F','GM','C','WFC','GS','PFE','LLY','UNH','V','HOOD','SHOP'];
const RD={rows:{},earn:{},at:'',src:'',busy:false,done:0,total:0,err:''};
try{const c=JSON.parse(localStorage.getItem('genyRadar:'+(BOOT.userId||'anon')));if(c&&c.rows){RD.rows=c.rows;RD.earn=c.earn||{};RD.at=c.at||'';RD.src=c.src||''}}catch(e){}
const rdSave=()=>{try{localStorage.setItem('genyRadar:'+(BOOT.userId||'anon'),JSON.stringify({rows:RD.rows,earn:RD.earn,at:RD.at,src:RD.src}))}catch(e){}};
function rdPref(){if(!S.radar)S.radar={f:'d',uni:'top30',fb:'all',fk:'all',noE:false,lista:''};return S.radar}
function rdUni(){const p=rdPref();
  if(p.uni==='mia'){const l=[...new Set(String(p.lista||'').toUpperCase().split(/[^A-Z0-9.^=-]+/).filter(Boolean))].slice(0,40);return l}
  return p.uni==='etf'?RD_ETF:p.uni==='top60'?RD_T60:RD_T30}
const rdFri=min=>{let d=min;for(let i=0;i<7;i++){if(new Date(Date.now()+d*864e5).getDay()===5)break;d++}return d};
function rdEma(a,n){const k=2/(n+1);let e=a[0];const o=[e];for(let i=1;i<a.length;i++){e=a[i]*k+e*(1-k);o.push(e)}return o}
function rdTrend(c,nf,ns,flat){
  if(c.length<ns+6)return null;
  const f=rdEma(c,nf),s=rdEma(c,ns),n=c.length-1,sl=f[n]/f[n-5]-1,sc=(c[n]>f[n]?1:-1)+(f[n]>s[n]?1:-1)+(Math.abs(sl)<flat?0:sl>0?1:-1);
  return{sc,dir:sc>=2?'a':sc<=-2?'b':'n'}}
function rdCalc(sym,rows){
  if(rows&&!Array.isArray(rows))rows=rows.historical||rows.data||rows.results;
  if(!Array.isArray(rows))return null;
  const b=rows.map(x=>({d:String(x.date).slice(0,10),c:+x.close,v:+x.volume||0})).filter(x=>x.c>0).sort((a,z)=>a.d.localeCompare(z.d));
  if(b.length<120)return null;
  const c=b.map(x=>x.c),n=c.length-1,wk=[];let lw=null;
  b.forEach(x=>{const k=Math.floor((Date.parse(x.d)/864e5+3)/7);if(k===lw)wk[wk.length-1]=x.c;else{wk.push(x.c);lw=k}});
  const rets=c.slice(1).map((x,i)=>Math.log(x/c[i])),sd=a=>{const m=a.reduce((p,q)=>p+q,0)/a.length;return Math.sqrt(a.reduce((p,q)=>p+(q-m)**2,0)/(a.length-1))};
  const hvs=[];for(let i=20;i<=rets.length;i++)hvs.push(sd(rets.slice(i-20,i))*Math.sqrt(252)*100);
  const hw=hvs.slice(-252),hv=hw[hw.length-1],mn=Math.min(...hw),mx=Math.max(...hw),vr=mx>mn?(hv-mn)/(mx-mn)*100:50;
  const bw=[];for(let i=Math.max(20,c.length-126);i<=c.length;i++){const w=c.slice(i-20,i);bw.push(sd(w)/(w.reduce((p,q)=>p+q,0)/20))}
  const cur=bw[bw.length-1],sq=bw.filter(x=>x<cur).length/bw.length<=.15;
  let g=0,l=0;for(let i=1;i<=14;i++){const d=c[i]-c[i-1];if(d>0)g+=d;else l-=d}g/=14;l/=14;
  for(let i=15;i<=n;i++){const d=c[i]-c[i-1];g=(g*13+Math.max(d,0))/14;l=(l*13+Math.max(-d,0))/14}
  const sp=[];for(let i=Math.max(0,n-58);i<=n;i+=2)sp.push(+c[i].toPrecision(5));
  return{s:sym,d:b[n].d,px:c[n],chg:(c[n]/c[n-1]-1)*100,td:rdTrend(c,20,50,.003),tw:rdTrend(wk,10,30,.006),rsi:l?100-100/(1+g/l):100,
    hv:+hv.toFixed(1),vr:Math.round(vr),sq,dv:b.slice(-20).reduce((p,x)=>p+x.c*x.v,0)/20,sp}}
/* La regla: la tendencia elige el lado; la volatilidad decide si se compra o se vende prima (VR < 50 compra, 50 a 70 vende con riesgo definido, > 70 vende con más margen) */
function rdPick(m,f){
  const Z={sc:0,dir:'n'},T=(f==='w'?m.tw:m.td)||Z,O=(f==='w'?m.td:m.tw)||Z,dte=rdFri(f==='w'?42:21),vr=m.vr,em=m.px*(m.hv/100)*Math.sqrt(dte/365);
  const er=RD.earn[m.s],ern=er&&er>=today()&&er<=iso(Date.now()+dte*864e5)?er:'',fN=f==='w'?'semanal':'diario',oN=f==='w'?'diario':'semanal';
  let tpl,alt='',kind='c',extra='';
  if(T.dir==='a'){
    if(vr>=50){tpl='Bull put spread';kind='v';alt=vr>=70?'Venta de put':''}
    else if(vr<=25&&T.sc===3){tpl=f==='w'?'Diagonal spread':'Compra de call';alt='Bull call spread'}
    else{tpl='Bull call spread';alt=f==='w'?'Diagonal spread':''}
  }else if(T.dir==='b'){
    if(vr>=50){tpl='Bear call spread';kind='v'}
    else if(vr<=25&&T.sc===-3){tpl='Compra de put';alt='Bear put spread'}
    else tpl='Bear put spread';
  }else{
    if(vr>=70){tpl='Iron condor';kind='v';alt='Short strangle'}
    else if(vr>=50){tpl='Iron condor';kind='v';alt='Iron butterfly'}
    else if(m.sq){tpl='Long strangle';alt='Long straddle';extra=' El precio está comprimido: suele venir un movimiento amplio.'}
    else{tpl='Calendar spread';alt='Butterfly'}
  }
  let sc=30;
  if(T.dir!=='n'){sc+=Math.abs(T.sc)===3?22:14;sc+=O.dir===T.dir?18:O.dir==='n'?4:-14;if((T.dir==='a'&&m.rsi>75)||(T.dir==='b'&&m.rsi<25))sc-=8}
  else{sc+=O.dir==='n'?16:4;if(T.sc===0)sc+=8;if(m.sq&&kind==='c')sc+=10}
  sc+=Math.abs(vr-50)/50*25;if(ern)sc-=15;if(m.dv<2e8)sc-=5;
  const dirT=T.dir==='a'?'Tendencia alcista':T.dir==='b'?'Tendencia bajista':'Precio lateral',volT=vr>=70?'cara':vr>=50?'algo cara':vr<=25?'barata':'más bien barata';
  const conf=T.dir==='n'?'':O.dir===T.dir?`, confirmada en ${oN}`:O.dir==='n'?'':`, aunque el ${oN} va en contra`;
  const why=`${dirT} en ${fN}${conf}. Volatilidad ${volT} (VR ${vr}): ${kind==='v'?'conviene cobrar prima con riesgo definido':'conviene comprar prima con riesgo limitado'}.${extra}`;
  return{tpl,alt,kind,dte,em,ern,why,T,O,score:Math.round(Math.max(5,Math.min(99,sc)))}}
const rdT=(t,pre)=>`<span class="rd-t ${t?t.dir:'n'}">${pre||''}${!t?'Sin datos':t.dir==='a'?'▲ Alcista':t.dir==='b'?'▼ Bajista':'● Lateral'}</span>`;
function rdSpark(m){const a=m.sp||[],mn=Math.min(...a),mx=Math.max(...a),up=a[a.length-1]>=a[0];
  return `<svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${a.map((v,i)=>`${(i*100/Math.max(1,a.length-1)).toFixed(1)},${(27-(v-mn)/((mx-mn)||1)*24).toFixed(1)}`).join(' ')}" fill="none" stroke="${up?'#00FF94':'#FF4D6D'}" stroke-width="1.6" vector-effect="non-scaling-stroke"/></svg>`}
const rdFd=d=>new Date(d+'T12:00').toLocaleDateString('es',{day:'numeric',month:'short'});
function rdLista(){
  const p=rdPref(),u=rdUni();
  return u.map(s=>RD.rows[s]).filter(Boolean).map(m=>({m,k:rdPick(m,p.f)}))
    .filter(x=>(p.fb==='all'||x.k.T.dir===p.fb)&&(p.fk==='all'||x.k.kind===p.fk)&&!(p.noE&&x.k.ern)).sort((a,b)=>b.k.score-a.k.score)}

VIEWS.radar=function(){
  const p=rdPref(),u=rdUni(),all=u.filter(s=>RD.rows[s]).length,L=rdLista(),tf=(arr,cur,act)=>arr.map(([v,l])=>`<button type="button" data-rd="${act}" data-v="${v}" aria-pressed="${cur===v}">${l}</button>`).join('');
  const mk=['SPY','QQQ','IWM'].map(s=>RD.rows[s]).filter(Boolean);
  const card=({m,k},i)=>`<div class="rd-card"><div class="hd"><div class="sym">${esc(m.s)}<small>${esc(RD_N[m.s]||'')} · ${m.px.toFixed(2)} <span class="${m.chg>=0?'up':'down'}">${m.chg>=0?'+':''}${m.chg.toFixed(1)}%</span></small></div><div class="rd-sc">${k.score}<small>puntaje</small></div></div>
    ${rdSpark(m)}<h3>${k.tpl}</h3><p>${k.why}</p>
    <div class="rd-facts">${rdT(k.T,p.f==='w'?'Semanal ':'Diario ')}${rdT(k.O,p.f==='w'?'Diario ':'Semanal ')}<span class="rd-t">Mov. esperado ±${k.em.toFixed(2)}</span><span class="rd-t">Vence en ${k.dte}d</span>${k.ern?`<span class="rd-t e">Resultados el ${rdFd(k.ern)}</span>`:''}</div>
    <button class="btn sm${i?' ghost':''}" data-rd="abrir" data-s="${esc(m.s)}">Armar en Estrategias</button></div>`;
  const row=({m,k},i)=>`<tr><td class="n">${i+1}</td><td><b>${esc(m.s)}</b><br><span class="muted" style="font-size:12px">${esc(RD_N[m.s]||'')}</span></td>
    <td class="n">${m.px.toFixed(2)}<br><span class="${m.chg>=0?'up':'down'}">${m.chg>=0?'+':''}${m.chg.toFixed(1)}%</span></td><td>${rdSpark(m)}</td>
    <td>${rdT(m.td)}</td><td>${rdT(m.tw)}</td>
    <td><div class="rd-vr" role="img" aria-label="Rango de volatilidad ${m.vr} de 100"><i style="left:${m.vr}%"></i></div><span class="num" style="font-size:12px;white-space:nowrap">VR ${m.vr} · HV ${m.hv}%</span></td>
    <td class="n">±${k.em.toFixed(2)}<br><span class="muted">${k.dte}d</span></td>
    <td class="st"><b>${k.tpl}${k.ern?` <span class="rd-t e">Resultados ${rdFd(k.ern)}</span>`:''}</b><span>${k.why}${k.alt?` Alternativa: ${k.alt}.`:''}</span></td>
    <td class="n pt">${k.score}</td><td><button class="btn sm ghost" data-rd="abrir" data-s="${esc(m.s)}">Armar</button></td></tr>`;
  return `<div class="vhead"><div><h1>Radar de oportunidades</h1><p>Escanea las acciones y ETF con las opciones más líquidas y encuentra, para cada una, la estrategia que mejor encaja con su tendencia y su volatilidad.</p></div>
   <div class="inline"><button class="btn sm ghost" data-rd="geny" ${L.length?'':'disabled'}>Pedirle a Geny el plan de la semana</button><button class="btn" data-rd="scan" ${RD.busy?'disabled':''}>${RD.busy?'Escaneando…':all?'Volver a escanear':'Escanear el mercado'}</button></div></div>
  <div class="panel" style="margin-bottom:18px"><div class="rd-ctl">
    <div>Marco de tiempo<div class="tfs" role="group" aria-label="Marco de tiempo">${tf([['d','Diario · operar a 3 o 4 semanas'],['w','Semanal · operar a 6 u 8 semanas']],p.f,'f')}</div></div>
    <label>Universo<select id="rd-uni">${[['top30','Las 30 más líquidas'],['top60','Las 60 más líquidas'],['etf','Solo ETF (20)'],['mia','Mi lista']].map(([v,l])=>`<option value="${v}" ${p.uni===v?'selected':''}>${l}</option>`).join('')}</select></label>
    ${p.uni==='mia'?`<label>Mis símbolos, separados por coma<input type="text" id="rd-lista" value="${esc(p.lista||'')}" placeholder="AAPL, NVDA, SPY" style="width:240px"></label>`:''}
    <div>Sesgo<div class="tfs" role="group" aria-label="Sesgo">${tf([['all','Todos'],['a','Alcistas'],['b','Bajistas'],['n','Laterales']],p.fb,'fb')}</div></div>
    <div>Tipo de estrategia<div class="tfs" role="group" aria-label="Tipo de estrategia">${tf([['all','Todas'],['c','Comprar prima'],['v','Vender prima']],p.fk,'fk')}</div></div>
    <label class="ck"><input type="checkbox" id="rd-noe" ${p.noE?'checked':''}>Ocultar las que reportan resultados antes de vencer</label>
   </div>
   ${RD.busy?`<div class="rd-prog" aria-live="polite"><span id="rdTxt">Leyendo ${RD.done} de ${RD.total}…</span><div class="bar"><i id="rdBar" style="width:${RD.total?RD.done/RD.total*100:0}%;background:var(--lime);transition:none"></i></div></div>`:''}
   ${RD.err?`<p class="r21alert" style="margin:14px 0 0">${esc(RD.err)}</p>`:''}
   ${RD.at&&!RD.busy?`<p class="hint" style="margin-top:12px">Último escaneo: ${new Date(RD.at).toLocaleString('es',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}. Precios de cierre diario (${esc(RD.src||'Yahoo Finance')}); ${all} de ${u.length} símbolos de este universo con datos.</p>`:''}
  </div>
  ${!all?`<div class="empty">${RD.busy?'Leyendo un año de precios de cada símbolo. Tarda cerca de un minuto.':u.length?'Todavía no hay un escaneo de este universo. Toca «Escanear el mercado» y en un minuto tienes el mapa completo.':'Escribe tus símbolos arriba y toca «Escanear el mercado».'}</div>`:`
  ${mk.length?`<div class="rd-mkt"><span style="color:var(--fg);font-family:var(--display);font-weight:700">Pulso del mercado</span>${mk.map(m=>`<span><b>${m.s}</b> ${m.px.toFixed(2)} <span class="${m.chg>=0?'up':'down'}">${m.chg>=0?'+':''}${m.chg.toFixed(1)}%</span> · diario ${rdT(m.td)} semanal ${rdT(m.tw)} · VR <b>${m.vr}</b></span>`).join('')}</div>`:''}
  ${L.length?`<div class="rd-top">${L.slice(0,3).map(card).join('')}</div>
  <div class="panel"><div class="ph"><h2>Todas las oportunidades</h2><span class="muted" style="font-size:13px">${L.length} de ${all} · ordenadas por puntaje</span></div>
   <div class="tbl"><table class="rd"><thead><tr><th class="n">#</th><th>Activo</th><th class="n">Precio</th><th>3 meses</th><th>Diario</th><th>Semanal</th><th>Volatilidad</th><th class="n">Mov. esperado</th><th>Estrategia sugerida</th><th class="n">Puntaje</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div></div>`
  :'<div class="empty">Ningún símbolo pasa esos filtros. Prueba con «Todos» o cambia el marco de tiempo.</div>'}`}
  <details class="panel rd-how" style="margin-top:18px"><summary>Cómo decide el radar</summary>
   <p><b>1. La tendencia elige el lado.</b> En diario compara el precio con sus medias de 20 y 50 días; en semanal, con las de 10 y 30 semanas. Si el otro marco confirma, sube el puntaje; si lo contradice, baja.</p>
   <p><b>2. La volatilidad decide si compras o vendes prima.</b> El VR (rango de volatilidad) ubica la volatilidad de hoy entre el mínimo (0) y el máximo (100) del último año. VR bajo: las opciones suelen estar baratas, mejor comprar. VR alto: suelen estar caras, mejor cobrar prima con riesgo definido.</p>
   <div class="tbl"><table><thead><tr><th></th><th>VR menor a 50 · comprar</th><th>VR 50 a 70 · vender con riesgo definido</th><th>VR mayor a 70 · vender con más margen</th></tr></thead><tbody>
    <tr><td><b class="up">Alcista</b></td><td>Bull call spread, compra de call o diagonal</td><td>Bull put spread</td><td>Bull put spread (alternativa: venta de put)</td></tr>
    <tr><td><b class="down">Bajista</b></td><td>Bear put spread o compra de put</td><td>Bear call spread</td><td>Bear call spread</td></tr>
    <tr><td><b>Lateral</b></td><td>Calendar spread; si el precio está comprimido, long strangle</td><td>Iron condor</td><td>Iron condor (alternativa: short strangle)</td></tr></tbody></table></div>
   <p><b>3. El puntaje (0 a 100)</b> premia tendencia clara, confirmación entre marcos y volatilidad en un extremo. Resta si la empresa reporta resultados antes del vencimiento, si el precio ya está muy extendido o si el activo mueve poco dinero al día.</p>
   <p><b>4. El movimiento esperado</b> es cuánto podría moverse el precio hasta el vencimiento según su volatilidad reciente (una desviación estándar). «Armar en Estrategias» coloca los strikes usando esa medida.</p></details>
  <p class="risk">Herramienta educativa. El radar ordena ideas con reglas fijas sobre precios de cierre; no conoce tu cuenta ni tu plan y no es una recomendación de inversión. El VR usa volatilidad histórica, no la implícita de la cadena de opciones: confirma la IV, la liquidez de los strikes y la fecha de resultados en tu bróker antes de operar. Operar opciones implica riesgo de pérdida.</p>`;
};

const RD_MSG={server_not_connected:'Los precios no están disponibles por ahora. Intenta de nuevo en unos minutos.',needs_reauth:'Los precios no están disponibles por ahora. Intenta de nuevo en unos minutos.',
  not_granted:'El radar necesita tu permiso para leer precios de FMP. Actívalo en el menú de permisos de esta app.',approval_required:'El radar necesita tu permiso para leer precios de FMP. Actívalo en el menú de permisos de esta app.',blocked_by_policy:'Tu organización no permite que esta app use el conector FMP.'};
async function rdScan(){
  if(RD.busy)return;const list=rdUni();
  if(!list.length){toast('Escribe al menos un símbolo en tu lista');return}
  let mcp=null;try{mcp=window.claude?.use?await claude.use('mcp'):null}catch(e){}
  if(!mcp){RD.err='Los precios no están disponibles por ahora. Intenta de nuevo en unos minutos.';render();return}
  Object.assign(RD,{busy:true,err:'',done:0,total:list.length});render();
  const q=list.slice(),wait=ms=>new Promise(r=>setTimeout(r,ms));let stop='',fail=0;
  const one=async s=>{const args={endpoint:'historical-price-eod-full',symbol:s,from_date:daysAgo(430),to_date:today()};
    try{return await mcp.callTool('FMP','chart',args)}catch(e){if(!e?.retryable||RD_MSG[e.code])throw e;await wait(e.retryAfterMs||600+Math.random()*700);return mcp.callTool('FMP','chart',args)}};
  const step=async s=>{
    try{const r=await one(s);if(r)RD.src=(r.provider||r.source)==='fmp'?'FMP':'Yahoo Finance';const m=rdCalc(s,r?.payload);if(m)RD.rows[s]=m;else fail++}catch(e){if(RD_MSG[e?.code])stop=e.code;else fail++}
    RD.done++;const t=$('#rdTxt'),b=$('#rdBar');if(t)t.textContent=`Leyendo ${RD.done} de ${RD.total}…`;if(b)b.style.width=RD.done/RD.total*100+'%'};
  const work=async()=>{while(q.length&&!stop)await step(q.shift())};
  await step(q.shift());   // la primera llamada pide el permiso; las demás van de a tres
  if(!stop)await Promise.all([work(),work(),work()]);
  if(!stop){try{const r=await mcp.callTool('FMP','calendar',{endpoint:'earnings-calendar',from_date:today(),to_date:daysAgo(-62),symbols:[...new Set([...RD_T60,...list])].slice(0,75).join(',')});
    const set=new Set([...RD_T60,...RD_ETF,...list]),e={};(Array.isArray(r?.payload)?r.payload:[]).forEach(x=>{const s=x.symbol,d=String(x.date||'').slice(0,10);if(set.has(s)&&d>=today()&&(!e[s]||d<e[s]))e[s]=d});RD.earn=e}catch(e){}}
  RD.busy=false;RD.at=new Date().toISOString();
  RD.err=stop?RD_MSG[stop]:fail>=list.length?'No pude leer ningún símbolo. Espera un minuto y vuelve a escanear.':fail?`No pude leer ${fail} símbolo${fail===1?'':'s'}; el resto está al día.`:'';
  rdSave();if(route()==='radar')render();if(!stop&&fail<list.length){toast('Escaneo listo');window.jrBump?.('radar')}
}
function rdAbrir(sym){
  const m=RD.rows[sym];if(!m)return;const k=rdPick(m,rdPref().f),o=opc(),st=opcStep(m.px);
  o.sym=sym;o.spot=+m.px.toFixed(2);o.iv=Math.max(5,Math.round(m.hv));o.dte=k.dte;
  o.src=`Idea del radar con el cierre del ${rdFd(m.d)} (${RD.src||'Yahoo Finance'}). La volatilidad es la histórica de 20 días: ajústala a la IV que ves en tu bróker.`;
  opcSet(o,k.tpl);o.legs=opcBuild(k.tpl,o.spot,o.dte,Math.max(st,Math.round(k.em/2/st)*st));o.rng=opcAutoRng(o);
  save();go('opciones');toast(`${k.tpl} en ${sym}, lista para ajustar`);window.jrBump?.('armar')}
document.addEventListener('click',e=>{
  const t=e.target instanceof Element?e.target:null;if(!t)return;
  const b=t.closest('[data-rd]');if(!b)return;const p=rdPref(),a=b.dataset.rd;
  if(a==='scan')rdScan();
  else if(a==='abrir')rdAbrir(b.dataset.s);
  else if(a==='geny'){const L=rdLista().slice(0,5);if(!L.length)return;const dn={a:'alcista',b:'bajista',n:'lateral'};
    const t=`Este es mi radar de opciones en marco ${p.f==='w'?'semanal':'diario'}. ${L.map(({m,k},i)=>`${i+1}) ${m.s} a ${m.px.toFixed(2)}: diario ${dn[(m.td||{dir:'n'}).dir]}, semanal ${dn[(m.tw||{dir:'n'}).dir]}, rango de volatilidad ${m.vr}, movimiento esperado ±${k.em.toFixed(2)} a ${k.dte} días, estrategia sugerida ${k.tpl}${k.ern?', reporta resultados el '+rdFd(k.ern):''}, puntaje ${k.score}`).join('. ')}. Ayúdame a convertirlo en mi plan PEDEM de la semana: qué vigilar en cada una, cuánto arriesgar por operación y qué NO debo hacer.`;
    go('geny');setTimeout(()=>{const q=$('#q');if(q){q.value=t;q.focus()}},60)}
  else if(['f','fb','fk'].includes(a)){p[a]=b.dataset.v;save();render()}
});
document.addEventListener('change',e=>{
  const id=e.target.id;if(id!=='rd-uni'&&id!=='rd-noe'&&id!=='rd-lista')return;const p=rdPref();
  if(id==='rd-uni')p.uni=e.target.value;else if(id==='rd-noe')p.noE=e.target.checked;else p.lista=e.target.value.toUpperCase().slice(0,300);
  save();render()});

  addEventListener('hashchange', () => {
    if (Date.now() - lastModAt >= 120000) {
      setTimeout(flush, 500);
    }
  });
  window.__GENY_REMOUNT__ = function remountGenyPro(nextBoot) {
    if (nextBoot && typeof nextBoot === 'object') Object.assign(BOOT, nextBoot);
    bindDom();
    render();
  };
  bindDom();
  render();
};
