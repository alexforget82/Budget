/* Daily review and an auditable bridge from current cash to the selected date. */
(()=>{
 const $=id=>document.getElementById(id),n=(tag,text,cls)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(cls)el.className=cls;return el;};
 const cash=c=>(c/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'}),date=d=>new Date(d+'T12:00:00').toLocaleDateString('fr-CA',{day:'numeric',month:'short',year:'numeric'}),signed=c=>(c>0?'+':'')+cash(c===0?0:c);
 const b=(label,handler,cls='secondary')=>{const el=n('button',label,cls);el.type='button';el.onclick=handler;return el;},field=(label,input)=>{const el=n('label',label);el.append(input);return el;};
 const review=$('planning-review'),history=n('div',undefined,'planning-history');history.id='planning-history';while(review.firstChild)history.append(review.firstChild);
 const modes=n('div',undefined,'planning-review-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Vue du suivi');
 const queue=n('div');queue.id='planning-inbox';const queueHeader=n('div',undefined,'inbox-heading'),queueCounts=n('div',undefined,'inbox-counts'),queueFilters=n('div',undefined,'planning-filters'),queueList=n('div',undefined,'inbox-list'),message=n('p',undefined,'inbox-status');message.setAttribute('role','status');
 queueHeader.append(n('div'));queueHeader.firstChild.append(n('p','VOTRE RENDEZ-VOUS BUDGET','eyebrow'),n('h3','Les opérations à confirmer'),n('p','Confirmez ce qui est passé, corrigez le montant ou reportez ce qui attend encore.','quiet-copy'));const configNotice=n('div',undefined,'inbox-config-notice');queue.append(queueHeader,configNotice,queueCounts,queueFilters,message,queueList);review.append(modes,queue,history);
 let current=null,mode='queue',filter='due',busy=false;
 for(const [value,label] of [['queue','À confirmer'],['history','Historique complet']]){const button=b(label,()=>{mode=value;drawModes();});button.dataset.reviewMode=value;modes.append(button);}
 for(const [value,label] of [['due','À traiter'],['week','7 prochains jours'],['all','Toutes les échéances']]){const button=b(label,()=>{filter=value;drawQueue();});button.dataset.inboxFilter=value;queueFilters.append(button);}
 const dialog=n('dialog',undefined,'editor-dialog planning-dialog planning-action-dialog');dialog.id='planning-action-dialog';const inner=n('div',undefined,'dialog-inner');dialog.append(inner);document.body.append(dialog);
 const bridge=n('section',undefined,'balance-bridge');bridge.id='balance-bridge';bridge.setAttribute('aria-label','Explication du solde prévu');$('section-prevision').querySelector('.trajectory-layout').after(bridge);
 function drawModes(){queue.hidden=mode!=='queue';history.hidden=mode!=='history';modes.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.reviewMode===mode)));}
 window.budgetOpenPlanningQueue=()=>{document.querySelector('[data-view="suivi"]').click();mode='queue';filter='due';drawModes();drawQueue();};
 function drawQueue(){
  if(!current)return;const today=current.forecast[0].date,end=new Date(Date.parse(today+'T12:00:00Z')+7*86400000).toISOString().slice(0,10);
  configNotice.replaceChildren();configNotice.hidden=!current.planning.warnings.length;if(current.planning.warnings.length)configNotice.append(n('span',current.planning.warnings.length+' point(s) de configuration à vérifier pour compléter la prévision.'),b('Voir les points à vérifier',()=>document.querySelector('[data-view="prevision"]').click()));
  const all=current.planning.rows.filter(r=>['planned','pending'].includes(r.status)&&r.type!=='reserve'&&r.remaining_cents>0),late=all.filter(r=>r.date<today),due=all.filter(r=>r.date===today),soon=all.filter(r=>r.date>today&&r.date<=end);
  queueCounts.replaceChildren();for(const [label,rows] of [['En retard',late],['Aujourd’hui',due],['Dans les 7 jours',soon]]){const item=n('div',undefined,'inbox-count');item.append(n('strong',rows.length),n('span',label));queueCounts.append(item);}
  queueFilters.querySelectorAll('button').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.inboxFilter===filter)));
  const rows=all.filter(r=>filter==='all'||r.date<=((filter==='week')?end:today));queueList.replaceChildren();
  if(!rows.length){const empty=n('div',undefined,'empty-state');empty.append(n('h3','Aucune opération datée à confirmer pour cette période'),n('p','Les opérations confirmées restent accessibles dans l’historique.'));queueList.append(empty);return;}
  for(const [title,items] of [['À rattraper',rows.filter(r=>r.date<today)],['Aujourd’hui',rows.filter(r=>r.date===today)],['À venir',rows.filter(r=>r.date>today)]]){
   if(!items.length)continue;queueList.append(n('h4',title+' · '+items.length,'inbox-group-title'));
   for(const row of items){
    const card=n('article',undefined,'inbox-card'+(row.date<today?' overdue':''));card.dataset.key=row.key;
    const copy=n('div',undefined,'inbox-copy');copy.append(n('h4',row.description),n('p',date(row.date)+' · '+(row.source==='envelope'?'Enveloppe':({income:'Revenu',expense:'Dépense',transfer:'Virement'})[row.type]),'quiet-copy'));
    const account=current.accounts.find(a=>a.id===row.account_id);copy.append(n('small',account?.name||'Compte à choisir'));if(row.modified&&row.original_on!==row.date)copy.append(n('small','Initialement prévu le '+date(row.original_on)));
    const amount=n('div',undefined,'inbox-amount');amount.append(n('strong',cash(row.remaining_cents)),n('small',row.actual_cents?'Encore prévu':'Montant attendu'));
    const actions=n('div',undefined,'inbox-actions');actions.append(b('Confirmer le réel',()=>openAction(row,'confirm'),'primary'),b('Modifier le prévu',()=>openAction(row,'adjust')),b('Reporter',()=>openAction(row,'move')),b('Annuler',()=>openAction(row,'skip')));card.append(copy,amount,actions);queueList.append(card);
   }
  }
 }
 function candidates(row,account){
  const type=row.type==='transfer'?'transfer':'transaction',actuals=type==='transfer'?current.calendar_transfers:current.calendar_actuals,claimed=new Set([...current.planning.rows.filter(r=>r.source==='recurring').flatMap(r=>r.actual_ids),...(current.planning.envelope_actual_links||[]).map(l=>'transaction:'+l.transaction_id)]);
  return (actuals||[]).filter(a=>a.happened_on<=current.forecast[0].date&&!claimed.has(type+':'+a.id)&&(type==='transfer'?a.from_account_id===row.account_id&&a.to_account_id===row.to_account_id:a.account_id===Number(account)&&(row.type==='income'?a.amount_cents>0:a.amount_cents<0)&&(!a.envelope_id||a.envelope_id===row.envelope_id))).sort((a,b)=>Math.abs(Date.parse(a.happened_on)-Date.parse(row.date))-Math.abs(Date.parse(b.happened_on)-Date.parse(row.date))).slice(0,100);
 }
 function openAction(row,action){
  inner.replaceChildren();const heading=n('div',undefined,'dialog-heading');heading.append(n('h2',({confirm:'Confirmer le réel',adjust:'Modifier le montant prévu',move:'Reporter cette opération',skip:'Annuler cette occurrence'})[action]),b('Fermer',()=>dialog.close()));inner.append(heading,n('p',row.description+' · prévu le '+date(row.date),'action-context'));
  const form=n('form',undefined,'planning-action-form'),error=n('p',undefined,'action-error');error.id='planning-action-error';error.setAttribute('role','alert');const explanation=n('p',undefined,'quiet-copy');
  const amount=n('input');amount.type='number';amount.min=action==='adjust'?'0':'0.01';amount.step='0.01';amount.name='amount';amount.required=true;amount.value=((action==='adjust'?row.planned_cents:row.remaining_cents)/100).toFixed(2);
  const realDate=n('input');realDate.type='date';realDate.name='happened_on';realDate.max=current.forecast[0].date;realDate.value=current.forecast[0].date;realDate.required=true;
  const newDate=n('input');newDate.type='date';newDate.name='new_on';newDate.min=current.forecast[0].date;newDate.max=current.forecast.at(-1).date;newDate.value=row.date<newDate.min?newDate.min:row.date;newDate.required=true;
  const account=n('select');account.name='account_id';account.required=true;for(const a of current.accounts){const o=n('option',a.name);o.value=a.id;account.append(o);}const blank=n('option','Choisir un compte');blank.value='';account.prepend(blank);account.value=row.account_id||'';account.disabled=row.source==='recurring';
  const entry=n('select');entry.name='entry_mode';for(const [value,label] of [['new','À enregistrer maintenant'],['existing','Déjà saisie — associer l’opération']]){const o=n('option',label);o.value=value;entry.append(o);}
  const actual=n('select');actual.name='actual_id';const actualLabel=field('Opération réelle à associer',actual),amountLabel=field(action==='adjust'?'Montant total prévu ($)':'Montant réellement passé ($)',amount),dateLabel=field('Date réelle',realDate),accountLabel=field('Compte',account);
  const complete=n('input');complete.type='checkbox';complete.name='complete_period';complete.checked=true;const completeLabel=field('Aucun autre achat prévu pour cette période',complete);completeLabel.className='inline-choice';completeLabel.hidden=row.source!=='envelope';
  const preview=n('p',undefined,'action-preview');
  function sync(){
   const selected=actual.value;actual.replaceChildren();const empty=n('option','Choisir l’opération déjà enregistrée');empty.value='';actual.append(empty);
   const options=candidates(row,account.value);for(const t of options){const option=n('option',date(t.happened_on)+' · '+t.description+' · '+cash(Math.abs(t.amount_cents)));option.value=t.id;actual.append(option);}actual.value=options.some(t=>String(t.id)===selected)?selected:'';
   const existing=entry.value==='existing';actualLabel.hidden=!existing;actual.required=existing;amountLabel.hidden=existing;amount.required=!existing;dateLabel.hidden=existing;realDate.required=!existing;account.required=row.source==='envelope';
   explanation.textContent=existing?'Le solde bancaire ne changera pas : cette opération y est déjà incluse.':row.type==='transfer'?'Un seul virement sera enregistré entre les deux comptes.':'Une transaction sera enregistrée et remplacera cette prévision. Si elle est déjà saisie, choisissez l’association ci-dessus.';
   preview.textContent=existing&&!options.length?'Aucune opération compatible sur ce compte. Vérifiez le compte ou enregistrez une nouvelle opération.':row.type==='transfer'?'Destination : '+(current.accounts.find(a=>a.id===row.to_account_id)?.name||'Compte'):'';
  }
  if(action==='confirm'){form.append(field('Cette opération est-elle déjà dans l’historique ?',entry),accountLabel,actualLabel,amountLabel,dateLabel,completeLabel,preview,explanation);entry.onchange=sync;account.onchange=sync;sync();}
  if(action==='adjust'){form.append(amountLabel,n('p','Seule cette occurrence changera. Les soldes réels et les autres dates restent inchangés.','quiet-copy'));}
  if(action==='move'){form.append(field('Nouvelle date prévue',newDate),n('p',row.source==='envelope'?'La dépense change de date. Le renouvellement de la réserve conserve sa date habituelle.':'Seule cette occurrence change de date.','quiet-copy'));}
  if(action==='skip'){form.append(n('p','Cette occurrence sera retirée de la prévision. Aucun mouvement bancaire ne sera créé. Vous pourrez la rétablir dans l’historique.'));}
  const refresh=b('Actualiser la liste',async()=>{refresh.disabled=true;try{const response=await fetch('/api/state');if(!response.ok)throw Error('Actualisation impossible.');render(await response.json());dialog.close();}catch(err){error.textContent=err.message;}finally{refresh.disabled=false;}});refresh.hidden=true;
  const save=n('button',({confirm:'Valider le réel',adjust:'Enregistrer le montant prévu',move:'Enregistrer le report',skip:'Annuler cette occurrence'})[action],'primary');save.type='submit';form.append(error,refresh,save);inner.append(form);
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;busy=true;save.disabled=true;error.textContent='';
   const payload={key:row.key,signature:row.signature,action};if(action==='move')payload.new_on=newDate.value;if(action==='adjust')payload.amount=Number(amount.value);
   if(action==='confirm'){payload.account_id=Number(account.value);payload.complete_period=complete.checked;if(entry.value==='existing')payload.actual_id=Number(actual.value);else{payload.amount=Number(amount.value);payload.happened_on=realDate.value;}}
   try{const response=await fetch('/api/planning/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}),out=await response.json();if(!response.ok)throw Error(out.error||'Enregistrement impossible.');render(out);message.textContent=({confirm:'Opération réelle confirmée. La prévision a été mise à jour.',move:'Échéance reportée. Les soldes réels restent inchangés.',adjust:'Montant prévu mis à jour.',skip:'Occurrence annulée. Elle reste accessible dans l’historique.'})[action];dialog.close();}
   catch(err){error.textContent=err.message;refresh.hidden=false;}finally{busy=false;save.disabled=false;}
  };
  if(!dialog.open)dialog.showModal();requestAnimationFrame(()=>form.querySelector('input:not([type=checkbox]),select')?.focus());
 }
 function drawBridge(){
  if(!current)return;const selected=$('planning-date').value||current.forecast[0].date,day=current.forecast.find(d=>d.date===selected);bridge.replaceChildren();if(!day?.bridge)return;
  const calc=day.bridge,header=n('div',undefined,'panel-heading');header.append(n('div'));header.firstChild.append(n('p','COMPRENDRE CHAQUE DOLLAR','eyebrow'),n('h3','Pourquoi ce solde au '+date(selected)+' ?'));bridge.append(header,n('p','Point de départ : les soldes réels d’aujourd’hui. Les opérations déjà enregistrées y sont incluses; elles ne sont pas ajoutées une deuxième fois.','quiet-copy'));
  const equation=n('div',undefined,'bridge-equation');equation.dataset.date=selected;
  for(const [label,value,key] of [['Solde réel de départ',calc.opening_cash_cents,'opening_cash_cents'],['Revenus prévus',calc.income_cents,'income_cents'],['Factures et autres dépenses',calc.expense_cents,'expense_cents'],['Dépenses d’enveloppes',calc.envelope_cents,'envelope_cents'],['Virements nets',calc.transfer_cents,'transfer_cents'],['Solde bancaire prévu',calc.closing_cash_cents,'closing_cash_cents'],['Réserves d’enveloppes restantes',-calc.reserved_cents,'reserved_cents'],['Disponible prévu',calc.closing_safe_cents,'closing_safe_cents']]){
   const line=n('div',undefined,'bridge-line'+(key.startsWith('closing_')?' bridge-result':''));line.dataset.bridge=key;line.append(n('span',label),n('strong',key==='opening_cash_cents'||key.startsWith('closing_')?cash(value):signed(value)));equation.append(line);
  }
  bridge.append(equation);
  const starting=n('details',undefined,'bridge-detail');starting.append(n('summary','Voir les comptes du solde de départ'));for(const a of current.accounts.filter(a=>a.kind!=='credit'&&a.included)){const row=n('div',undefined,'bridge-event');row.append(n('span',a.name),n('strong',cash(a.balance_cents)));starting.append(row);}bridge.append(starting);
  const events=current.forecast.filter(d=>d.date<=selected).flatMap(d=>d.events.map(e=>({...e,simulation_date:d.date}))),groups=[['Revenus','income_cents',e=>e.type==='income'],['Factures et autres dépenses','expense_cents',e=>e.type==='expense'&&!e.envelope_id],['Dépenses d’enveloppes','envelope_cents',e=>e.type==='expense'&&e.envelope_id],['Virements','transfer_cents',e=>e.type==='transfer'],['Renouvellements et réserves','reserves',e=>e.type==='reserve']];
  const details=n('div',undefined,'bridge-groups');for(const [label,key,accept] of groups){const items=events.filter(accept),detail=n('details',undefined,'bridge-detail');detail.dataset.bridgeGroup=key;const summary=n('summary');summary.append(n('span',label+' · '+items.length),n('strong',key==='reserves'?'Aucune sortie bancaire':signed(items.reduce((total,e)=>total+(e.cash_impact_cents||0),0))));detail.append(summary);
   for(const e of items){const row=n('div',undefined,'bridge-event'),copy=n('div');copy.append(n('strong',e.description),n('small',date(e.simulation_date)+(e.overdue?' · à confirmer, échéance du '+date(e.original_on):'')+(e.cash_impact_cents===0?(e.type==='reserve'?' · réserve seulement':e.credit_charge?' · crédit, sans sortie bancaire':' · aucun effet sur les comptes inclus'):'')));row.append(copy,n('strong',signed(e.cash_impact_cents||0)));detail.append(row);}if(!items.length)detail.append(n('p','Aucun mouvement de ce type sur la période.','quiet-copy'));details.append(detail);
  }bridge.append(details);
  const pendingIncome=current.planning.rows.filter(r=>r.status==='pending'&&r.type==='income'&&r.date<=selected);if(pendingIncome.length){const detail=n('details',undefined,'bridge-detail excluded-income');detail.append(n('summary',pendingIncome.length+' revenu(s) en retard non ajouté(s) au solde'));for(const r of pendingIncome)detail.append(n('p',r.description+' · '+date(r.date)+' · '+cash(r.remaining_cents)));bridge.append(detail);}
  bridge.append(n('p','Les dettes des cartes ne créent aucune réserve automatique. Seuls leurs remboursements prévus ou enregistrés influencent le solde bancaire.','quiet-copy'));
 }
 document.addEventListener('budget:forecast-day-selected',drawBridge);
 const previous=render;render=function(s){previous(s);current=s;drawModes();drawQueue();drawBridge();};if(typeof state!=='undefined'&&state){current=state;drawModes();drawQueue();drawBridge();}
})();
