/* Planned versus actual. Rendering never creates financial operations. */
(()=>{
 const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const money=n=>(n/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'}),day=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'});
 const button=(label,fn)=>{const b=node('button',label,'secondary');b.type='button';b.onclick=fn;return b;};
 const statusNames={planned:'Prévu',pending:'À confirmer',actual:'Réel enregistré',skipped:'Annulé'};
 const warnings=node('div',undefined,'planning-notices');warnings.id='planning-notices';$('section-prevision').querySelector('.page-intro').after(warnings);
 const dashboardNotice=node('div',undefined,'planning-dashboard-notice');dashboardNotice.id='planning-dashboard-notice';$('app-dashboard').prepend(dashboardNotice);
 const host=$('planning-review'),filters=node('div',undefined,'review-filters');
 const month=node('input');month.type='month';month.id='review-month';month.value=new Date().toLocaleDateString('en-CA').slice(0,7); // set below without locale assumptions
 const now=new Date();month.value=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
 const status=node('select');status.id='review-status';for(const [value,label] of [['all','Tous les statuts'],['pending','À confirmer'],['actual','Réel enregistré'],['planned','À venir'],['skipped','Annulés / sans paiement']]){const o=node('option',label);o.value=value;status.append(o);}
 const monthLabel=node('label','Période');monthLabel.append(month);const statusLabel=node('label','Afficher');statusLabel.append(status);filters.append(monthLabel,statusLabel,button('Toutes les dates',()=>{month.value='';draw();}));host.append(filters);
 const info=node('p',undefined,'quiet-copy'),totals=node('div',undefined,'trajectory-metrics'),list=node('div',undefined,'review-list'),unmatched=node('details',undefined,'advanced-tool');host.append(info,totals,list,unmatched);
 const matchDialog=node('dialog',undefined,'editor-dialog planning-dialog'),inner=node('div',undefined,'dialog-inner');matchDialog.append(inner);document.body.append(matchDialog);
 let current=null;
 function draft(row){
  const f=$('transaction');f.elements.direction.value=row.type==='income'?'income':'expense';$('transaction-direction').dispatchEvent(new Event('change',{bubbles:true}));
  f.elements.account_id.value=row.account_id||'';f.elements.amount.value=(row.remaining_cents/100).toFixed(2);f.elements.description.value=row.description;f.elements.envelope_id.value=row.envelope_id||'';
  const today=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');f.elements.happened_on.value=row.date>today?today:row.date;
  window.appOpenEditor('transaction');
 }
 function match(row){
  inner.replaceChildren();const heading=node('div',undefined,'dialog-heading');heading.append(node('h2','Associer le réel · '+row.description),button('Fermer',()=>matchDialog.close()));inner.append(heading,node('p','Le montant réel remplacera la prévision, même s’il est différent. Aucun solde ne sera modifié.'));
  const select=node('select'),all=row.type==='transfer'?(current.calendar_transfers||[]):(current.calendar_actuals||[]),claimed=new Set((current.planning?.rows||[]).flatMap(r=>r.actual_ids));
  const candidates=all.filter(a=>!claimed.has((row.type==='transfer'?'transfer:':'transaction:')+a.id)&&Math.abs(Date.parse(a.happened_on)-Date.parse(row.date))<=31*86400000&&(row.type==='transfer'?a.from_account_id===row.account_id&&a.to_account_id===row.to_account_id:a.account_id===row.account_id&&(row.type==='expense'?a.amount_cents<0:a.amount_cents>0)));
  for(const a of candidates){const o=node('option',day(a.happened_on)+' · '+a.description+' · '+money(Math.abs(a.amount_cents)));o.value=a.id;select.append(o);}
  const label=node('label','Opération enregistrée');label.append(select);inner.append(label);
  if(!candidates.length)inner.append(node('p','Aucune opération compatible. Enregistrez la transaction ou vérifiez son compte et sa date.'));
  const save=button('Associer cette opération',async()=>{save.disabled=true;const ok=await send('/api/reconcile/link',{recurring_id:row.recurring_id,occurrence_on:row.original_on,actual_type:row.type==='transfer'?'transfer':'transaction',actual_id:Number(select.value)});save.disabled=false;if(ok)matchDialog.close();});save.disabled=!candidates.length;inner.append(save);matchDialog.showModal();
 }
 function drawWarnings(){
  warnings.replaceChildren();const items=current.planning?.warnings||[],pending=(current.planning?.rows||[]).filter(r=>['planned','pending'].includes(r.status)&&r.type!=='reserve'&&r.remaining_cents>0&&r.date<=current.forecast[0].date);
  dashboardNotice.replaceChildren();dashboardNotice.hidden=!items.length&&!pending.length;
  if(items.length||pending.length){dashboardNotice.append(node('strong',pending.length?pending.length+' mouvement(s) à confirmer':'Prévision à compléter'),node('span',items.length+' point(s) de configuration à vérifier.'),button('Voir les opérations à confirmer',()=>window.budgetOpenPlanningQueue?.()));}
  if(!items.length&&!pending.length)return;
  const detail=node('details',undefined,'advanced-tool');detail.open=true;detail.append(node('summary','Fiabilité de la prévision · '+items.length+' point(s) à vérifier'));
  if(pending.length)detail.append(node('p','Les dépenses et virements passés non confirmés restent déduits à partir d’aujourd’hui. Les revenus en retard ne financent pas votre disponible avant confirmation.'));
  for(const item of items){const line=node('div',undefined,'planning-notice');line.append(node('span',item.message));if(item.envelope_id)line.append(button('Configurer',()=>editEnvelope(item.envelope_id)));else if(item.code==='credit_payment')line.append(button('Planifier un virement',()=>{resetRec();window.appOpenEditor('recurring');}));detail.append(line);}
  warnings.append(detail);
 }
 function draw(){
  if(!current)return;
  const summary=$('planning-real-summary');summary.replaceChildren();
  for(const [label,value,caption] of [['Solde réel aujourd’hui',current.cash_cents,'Comptes inclus · opérations enregistrées'],['Réservé actuellement',current.reserved_cents,'Argent affecté aux enveloppes'],['Disponible aujourd’hui',current.safe_cents,'Solde réel moins les réserves d’enveloppes']]){const card=node('div',undefined,'trajectory-metric');card.append(node('span',label),node('strong',money(value)),node('small',caption));summary.append(card);}
  const rows=(current.planning?.rows||[]).filter(r=>(!month.value||r.date.startsWith(month.value))&&(status.value==='all'||r.status===status.value));
  info.textContent='Suivi des prévisions depuis le '+day(current.planning?.since||current.forecast[0].date)+'. Les périodes antérieures à l’activation ne sont pas reconstituées. Pour une enveloppe, les achats de la période remplacent son budget prévu. Utilisez « Encore des achats » si la période n’est pas terminée.';
  totals.replaceChildren();const expenses=rows.filter(r=>r.type==='expense'),completed=expenses.filter(r=>r.status==='actual');
  for(const [label,value,caption] of [['Dépenses prévues',expenses.reduce((n,r)=>n+r.planned_cents,0),'Budget initial des occurrences affichées'],['Réel rapproché',expenses.reduce((n,r)=>n+(r.actual_cents||0),0),'Dépenses associées à ces prévisions'],['Écart des dépenses terminées',completed.reduce((n,r)=>n+(r.actual_cents||0)-r.planned_cents,0),'Positif : dépassement · négatif : économie']]){const card=node('div',undefined,'trajectory-metric');card.append(node('span',label),node('strong',money(value)),node('small',caption));totals.append(card);}
  list.replaceChildren();if(!rows.length)list.append(node('p','Aucune opération prévue pour ces filtres.','empty-state'));
  for(const row of rows){
   const card=node('article',undefined,'review-card '+row.status);card.dataset.key=row.key;
   const heading=node('div',undefined,'review-card-heading'),title=node('div');title.append(node('h3',row.description),node('small',day(row.date)+' · '+(row.source==='envelope'?'Enveloppe':({income:'Revenu',expense:'Dépense',transfer:'Virement',reserve:'Réserve'})[row.type])));heading.append(title,node('span',row.card_payment_mode==='purchases'&&row.status==='skipped'&&!row.modified?'Aucun paiement prévu':statusNames[row.status],'soft-badge'));card.append(heading);
   const values=node('div',undefined,'review-values');for(const [label,value] of [['Prévu',row.planned_cents],['Réel',row.actual_cents],['Écart',row.variance_cents]]){const item=node('div');item.append(node('span',label),node('strong',value===null?'—':money(value)));values.append(item);}card.append(values);
   const actions=node('div',undefined,'review-actions');
   if(row.source==='envelope'){
    if(row.status==='actual')actions.append(button('Encore des achats',()=>send('/api/envelope/status',{envelope_id:row.envelope_id,occurrence_on:row.original_on,status:'open'})));
    else if(row.status!=='skipped'){actions.append(button(row.actual_cents===null?'Confirmer sans dépense':'Terminer la période',()=>send('/api/envelope/status',{envelope_id:row.envelope_id,occurrence_on:row.original_on,status:'complete'})),button('Annuler la dépense prévue',()=>send('/api/envelope/status',{envelope_id:row.envelope_id,occurrence_on:row.original_on,status:'skipped'})));}
    actions.append(button('Calcul automatique',()=>send('/api/envelope/status',{envelope_id:row.envelope_id,occurrence_on:row.original_on,status:'auto'})));
   }else {
    if(['planned','pending'].includes(row.status)&&row.type!=='reserve')actions.append(button('Associer un réel',()=>match(row)));
    if(['planned','pending'].includes(row.status))actions.append(button('Annuler cette occurrence',()=>send('/api/overrides',{recurring_id:row.recurring_id,occurrence_on:row.original_on,amount:0})));
    if(row.status==='skipped'){const override=current.overrides.find(o=>o.recurring_id===row.recurring_id&&o.occurrence_on===row.original_on);if(override)actions.append(button('Rétablir cette occurrence',()=>send('/api/overrides/delete',{id:override.id})));}
   }
   if((row.status==='planned'||row.status==='pending')&&row.date<=current.forecast[0].date&&['expense','income'].includes(row.type))actions.append(button('Saisir la transaction',()=>draft(row)));
   if(row.partial)card.append(node('p','Achats supplémentaires prévus : '+money(row.remaining_cents),'quiet-copy'));
   if(row.status==='pending')card.append(node('p',row.type==='income'?'Revenu non reçu : exclu du disponible projeté.':'Montant encore déduit dans la prévision tant qu’il n’est pas confirmé ou annulé.','quiet-copy'));
   card.append(actions);list.append(card);
  }
  const used=new Set((current.planning?.rows||[]).flatMap(r=>r.actual_ids)),others=(current.calendar_actuals||[]).filter(t=>(!month.value||t.happened_on.startsWith(month.value))&&!used.has('transaction:'+t.id));
  unmatched.replaceChildren();unmatched.append(node('summary','Transactions réelles sans prévision associée · '+others.length),node('p','Ces opérations sont déjà intégrées aux soldes réels. Elles ne sont pas déduites une deuxième fois.'));
  for(const t of others){const row=node('div',undefined,'v2-row');row.append(node('span',day(t.happened_on)+' · '+t.description+' · '+t.account_name),node('strong',money(t.amount_cents)));unmatched.append(row);}
 }
 month.onchange=draw;status.onchange=draw;
 const previous=render;render=function(s){previous(s);current=s;drawWarnings();draw();};if(typeof state!=='undefined'&&state)render(state);
})();
