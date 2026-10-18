// Sillage's review and comparison views read the existing ledger; no second balance model.
export function createProWorkspace({db,today,support,forecast}){
 const q=(sql,...a)=>db.prepare(sql).all(...a);
 function overview(month,account){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month||''))throw Error('Mois invalide.');
  const id=account?Number(account):null;if(id!==null&&(!Number.isSafeInteger(id)||!q('SELECT id FROM accounts WHERE id=?',id).length))throw Error('Compte introuvable.');
  const end=new Date(month+'-01T12:00:00Z'),months=[];
  for(let i=5;i>=0;i--){const d=new Date(end);d.setUTCMonth(d.getUTCMonth()-i);const m=d.toISOString().slice(0,7),filter='substr(happened_on,1,7)=?'+(id?' AND account_id=?':''),args=id?[m,id]:[m];const totals=q('SELECT COUNT(*) count,COALESCE(SUM(CASE WHEN amount_cents>0 THEN amount_cents ELSE 0 END),0) income_cents,COALESCE(SUM(CASE WHEN amount_cents<0 THEN -amount_cents ELSE 0 END),0) expense_cents FROM transactions WHERE '+filter,...args)[0];months.push({month:m,...totals,net_cents:totals.income_cents-totals.expense_cents});}
  const current=months.at(-1),previous=months.at(-2),cats=m=>q("SELECT t.category_id,COALESCE(c.name,'Non-catégorisé') name,SUM(CASE WHEN t.amount_cents<0 THEN -t.amount_cents ELSE 0 END) expense_cents FROM transactions t LEFT JOIN categories c ON c.id=t.category_id WHERE substr(t.happened_on,1,7)=?"+(id?' AND t.account_id=?':'')+' GROUP BY t.category_id',...(id?[m,id]:[m]));
  const a=cats(month),b=cats(previous.month),keys=new Set([...a,...b].map(c=>c.category_id)),changes=[...keys].map(key=>{const now=a.find(c=>c.category_id===key),before=b.find(c=>c.category_id===key);return {category_id:key,name:(now||before).name,current_cents:now?.expense_cents||0,previous_cents:before?.expense_cents||0,delta_cents:(now?.expense_cents||0)-(before?.expense_cents||0)};}).sort((a,b)=>Math.abs(b.delta_cents)-Math.abs(a.delta_cents));
  const queue=where=>({count:q('SELECT COUNT(*) n FROM transactions WHERE '+where)[0].n,items:q("SELECT t.*,a.name account_name FROM transactions t JOIN accounts a ON a.id=t.account_id WHERE "+where+' ORDER BY happened_on DESC,t.id DESC LIMIT 20')});
  const duplicates=q("SELECT account_id,happened_on,amount_cents,MIN(description) description,COUNT(*) count FROM transactions GROUP BY account_id,happened_on,amount_cents,LOWER(TRIM(description)) HAVING COUNT(*)>1 ORDER BY happened_on DESC LIMIT 50");
  return {month,months,current,previous,changes,partial:month===today().slice(0,7),future:month>today().slice(0,7),review:{unreviewed:queue('reviewed=0'),uncategorized:queue('category_id IS NULL'),duplicates,duplicates_limit:50,due:forecast().rows.filter(r=>r.date<=today()&&['planned','pending'].includes(r.status)&&r.remaining_cents>0),...support.state()}};
 }
 function transaction(id){if(!Number.isSafeInteger(Number(id))||Number(id)<1)throw Error('Opération invalide.');const row=q("SELECT t.*,a.name account_name,a.kind account_kind,COALESCE(c.name,'Non-catégorisé') category_name,s.name subcategory_name,e.name envelope_name FROM transactions t JOIN accounts a ON a.id=t.account_id LEFT JOIN categories c ON c.id=t.category_id LEFT JOIN subcategories s ON s.id=t.subcategory_id LEFT JOIN envelopes e ON e.id=t.envelope_id WHERE t.id=?",Number(id))[0];if(!row)throw Error('Opération introuvable.');return row;}
 return {overview,transaction};
}
