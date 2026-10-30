// Payment suggestions concern new card activity, never a reservation of card debt.
export function deriveCardPayments(args,base,skeleton,previous){
 const {accounts,recurring,cardPaymentPlans=[],transactions=[],transfers=[],links=[],overrides=[],today,nextOccurrence,similarDescription}=args;
 const add=(d,n)=>new Date(Date.parse(d+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),distance=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
 const known=new Map((previous?.rows||[]).map(r=>[r.key,r])),userOverrides=new Map(overrides.map(o=>[o.recurring_id+'|'+o.occurrence_on,o.amount_cents]));
 const result=[],metadata=new Map(),claimed=new Set([...base.rows.flatMap(r=>r.actual_ids),...links.map(l=>l.actual_type+':'+l.actual_id)]);
 const baseEvents=base.days.flatMap(d=>d.events.map(e=>({...e,on:d.date})));
 for(const plan of cardPaymentPlans.filter(p=>p.mode==='purchases')){
  const rule=recurring.find(r=>r.id===plan.recurring_id&&r.active);if(!rule)continue;
  const occurrences=skeleton.rows.filter(r=>r.recurring_id===rule.id).sort((a,b)=>a.date.localeCompare(b.date)||a.original_on.localeCompare(b.original_on));if(!occurrences.length)continue;
  const first=occurrences[0];
  let previousDate;
  if(rule.frequency==='weekly'||rule.frequency==='biweekly')previousDate=add(first.original_on,rule.frequency==='weekly'?-7:-14);
  else{const d=new Date(first.original_on+'T12:00:00Z'),start=new Date(rule.start_on+'T12:00:00Z'),i=(d.getUTCFullYear()-start.getUTCFullYear())*12+d.getUTCMonth()-start.getUTCMonth();previousDate=nextOccurrence(rule.start_on,rule.frequency,i-1);}
  let periodStart=add(previousDate,1),carry=0,projectedPayments=0;
  if(periodStart>first.date)periodStart=first.date;
  for(const row of occurrences){
   let purchases=0;const items=[];
   for(const t of transactions)if(t.account_id===plan.card_account_id&&t.happened_on>=periodStart&&t.happened_on<=row.date){purchases-=t.amount_cents;items.push({date:t.happened_on,description:t.description,amount_cents:-t.amount_cents,real:true});}
   for(const t of transfers)if(t.from_account_id===plan.card_account_id&&t.happened_on>=periodStart&&t.happened_on<=row.date){purchases+=t.amount_cents;items.push({date:t.happened_on,description:t.description,amount_cents:t.amount_cents,real:true});}
   for(const e of baseEvents)if(e.on>=periodStart&&e.on<=row.date&&e.account_id===plan.card_account_id){const amount=e.type==='expense'||e.type==='transfer'?e.amount_cents:e.type==='income'?-e.amount_cents:0;if(amount){purchases+=amount;items.push({date:e.on,description:e.description,amount_cents:amount,real:false});}}
   const net=purchases+carry,outstanding=Math.max(0,net),overrideKey=rule.id+'|'+row.original_on,explicit=links.find(l=>l.recurring_id===rule.id&&l.occurrence_on===row.original_on&&l.actual_type==='transfer');
   const old=known.get(row.key),actualId=old?.status==='actual'?Number(old.actual_ids[0]?.split(':')[1]):explicit?.actual_id,actual=transfers.find(t=>t.id===actualId);
   const target=userOverrides.get(overrideKey)??outstanding;
   const candidates=transfers.filter(t=>!claimed.has('transfer:'+t.id)&&t.from_account_id===rule.account_id&&t.to_account_id===plan.card_account_id&&distance(t.happened_on,row.date)<=3);
   const day=base.days.find(d=>d.date>=(row.date<today?today:row.date))||base.days.at(-1),owed=accounts.find(a=>a.id===plan.card_account_id)?.simple_credit?outstanding:Math.max(0,(day.account_balances.find(a=>a.id===plan.card_account_id)?.balance_cents||0)-projectedPayments);
   const amount=userOverrides.has(overrideKey)?target:actual||candidates.length?outstanding:Math.min(outstanding,owed);
   metadata.set(row.key,{card_payment_mode:plan.mode,card_account_id:plan.card_account_id,purchase_period_start:periodStart,purchase_period_end:row.date,purchase_cents:purchases,carried_cents:carry,suggested_cents:outstanding,payment_items:items,unmatched_payment_ids:actual?[]:candidates.map(t=>t.id)});
   result.push({recurring_id:rule.id,occurrence_on:row.original_on,amount_cents:amount});
   if(actual){claimed.add('transfer:'+actual.id);carry=net<0?net:Math.max(0,outstanding-actual.amount_cents);}
   else{projectedPayments+=amount;carry=net<0?net:userOverrides.has(overrideKey)?Math.max(0,outstanding-amount):0;}
   periodStart=add(row.date,1);
  }
 }
 return {overrides:result,metadata};
}
