// A payment plan owns one ordinary transfer rule; confirmations and overrides
// therefore reuse the existing atomic ledger and reconciliation machinery.
export function createCardPayments({db,cents,validDate,today,atomic}){
 const q=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 function post(url,x){
  const cardId=Number(x.card_account_id),plan=q('SELECT * FROM card_payment_plans WHERE card_account_id=?',cardId)[0];
  if(url.endsWith('/delete')){if(!plan)throw Error('Plan de remboursement introuvable.');atomic(()=>run('DELETE FROM recurring WHERE id=?',plan.recurring_id));return;}
  const card=q('SELECT * FROM accounts WHERE id=?',cardId)[0],source=q('SELECT * FROM accounts WHERE id=?',Number(x.from_account_id))[0],mode=x.mode,amount=mode==='fixed'?cents(x.amount):1;
  if(!card||card.kind!=='credit'||!source||source.kind==='credit'||card.id===source.id)throw Error('Choisissez une carte et un compte bancaire de remboursement.');
  if(!['purchases','fixed'].includes(mode)||!['weekly','biweekly','monthly'].includes(x.frequency)||!validDate(x.start_on)||(!plan&&x.start_on<today())||amount===null||amount<=0)throw Error('Vérifiez le mode, le montant, la fréquence et la première date de remboursement.');
  const replacement=x.replace_recurring_id?Number(x.replace_recurring_id):null,ruleId=plan?.recurring_id||replacement;
  if(replacement&&!plan){const rule=q('SELECT * FROM recurring WHERE id=?',replacement)[0];if(!rule||rule.type!=='transfer'||rule.to_account_id!==cardId||rule.account_id!==source.id||q('SELECT 1 FROM card_payment_plans WHERE recurring_id=?',replacement).length)throw Error('La règle à réutiliser doit être un virement de ce compte vers cette carte.');}
  if(q("SELECT id FROM recurring WHERE active=1 AND type='transfer' AND to_account_id=? AND id!=?",cardId,ruleId||0).length)throw Error('Un autre remboursement récurrent existe pour cette carte. Réutilisez-le ou mettez-le en pause avant de créer ce plan.');
  atomic(()=>{
   const values=['Paiement '+card.name+' depuis '+source.name,amount,source.id,card.id,x.start_on,x.frequency,x.active===false||x.active==='false'?0:1];let id=ruleId;
   if(id)run("UPDATE recurring SET description=?,type='transfer',amount_cents=?,account_id=?,to_account_id=?,envelope_id=NULL,start_on=?,frequency=?,active=?,day_adjust='none',one_time=0 WHERE id=?",...values,id);
   else id=Number(run("INSERT INTO recurring(description,type,amount_cents,account_id,to_account_id,start_on,frequency,active,day_adjust,one_time) VALUES(?,'transfer',?,?,?,?,?,?,'none',0)",...values).lastInsertRowid);
   run('INSERT INTO card_payment_plans(card_account_id,recurring_id,mode) VALUES(?,?,?) ON CONFLICT(card_account_id) DO UPDATE SET recurring_id=excluded.recurring_id,mode=excluded.mode',cardId,id,mode);
  });
 }
 return {post};
}
