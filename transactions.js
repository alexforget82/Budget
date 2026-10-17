/* A focused register and a small, reusable transaction editor. */
(()=>{
 const $=id=>document.getElementById(id);
 const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(text,fn,cls='secondary')=>{const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;};
 const money=n=>(n/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'});
 const section=$('section-transactions');section.classList.add('designed-page','transaction-workspace');section.classList.remove('is-collapsed');section.querySelector('.section-toggle').hidden=true;
 const heading=section.querySelector('.section-head');heading.querySelector('h2').textContent='Vos opérations, simplement';
 const actions=node('div',undefined,'page-actions');actions.append(button('+ Nouvelle transaction',()=>window.appOpenEditor('transaction'),'primary'));heading.append(actions);
 const intro=node('p','Retrouvez une opération, vérifiez vos dépenses et gardez votre budget à jour.','page-intro');heading.after(intro);
 const help=node('details',undefined,'context-help');help.append(node('summary','Comprendre les transactions et les cartes de crédit'));
 for(const child of [...section.children])if(child.matches('p.sub,small'))help.append(child);section.append(help);
 const summary=node('div',undefined,'register-summary');intro.after(summary);
 for(const [key,label] of [['expense_cents','Dépenses'],['income_cents','Revenus'],['pending_count','À vérifier']]){const card=node('div',undefined,'register-metric');card.dataset.metric=key;card.append(node('span',label),node('strong','—'),node('small',key==='pending_count'?'Opérations non révisées':'Sur les résultats filtrés'));summary.append(card);}
 const tools=node('div',undefined,'register-tools');summary.after(tools);
 const quick=node('div',undefined,'register-quick-filters');quick.setAttribute('role','group');quick.setAttribute('aria-label','Type d’opérations');
 for(const [mode,label] of [['all','Tout'],['expense','Dépenses'],['income','Revenus'],['pending','À vérifier']]){const b=button(label,()=>{ $('v2-kind').value=['expense','income'].includes(mode)?mode:'';$('v2-review').value=mode==='pending'?'0':'';filterChange();},'register-filter');b.dataset.mode=mode;quick.append(b);}tools.append(quick);
 const fields=node('div',undefined,'register-search-row');tools.append(fields);
 const search=$('v2-search');search.placeholder='Rechercher un commerce ou une description…';search.autocomplete='off';search.parentElement.classList.add('register-search');fields.append(search.parentElement,$('v2-account').parentElement);
 const periodLabel=node('label','Période'),period=node('select');period.id='transactions-period';for(const [value,label] of [['all','Tout l’historique'],['current','Ce mois-ci'],['previous','Le mois dernier'],['custom','Dates personnalisées']])period.add(new Option(label,value));periodLabel.append(period);fields.append(periodLabel);
 const advanced=node('details',undefined,'register-advanced'),advancedLabel=node('summary','Filtres avancés'),advancedFields=node('div',undefined,'register-advanced-fields');advanced.append(advancedLabel,advancedFields);
 for(const id of ['v3-category-filter','v2-review','v3-date-from','v3-date-to'])advancedFields.append($(id).parentElement);
 const hiddenKind=$('v2-kind').parentElement;hiddenKind.hidden=true;advancedFields.append(hiddenKind);tools.append(advanced);
 const filterFooter=node('div',undefined,'register-filter-footer'),resultLabel=node('span','Chargement de vos opérations…');resultLabel.id='register-result-label';resultLabel.setAttribute('role','status');
 const reset=button('Réinitialiser les filtres',()=>{for(const id of ['v2-search','v2-account','v2-kind','v2-review','v3-category-filter','v3-date-from','v3-date-to'])$(id).value='';period.value='all';filterChange();},'text-action');reset.hidden=true;
 const exportButton=$('v2-export');exportButton.textContent='Exporter les résultats';exportButton.className='text-action';filterFooter.append(resultLabel,reset,exportButton);tools.append(filterFooter);
 $('v2-filters').remove();
 const pager=$('v2-prev').parentElement;pager.classList.add('register-pagination');
 const guide=node('p',undefined,'register-transfer-hint');guide.append(node('span','Un paiement de carte ou un transfert entre vos comptes ? '),button('Enregistrer un virement',()=>document.querySelector('[data-view="virements"]').click(),'text-action'));pager.after(guide);
 const warning=node('p',undefined,'register-date-warning');warning.hidden=true;advanced.append(warning);
 function filterChange(){ $('v2-account').dispatchEvent(new Event('change',{bubbles:true})); }
 function updateFilters(){
  const kind=$('v2-kind').value,review=$('v2-review').value,mode=review==='0'&&!kind?'pending':!review&&(kind==='expense'||kind==='income')?kind:!kind&&!review?'all':null;
  quick.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  const active=['v2-search','v2-account','v2-kind','v2-review','v3-category-filter','v3-date-from','v3-date-to'].filter(id=>$(id).value).length;reset.hidden=!active;
  const count=Number(!!$('v3-category-filter').value)+Number(!!review&&mode!=='pending')+Number(period.value==='custom'&&!!($('v3-date-from').value||$('v3-date-to').value));advancedLabel.textContent='Filtres avancés'+(count?' · '+count:'');
  warning.hidden=!($('v3-date-from').value&&$('v3-date-to').value&&$('v3-date-from').value>$('v3-date-to').value);warning.textContent='La date de début doit précéder la date de fin.';
 }
 for(const id of ['v2-search','v2-account','v2-kind','v2-review','v3-category-filter','v3-date-from','v3-date-to'])$(id).addEventListener(id==='v2-search'?'input':'change',()=>{if(id==='v3-date-from'||id==='v3-date-to')period.value=$('v3-date-from').value||$('v3-date-to').value?'custom':'all';updateFilters();});
 period.onchange=()=>{
  if(period.value==='custom'){advanced.open=true;$('v3-date-from').focus();return;}
  let from='',to='';if(period.value!=='all'){const date=new Date(today().slice(0,7)+'-01T12:00:00Z');if(period.value==='previous')date.setUTCMonth(date.getUTCMonth()-1);from=date.toISOString().slice(0,10);date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(0);to=date.toISOString().slice(0,10);}
  $('v3-date-from').value=from;$('v3-date-to').value=to;filterChange();
 };
 document.addEventListener('budget:transactions-loading',()=>{resultLabel.textContent='Chargement des opérations…';});
 document.addEventListener('budget:transactions-loaded',event=>{
  const data=event.detail;for(const card of summary.children){const value=data.summary?.[card.dataset.metric];card.querySelector('strong').textContent=value===undefined?'—':card.dataset.metric==='pending_count'?String(value):money(value);}
  resultLabel.textContent=data.count+' opération'+(data.count===1?'':'s')+' · '+(period.value==='all'?'Tout l’historique':period.selectedOptions[0].textContent);updateFilters();
 });
 document.addEventListener('budget:transactions-error',()=>{for(const card of summary.children)card.querySelector('strong').textContent='—';resultLabel.textContent='Chargement impossible. ';resultLabel.append(button('Réessayer',()=>window.budgetRefreshTransactions(),'text-action'));});
 document.addEventListener('click',event=>{for(const menu of section.querySelectorAll('.ledger-menu[open]'))if(!menu.contains(event.target))menu.open=false;});
 section.addEventListener('keydown',event=>{if(event.key==='Escape')for(const menu of section.querySelectorAll('.ledger-menu[open]')){menu.open=false;menu.querySelector('summary').focus();}});

 // Focused editor: type, amount and description first; envelope only when needed.
 const form=$('transaction'),dialog=$('transaction-dialog');dialog.classList.add('transaction-entry-dialog');
 const select=$('transaction-direction'),category=$('transaction-category'),amount=form.elements.amount,description=form.elements.description;
 const directionLabel=select.parentElement;directionLabel.hidden=true;
 const types=node('div',undefined,'entry-type-selector');types.setAttribute('role','group');types.setAttribute('aria-label','Type de transaction');
 for(const [value,label] of [['expense','Dépense'],['income','Revenu']]){const b=button(label,()=>{select.value=value;select.dispatchEvent(new Event('change',{bubbles:true}));},'entry-type');b.dataset.direction=value;types.append(b);}
 const amountLabel=amount.parentElement;amountLabel.classList.add('entry-amount');const currency=node('span','CAD','entry-currency');amountLabel.append(currency);amount.placeholder='0,00';amount.inputMode='decimal';
 const descriptionLabel=description.parentElement;descriptionLabel.classList.add('entry-description');description.placeholder='Ex. Épicerie, café, salaire…';
 const accountLabel=$('account-options').parentElement,categoryLabel=category.parentElement,dateLabel=form.elements.happened_on.parentElement;
 const more=node('details',undefined,'entry-more');more.append(node('summary','Associer une enveloppe (facultatif)'),$('envelope-options').parentElement);
 const suggestions=node('div',undefined,'entry-suggestions'),suggestionLabel=node('p','Récents','entry-suggestions-label'),chips=node('div',undefined,'entry-merchant-chips');suggestions.append(suggestionLabel,chips);
 const categoryHint=node('p',undefined,'entry-category-hint');categoryHint.hidden=true;const copyNotice=node('p',undefined,'entry-copy-notice');copyNotice.hidden=true;copyNotice.setAttribute('role','status');
 const accountHint=node('p',undefined,'entry-account-hint');accountHint.hidden=true;
 const submit=form.querySelector('button:not([type]),button[type="submit"]');submit.type='submit';submit.textContent='Enregistrer';
 const submitMore=node('button','Enregistrer et continuer','secondary');submitMore.type='submit';submitMore.dataset.keepOpen='true';const footer=node('div',undefined,'entry-submit-actions');footer.append(submit,submitMore);
 form.replaceChildren(directionLabel,types,copyNotice,amountLabel,descriptionLabel,suggestions,accountLabel,categoryLabel,dateLabel,categoryHint,more,accountHint,footer);
 let latest=null,categoryTouched=false,lastSuggested=null,keepOpen=false;
 const normalize=value=>value.trim().toLocaleLowerCase('fr-CA');
 function syncType(){
  types.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.direction===select.value)));
  dialog.querySelector('.dialog-heading h2').textContent=select.value==='income'?'Nouveau revenu':'Nouvelle dépense';
  more.hidden=select.value==='income';renderMerchants();accountNote();
 }
 function accountNote(){const account=latest?.accounts.find(a=>String(a.id)===$('account-options').value);accountHint.hidden=account?.kind!=='credit';accountHint.textContent=select.value==='expense'?'Cette dépense augmente le montant dû sur la carte. Son remboursement se saisit comme un virement.':'Cette entrée réduit le montant dû sur la carte.';}
 function suggestCategory(merchant,explicit=false){
  if(!latest||categoryTouched&&!explicit)return;
  if(merchant&&merchant.category_id&&latest.categories.some(c=>c.id===merchant.category_id)&&(merchant.amount_cents<0)===(select.value==='expense')){
   category.value=String(merchant.category_id);lastSuggested=category.value;categoryHint.textContent='Catégorie proposée : '+category.selectedOptions[0].textContent+'. Vous pouvez la modifier.';categoryHint.hidden=false;
  }else{if(category.value===lastSuggested)category.value='';lastSuggested=null;categoryHint.hidden=true;}
 }
 function renderMerchants(){
  chips.replaceChildren();const merchants=(latest?.recent_descriptions||[]).filter(m=>(m.amount_cents<0)===(select.value==='expense')).slice(0,6);suggestions.hidden=!merchants.length;
  for(const merchant of merchants)chips.append(button(merchant.description,()=>{description.value=merchant.description;categoryTouched=false;suggestCategory(merchant,true);amount.focus();},'merchant-chip'));
 }
 category.addEventListener('change',()=>{categoryTouched=true;categoryHint.hidden=true;lastSuggested=null;});
 description.addEventListener('input',()=>{copyNotice.hidden=true;const merchant=latest?.recent_descriptions?.find(m=>normalize(m.description)===normalize(description.value));suggestCategory(merchant);});
 select.addEventListener('change',()=>{categoryHint.hidden=true;categoryTouched=false;category.value='';lastSuggested=null;suggestCategory(latest?.recent_descriptions?.find(m=>normalize(m.description)===normalize(description.value)));syncType();});
 $('account-options').addEventListener('change',accountNote);
 form.addEventListener('submit',event=>{keepOpen=event.submitter?.dataset.keepOpen==='true';});
 const openEditor=window.appOpenEditor;
 window.appOpenEditor=function(key){
  if(key==='transaction'&&!amount.value&&!description.value){select.value='expense';select.dispatchEvent(new Event('change',{bubbles:true}));categoryTouched=false;category.value='';categoryHint.hidden=true;copyNotice.hidden=true;}
  openEditor(key);if(key==='transaction'){syncType();requestAnimationFrame(()=>amount.focus());}
 };
 window.addEventListener('budget:repeat-transaction',event=>{
  const row=event.detail;description.value=row.description;amount.value=(Math.abs(row.amount_cents)/100).toFixed(2);select.value=row.amount_cents<0?'expense':'income';select.dispatchEvent(new Event('change',{bubbles:true}));$('account-options').value=String(row.account_id);category.value=String(row.category_id||'');$('envelope-options').value=select.value==='expense'?String(row.envelope_id||''):'';form.elements.happened_on.value=today();categoryTouched=true;categoryHint.hidden=true;more.open=!!row.envelope_id;copyNotice.textContent='Copie à vérifier : nouvelle opération, datée d’aujourd’hui. Rien n’est encore enregistré.';copyNotice.hidden=false;window.appOpenEditor('transaction');
 });
 const previousSend=send;send=async function(url,data){
  const ok=await previousSend(url,data);
  if(ok&&url==='/api/transactions'){
   const again=keepOpen;keepOpen=false;categoryTouched=false;lastSuggested=null;categoryHint.hidden=true;copyNotice.hidden=true;category.value='';
   if(again){openEditor('transaction');syncType();requestAnimationFrame(()=>amount.focus());}
  }
  return ok;
 };
 const previousRender=render;render=function(s){previousRender(s);latest=s;renderMerchants();accountNote();section.classList.remove('is-collapsed');};
 updateFilters();syncType();if(typeof state!=='undefined'&&state){latest=state;renderMerchants();accountNote();}
 window.budgetRefreshTransactions();
})();
