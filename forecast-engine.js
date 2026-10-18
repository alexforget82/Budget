import {createCardEnvelopeFunds,earlyCardEnvelopePurchases} from './card-envelope-funds.js';
import {envelopeBudgetDates} from './budget-schedule.js';
import {deriveCardPayments} from './card-payments-engine.js';

// Pure simulation: never writes actual account or envelope balances.
function buildBaseForecast({accounts,envelopes,recurring,fundingLinks=[],overrides=[],moves=[],links=[],transactions=[],transfers=[],periods=[],renewals=[],envelopeOverrides=[],envelopeMoves=[],envelopeLinks=[],today,since=today,horizon=90,nextOccurrence,occurrenceInfo,similarDescription}) {
 const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const end=addDays(today,horizon-1),distance=(a,b)=>Math.abs(Date.parse(a)-Date.parse(b))/86400000;
 const warnings=[],rows=[],used=new Set(),actualMap=new Map([...transactions.map(t=>['transaction:'+t.id,{...t,actual_type:'transaction'}]),...transfers.map(t=>['transfer:'+t.id,{...t,actual_type:'transfer'}])]);
 const overrideMap=new Map(overrides.map(o=>[o.recurring_id+'|'+o.occurrence_on,o.amount_cents]));
 const moveMap=new Map(moves.map(m=>[m.recurring_id+'|'+m.occurrence_on,m.new_on]));
 const envOverrides=new Map(envelopeOverrides.map(o=>[o.envelope_id+'|'+o.occurrence_on,o.budget_cents]));
 const envelopeMoveMap=new Map(envelopeMoves.map(m=>[m.envelope_id+'|'+m.occurrence_on,m.new_on]));
 const envelopeLinkMap=new Map(envelopeLinks.map(l=>[l.transaction_id,l]));
 const periodMap=new Map(periods.map(p=>[p.envelope_id+'|'+p.occurrence_on,p.status]));
 const enabled=envelopes.filter(e=>e.active&&e.forecast_spend!==0);
 const included=a=>a&&a.included&&a.kind!=='credit',accountMap=new Map(accounts.map(a=>[a.id,a]));
 // Generate the nominal occurrences first. Original dates remain stable across moves.
 for(const rule of recurring.filter(r=>r.active)) {
  if(rule.type==='reserve'&&!rule.paycheck_allocation&&envelopes.some(e=>e.id===rule.envelope_id&&e.active&&e.frequency!=='none'))continue;
  for(let i=0;i<20000;i++) {
   if(rule.one_time&&i>0)break;
   const original=occurrenceInfo(rule.start_on,rule.frequency,i,rule.day_adjust||'none').date;
   if(original>addDays(end,90))break;
   const date=moveMap.get(rule.id+'|'+original)||original;
   if(date<since||date>end)continue;
   const amount=overrideMap.get(rule.id+'|'+original)??rule.amount_cents;
   rows.push({key:'rec-'+rule.id+'|'+original,source:rule.paycheck_allocation?'paycheck':'recurring',id:rule.id,recurring_id:rule.id,original_on:original,date,description:rule.description,type:rule.type,account_id:rule.account_id,to_account_id:rule.to_account_id,envelope_id:rule.envelope_id,planned_cents:amount,actual_cents:null,actual_ids:[],status:amount===0?'skipped':'planned',modified:date!==original||overrideMap.has(rule.id+'|'+original)});
  }
 }
 // Explicit links always win. Automatic matches require unique candidates in both directions.
 for(const link of links){const row=rows.find(r=>r.recurring_id===link.recurring_id&&r.original_on===link.occurrence_on),actual=actualMap.get(link.actual_type+':'+link.actual_id);if(!actual)continue;used.add(link.actual_type+':'+link.actual_id);if(row){row.actual_cents=Math.abs(actual.amount_cents);row.actual_ids=[link.actual_type+':'+link.actual_id];row.status='actual';}}
 const proposals=[];
 for(const [id,a] of actualMap){if(used.has(id)||(a.actual_type==='transaction'&&envelopeLinkMap.has(a.id)))continue;
  const matches=rows.filter(r=>r.status==='planned'&&r.type!=='reserve'&&distance(r.date,a.happened_on)<=3&&r.planned_cents===Math.abs(a.amount_cents)&&similarDescription(r.description,a.description)&&(a.actual_type==='transfer'?r.type==='transfer'&&r.account_id===a.from_account_id&&r.to_account_id===a.to_account_id:r.account_id===a.account_id&&(!a.envelope_id||r.envelope_id===a.envelope_id)&&((r.type==='expense'&&a.amount_cents<0)||(r.type==='income'&&a.amount_cents>0))));
  if(matches.length===1)proposals.push({id,a,row:matches[0]});
 }
 for(const p of proposals)if(proposals.filter(x=>x.row===p.row).length===1){used.add(p.id);p.row.actual_cents=Math.abs(p.a.amount_cents);p.row.actual_ids=[p.id];p.row.status='actual';}
 for(const e of enabled){
  if(e.frequency==='none'||!e.start_on||!e.budget_cents){warnings.push({code:'envelope_unscheduled',envelope_id:e.id,message:e.name+' : date, fréquence et budget à définir. Seule la réserve actuelle est déduite.'});continue;}
  // A linked expense rule owns its dates and amounts; no second automatic envelope expense.
  const account=accountMap.get(e.forecast_account_id),sources=accounts.filter(included),funding=account&&account.kind!=='credit'&&!included(account)&&sources.length===1?{from:sources[0].id,to:account.id}:null;
  if(!account)warnings.push({code:'envelope_account',envelope_id:e.id,message:e.name+' : compte à choisir. Les dépenses sont provisoirement déduites du solde total inclus.'});
  const start=e.planning_since||since;
  const schedule=[];
  for(let i=0;i<20000;i++){
   const original=nextOccurrence(e.start_on,e.frequency,i);if(original>addDays(end,90))break;if(original<start)continue;
   schedule.push({original,date:envelopeMoveMap.get(e.id+'|'+original)||original,nextNominal:nextOccurrence(e.start_on,e.frequency,i+1)});
  }
  schedule.sort((a,b)=>a.date.localeCompare(b.date));
  for(const occurrence of schedule){
   const {original,date,nextNominal}=occurrence;if(date>end)continue;
   const next=schedule.find(s=>s.date>date)?.date||addDays(end,91),budget=envOverrides.get(e.id+'|'+original)??e.budget_cents;
   if(rows.some(r=>r.source==='recurring'&&(r.type==='expense'&&!funding||r.type==='transfer'&&funding&&r.account_id===funding.from&&r.to_account_id===funding.to)&&r.envelope_id===e.id&&r.original_on>=original&&r.original_on<nextNominal))continue;
   const uniqueDate=schedule.filter(s=>s.date===date).length===1;
   const actuals=funding?transfers.filter(t=>t.envelope_id===e.id&&t.from_account_id===funding.from&&t.to_account_id===funding.to&&(t.envelope_on?t.envelope_on===original:t.happened_on>=date&&t.happened_on<next)):transactions.filter(t=>{const link=envelopeLinkMap.get(t.id);return t.envelope_id===e.id&&t.amount_cents<0&&!used.has('transaction:'+t.id)&&(link?link.envelope_id===e.id&&link.occurrence_on===original:uniqueDate&&((t.happened_on>=date&&t.happened_on<next)||(accountMap.get(t.account_id)?.kind==='credit'&&original===e.start_on&&t.happened_on<date&&t.happened_on>=(e.planning_since||since))));});
   const actual=actuals.reduce((n,t)=>n+(funding?t.amount_cents:-t.amount_cents),0),choice=periodMap.get(e.id+'|'+original);
   const status=choice==='skipped'?'skipped':choice==='complete'||(actuals.length&&choice!=='open'&&(!funding||actual>=budget))?'actual':'planned';
   rows.push({key:'env-'+e.id+'|'+original,source:'envelope',id:'env-spend-'+e.id,envelope_id:e.id,date,original_on:original,period_end:addDays(next,-1),description:e.name,type:funding?'transfer':'expense',envelope_funding:!!funding,account_id:funding?.from??account?.id??null,to_account_id:funding?.to??null,planned_cents:budget,actual_cents:actuals.length||choice==='complete'?actual:null,actual_ids:actuals.map(t=>(funding?'transfer:':'transaction:')+t.id),status:budget===0&&!actuals.length?'skipped':status,partial:choice==='open',modified:envOverrides.has(e.id+'|'+original)||date!==original});
  }
 }
 for(const row of rows){
  row.remaining_cents=row.status==='planned'?Math.max(0,row.planned_cents-(row.actual_cents||0)):0;
  row.variance_cents=row.actual_cents===null?null:row.actual_cents-row.planned_cents;
  if(row.status==='planned'&&row.date<today)row.status='pending';
  row.simulation_on=row.date<today?today:row.date;
 }
 const fundingByTransfer=new Map();
 for(const row of rows){row.funded_cents=0;row.actual_funded_cents=0;}
 for(const link of fundingLinks){const expense=rows.find(r=>r.key===link.expense_key&&r.type==='expense');if(!expense||!['planned','pending'].includes(expense.status))continue;const from=accountMap.get(link.from_account_id),to=accountMap.get(link.to_account_id);if(!included(from)||included(to)||expense.account_id!==link.to_account_id)continue;
  if(link.transfer_id){const actual=transfers.find(t=>t.id===link.transfer_id&&t.from_account_id===from.id&&t.to_account_id===to.id);if(actual){const covered=Math.min(Math.max(0,expense.remaining_cents-expense.funded_cents),link.coverage_cents||0,actual.amount_cents);expense.funded_cents+=covered;expense.actual_funded_cents+=covered;}}
  else{const transfer=rows.find(r=>r.recurring_id===link.transfer_rule_id&&r.original_on===link.transfer_on&&r.type==='transfer');if(transfer&&['planned','pending'].includes(transfer.status)){fundingByTransfer.set(transfer.key,{link,expense});transfer.funding_expense_key=expense.key;transfer.funding_description=expense.description;}}
 }
 const futureActuals=transactions.filter(t=>t.happened_on>today);
 if(futureActuals.length)warnings.push({code:'future_actuals',message:futureActuals.length+' transaction(s) datée(s) dans le futur sont déjà intégrées aux soldes réels. Utilisez une opération prévue pour les prochains paiements.'});
 const cardFunds=createCardEnvelopeFunds({accounts,envelopes,transactions,transfers,today}),openingCardEnvelope=cardFunds.total(),openingCardFunds=cardFunds.entries();
 const balances=new Map(accounts.map(a=>[a.id,a.balance_cents])),reserves=new Map(envelopes.map(e=>[e.id,e.reserved_cents]));
 let reserved=envelopes.reduce((s,e)=>s+e.reserved_cents,0),unassigned=0;
 const cumulative={income_cents:0,expense_cents:0,envelope_cents:0,transfer_cents:0};
 const days=[],cash=()=>accounts.filter(included).reduce((n,a)=>n+(balances.get(a.id)||0),0)-unassigned;
 const held=()=>reserved+cardFunds.total(),openingCash=cash();
 const consume=(id,amount)=>{const release=Math.min(reserves.get(id)||0,amount);reserves.set(id,(reserves.get(id)||0)-release);reserved-=release;return release;};
 for(let n=0;n<horizon;n++){
  const date=addDays(today,n),events=[];
  for(const e of envelopes){if(!e.active||e.frequency==='none'||!e.start_on)continue;
   const scheduled=e.budget_schedules?envelopeBudgetDates(e,date,date,nextOccurrence)[0]:null;let due=!!scheduled;if(!e.budget_schedules)for(let i=0;i<20000;i++){const d=nextOccurrence(e.start_on,e.frequency,i);if(d>=date){due=d===date;break;}}
   if(!due||renewals.some(r=>r.envelope_id===e.id&&r.occurrence_on===date))continue;
   const before=reserves.get(e.id)||0,budget=envOverrides.get(e.id+'|'+date)??scheduled?.amount_cents??e.budget_cents,early=transfers.filter(t=>t.envelope_id===e.id&&t.envelope_on===date&&t.happened_on<date).reduce((n,t)=>n+Math.max(0,t.amount_cents-(e.rollover?(t.envelope_effect_cents||0):0)),0),remaining=Math.max(0,budget-early-earlyCardEnvelopePurchases({accounts,transactions,envelopeLinks},e,date)),after=e.rollover?before+remaining:remaining;
   reserves.set(e.id,after);reserved+=after-before;events.push({id:'env-'+e.id,description:'Renouvellement · '+e.name,type:'reserve',amount_cents:after-before,envelope_id:e.id,envelope_renewal:true,cash_impact_cents:0,sts_impact_cents:before-after});
  }
  for(const row of rows.filter(r=>r.simulation_on===date&&r.remaining_cents>0).sort((a,b)=>{const rank=r=>fundingByTransfer.has(r.key)?100:r.type==='expense'&&r.envelope_id&&accountMap.get(r.account_id)?.kind==='credit'?50:0;return rank(b)-rank(a);})){
   // Unconfirmed past income must not finance today's spending.
   if(row.status==='pending'&&row.type==='income')continue;
   if(row.status==='pending'&&row.type==='transfer'&&!included(accountMap.get(row.account_id))&&included(accountMap.get(row.to_account_id))){warnings.push({code:'late_incoming_transfer',message:row.description+' : entrée en retard non ajoutée au disponible tant que le virement n’est pas confirmé.'});continue;}
   const amount=row.remaining_cents,account=accountMap.get(row.account_id),beforeCash=cash(),before=cash()-held();
   if(row.type==='income'){balances.set(row.account_id,(balances.get(row.account_id)||0)+(account?.kind==='credit'?-amount:amount));if(account?.kind==='credit')cardFunds.pay(account.id,amount);}
   if(row.type==='expense'){
    if(account)balances.set(account.id,(balances.get(account.id)||0)+(account.kind==='credit'?amount:-amount));else unassigned+=amount;
    if(account?.kind==='credit'&&row.envelope_id)cardFunds.charge(account.id,row.envelope_id,Math.min(amount,Math.max(0,balances.get(account.id)||0)));
    const allowance=envelopes.find(e=>e.id===row.envelope_id&&e.forecast_spend!==0&&e.forecast_account_id===row.account_id);if(row.envelope_id&&!cardFunds.isExternalAllowance(row.envelope_id)&&!(allowance&&account?.kind!=='credit'&&!included(account)&&accounts.filter(included).length===1))consume(row.envelope_id,Math.max(0,amount-(row.funded_cents||0)));
   }
   if(row.type==='transfer'){
    const target=accountMap.get(row.to_account_id);
    balances.set(row.account_id,(balances.get(row.account_id)||0)+(account?.kind==='credit'?amount:-amount));
    balances.set(row.to_account_id,(balances.get(row.to_account_id)||0)+(target?.kind==='credit'?-amount:amount));
    if(target?.kind==='credit')cardFunds.pay(target.id,amount);
    if(row.envelope_id&&included(account)&&!included(target)&&target?.kind!=='credit'&&!fundingByTransfer.has(row.key))consume(row.envelope_id,amount);
    const funding=fundingByTransfer.get(row.key);if(funding&&funding.expense.simulation_on>=date){const covered=Math.min(amount,funding.link.coverage_cents||0,Math.max(0,funding.expense.remaining_cents-funding.expense.funded_cents));if(funding.expense.envelope_id)consume(funding.expense.envelope_id,covered);funding.expense.funded_cents+=covered;row.funding_cents=covered;}
   }
   if(row.type==='reserve'){reserved+=amount;if(row.envelope_id)reserves.set(row.envelope_id,(reserves.get(row.envelope_id)||0)+amount);}
   const impact=cash()-beforeCash;const group=row.type==='income'?'income_cents':row.type==='transfer'?'transfer_cents':row.type==='expense'?(row.envelope_id?'envelope_cents':'expense_cents'):null;if(group)cumulative[group]+=impact;
   events.push({...row,amount_cents:amount,cash_impact_cents:impact,sts_impact_cents:cash()-held()-before,credit_charge:row.type==='expense'&&account?.kind==='credit',transfer_internal:row.type==='transfer'&&included(account)&&included(accountMap.get(row.to_account_id)),envelope_spending:row.source==='envelope',overdue:row.status==='pending'});
  }
  days.push({date,bridge:{opening_cash_cents:openingCash,...cumulative,closing_cash_cents:cash(),reserved_cents:held(),card_envelope_reserved_cents:cardFunds.total(),closing_safe_cents:cash()-held()},cash_cents:cash(),reserved_cents:held(),envelope_reserved_cents:reserved,card_envelope_reserved_cents:cardFunds.total(),credit_reserved_cents:0,safe_cents:cash()-held(),account_balances:accounts.map(a=>({id:a.id,balance_cents:balances.get(a.id)})),events});
 }
 return {opening_card_envelope_cents:openingCardEnvelope,card_envelope_funds:openingCardFunds,days,rows:rows.sort((a,b)=>a.date.localeCompare(b.date)||a.description.localeCompare(b.description,'fr')),warnings,since};
}

// Resolve suggested transfers against actual payments before exposing the final
// projection. Re-running the pure simulation never writes to the bank ledger.
export function buildForecast(args){
 const plans=args.cardPaymentPlans||[],automatic=new Set(plans.filter(p=>p.mode==='purchases').map(p=>p.recurring_id));
 if(!automatic.size){const result=buildBaseForecast(args);annotate(result,args);return result;}
 const base=buildBaseForecast({...args,recurring:args.recurring.map(r=>automatic.has(r.id)?{...r,active:0}:r)}),skeleton=buildBaseForecast(args);
 let result=null,calculation,last=null,stable=false;
 const count=skeleton.rows.filter(r=>automatic.has(r.recurring_id)).length;
 for(let i=0;i<count+3;i++){
  calculation=deriveCardPayments(args,base,skeleton,result);
  const signature=JSON.stringify(calculation.overrides);
  result=buildBaseForecast({...args,overrides:[...calculation.overrides,...(args.overrides||[])]});
  if(signature===last){stable=true;break;}last=signature;
 }
 for(const row of result.rows){const info=calculation.metadata.get(row.key);if(info){Object.assign(row,info);row.modified=skeleton.rows.find(r=>r.key===row.key)?.modified||false;}}
 if(!stable)result.warnings.push({code:'card_payment_review',message:'Certains remboursements de carte restent ambigus. Associez les virements réels avant de vous fier aux propositions.'});
 annotate(result,args);return result;
}
function annotate(result,args){
 const plans=args.cardPaymentPlans||[],used=new Set([...result.rows.flatMap(r=>r.actual_ids),...(args.links||[]).map(l=>l.actual_type+':'+l.actual_id)]);
 for(const row of result.rows){const plan=plans.find(p=>p.recurring_id===row.recurring_id);if(plan){row.card_payment_mode=plan.mode;row.card_account_id=plan.card_account_id;if(['planned','pending'].includes(row.status)){row.unmatched_payment_ids=(args.transfers||[]).filter(t=>!used.has('transfer:'+t.id)&&t.from_account_id===row.account_id&&t.to_account_id===row.to_account_id&&Math.abs(Date.parse(t.happened_on)-Date.parse(row.date))<=3*86400000).map(t=>t.id);if(row.unmatched_payment_ids.length)result.warnings.push({code:'card_payment_match',card_account_id:plan.card_account_id,message:row.description+' : un virement réel est à vérifier. Associez-le dans À confirmer pour éviter un deuxième paiement prévu.'});}}}
 // Events carry the same explanation as their occurrence in the review list.
 const byKey=new Map(result.rows.map(r=>[r.key,r]));for(const day of result.days)for(const event of day.events){const row=byKey.get(event.key);if(row?.card_payment_mode){event.modified=row.modified;event.card_payment_mode=row.card_payment_mode;event.card_account_id=row.card_account_id;}}
}
