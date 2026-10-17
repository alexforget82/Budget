/* Presentation for accounts and planning. Financial data comes from the existing API. */
(()=>{
 const $=id=>document.getElementById(id);
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const action=(text,fn,cls='secondary')=>{const b=el('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const cash=v=>(v/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'});
 const date=(value,long=false)=>new Date(value+'T12:00:00').toLocaleDateString('fr-CA',long?{weekday:'long',day:'numeric',month:'long'}:{day:'numeric',month:'short'});
 const symbol=(name)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',({account:'M3 7h18v14H3z M3 7l13-4v4 M16 12h5v4h-5z',savings:'M4 9h16v12H4z M8 9V4h8v5 M9 15h6',credit:'M3 5h18v14H3z M3 10h18 M6 15h4',envelope:'M3 5h18v14H3z M3 5l9 7 9-7',income:'M5 17L19 3 M8 3h11v11',expense:'M5 7l14 14 M8 21h11V10',transfer:'M3 8h18 M17 4l4 4-4 4 M21 16H3 M7 12l-4 4 4 4',reserve:'M12 3l9 9-9 9-9-9z'})[name]||'M3 12h18');svg.append(p);return svg;};
 const pages=['comptes','enveloppes','recurrences','prevision','objectifs','calendrier'];
 for(const name of pages){
  const section=$('section-'+name);section.classList.add('designed-page');section.classList.remove('is-collapsed');
  const help=el('details',undefined,'context-help');help.append(el('summary','Quelques repères pour bien commencer'));
  for(const child of [...section.children])if(child.matches('p.sub,p.warning,.selection-hint'))help.append(child);
  if(help.children.length>1)section.append(help);
  section.querySelector('.section-toggle')?.setAttribute('hidden','');
 }
 const names={comptes:'Vos comptes, en toute clarté',enveloppes:'De l’argent pour vos priorités',recurrences:'Votre rythme financier',prevision:'Les prochaines semaines, en clair',objectifs:'Faites place à vos projets',calendrier:'Votre mois, en un regard'};
 const intros={comptes:'Vos soldes au même endroit. Choisissez ce qui entre dans votre disponible.',enveloppes:'Gardez vos réserves visibles et ajustez-les à votre quotidien.',recurrences:'Revenus, factures et virements : tout ce qui revient, au même endroit.',prevision:'Une trajectoire claire, puis les détails à votre rythme.',objectifs:'Un cap, une progression et la satisfaction d’avancer.',calendrier:'Repérez vos journées importantes et consultez leurs mouvements.'};
 for(const name of pages){const section=$('section-'+name),head=section.querySelector('.section-head');if(head){head.querySelector('h2').textContent=names[name];const intro=el('p',intros[name],'page-intro');head.after(intro);}}
 // A small contextual navigation makes planning feel like a connected workspace.
 for(const name of ['enveloppes','objectifs','recurrences','prevision','calendrier']){
  const nav=el('nav',undefined,'planning-tabs');nav.setAttribute('aria-label','Planifier votre budget');
  for(const [key,label] of [['prevision','Vue d’ensemble'],['recurrences','Récurrences'],['enveloppes','Enveloppes'],['objectifs','Objectifs'],['calendrier','Calendrier']]){const b=action(label,()=>document.querySelector(`[data-view="${key}"]`).click());b.setAttribute('aria-current',key===name?'page':'false');nav.append(b);}
  $('section-'+name).prepend(nav);
 }
 function compactActions(name){const section=$('section-'+name),bar=section.querySelector('.view-toolbar');if(bar){bar.classList.add('page-actions');section.querySelector('.section-head').append(bar);}return bar;}
 const accountActions=compactActions('comptes');compactActions('enveloppes');compactActions('recurrences');
 function disclosure(node,label){const details=el('details',undefined,'advanced-tool');details.append(el('summary',label),node);return details;}
 function dialogFor(node,title){const dialog=el('dialog',undefined,'editor-dialog planning-dialog');const inner=el('div',undefined,'dialog-inner');const heading=el('div',undefined,'dialog-heading');heading.append(el('h2',title),action('Fermer',()=>dialog.close()));inner.append(heading,node);dialog.append(inner);document.body.append(dialog);return dialog;}
 const reconcile=$('section-comptes').querySelector('.reconciliation-panel');const balanceDialog=dialogFor(reconcile,'Comparer avec votre banque');accountActions.prepend(action('Comparer un solde',()=>balanceDialog.showModal()));
 const accountsSummary=el('div',undefined,'account-overview');$('accounts').before(accountsSummary);
 const accountHelp=$('section-comptes').querySelector('.context-help');if(accountHelp)accountHelp.firstElementChild.textContent='Comment est calculé le disponible ?';
 const envelopeAdvanced=$('section-enveloppes').querySelector('.v21-reconcile');if(envelopeAdvanced)$('section-enveloppes').append(disclosure(envelopeAdvanced,'Prévoir un budget exceptionnel'));
 const recurringAdvanced=$('section-recurrences').querySelector('.v21-reconcile');if(recurringAdvanced)$('section-recurrences').append(disclosure(recurringAdvanced,'Associer une opération à une récurrence'));
 $('section-recurrences').querySelector('.rec-form-title')?.remove();
 const recurringFilters=el('div',undefined,'planning-filters');let recurringFilter='all';
 for(const [key,label] of [['all','Tout'],['income','Revenus'],['expense','Factures'],['transfer','Virements'],['reserve','Réserves']]){const b=action(label,()=>{recurringFilter=key;drawRecurring();});b.dataset.filter=key;recurringFilters.append(b);}
 $('rec-groups').before(recurringFilters);
 // Goals are created in a focused editor instead of an always-visible form.
 const goalDialog=dialogFor($('goal-form'),'Votre objectif');const goalActions=el('div',undefined,'page-actions');goalActions.append(action('+ Nouvel objectif',()=>{ $('goal-form').reset();$('goal-form').elements.id.value='';$('goal-save').textContent='Créer l’objectif';$('goal-cancel').hidden=true;goalDialog.showModal();},'primary'));$('section-objectifs').querySelector('.section-head').append(goalActions);
 $('goal-cancel').addEventListener('click',()=>goalDialog.close());
 $('goals-list').addEventListener('click',e=>{if(e.target.closest('button')?.textContent==='Modifier')goalDialog.showModal();});
 const previousSend=send;send=async function(url,data){const ok=await previousSend(url,data);if(ok&&url==='/api/goals')goalDialog.close();if(ok&&url==='/api/balance/reconcile')balanceDialog.close();return ok;};

 renderAccounts=function(accounts){
  const host=$('accounts');host.replaceChildren();host.className='account-card-grid';
  for(const account of [...accounts].sort((a,b)=>a.name.localeCompare(b.name,'fr-CA'))){
   const card=el('article',undefined,'bank-card '+account.kind);card.dataset.accountId=account.id;
   const top=el('div',undefined,'bank-card-top'),icon=el('span',undefined,'tile-icon');icon.append(symbol(account.kind==='checking'?'account':account.kind));const label=el('div');label.append(el('h3',account.name),el('span',({checking:'Compte courant',savings:'Compte d’épargne',credit:'Carte et marge'})[account.kind],'card-caption'));top.append(icon,label);
   const value=el('div',cash(account.balance_cents),'bank-balance');const credit=account.kind==='credit';value.classList.toggle('negative',!credit&&account.balance_cents<0);
   card.append(top,el('p',credit?'Montant dû':'Solde actuel','card-caption balance-caption'),value);
   const footer=el('div',undefined,'bank-card-footer');
   if(credit)footer.append(el('span','Exclu du disponible','soft-badge'));
   else{const toggle=el('label',undefined,'account-switch');const input=el('input');input.type='checkbox';input.checked=!!account.included;input.setAttribute('aria-label','Inclure '+account.name+' dans le disponible');const track=el('span',undefined,'switch-track');track.setAttribute('aria-hidden','true');const text=el('span',account.included?'Inclus dans le disponible':'Hors disponible');toggle.append(input,track,text);input.onchange=async()=>{input.disabled=true;const ok=await send('/api/accounts/inclusion',{id:account.id,included:input.checked});if(!ok){input.checked=!!account.included;input.disabled=false;}};footer.append(toggle);}
   footer.append(action('Modifier',()=>editAccount(account.id),'card-link'));card.append(footer);host.append(card);
  }
  if(!accounts.length)budgetEmpty(host,'Votre premier compte vous attend','Ajoutez le solde de votre compte courant pour commencer à planifier.','Ajouter un compte',()=>{resetAccount();window.appOpenEditor('account');});
 };
 renderEnvelopes=function(items){
  const host=$('envelopes');host.replaceChildren();host.className='envelope-card-grid';
  for(const envelope of items){
   const details=state?.envelope_details?.find(d=>d.id===envelope.id);const card=el('article',undefined,'envelope-tile');card.dataset.envelopeId=envelope.id;
   const top=el('div',undefined,'bank-card-top'),icon=el('span',undefined,'tile-icon');icon.append(symbol('envelope'));const name=el('div');name.append(el('h3',envelope.name),el('span',envelope.active?'Réserve active':'En pause','card-caption'));top.append(icon,name);card.append(top,el('p','Disponible dans l’enveloppe','card-caption balance-caption'),el('div',cash(envelope.reserved_cents),'bank-balance'));
   const progress=el('progress');progress.max=Math.max(1,envelope.budget_cents,envelope.reserved_cents);progress.value=envelope.reserved_cents;progress.setAttribute('aria-label',envelope.name+' : '+cash(envelope.reserved_cents)+' réservés');card.append(progress);
   const info=el('div',undefined,'envelope-facts');info.append(el('span','Budget par période'),el('strong',envelope.budget_cents?cash(envelope.budget_cents):'Libre'),el('span','Prochain renouvellement'),el('strong',details?.next_renewal?date(details.next_renewal):'Aucun'),el('span','Dépensé cette période'),el('strong',cash(details?.spent_cents||0)));card.append(info);
   const footer=el('div',undefined,'bank-card-footer');footer.append(action('Ajuster l’enveloppe',()=>editEnvelope(envelope.id),'card-link'),action('Supprimer',()=>deleteEnvelope(envelope.id),'quiet-danger'));card.append(footer);host.append(card);
  }
  if(!items.length)budgetEmpty(host,'Chaque priorité peut avoir son enveloppe','Épicerie, sorties, vacances : répartissez votre disponible sans déplacer d’argent.','Créer une enveloppe',()=>{resetEnvelope();window.appOpenEditor('envelope');});
 };
 let latest=null;
 function drawAccountsSummary(){
  accountsSummary.replaceChildren();const accounts=latest.accounts||[];const balance=accounts.filter(a=>a.kind!=='credit').reduce((s,a)=>s+a.balance_cents,0),debt=accounts.filter(a=>a.kind==='credit').reduce((s,a)=>s+a.balance_cents,0);
  const lead=el('div',undefined,'account-overview-lead');lead.append(el('span','VOTRE ARGENT AU QUOTIDIEN','eyebrow'),el('strong',cash(balance)),el('p',accounts.length+' compte'+(accounts.length===1?'':'s')+' pour garder le cap.'));accountsSummary.append(lead);
  for(const [label,value,copy] of [['Inclus dans le disponible',latest.cash_cents,'Avant les réserves d’enveloppes'],['Cartes et marges',debt,'Montants dus, suivis séparément']]){const metric=el('div',undefined,'account-overview-metric');metric.append(el('span',label),el('strong',cash(value)),el('small',copy));accountsSummary.append(metric);}
 }
 function drawRecurring(){
  if(!latest)return;const host=$('rec-groups');host.replaceChildren();host.className='recurrence-card-grid';
  recurringFilters.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===recurringFilter)));
  const all=latest.recurring||[],rules=all.filter(r=>recurringFilter==='all'||r.type===recurringFilter).sort((a,b)=>Number(b.active)-Number(a.active)||a.description.localeCompare(b.description,'fr-CA'));
  const accountNames=new Map(latest.accounts.map(a=>[a.id,a.name]));
  for(const rule of rules){
   const card=el('article',undefined,'recurrence-tile '+rule.type+(rule.active?'':' paused'));const top=el('div',undefined,'bank-card-top'),icon=el('span',undefined,'tile-icon');icon.append(symbol(rule.type));const copy=el('div');copy.append(el('h3',rule.description),el('span',freq[rule.frequency]||rule.frequency,'card-caption'));top.append(icon,copy);card.append(top);
   card.append(el('div',(rule.type==='income'?'+':rule.type==='expense'?'−':'')+cash(rule.amount_cents),'rule-amount'),el('p',rule.type==='reserve'?(latest.envelopes.find(e=>e.id===rule.envelope_id)?.name||'Enveloppe'):((accountNames.get(rule.account_id)||'Compte')+(rule.type==='transfer'?' → '+(accountNames.get(rule.to_account_id)||'Compte'):'')),'card-caption'));
   const next=latest.forecast.find(day=>day.events.some(event=>event.id===rule.id));card.append(el('p',!rule.active?'Récurrence en pause':next?'Prochaine occurrence · '+date(next.date):'Début de la règle · '+date(rule.start_on),'rule-date'));
   const footer=el('div',undefined,'bank-card-footer');footer.append(action('Modifier',()=>editRule(rule.id),'card-link'),action(rule.active?'Mettre en pause':'Réactiver',()=>send('/api/recurring/update',{...rule,amount:rule.amount_cents/100,active:!rule.active}),'card-link'));
   const more=el('details',undefined,'card-more');const moreLabel=el('summary','•••');moreLabel.setAttribute('aria-label','Autres actions pour '+rule.description);more.append(moreLabel,action('Supprimer la règle',()=>{if(confirm('Supprimer « '+rule.description+' » ?'))send('/api/recurring/delete',{id:rule.id});},'quiet-danger'));footer.append(more);card.append(footer);host.append(card);
  }
  if(!rules.length)budgetEmpty(host,'Rien ici pour le moment','Ajoutez vos revenus et vos factures pour donner vie à votre prévision.','Ajouter une récurrence',()=>{resetRec();window.appOpenEditor('recurring');});
 }

 // Forecast: a horizon, one trajectory, then one week and one day at a time.
 const forecastSection=$('section-prevision');
 const legacy=el('details',undefined,'forecast-source-list');legacy.append(el('summary','Consulter la liste quotidienne complète'));
 for(const selector of ['.forecast-legend','.forecast-toolbar','#forecast']){const child=forecastSection.querySelector(selector);if(child)legacy.append(child);}
 forecastSection.append(legacy);
 const planning=el('div',undefined,'forecast-workspace');forecastSection.querySelector('.page-intro').after(planning);
 planning.innerHTML=`<div class="forecast-controls"><div><span class="eyebrow">L’HORIZON QUI VOUS CONVIENT</span><p>Vos soldes saisis, vos réserves et vos mouvements prévus.</p></div><div class="horizon-selector" role="group" aria-label="Horizon de prévision"><button type="button" data-horizon="30">30 jours</button><button type="button" data-horizon="60">60 jours</button><button type="button" data-horizon="90" aria-pressed="true">90 jours</button></div></div><div class="trajectory-metrics"></div><div class="trajectory-alert" hidden></div><div class="trajectory-layout"><div class="trajectory-panel"><div class="panel-heading"><div><p class="eyebrow">VOTRE TRAJECTOIRE</p><h3>Le disponible au fil des jours</h3></div><span class="trajectory-date-range"></span></div><svg id="planning-chart" role="img" aria-label="Prévision du disponible"></svg><label class="trajectory-slider-label">Explorer une journée<input id="planning-day-slider" type="range" min="0" max="89" value="0" step="1"></label><p class="trajectory-legend"><span>Disponible projeté</span><span>Seuil de 0 $</span></p></div><aside class="selected-day-panel" aria-label="Détail du jour sélectionné"><div class="day-picker"><button type="button" id="planning-day-prev" aria-label="Jour précédent">←</button><label>Journée<input id="planning-date" type="date"></label><button type="button" id="planning-day-next" aria-label="Jour suivant">→</button></div><div id="planning-day-detail" aria-live="polite"></div></aside></div><div class="week-heading"><div><p class="eyebrow">À VOTRE RYTHME</p><h3>Une semaine à la fois</h3></div><div class="week-paging"><button type="button" id="planning-weeks-prev" aria-label="Semaines précédentes">←</button><span id="planning-weeks-page"></span><button type="button" id="planning-weeks-next" aria-label="Semaines suivantes">→</button></div></div><div id="planning-weeks" class="week-cards"></div><div class="week-days-caption">Les journées de la semaine sélectionnée</div><div id="planning-week-days" class="week-day-strip"></div>`;
 let horizon=90,selected=0,weekPage=0,forecastDays=[],chartMap=null;
 const chart=$('planning-chart'),slider=$('planning-day-slider');
 const previousWeek=$('planning-weeks-prev'),nextWeek=$('planning-weeks-next');
 function drawTrajectory(){
  chart.replaceChildren();if(!forecastDays.length)return;
  const width=Math.max(300,Math.round(chart.getBoundingClientRect().width)||760),height=280,left=64,right=width-18,top=24,bottom=228;
  chart.setAttribute('viewBox',`0 0 ${width} ${height}`);
  const values=forecastDays.map(d=>d.safe_cents),rough=Math.max(10000,Math.max(0,...values)-Math.min(0,...values))/4,unit=10**Math.floor(Math.log10(rough)),step=[1,2,5,10].map(n=>n*unit).find(n=>n>=rough),low=Math.floor(Math.min(0,...values)/step)*step,high=Math.max(low+step,Math.ceil(Math.max(0,...values)/step)*step);
  const x=i=>left+i*(right-left)/Math.max(1,forecastDays.length-1),y=v=>bottom-(v-low)/(high-low)*(bottom-top);
  const svgNode=(tag,attrs,text)=>{const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;chart.append(n);return n;};
  for(let value=low;value<=high;value+=step){svgNode('line',{x1:left,y1:y(value),x2:right,y2:y(value),class:value===0?'chart-zero':'chart-grid'});svgNode('text',{x:left-10,y:y(value)+4,'text-anchor':'end',class:'chart-tick'},(value/100).toLocaleString('fr-CA',{notation:Math.abs(value)>=1000000?'compact':'standard',maximumFractionDigits:1})+' $');}
  const defs=svgNode('defs',{}),gradient=document.createElementNS(chart.namespaceURI,'linearGradient');gradient.id='planning-fill';gradient.setAttribute('x1','0');gradient.setAttribute('y1','0');gradient.setAttribute('x2','0');gradient.setAttribute('y2','1');
  for(const [offset,opacity] of [['0%','.2'],['100%','.01']]){const stop=document.createElementNS(chart.namespaceURI,'stop');stop.setAttribute('offset',offset);stop.setAttribute('stop-color','#367b64');stop.setAttribute('stop-opacity',opacity);gradient.append(stop);}defs.append(gradient);
  const points=forecastDays.map((day,i)=>[x(i),y(day.safe_cents)]);
  svgNode('path',{d:'M '+points.map(p=>p.join(',')).join(' L ')+` L ${right},${bottom} L ${left},${bottom} Z`,fill:'url(#planning-fill)'});
  svgNode('polyline',{points:points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#367b64','stroke-width':'2.6','stroke-linecap':'round','stroke-linejoin':'round','vector-effect':'non-scaling-stroke'});
  for(const i of [...new Set([0,Math.floor((forecastDays.length-1)/2),forecastDays.length-1])])svgNode('text',{x:x(i),y:264,'text-anchor':i===0?'start':i===forecastDays.length-1?'end':'middle',class:'chart-tick'},date(forecastDays[i].date));
  const guide=svgNode('line',{x1:x(selected),x2:x(selected),y1:top,y2:bottom,class:'chart-guide'}),dot=svgNode('circle',{cx:x(selected),cy:y(values[selected]),r:5.5,fill:values[selected]<0?'#b15d52':'#367b64',stroke:'#fff','stroke-width':3});
  chartMap={x,y,guide,dot,width,left,right};chart.setAttribute('aria-label',`Disponible projeté sur ${forecastDays.length} jours : minimum ${cash(Math.min(...values))}. Utilisez le curseur sous le graphique pour consulter chaque journée.`);
 }
 function selectDay(index,followWeek=true){
  if(!forecastDays.length)return;selected=Math.max(0,Math.min(forecastDays.length-1,index));if(followWeek)weekPage=Math.floor(Math.floor(selected/7)/4)*4;
  slider.value=selected;const day=forecastDays[selected];slider.setAttribute('aria-valuetext',date(day.date,true)+' : '+cash(day.safe_cents));$('planning-date').value=day.date;
  $('planning-day-prev').disabled=selected===0;$('planning-day-next').disabled=selected===forecastDays.length-1;
  if(chartMap){chartMap.guide.setAttribute('x1',chartMap.x(selected));chartMap.guide.setAttribute('x2',chartMap.x(selected));chartMap.dot.setAttribute('cx',chartMap.x(selected));chartMap.dot.setAttribute('cy',chartMap.y(day.safe_cents));chartMap.dot.setAttribute('fill',day.safe_cents<0?'#b15d52':'#367b64');}
  const detail=$('planning-day-detail');detail.replaceChildren();detail.append(el('p',date(day.date,true),'day-full-date'),el('span','Disponible projeté','card-caption'),el('strong',cash(day.safe_cents),'selected-day-value'+(day.safe_cents<0?' negative':'')));
  const facts=el('div',undefined,'day-balance-facts');facts.append(el('span','Solde admissible'),el('strong',cash(day.cash_cents)),el('span','Enveloppes réservées'),el('strong',cash(day.reserved_cents)));detail.append(facts);
  const events=el('div',undefined,'day-events');events.append(el('h4',day.events.length?day.events.length+' mouvement'+(day.events.length===1?' prévu':'s prévus'):'Une journée tranquille'));
  for(const event of day.events){const row=el('div',undefined,'day-event '+event.type),icon=el('span',undefined,'event-dot');icon.append(symbol(event.type));const copy=el('div');copy.append(el('strong',event.description),el('small',event.credit_charge?'Achat sur crédit':event.transfer_internal?'Virement interne':types[event.type]||'Mouvement'));if(typeof event.sts_impact_cents==='number')copy.append(el('small',event.sts_impact_cents===0?'Aucun effet sur le disponible':'Effet sur le disponible : '+(event.sts_impact_cents>0?'+':'−')+cash(Math.abs(event.sts_impact_cents))));row.append(icon,copy,el('strong',(event.type==='income'?'+':event.type==='expense'?'−':'')+cash(event.amount_cents),'event-face-amount'));events.append(row);}
  if(!day.events.length)events.append(el('p','Aucun mouvement prévu. Votre disponible suit son cours.','quiet-copy'));detail.append(events);drawWeeks();
 }
 function drawWeeks(){
  const count=Math.ceil(forecastDays.length/7),host=$('planning-weeks');host.replaceChildren();previousWeek.disabled=weekPage===0;nextWeek.disabled=weekPage+4>=count;$('planning-weeks-page').textContent=count?`${weekPage+1}–${Math.min(count,weekPage+4)} / ${count}`:'—';
  for(let week=weekPage;week<Math.min(count,weekPage+4);week++){
   const days=forecastDays.slice(week*7,(week+1)*7),minimum=Math.min(...days.map(d=>d.safe_cents)),events=days.reduce((n,d)=>n+d.events.length,0);const b=action('',()=>selectDay(week*7),'week-card');b.setAttribute('aria-pressed',String(Math.floor(selected/7)===week));b.append(el('span','SEMAINE '+(week+1),'eyebrow'),el('strong',date(days[0].date)+' – '+date(days.at(-1).date),'week-date'),el('span','Minimum prévu','card-caption'),el('strong',cash(minimum),minimum<0?'week-value negative':'week-value'),el('span',events+' mouvement'+(events===1?' prévu':'s prévus'),'week-events'));host.append(b);
  }
  const strip=$('planning-week-days');strip.replaceChildren();const start=Math.floor(selected/7)*7;
  forecastDays.slice(start,start+7).forEach((day,i)=>{const b=action('',()=>selectDay(start+i),'week-day');b.setAttribute('aria-pressed',String(selected===start+i));b.setAttribute('aria-label',date(day.date,true)+' : '+cash(day.safe_cents));b.append(el('span',new Date(day.date+'T12:00:00').toLocaleDateString('fr-CA',{weekday:'short'})),el('strong',new Date(day.date+'T12:00:00').getDate()),el('span',day.events.length?'●':'—','day-mark'));strip.append(b);});
 }
 function drawForecast(){
  forecastDays=(latest.forecast||[]).slice(0,horizon);selected=Math.min(selected,Math.max(0,forecastDays.length-1));weekPage=Math.min(weekPage,Math.max(0,Math.floor((forecastDays.length-1)/28)*4));
  planning.querySelectorAll('[data-horizon]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.horizon)===horizon)));
  const metrics=planning.querySelector('.trajectory-metrics');metrics.replaceChildren();
  if(!forecastDays.length){metrics.append(el('p','Aucune prévision disponible.'));chart.replaceChildren();chartMap=null;$('planning-day-detail').replaceChildren();$('planning-weeks').replaceChildren();$('planning-week-days').replaceChildren();slider.disabled=true;return;}
  slider.disabled=false;slider.max=forecastDays.length-1;$('planning-date').min=forecastDays[0].date;$('planning-date').max=forecastDays.at(-1).date;
  const minimum=Math.min(...forecastDays.map(d=>d.safe_cents)),lowDay=forecastDays.find(d=>d.safe_cents===minimum);
  for(const [label,value,caption] of [['Aujourd’hui',forecastDays[0].safe_cents,'Votre point de départ'],['Le creux à anticiper',minimum,'Le '+date(lowDay.date)],['À la fin de la période',forecastDays.at(-1).safe_cents,'Le '+date(forecastDays.at(-1).date)]]){const metric=el('div',undefined,'trajectory-metric');metric.append(el('span',label),el('strong',cash(value),value<0?'negative':''),el('small',caption));metrics.append(metric);}
  const alert=planning.querySelector('.trajectory-alert');alert.hidden=minimum>=0;alert.replaceChildren();if(minimum<0)alert.append(el('span','Un creux sous zéro est prévu le '+date(lowDay.date)+'.'),action('Voir cette journée',()=>selectDay(forecastDays.indexOf(lowDay)),'card-link'));
  planning.querySelector('.trajectory-date-range').textContent=date(forecastDays[0].date)+' → '+date(forecastDays.at(-1).date);drawTrajectory();selectDay(selected);
 }
 planning.querySelectorAll('[data-horizon]').forEach(b=>b.onclick=()=>{horizon=Number(b.dataset.horizon);drawForecast();});
 slider.oninput=()=>selectDay(Number(slider.value));$('planning-day-prev').onclick=()=>selectDay(selected-1);$('planning-day-next').onclick=()=>selectDay(selected+1);
 $('planning-date').onchange=()=>{const i=forecastDays.findIndex(d=>d.date===$('planning-date').value);if(i>=0)selectDay(i);else $('planning-date').value=forecastDays[selected]?.date||'';};
 previousWeek.onclick=()=>{weekPage=Math.max(0,weekPage-4);drawWeeks();};nextWeek.onclick=()=>{weekPage+=4;drawWeeks();};
 chart.onclick=event=>{if(!chartMap)return;const bounds=chart.getBoundingClientRect(),position=(event.clientX-bounds.left)*chartMap.width/bounds.width;selectDay(Math.round((position-chartMap.left)/(chartMap.right-chartMap.left)*(forecastDays.length-1)));};
 let chartWidth=0;new ResizeObserver(entries=>{const width=Math.round(entries[0].contentRect.width);if(width>0&&width!==chartWidth){chartWidth=width;requestAnimationFrame(drawTrajectory);}}).observe(chart);
 // Keep a single planning entry in the sidebar; contextual tabs expose its views.
 const hub=document.querySelector('.app-shell-nav [data-view="prevision"]');
 for(const child of [...hub.childNodes])if(child.nodeType===Node.TEXT_NODE)child.textContent='Planifier';
 const planningKeys=['enveloppes','objectifs','recurrences','prevision','calendrier'];
 for(const key of planningKeys){const navButton=document.querySelector(`.app-shell-nav [data-view="${key}"]`);if(key!=='prevision')navButton.classList.add('planning-subroute');}
 document.querySelectorAll('.app-shell-nav [data-view]').forEach(button=>button.addEventListener('click',()=>{
   const inPlanning=planningKeys.includes(button.dataset.view);hub.classList.toggle('planning-hub-active',inPlanning);
   if(inPlanning)hub.setAttribute('aria-current','page');
 }));
 if(planningKeys.some(key=>document.querySelector(`[data-view="${key}"]`).classList.contains('active')))hub.classList.add('planning-hub-active');
 // A compact mobile menu replaces a long horizontally scrolling sidebar.
 const mainNav=document.querySelector('.app-shell-nav');
 const mobileMenu=action('',()=>{const open=mainNav.classList.toggle('mobile-menu-open');mobileMenu.setAttribute('aria-expanded',String(open));},'mobile-navigation-trigger');
 mobileMenu.setAttribute('aria-label','Choisir un écran');mobileMenu.setAttribute('aria-expanded','false');
 const menuIcon=symbol('account');menuIcon.querySelector('path').setAttribute('d','M4 6h16 M4 12h16 M4 18h16');const menuLabel=el('span',document.querySelector('.app-shell-nav [data-view].active')?.textContent||'Menu');mobileMenu.append(menuIcon,menuLabel);mainNav.prepend(mobileMenu);
 function closeMenu(){mainNav.classList.remove('mobile-menu-open');mobileMenu.setAttribute('aria-expanded','false');}
 document.querySelectorAll('.app-shell-nav [data-view]').forEach(button=>button.addEventListener('click',()=>{menuLabel.textContent=button.textContent;closeMenu();}));
 document.addEventListener('click',event=>{if(!mainNav.contains(event.target))closeMenu();});
 mobileMenu.addEventListener('keydown',event=>{if(event.key==='Escape')closeMenu();});
 const oldRender=render;
 render=function(s){oldRender(s);latest=s;drawAccountsSummary();renderAccounts(s.accounts||[]);renderEnvelopes(s.envelopes||[]);drawRecurring();drawForecast();for(const name of pages)$('section-'+name).classList.remove('is-collapsed');};
 if(typeof state!=='undefined'&&state)render(state);
})();
