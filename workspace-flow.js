// Presentation and navigation only. Financial values come from the canonical state.
export function initialize(runtime) {
  const $ = id => document.getElementById(id);
  const node = (tag, text, cls) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    if (cls) e.className = cls;
    return e;
  };
  const money = n => (n / 100).toLocaleString('fr-CA', {style:'currency',currency:'CAD'});
  const date = d => d ? new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'short'}) : '—';
  const nav = document.querySelector('.app-shell-nav');
  const go = view => nav.querySelector(`[data-view="${view}"]`)?.click();
  const button = (text, action) => {
    const b = node('button',text,'secondary'); b.type='button'; b.onclick=action; return b;
  };
  document.body.classList.add('workspace-flow');
  for(const view of ['prevision','recurrences']) {
    const section=$('section-'+view), tabs=section.querySelector('.planning-tabs');
    if(!tabs)continue;
    const more=node('details',undefined,'flow-planning-more');
    more.append(node('summary','Autres vues'),tabs);
    section.prepend(more);
  }
  const budgetViews = ['budget','enveloppes','bilan'];
  const tabNames = {budget:'Budget et enveloppes',enveloppes:'Gérer les enveloppes',bilan:'Bilan mensuel'};
  for (const view of budgetViews) {
    const section = $('section-'+view);
    const tabs = node('nav',undefined,'flow-budget-tabs');
    tabs.setAttribute('aria-label','Vues du budget');
    for (const target of budgetViews) {
      const b = button(tabNames[target],()=>go(target));
      b.dataset.budgetView=target;
      if(view===target) b.setAttribute('aria-current','page');
      tabs.append(b);
    }
    section.prepend(tabs);
  }
  for (const view of ['bilan','enveloppes','paie'])
    nav.querySelector(`[data-view="${view}"]`).classList.add('flow-secondary-route');
  function mark(view) {
    const parent=nav.querySelector('[data-view="budget"]');
    parent.classList.remove('flow-parent-active');
    if (!budgetViews.includes(view)) return;
    // Keep the actual route's active class: legacy reports use it to refresh.
    parent.classList.add('flow-parent-active');
    parent.setAttribute('aria-current','page');
    document.querySelector('.workspace-header h1').textContent = 'Budget';
    for (const b of document.querySelectorAll('.mobile-tabbar [data-mobile-view]'))
      b.setAttribute('aria-current',b.dataset.mobileView==='budget'?'page':'false');
  }
  for (const b of nav.querySelectorAll('[data-view]'))
    b.addEventListener('click',()=>{
      mark(b.dataset.view);
      document.querySelectorAll('.flow-planning-more').forEach(d=>d.open=false);
    });
  mark(location.hash.slice(1));
  window.addEventListener('hashchange',()=>{
    const view=location.hash.slice(1);
    const target=[...nav.querySelectorAll('[data-view]')].find(b=>b.dataset.view===view);
    target?.click();
  });

  const payday = node('section',undefined,'flow-payday');
  payday.id='dashboard-payday';
  const paydayTitle = node('div',undefined,'flow-panel-heading');
  paydayTitle.append(node('h2','Ma prochaine paie'),button('Répartition et règles',()=>go('paie')));
  const paydayValues=node('div',undefined,'flow-payday-values');
  payday.append(paydayTitle,paydayValues);
  $('v80-hero').after(payday);
  function drawPayday(state) {
    const cycle=state.life?.cycle, traffic=state.life?.traffic;
    paydayValues.replaceChildren();
    if (!cycle?.pay) { paydayValues.append(node('p','Aucune paie prévue dans la période.')); return; }
    for (const [label,value] of [['Prochaine paie',date(cycle.pay.date)],['Revenus de cette paie',money(cycle.pay.amount_cents)],['Minimum avant la paie',money(traffic.minimum_cents)]]) {
      const cell=node('div');cell.append(node('span',label),node('strong',value));paydayValues.append(cell);
    }
  }

  const daily = node('section',undefined,'flow-daily');
  daily.id='forecast-daily-table';
  daily.append(node('h3','Jour par jour · prévision actuelle'));
  const dailyTable=node('table'),thead=node('thead'),heading=node('tr'),tbody=node('tbody');
  for(const label of ['Date','Événements','Solde bancaire','Protégé','Disponible à dépenser']) heading.append(node('th',label));
  thead.append(heading);dailyTable.append(thead,tbody);daily.append(dailyTable);
  $('v4-forecast').append(daily);
  let latest=null;
  function drawDaily() {
    if(!latest) return;
    const horizon=Number(document.querySelector('#v4-forecast [data-days][aria-pressed=true]')?.dataset.days || 30);
    tbody.replaceChildren();
    for(const d of latest.forecast.slice(0,horizon)) {
      const row=node('tr');row.dataset.date=d.date;
      const open=button(date(d.date),()=>{
        const index=latest.forecast.findIndex(day=>day.date===d.date);
        $('v4-slider').value=index;
        $('v4-slider').dispatchEvent(new Event('input',{bubbles:true}));
        $('v4-forecast-day').scrollIntoView({block:'nearest',behavior:'smooth'});
      });
      const first=node('td');first.append(open);row.append(first);
      row.append(node('td',d.events.map(e=>e.description).join(' · ') || '—'));
      for(const value of [d.cash_cents,d.cash_cents-d.safe_cents,d.safe_cents]) row.append(node('td',money(value)));
      tbody.append(row);
    }
  }
  for(const b of document.querySelectorAll('#v4-forecast [data-days]')) b.addEventListener('click',drawDaily);

  // Reuse the existing global search, editor and classification confirmation.
  let prefixUntil=0;
  document.addEventListener('keydown',e=>{
    const editing=e.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable=false])');
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!e.altKey) {
      if(document.querySelector('dialog[open]')) return;
      const search=[...document.querySelectorAll('button')].find(b=>b.textContent==='Rechercher…');
      if(search){e.preventDefault();search.click();} return;
    }
    if(editing||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open]')) return;
    const key=e.key.toLowerCase();
    if(Date.now()<prefixUntil) {
      prefixUntil=0;
      const view={a:'dashboard',t:'transactions',b:'budget',r:'recurrences',p:'prevision',c:'comptes'}[key];
      if(view){e.preventDefault();go(view);} return;
    }
    if(key==='g'){prefixUntil=Date.now()+1500;return;}
    if(key==='n'){e.preventDefault();nav.querySelector('.quick-add').click();}
  });
  const shortcuts=node('details',undefined,'flow-shortcuts');
  shortcuts.append(node('summary','Raccourcis clavier'),node('p','Ctrl / ⌘ K : rechercher · N : transaction · G puis A / T / B / R / P / C : accueil / transactions / budget / récurrences / prévisions / comptes.'));
  $('s26-tools').append(shortcuts);
  let gesture=null;
  const host=$('v2-transaction-list');
  host.addEventListener('touchstart',e=>{
    if(e.touches.length!==1||e.target.closest('button,input,select,summary,a')||!matchMedia('(max-width:760px)').matches) {gesture=null;return;}
    const row=e.target.closest('.ledger-row');
    gesture=row?{row,x:e.touches[0].clientX,y:e.touches[0].clientY}:null;
  },{passive:true});
  host.addEventListener('touchend',e=>{
    if(!gesture||e.changedTouches.length!==1)return;
    const {row,x,y}=gesture;gesture=null;
    const dx=e.changedTouches[0].clientX-x,dy=e.changedTouches[0].clientY-y;
    if(Math.abs(dx)>75&&Math.abs(dx)>Math.abs(dy)*2&&!document.querySelector('dialog[open]')) row.querySelector('.ledger-category button')?.click();
  },{passive:true});
  host.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
  const hint=node('p','Balayez une ligne pour la classer; le menu ⋯ reste disponible.','flow-swipe-hint');
  host.closest('.register-table').before(hint);
  const render=runtime.render;
  runtime.render=function(state){const result=render(state);latest=state;drawPayday(state);drawDaily();return result;};
  if(runtime.state){latest=runtime.state;drawPayday(latest);drawDaily();}
}
