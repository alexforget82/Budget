// Sillage 2: four daily destinations. Original routes and handlers remain authoritative.
export function initialize(runtime) {
  const $ = id => document.getElementById(id);
  const nav = document.querySelector('.app-shell-nav');
  const settings = $('s26-tools'), settingsBody = settings.querySelector(':scope>div');
  document.body.classList.add('sillage-two');
  document.title = 'Sillage 2';
  function label(button, text) {
    const texts=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE && n.textContent.trim());
    if(texts.length) { texts[0].textContent=' '+text; for(const n of texts.slice(1))n.remove(); }
    else button.append(document.createTextNode(' '+text));
  }
  const primary = new Map([['dashboard','Disponible'],['transactions','Transactions'],['budget','Budget'],['recurrences','À venir']]);
  settings.querySelector(':scope>summary').textContent='Réglages';
  for(const button of [...nav.querySelectorAll('[data-view]')]) {
    if(primary.has(button.dataset.view)) {
      label(button,primary.get(button.dataset.view));
      button.classList.add('s2-primary');
      nav.insertBefore(button,settings);
    } else {
      settingsBody.append(button);
      button.classList.add('s2-setting-route');
    }
  }
  const essentials=document.createElement('div');essentials.className='s2-settings-main';
  for(const view of ['comptes','categories','importer','sauvegardes'])essentials.append(nav.querySelector(`[data-view="${view}"]`));
  settingsBody.prepend(essentials);
  const advanced=document.createElement('details');advanced.id='s2-advanced-tools';
  const advancedTitle=document.createElement('summary');advancedTitle.textContent='Outils avancés';advanced.append(advancedTitle);
  for(const b of [...settingsBody.querySelectorAll(':scope>[data-view]')]) {
    if(['enveloppes','bilan'].includes(b.dataset.view))b.classList.add('s2-context-route');
    advanced.append(b);
  }
  settingsBody.append(advanced);
  for(const view of primary.keys())nav.insertBefore(nav.querySelector(`[data-view="${view}"]`),settings);
  const names={importer:'Importer CSV',sauvegardes:'Sauvegardes',virements:'Virements','budgets-libres':'Budgets libres',objectifs:'Objectifs',comptes:'Comptes',categories:'Catégories',verification:'Vérifier mes données',paie:'Répartition de la paie',exceptions:'Ajustements ponctuels',suivi:'Associer au prévu',prevision:'Prévisions détaillées',calendrier:'Calendrier détaillé',demarrage:'Configurer Sillage'};
  for(const [view,text] of Object.entries(names)) label(nav.querySelector(`[data-view="${view}"]`),text);
  const brand=nav.querySelector('.brand strong');
  brand.replaceChildren(document.createTextNode('Sillage '));
  const generation=document.createElement('span');generation.className='brand-generation';generation.textContent='2';brand.append(generation);
  const routeGroup=view=>['dashboard','prevision'].includes(view)?'dashboard':['budget','enveloppes','bilan','budgets-libres','objectifs'].includes(view)?'budget':['recurrences','calendrier','suivi','exceptions'].includes(view)?'recurrences':null;
  function mark(view) {
    const parent=routeGroup(view);
    for(const b of nav.querySelectorAll('.s2-primary')) {
      b.classList.toggle('s2-current',b.dataset.view===parent);
      b.setAttribute('aria-current',b.dataset.view===parent?'page':'false');
    }
    // Do not change .active: report refreshes depend on the real route.
    $('workspace-title').textContent=primary.get(view)||({prevision:'Disponible · prévisions',enveloppes:'Budget · enveloppes',bilan:'Budget · bilan',calendrier:'À venir · calendrier',suivi:'À venir · associations',exceptions:'À venir · ajustements'}[view])||names[view]||'Réglages';
    if(!primary.has(view) && !['prevision','enveloppes','bilan'].includes(view))settings.open=true;
  }
  for(const b of nav.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{mark(b.dataset.view);if(primary.has(b.dataset.view)){settings.open=false;advanced.open=false;}});
  mark(nav.querySelector('[data-view].active')?.dataset.view||'dashboard');
  for(const tab of document.querySelectorAll('.flow-budget-tabs [data-budget-view]'))tab.textContent={budget:'Vue d’ensemble',enveloppes:'Enveloppes',bilan:'Bilan'}[tab.dataset.budgetView];
  const actions=document.createElement('div');actions.className='s2-available-actions';
  function action(text,run){const b=document.createElement('button');b.type='button';b.className='secondary';b.textContent=text;b.onclick=run;return b;}
  actions.append(action('Voir la prévision complète',()=>nav.querySelector('[data-view=prevision]').click()),action('Puis-je faire cet achat ?',()=>{nav.querySelector('[data-view=prevision]').click();$('v4-sim-open').click();}));
  $('v80-hero').after(actions);
  const details=document.createElement('details');details.id='s2-dashboard-details';details.className='s2-dashboard-details';
  const summary=document.createElement('summary');summary.textContent='Plus de détails';details.append(summary);
  // Keep secondary dashboard tools available without duplicating them.
  for(const selector of ['.minimum-history-shortcut','#dashboard-payday']) {
    const item=document.querySelector(selector);if(item)details.append(item);
  }
  actions.after(details);
  try {if(!localStorage.getItem('sillage2-layout')) {if(!$('app-dashboard').classList.contains('home-essential'))$('home-mode').click();localStorage.setItem('sillage2-layout','simple');}} catch {}
  const form=$('transaction'),date=form.elements.happened_on;
  const dateOptions=document.createElement('details');dateOptions.id='s2-entry-options';
  const dateSummary=document.createElement('summary');dateSummary.textContent='Date de la transaction';dateOptions.append(dateSummary,date.closest('label'));
  form.querySelector('button[type=submit],button:not([type])')?.before(dateOptions);
  form.addEventListener('invalid',e=>{if(dateOptions.contains(e.target))dateOptions.open=true;},true);
  $('transaction-direction').addEventListener('change',()=>{if($('transaction-direction').value==='transfer')dateOptions.open=true;});
  const open=window.appOpenEditor;
  window.appOpenEditor=function(key){if(key==='transaction')dateOptions.open=$('transaction-direction').value==='transfer';return open(key);};
  const sub=$('transaction-subcategory');
  const syncSub=()=>{if(sub)sub.closest('label').classList.toggle('s2-empty-subcategory',sub.options.length<=1&&!sub.value);};
  if(sub){new MutationObserver(syncSub).observe(sub,{childList:true});sub.addEventListener('change',syncSub);syncSub();}
  const render=runtime.render;
  runtime.render=function(s){const result=render(s);mark(nav.querySelector('[data-view].active')?.dataset.view||'dashboard');return result;};
  document.body.dataset.sillageReady='2';
}
