// Calendar-based targets: never use rounded monthly averages.
export const budgetFrequencies=['weekly','biweekly','monthly','quarterly','semiannual','yearly'];
export const frequencyNames={weekly:'Chaque semaine',biweekly:'Aux 2 semaines',monthly:'Chaque mois',quarterly:'Aux 3 mois',semiannual:'Aux 6 mois',yearly:'Chaque année'};
export const monthEnd=month=>new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0,12)).toISOString().slice(0,10);
export function budgetDates(plan,from,to,nextOccurrence){
 const out=[];if(!plan||!budgetFrequencies.includes(plan.frequency)||!plan.start_on)return out;
 const end=plan.repeat_monthly===false&&monthEnd(plan.from_month||plan.start_on.slice(0,7))<to?monthEnd(plan.from_month||plan.start_on.slice(0,7)):to;
 for(let i=0;i<20000;i++){const date=nextOccurrence(plan.start_on,plan.frequency,i);if(date>end)break;if(date>=from)out.push({date,amount_cents:plan.period_amount_cents});}return out;
}
export function envelopeBudgetDates(envelope,from,to,nextOccurrence){
 if(!envelope.budget_schedules)return budgetDates({frequency:envelope.frequency,start_on:envelope.start_on,period_amount_cents:envelope.budget_cents,repeat_monthly:true},from,to,nextOccurrence);
 const plans=[...envelope.budget_schedules].sort((a,b)=>a.from_month.localeCompare(b.from_month)),out=[];
 for(let i=0;i<plans.length;i++)for(const item of budgetDates(plans[i],from,to,nextOccurrence))if(item.date>=plans[i].from_month+'-01'&&(!plans[i+1]||item.date<plans[i+1].from_month+'-01'))out.push(item);
 return out.sort((a,b)=>a.date.localeCompare(b.date));
}
