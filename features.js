/* Daily budgeting tools. All financial mutations are validated by the local server. */
(()=>{
  const by=id=>document.getElementById(id);
  const money=value=>(value/100).toLocaleString('fr-CA',{style:'currency',currency:'CAD'});
  const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(className)e.className=className;return e;};
  const button=(text,action,cls='secondary')=>{const b=node('button',text,cls);b.type='button';b.onclick=action;return b;};
  const options=(select,items,empty)=>{const old=select.value;select.replaceChildren();if(empty!==undefined)select.add(new Option(empty,''));for(const item of items)select.add(new Option(item.name,item.id));if([...select.options].some(o=>o.value===old))select.value=old;};
  let current,reportRequest=0,csv='',preview=null,restoreBackup=null,balancePreview=null;
  async function request(url,data){
    const response=await fetch(url,data===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'Opération impossible.');return result;
  }
  function failure(message){by('error').textContent=message;}
  async function mutate(url,data){if(await send(url,data)){if(document.querySelector('[data-view="bilan"].active'))loadReport();return true;}return false;}
  by('report-month').value=today().slice(0,7);
  const direction=by('transaction-direction');
  function transactionType(){const income=direction.value==='income';by('envelope-options').disabled=income;if(income)by('envelope-options').value='';}
  direction.onchange=transactionType;
  by('transaction').onsubmit=async e=>{
    e.preventDefault();const f=e.target,data=Object.fromEntries(new FormData(f));data.amount=Number(data.amount)*(data.direction==='expense'?-1:1);data.category_id=data.category_id||null;
    if(await mutate('/api/transactions',data)){f.elements.amount.value='';f.elements.description.value='';selectDefaultTransactionAccount(current.accounts);}
  };
  by('v2-edit-direction').addEventListener('change',()=>{if(by('v2-edit-direction').value==='income')by('v2-edit-envelope').value='';});

  async function loadReport(){
    const ticket=++reportRequest;by('report-error').textContent='';
    try{
      const result=await request('/api/monthly?'+new URLSearchParams({month:by('report-month').value,account:by('report-account').value}));if(ticket!==reportRequest)return;
      const summary=by('monthly-summary');summary.replaceChildren();
      for(const [label,value] of [['Revenus',result.income_cents],['Dépenses',result.expense_cents],['Différence',result.net_cents]]){const box=node('div',undefined,'feature-metric');box.append(node('span',label),node('strong',money(value),value<0?'negative':''));summary.append(box);}
      const report=by('category-report');report.replaceChildren();
      for(const group of result.groups){const row=node('div',undefined,'category-summary');const head=node('div',undefined,'v2-progress-head');head.append(node('strong',group.name),node('strong',money(group.expense_cents)));const track=node('div',undefined,'v2-progress-track');const fill=node('div',undefined,'v2-progress-fill');fill.style.width=(result.expense_cents?group.expense_cents/result.expense_cents*100:0)+'%';track.append(fill);row.append(head,track,node('small',(result.expense_cents?Math.round(group.expense_cents/result.expense_cents*100):0)+' % des dépenses'));report.append(row);}
      if(!result.groups.length)budgetEmpty(report,'Aucune dépense ce mois-ci','Changez de mois ou ajoutez votre première dépense.');
      const budgets=by('budget-comparison');budgets.replaceChildren();
      for(const budget of result.budgets.filter(b=>b.limit_cents!==null)){const spent=result.groups.find(g=>g.category_id===budget.id)?.expense_cents||0;const row=node('div',undefined,'budget-row');row.append(node('strong',budget.name),node('span',money(spent)+' / '+money(budget.limit_cents)),node('small',spent>budget.limit_cents?'Plafond dépassé de '+money(spent-budget.limit_cents):'Reste '+money(budget.limit_cents-spent),spent>budget.limit_cents?'negative':''));budgets.append(row);}
    }catch(e){if(ticket===reportRequest)by('report-error').textContent=e.message;}
  }
  by('report-month').onchange=loadReport;by('report-account').onchange=loadReport;
  document.querySelector('[data-view="bilan"]').addEventListener('click',loadReport);
  by('category-create-form').onsubmit=async e=>{e.preventDefault();if(await mutate('/api/categories',{name:e.target.elements.name.value}))e.target.reset();};
  const manageCategories=button('Gérer les catégories',()=>{document.querySelector('[data-view="bilan"]').click();by('category-manager').open=true;by('category-manager').scrollIntoView({block:'center',behavior:'smooth'});by('category-edit-choice').focus({preventScroll:true});});
  manageCategories.id='manage-categories';by('section-transactions').querySelector('.section-head').append(manageCategories);
  let categoryEditing=null;
  function selectCategory(){categoryEditing=current?.categories.find(c=>c.id===Number(by('category-edit-choice').value));by('category-edit-form').elements.name.value=categoryEditing?.name||'';by('category-edit-status').textContent='';}
  by('category-edit-choice').onchange=selectCategory;
  by('category-edit-form').onsubmit=async e=>{e.preventDefault();if(!categoryEditing)return;const data={id:categoryEditing.id,expected_name:categoryEditing.name,name:e.target.elements.name.value};if(await mutate('/api/categories/update',data)){selectCategory();by('category-edit-status').textContent='Nom enregistré. L’historique est conservé.';}};
  by('category-budget-form').onsubmit=async e=>{e.preventDefault();await mutate('/api/category-budget',{category_id:by('budget-category').value,amount:Number(e.target.elements.amount.value)});};

  function renderGoals(){
    const host=by('goals-list');host.replaceChildren();
    for(const goal of current.goals||[]){
      const card=node('article',undefined,'goal-card');card.append(node('h3',goal.name));const percent=Math.min(100,Math.round(goal.saved_cents/goal.target_cents*100));
      const value=node('div',undefined,'goal-amount');value.append(node('strong',money(goal.saved_cents)),node('span',' sur '+money(goal.target_cents)));card.append(value);
      const progress=node('progress');progress.max=goal.target_cents;progress.value=Math.min(goal.saved_cents,goal.target_cents);progress.setAttribute('aria-label',goal.name+' : '+percent+' %');card.append(progress,node('p',percent+' % atteint'+(goal.target_date?' · cible '+new Date(goal.target_date+'T12:00:00').toLocaleDateString('fr-CA'):''),'sub'));
      const remaining=Math.max(0,goal.target_cents-goal.saved_cents);if(goal.target_date&&goal.target_date>=today()&&remaining){const now=new Date(today()+'T12:00:00'),end=new Date(goal.target_date+'T12:00:00');const months=Math.max(1,(end.getFullYear()-now.getFullYear())*12+end.getMonth()-now.getMonth());card.append(node('p','Repère : '+money(Math.ceil(remaining/months))+' par mois jusqu’à la cible.','sub'));}
      const actions=node('div',undefined,'actions');actions.append(button('Modifier',()=>{const f=by('goal-form');for(const [key,value] of Object.entries({id:goal.id,name:goal.name,target:goal.target_cents/100,saved:goal.saved_cents/100,target_date:goal.target_date||''}))f.elements[key].value=value;by('goal-save').textContent='Enregistrer';by('goal-cancel').hidden=false;f.elements.name.focus();}),button('Supprimer',async()=>{if(confirm('Supprimer l’objectif « '+goal.name+' » ? Les soldes ne changeront pas.'))await mutate('/api/goals/delete',{id:goal.id});},'danger'));card.append(actions);host.append(card);
    }
    if(!current.goals?.length)budgetEmpty(host,'Quel est votre prochain projet ?','Créez un objectif et suivez votre progression, à votre rythme.');
  }
  function resetGoal(){by('goal-form').reset();by('goal-form').elements.id.value='';by('goal-save').textContent='Créer l’objectif';by('goal-cancel').hidden=true;}
  by('goal-cancel').onclick=resetGoal;
  by('goal-form').onsubmit=async e=>{e.preventDefault();const x=Object.fromEntries(new FormData(e.target));x.target=Number(x.target);x.saved=Number(x.saved);if(await mutate('/api/goals',x))resetGoal();};

  let csvHeaders=[];
  window.budgetCSVConfiguration=()=>{const x=csvInput();return {headers:csvHeaders,delimiter:x.delimiter,account_id:x.account_id,date_format:x.date_format,invert_sign:x.invert_sign,mapping:x.mapping};};
  window.budgetApplyCSVProfile=config=>{
   if(JSON.stringify(csvHeaders)!==JSON.stringify(config.headers)||by('csv-file-info').dataset.delimiter!==config.delimiter||!current.accounts.some(a=>a.id===Number(config.account_id)))return false;
   by('csv-account').value=config.account_id;by('csv-date-format').value=config.date_format;by('csv-invert').checked=config.invert_sign;by('csv-balance-mode').value='history';
   for(const select of by('csv-columns').querySelectorAll('select'))select.value=config.mapping[select.dataset.column]??'';
   invalidateCSV();return true;
  };
  function csvInput(){return {csv,delimiter:by('csv-file-info').dataset.delimiter,account_id:by('csv-account').value,category_id:by('csv-category').value||null,date_format:by('csv-date-format').value,invert_sign:by('csv-invert').checked,affects_balance:by('csv-balance-mode').value==='balance',mapping:Object.fromEntries([...by('csv-columns').querySelectorAll('select')].map(select=>[select.dataset.column,select.value]))};}
  function invalidateCSV(){preview=null;by('csv-preview').hidden=true;by('csv-status').textContent='';}
  for(const id of ['csv-account','csv-category','csv-date-format','csv-invert','csv-balance-mode'])by(id).addEventListener('change',invalidateCSV);
  by('csv-file').onchange=async()=>{
    invalidateCSV();csv='';by('csv-mapping').hidden=true;const file=by('csv-file').files[0];if(!file)return;
    try{
      if(file.size>2_000_000)throw Error('Fichier trop volumineux (2 Mo maximum).');csv=await file.text();const info=await request('/api/import/inspect',{csv});by('csv-file-info').textContent=file.name+' · '+info.count+' opérations · '+info.headers.length+' colonnes';by('csv-file-info').dataset.delimiter=info.delimiter;
      const columns=by('csv-columns');columns.replaceChildren();
      const guesses={date:/^date|transaction.*date/i,description:/description|libell|merchant|commerce|memo/i,amount:/^montant$|^amount$/i,debit:/d[ée]bit|withdrawal|retrait/i,credit:/cr[ée]dit|deposit|d[ée]p[oô]t/i,category:/cat[ée]gor/i};
      for(const [key,label] of [['date','Date'],['description','Description'],['amount','Montant signé'],['debit','Débit (si séparé)'],['credit','Crédit (si séparé)'],['category','Catégorie (facultatif)']]){
        const field=node('label',label),select=node('select');select.dataset.column=key;select.add(new Option('Non utilisé',''));info.headers.forEach((header,index)=>select.add(new Option(header||'Colonne '+(index+1),index)));const guessed=info.headers.findIndex(header=>guesses[key].test(header));if(guessed>=0)select.value=String(guessed);select.onchange=invalidateCSV;field.append(select);columns.append(field);
      }
      csvHeaders=info.headers;by('csv-mapping').hidden=false;document.dispatchEvent(new CustomEvent('budget:csv-ready',{detail:{headers:info.headers,delimiter:info.delimiter}}));
    }catch(e){by('csv-status').textContent=e.message;}
  };
  function selectionSummary(){
    const selected=[...by('csv-preview-rows').querySelectorAll('input:checked')].map(input=>preview.rows.find(r=>r.row===Number(input.value)));const total=selected.reduce((sum,row)=>sum+row.amount_cents,0);const account=current.accounts.find(a=>String(a.id)===by('csv-account').value);const effect=account?.kind==='credit'?-total:total;
    by('csv-selection-summary').textContent=selected.length+' opération(s) sélectionnée(s) · '+(by('csv-balance-mode').value==='balance'?'Variation du solde du compte : '+money(effect):'Aucun changement des soldes actuels.');by('csv-commit').disabled=!selected.length;
  }
  by('csv-preview-button').onclick=async()=>{
    const b=by('csv-preview-button');b.disabled=true;invalidateCSV();
    try{
      preview=await request('/api/import/preview',csvInput());const host=by('csv-preview-rows');host.replaceChildren();
      for(const r of preview.rows){const tr=node('tr'),choice=node('td'),input=node('input');input.type='checkbox';input.value=r.row;input.setAttribute('aria-label','Importer la ligne '+r.row);input.checked=!r.error&&!r.duplicate;input.disabled=!!r.error||r.duplicate;input.dataset.duplicate=r.duplicate?'true':'false';input.dataset.invalid=r.error?'true':'false';input.onchange=selectionSummary;choice.append(input);tr.append(choice,node('td',r.date||'—'),node('td',r.description||'Ligne '+(r.row+1)),node('td',r.amount_cents===undefined?'—':money(r.amount_cents)),node('td',r.error||(r.duplicate?'Doublon possible':'Prête'),r.error?'negative':r.duplicate?'duplicate-label':''));host.append(tr);}
      by('csv-allow-duplicates').checked=false;const summary=by('csv-summary');summary.replaceChildren();for(const [label,value] of [['Opérations',preview.rows.length],['Doublons possibles',preview.rows.filter(r=>r.duplicate).length],['Lignes invalides',preview.rows.filter(r=>r.error).length]]){const item=node('div',undefined,'feature-metric');item.append(node('span',label),node('strong',value));summary.append(item);}by('csv-preview').hidden=false;selectionSummary();
    }catch(e){by('csv-status').textContent=e.message;}finally{b.disabled=false;}
  };
  by('csv-allow-duplicates').onchange=()=>{for(const input of by('csv-preview-rows').querySelectorAll('[data-duplicate="true"]')){input.disabled=!by('csv-allow-duplicates').checked;if(input.disabled)input.checked=false;}selectionSummary();};
  by('csv-commit').onclick=async()=>{
    if(!preview)return;const b=by('csv-commit');b.disabled=true;
    try{
      const result=await request('/api/import/commit',{...csvInput(),fingerprint:preview.fingerprint,selected_rows:[...by('csv-preview-rows').querySelectorAll('input:checked')].map(input=>Number(input.value)),include_duplicates:by('csv-allow-duplicates').checked});render(result.state);invalidateCSV();by('csv-status').textContent=result.imported+' opération(s) importée(s).';
    }catch(e){by('csv-status').textContent=e.message;}finally{b.disabled=false;}
  };

  by('balance-preview').onclick=()=>{
    by('balance-comparison').hidden=true;balancePreview=null;const form=by('balance-form');if(!form.reportValidity())return;const account=current.accounts.find(a=>String(a.id)===by('balance-account').value);if(!account)return;
    const value=Number(form.elements.balance.value),expected=account.balance_cents,delta=Math.round(value*100)-expected;
    balancePreview={account_id:account.id,balance:value,expected_balance_cents:expected,note:form.elements.note.value,confirm:true};by('balance-difference').textContent='Solde du programme : '+money(expected)+' · Solde bancaire : '+money(Math.round(value*100))+' · Correction : '+money(delta)+'. Les opérations passées ne seront pas modifiées.';by('balance-confirm').disabled=delta===0;by('balance-comparison').hidden=false;
  };
  by('balance-form').addEventListener('input',()=>{balancePreview=null;by('balance-comparison').hidden=true;});
  by('balance-confirm').onclick=async()=>{if(balancePreview&&await mutate('/api/balance/reconcile',balancePreview)){balancePreview=null;by('balance-comparison').hidden=true;}};

  by('restore-file').onchange=async()=>{
    restoreBackup=null;by('restore-confirmation').hidden=true;by('restore-confirm-text').value='';by('restore-button').disabled=true;by('restore-status').textContent='';const file=by('restore-file').files[0];if(!file)return;
    try{if(file.size>8_000_000)throw Error('Sauvegarde trop volumineuse (8 Mo maximum).');const candidate=JSON.parse(await file.text());const result=await request('/api/backup/validate',{backup:candidate});restoreBackup=candidate;by('restore-counts').textContent=result.counts.accounts+' comptes · '+result.counts.transactions+' transactions · '+result.counts.envelopes+' enveloppes · '+result.counts.goals+' objectifs';by('restore-status').textContent='Sauvegarde vérifiée. Vérifiez le contenu avant de remplacer le budget.';by('restore-confirmation').hidden=false;}catch(e){by('restore-status').textContent='Restauration impossible : '+e.message;}
  };
  by('restore-confirm-text').oninput=()=>by('restore-button').disabled=by('restore-confirm-text').value!=='REMPLACER';
  by('restore-button').onclick=async()=>{
    if(!restoreBackup||by('restore-confirm-text').value!=='REMPLACER')return;by('restore-button').disabled=true;
    try{const result=await request('/api/backup/restore',{backup:restoreBackup,confirm:'REMPLACER'});render(result.state);by('restore-status').textContent='Budget restauré. Copie du budget précédent conservée : data/backups/'+result.safety_backup;restoreBackup=null;by('restore-confirmation').hidden=true;by('restore-file').value='';}catch(e){by('restore-status').textContent=e.message;by('restore-button').disabled=false;}
  };

  const oldRender=render;
  render=function(s){
    oldRender(s);current=s;
    for(const [id,empty] of [['transaction-category','Non classé'],['v2-edit-category','Non classé'],['v3-category-filter','Toutes'],['csv-category','Non classé'],['budget-category',undefined]])options(by(id),s.categories||[],empty);
    for(const [id,empty] of [['report-account','Tous les comptes'],['csv-account',undefined],['balance-account',undefined]])options(by(id),s.accounts||[],empty);
    const merchants=by('recent-merchants');merchants.replaceChildren();for(const item of s.recent_descriptions||[])merchants.append(new Option(item.description,item.description));
    options(by('category-edit-choice'),s.categories||[]);if(!categoryEditing||categoryEditing.id!==Number(by('category-edit-choice').value))selectCategory();
    renderGoals();const history=by('balance-history');history.replaceChildren();for(const row of s.balance_reconciliations||[]){const line=node('div',undefined,'audit-row');line.append(node('strong',row.account_name),node('span',money(row.old_balance_cents)+' → '+money(row.new_balance_cents)),node('small',row.happened_on+' · '+row.note));history.append(line);}
    if(document.querySelector('[data-view="bilan"].active'))loadReport();
  };
  if(typeof state!=='undefined'&&state)render(state);
})();
