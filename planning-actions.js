// User-triggered planning actions. Each confirmation is one atomic ledger change.
export function createPlanningActions({db,snapshot,atomic,addTransaction,validateTransfer,accountEffect,cents,validDate,today,applyTransferEnvelope=()=>{},prepareConfirmation=()=>null,confirmFunding=()=>{}}){
 const q=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 function action(x){
  const state=snapshot(),row=state.planning.rows.find(r=>r.key===x.key);
  if(!row||!['planned','pending'].includes(row.status)||row.type==='reserve')throw Error('Cette opération a déjà été traitée ou n’est plus disponible. Actualisez la liste.');
  if(typeof x.signature!=='string'||x.signature!==row.signature)throw Error('Cette prévision a changé. Actualisez la liste avant de continuer.');
  if(!['confirm','move','skip','adjust'].includes(x.action))throw Error('Action inconnue.');
  const original=row.original_on;
  if(x.action==='move'){
   if(!validDate(x.new_on)||x.new_on<today()||Math.abs(Date.parse(x.new_on)-Date.parse(original))>90*86400000||x.new_on>state.forecast.at(-1).date)throw Error('Choisissez une date future dans les 90 jours de l’échéance et dans la prévision affichée.');
   atomic(()=>{if(row.source==='recurring')run('INSERT INTO recurring_moves(recurring_id,occurrence_on,new_on) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET new_on=excluded.new_on',row.recurring_id,original,x.new_on);else run('INSERT INTO envelope_occurrence_moves(envelope_id,occurrence_on,new_on) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET new_on=excluded.new_on',row.envelope_id,original,x.new_on);});return;
  }
  if(x.action==='skip'||x.action==='adjust'){
   const amount=x.action==='skip'?0:cents(x.amount);
   if(amount===null||amount<0)throw Error('Montant prévu invalide.');
   atomic(()=>{
    if(row.source==='recurring')run('INSERT INTO recurring_overrides(recurring_id,occurrence_on,amount_cents) VALUES(?,?,?) ON CONFLICT(recurring_id,occurrence_on) DO UPDATE SET amount_cents=excluded.amount_cents',row.recurring_id,original,amount);
    else if(x.action==='skip')run("INSERT INTO envelope_period_status(envelope_id,occurrence_on,status) VALUES(?,?,'skipped') ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET status='skipped'",row.envelope_id,original);
    else run('INSERT INTO envelope_budget_overrides(envelope_id,occurrence_on,budget_cents) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET budget_cents=excluded.budget_cents',row.envelope_id,original,amount);
   });return;
  }
  if(x.action==='confirm'&&!x.actual_id&&row.unmatched_payment_ids?.length&&x.allow_new_payment!==true)throw Error('Un virement réel existe près de cette échéance. Associez-le ou confirmez explicitement qu’il s’agit d’un nouveau paiement distinct.');
  let amount=cents(x.amount),date=x.happened_on,actual=null;
  const kind=row.type==='transfer'?'transfer':'transaction';
  if(x.actual_id){
   actual=q(kind==='transfer'?'SELECT * FROM account_transfers WHERE id=?':'SELECT * FROM transactions WHERE id=?',Number(x.actual_id))[0];
   if(!actual)throw Error('Opération réelle introuvable.');
   const claimed=state.planning.rows.some(r=>r.actual_ids.includes(kind+':'+actual.id))||q('SELECT 1 FROM reconciliation_links WHERE actual_type=? AND actual_id=?',kind,actual.id).length||(kind==='transaction'&&q('SELECT 1 FROM envelope_actual_links WHERE transaction_id=?',actual.id).length);
   if(claimed)throw Error('Cette opération réelle est déjà associée à une prévision.');
   date=actual.happened_on;amount=Math.abs(actual.amount_cents);
  }
  if(!validDate(date)||date>today())throw Error('Le réel doit être daté d’aujourd’hui ou d’un jour passé. Utilisez Reporter pour une opération future.');
  if(amount===null||amount<=0)throw Error('Indiquez un montant réel supérieur à zéro.');
  if(x.complete_period!==undefined&&typeof x.complete_period!=='boolean')throw Error('Choix de fin de période invalide.');
  const account=row.source==='envelope'&&row.type!=='transfer'?Number(x.account_id||actual?.account_id||row.account_id):row.account_id;
  if(!q('SELECT id FROM accounts WHERE id=?',account).length)throw Error('Choisissez le compte de cette opération.');
  if(actual){
   if(kind==='transfer'?(actual.from_account_id!==account||actual.to_account_id!==row.to_account_id):(actual.account_id!==account||(row.type==='income'?actual.amount_cents<=0:actual.amount_cents>=0)))throw Error('Le compte ou le type de l’opération réelle ne correspond pas à cette prévision.');
   if(row.source==='envelope'&&actual.envelope_id&&actual.envelope_id!==row.envelope_id)throw Error('Cette dépense est déjà affectée à une autre enveloppe.');
   if(row.source==='recurring'&&actual.envelope_id&&actual.envelope_id!==row.envelope_id)throw Error('L’enveloppe de cette opération ne correspond pas à la prévision.');
  }
  const funding=kind==='transfer'&&!actual?prepareConfirmation(row,amount):null;
  atomic(()=>{
   let id=actual?.id;
   if(!actual&&kind==='transfer'){
    const t=validateTransfer({from_account_id:account,to_account_id:row.to_account_id,amount:amount/100,description:row.description,happened_on:date});
    id=Number(run('INSERT INTO account_transfers(from_account_id,to_account_id,amount_cents,description,happened_on) VALUES(?,?,?,?,?)',t.from,t.to,t.amount,t.description,t.date).lastInsertRowid);
    run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(t.from,-t.amount),t.from);run('UPDATE accounts SET balance_cents=balance_cents+? WHERE id=?',accountEffect(t.to,t.amount),t.to);applyTransferEnvelope(id,row.envelope_id,t.amount,date,row.source==='envelope'?original:null);
   }else if(!actual)id=addTransaction({category_id:row.category_id||null,account_id:account,envelope_id:row.envelope_id,amount:(row.type==='income'?amount:-amount)/100,description:row.description,happened_on:date},{coveredCents:row.actual_funded_cents||0});
   if(funding)confirmFunding(funding,id,amount);
   if(row.envelope_id&&actual&&kind==='transfer'){if(actual.envelope_id&&actual.envelope_id!==row.envelope_id)throw Error('Ce virement est déjà associé à une autre enveloppe.');if(!actual.envelope_id)applyTransferEnvelope(id,row.envelope_id,amount,date,row.source==='envelope'?original:null);else if(row.source==='envelope')run('UPDATE account_transfers SET envelope_on=? WHERE id=?',original,id);}
   if(row.envelope_id&&actual&&kind==='transaction'&&!actual.envelope_id){
     const reserve=q('SELECT reserved_cents FROM envelopes WHERE id=?',row.envelope_id)[0].reserved_cents,effect=actual.affects_balance?Math.min(reserve,Math.max(0,amount-(row.actual_funded_cents||0))):0;
     run('UPDATE envelopes SET reserved_cents=reserved_cents-? WHERE id=?',effect,row.envelope_id);run('UPDATE transactions SET envelope_id=?,envelope_effect_cents=? WHERE id=?',row.envelope_id,effect,id);
    }
   if(row.source==='recurring')run('INSERT INTO reconciliation_links(recurring_id,occurrence_on,actual_type,actual_id) VALUES(?,?,?,?)',row.recurring_id,original,kind,id);
   else{
    if(kind==='transaction')run('INSERT INTO envelope_actual_links(transaction_id,envelope_id,occurrence_on) VALUES(?,?,?)',id,row.envelope_id,original);
    run('INSERT INTO envelope_period_status(envelope_id,occurrence_on,status) VALUES(?,?,?) ON CONFLICT(envelope_id,occurrence_on) DO UPDATE SET status=excluded.status',row.envelope_id,original,x.complete_period===false?'open':'complete');
   }
  });
 }
 return {action};
}
