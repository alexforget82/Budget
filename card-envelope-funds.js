// Only purchases explicitly assigned to an envelope are protected here.
// Opening card debt and historical imports never create an allocation.
export function createCardEnvelopeFunds({accounts=[],envelopes=[],transactions=[],transfers=[],today}) {
 const cards=new Set(accounts.filter(a=>a.kind==='credit').map(a=>a.id)),lots=[];
 const externalAllowances=new Set(envelopes.filter(e=>e.forecast_spend&&accounts.some(a=>a.id===e.forecast_account_id&&a.kind!=='credit'&&!a.included)&&accounts.filter(a=>a.included&&a.kind!=='credit').length===1).map(e=>e.id));
 function charge(cardId,envelopeId,amount){if(cards.has(cardId)&&envelopeId&&!externalAllowances.has(envelopeId)&&amount>0)lots.push({card_account_id:cardId,envelope_id:envelopeId,amount_cents:amount});}
 function pay(cardId,amount){let left=Math.max(0,amount),released=0;for(const lot of lots){if(lot.card_account_id!==cardId||!left)continue;const part=Math.min(left,lot.amount_cents);lot.amount_cents-=part;left-=part;released+=part;}return released;}
 // Without timestamps, same-day purchases are funded before same-day payments.
 const events=[...transactions.filter(t=>cards.has(t.account_id)&&t.affects_balance!==0&&(!today||t.happened_on<=today)).map(t=>({on:t.happened_on,order:t.amount_cents<0?0:1,id:t.id,transaction:t})),...transfers.filter(t=>cards.has(t.to_account_id)&&(!today||t.happened_on<=today)).map(t=>({on:t.happened_on,order:2,id:t.id,transfer:t}))].sort((a,b)=>a.on.localeCompare(b.on)||a.order-b.order||a.id-b.id);
 for(const event of events){const t=event.transaction;if(t){if(t.amount_cents<0)charge(t.account_id,t.envelope_id,-t.amount_cents);else pay(t.account_id,t.amount_cents);}else pay(event.transfer.to_account_id,event.transfer.amount_cents);}
 // A reconciled zero/credit card balance cannot still require bank funding.
 for(const a of accounts)if(cards.has(a.id)&&Number.isSafeInteger(a.balance_cents)){const total=lots.filter(l=>l.card_account_id===a.id).reduce((n,l)=>n+l.amount_cents,0);pay(a.id,Math.max(0,total-Math.max(0,a.balance_cents)));}
 const entries=()=>{const groups=new Map();for(const lot of lots)if(lot.amount_cents){const key=lot.card_account_id+'|'+lot.envelope_id,entry=groups.get(key)||{card_account_id:lot.card_account_id,envelope_id:lot.envelope_id,amount_cents:0};entry.amount_cents+=lot.amount_cents;groups.set(key,entry);}return [...groups.values()];};
 return {charge,pay,entries,isExternalAllowance:id=>externalAllowances.has(id),total:()=>lots.reduce((n,l)=>n+l.amount_cents,0)};
}
export const cardEnvelopeTotal=args=>createCardEnvelopeFunds(args).total();

// An early purchase already protected on its card must not be allocated again
// when its envelope's period starts. Explicit period associations take priority.
export function earlyCardEnvelopePurchases({accounts=[],transactions=[],envelopeLinks=[]},envelope,on) {
 const cards=new Set(accounts.filter(a=>a.kind==='credit').map(a=>a.id)),links=new Map(envelopeLinks.map(l=>[l.transaction_id,l]));
 return transactions.filter(t=>t.envelope_id===envelope.id&&cards.has(t.account_id)&&t.affects_balance!==0&&t.amount_cents<0&&t.happened_on<on&&(links.has(t.id)?links.get(t.id).occurrence_on===on:envelope.start_on===on&&t.happened_on>=(envelope.planning_since||t.happened_on))).reduce((n,t)=>n+Math.max(0,-t.amount_cents-(envelope.rollover?(t.envelope_effect_cents||0):0)),0);
}
