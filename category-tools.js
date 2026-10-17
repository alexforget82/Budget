import {createHash} from 'node:crypto';
export const normalizeCategory=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA').replace(/\s+/g,' ').trim();
export const isUncategorizedName=name=>normalizeCategory(name).replace(/[-‐‑–—]/g,' ').replace(/\s+/g,' ')==='non categorise';
export const lunchMoneyGroups=[
 {name:'Revenus',categories:['Salaire Alex','Salaire Jenny','Allocation canadienne pour enfants','Allocation famille','Rente RRQ','Rente FRV',"Remboursement d'assurance", "Remboursement d'impôt",'Autres revenus']},
 {name:'Dépenses fixes',categories:['Frais bancaires','Hydro-Québec','Ligne de crédit','Marge de crédit','REEE','MNP','Pension alimentaire','Cellulaires','TELUS','IPTV','Abonnements numériques','Assurances Vie','Assurances Auto','Assurance Habitation','Paiement auto','Permis et Plaque','Garderie','Taxes (municipales et scolaires)']},
 {name:'Dépenses variables',categories:['Anaïs : Dépenses personnelles','Essence Alex','Essence Jenny','Epicerie','Restaurant','Couches et Lait','Médicaments','Pharmacie']},
 {name:'Dépenses non mensuelles',categories:['Piscine et terrassement','Vêtements','Electroniques','Scolarité','Activités','Meubles et fournitures','Quincaillerie et outils','Essentiel pour la maison','Santé : Rendez-vous et achats','Auto : Entretien et pièces','Maison : Entretien et amélioration']},
 {name:'Transfert',categories:['Ajustement de solde','Paiement de carte de crédit','Transfert entre comptes']}
];
export function createCategoryTools({db,atomic,exportBackup,today}){
 const q=(sql,...a)=>db.prepare(sql).all(...a),run=(sql,...a)=>db.prepare(sql).run(...a);
 const parent=id=>q('SELECT * FROM categories WHERE id=?',Number(id))[0];
 function subcategoryId(value,category,allowArchived=false){if(value===null||value===undefined||value==='')return null;const id=Number(value),s=q('SELECT * FROM subcategories WHERE id=?',id)[0];if(!Number.isSafeInteger(id)||!s||s.category_id!==category||(!allowArchived&&(s.archived||parent(category)?.archived)))throw Error('Sous-catégorie introuvable, archivée ou associée à une autre catégorie.');return id;}
 function mergePreview(x){
  const source=parent(x.source_id),target=parent(x.target_id);if(!source||!target||source.id===target.id||target.archived)throw Error('Choisissez deux catégories différentes et une destination active.');
  const children=q('SELECT * FROM subcategories WHERE category_id=?',source.id),destination=q('SELECT * FROM subcategories WHERE category_id=?',target.id),mapping=children.map(s=>({id:s.id,name:s.name,archived:s.archived,target_id:destination.find(t=>normalizeCategory(t.name)===normalizeCategory(s.name))?.id||null}));
  const sourceLimit=q('SELECT limit_cents FROM category_budgets WHERE category_id=?',source.id)[0]?.limit_cents??null,targetLimit=q('SELECT limit_cents FROM category_budgets WHERE category_id=?',target.id)[0]?.limit_cents??null,limit=sourceLimit===null?targetLimit:(targetLimit||0)+sourceLimit;
  if(limit!==null&&(!Number.isSafeInteger(limit)||limit>1e12))throw Error('Plafond combiné trop élevé.');
  return {source,target,mapping,count:q('SELECT COUNT(*) n FROM transactions WHERE category_id=?',source.id)[0].n,source_limit_cents:sourceLimit,target_limit_cents:targetLimit,combined_limit_cents:limit,token:createHash('sha256').update(JSON.stringify([exportBackup().tables,today(),source.id,target.id])).digest('hex')};
 }
 const groupKey='category_groups_v511';
 function catalog(){let assignments={};try{const value=JSON.parse(q('SELECT value FROM app_settings WHERE key=?',groupKey)[0]?.value||'{}');if(value&&typeof value==='object'&&!Array.isArray(value))for(const [id,group] of Object.entries(value))if(/^\d+$/.test(id)&&lunchMoneyGroups.some(g=>g.name===group))assignments[id]=group;}catch{}return {groups:lunchMoneyGroups.map(g=>g.name),assignments};}
 function saveGroups(assignments){run('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',groupKey,JSON.stringify(assignments));}
 function catalogPreview(){
  const catalogName=value=>normalizeCategory(value).replace(/[’‘]/g,"'"),categories=q('SELECT * FROM categories'),children=q('SELECT * FROM subcategories'),aliases={'Restaurant':['Restaurants'],'Essentiel pour la maison':['Essentiels pour la maison']},names=['Conjoint','Jenny','Alex'];
  const rows=lunchMoneyGroups.flatMap(group=>group.categories.map(name=>{const existing=categories.find(c=>catalogName(c.name)===catalogName(name))||categories.find(c=>(aliases[name]||[]).some(a=>catalogName(c.name)===catalogName(a)));return {name,group:group.name,existing_id:existing?.id||null,existing_name:existing?.name||null,action:existing?(existing.archived?'reactivate':'reuse'):'create',children:name==='Frais bancaires'?names.map(child=>{const old=children.find(c=>c.category_id===existing?.id&&normalizeCategory(c.name)===normalizeCategory(child));return {name:child,existing_id:old?.id||null,action:old?(old.archived?'reactivate':'reuse'):'create'};}):[]};}));
  return {rows,create_count:rows.filter(r=>r.action==='create').length,reuse_count:rows.filter(r=>r.action==='reuse').length,reactivate_count:rows.filter(r=>r.action==='reactivate').length,token:createHash('sha256').update(JSON.stringify([exportBackup().tables,today(),rows])).digest('hex')};
 }
 function deletionPreview(x){
  const source=parent(x.id),target=x.target_id?parent(x.target_id):null;if(!source||isUncategorizedName(source.name)||x.target_id&&(!target||target.archived||target.id===source.id))throw Error('Choisissez une catégorie à supprimer et une destination active différente. Non-catégorisé reste disponible.');
  const merge=target?mergePreview({source_id:source.id,target_id:target.id}):null;let rules=[];try{rules=JSON.parse(q("SELECT value FROM app_settings WHERE key='v50_rules'")[0]?.value||'[]');}catch{}if(!Array.isArray(rules))rules=[];
  return {source,target,mapping:merge?.mapping||[],count:q('SELECT COUNT(*) n FROM transactions WHERE category_id=?',source.id)[0].n,children:q('SELECT COUNT(*) n FROM subcategories WHERE category_id=?',source.id)[0].n,rules_count:rules.filter(r=>r&&Number(r.category_id)===source.id).length,source_limit_cents:q('SELECT limit_cents FROM category_budgets WHERE category_id=?',source.id)[0]?.limit_cents??null,combined_limit_cents:merge?.combined_limit_cents??null,token:createHash('sha256').update(JSON.stringify([exportBackup().tables,today(),'delete',source.id,target?.id||null])).digest('hex')};
 }
 function deleteCategory(x){
  const p=deletionPreview(x);if(x.token!==p.token||x.confirm!==true)throw Error('Le budget a changé ou la confirmation manque. Recommencez l’aperçu.');
  atomic(()=>{
   const children=new Map();if(p.target){for(const sub of p.mapping){const id=sub.target_id||Number(run('INSERT INTO subcategories(category_id,name,archived) VALUES(?,?,?)',p.target.id,sub.name,sub.archived).lastInsertRowid);children.set(sub.id,id);run('UPDATE transactions SET subcategory_id=? WHERE category_id=? AND subcategory_id=?',id,p.source.id,sub.id);}run('UPDATE transactions SET category_id=? WHERE category_id=?',p.target.id,p.source.id);}else run('UPDATE transactions SET category_id=NULL,subcategory_id=NULL WHERE category_id=?',p.source.id);
   const raw=q("SELECT value FROM app_settings WHERE key='v50_rules'")[0];if(raw){let rules;try{rules=JSON.parse(raw.value);}catch{}if(Array.isArray(rules)&&rules.some(r=>r&&Number(r.category_id)===p.source.id)){for(const r of rules)if(r&&Number(r.category_id)===p.source.id){r.category_id=p.target?.id||null;r.subcategory_id=p.target?(children.get(r.subcategory_id)||null):null;if(!p.target)r.active=false;}run("UPDATE app_settings SET value=? WHERE key='v50_rules'",JSON.stringify(rules));}}
   run('DELETE FROM category_budgets WHERE category_id=?',p.source.id);if(p.target&&p.combined_limit_cents!==null)run('INSERT INTO category_budgets(category_id,limit_cents) VALUES(?,?) ON CONFLICT(category_id) DO UPDATE SET limit_cents=excluded.limit_cents',p.target.id,p.combined_limit_cents);
   run('DELETE FROM subcategories WHERE category_id=?',p.source.id);run('DELETE FROM categories WHERE id=?',p.source.id);const assignments=catalog().assignments;delete assignments[p.source.id];saveGroups(assignments);
  });
 }
 function bulkDeletionPreview(){
  const categories=q('SELECT * FROM categories').filter(c=>!isUncategorizedName(c.name)),ids=new Set(categories.map(c=>c.id));let rules=[];try{rules=JSON.parse(q("SELECT value FROM app_settings WHERE key='v50_rules'")[0]?.value||'[]');}catch{}if(!Array.isArray(rules))rules=[];
  return {categories,count:categories.length,transactions:q('SELECT category_id,COUNT(*) n FROM transactions GROUP BY category_id').filter(r=>ids.has(r.category_id)).reduce((n,r)=>n+r.n,0),children:q('SELECT category_id FROM subcategories').filter(r=>ids.has(r.category_id)).length,limits:q('SELECT category_id FROM category_budgets').filter(r=>ids.has(r.category_id)).length,rules_count:rules.filter(r=>r&&ids.has(Number(r.category_id))).length,token:createHash('sha256').update(JSON.stringify([exportBackup().tables,today(),'delete-all-categories'])).digest('hex')};
 }
 function bulkDelete(x){
  const p=bulkDeletionPreview();if(x.token!==p.token||x.confirm!==true||!p.count)throw Error('Confirmez un aperçu actuel avec des catégories à supprimer.');
  atomic(()=>{const ids=new Set(p.categories.map(c=>c.id));for(const id of ids){run('UPDATE transactions SET category_id=NULL,subcategory_id=NULL WHERE category_id=?',id);run('DELETE FROM category_budgets WHERE category_id=?',id);run('DELETE FROM subcategories WHERE category_id=?',id);run('DELETE FROM categories WHERE id=?',id);}
   const raw=q("SELECT value FROM app_settings WHERE key='v50_rules'")[0];if(raw){let rules;try{rules=JSON.parse(raw.value);}catch{}if(Array.isArray(rules)&&rules.some(r=>r&&ids.has(Number(r.category_id)))){for(const r of rules)if(r&&ids.has(Number(r.category_id))){r.category_id=null;r.subcategory_id=null;r.active=false;}run("UPDATE app_settings SET value=? WHERE key='v50_rules'",JSON.stringify(rules));}}saveGroups({});
  });
 }
 function post(route,x){
  if(route==='/api/categories/delete-all-preview')return bulkDeletionPreview();
  if(route==='/api/categories/delete-all')return bulkDelete(x);
  if(route==='/api/categories/delete-preview')return deletionPreview(x);
  if(route==='/api/categories/delete')return deleteCategory(x);
  if(route==='/api/categories/catalog-preview')return catalogPreview();
  if(route==='/api/categories/catalog-apply'){
   const preview=catalogPreview();if(x.token!==preview.token)throw Error('Le budget a changé depuis l’aperçu. Recommencez.');
   atomic(()=>{const assignments=catalog().assignments;for(const row of preview.rows){const id=row.existing_id||Number(run('INSERT INTO categories(name) VALUES(?)',row.name).lastInsertRowid);if(row.action==='reactivate')run('UPDATE categories SET archived=0 WHERE id=?',id);assignments[id]=row.group;for(const child of row.children){if(child.existing_id){if(child.action==='reactivate')run('UPDATE subcategories SET archived=0 WHERE id=?',child.existing_id);}else run('INSERT INTO subcategories(category_id,name) VALUES(?,?)',id,child.name);}}saveGroups(assignments);});return;
  }
  if(route==='/api/categories/group'){
   const c=parent(x.id);if(!c||!(x.group===null||lunchMoneyGroups.some(g=>g.name===x.group)))throw Error('Catégorie ou groupe invalide.');const assignments=catalog().assignments;if(x.group===null)delete assignments[c.id];else assignments[c.id]=x.group;saveGroups(assignments);return;
  }
  if(route==='/api/categories/merge-preview')return mergePreview(x);
  if(route==='/api/categories/merge'){
   const p=mergePreview(x);if(x.token!==p.token)throw Error('Le budget a changé depuis l’aperçu. Recommencez.');
   atomic(()=>{for(const s of p.mapping){let id=s.target_id;if(!id)id=Number(run('INSERT INTO subcategories(category_id,name,archived) VALUES(?,?,?)',p.target.id,s.name,s.archived).lastInsertRowid);run('UPDATE transactions SET subcategory_id=? WHERE category_id=? AND subcategory_id=?',id,p.source.id,s.id);}run('UPDATE transactions SET category_id=? WHERE category_id=?',p.target.id,p.source.id);run('UPDATE categories SET archived=1 WHERE id=?',p.source.id);run('DELETE FROM category_budgets WHERE category_id=?',p.source.id);if(p.combined_limit_cents!==null)run('INSERT INTO category_budgets(category_id,limit_cents) VALUES(?,?) ON CONFLICT(category_id) DO UPDATE SET limit_cents=excluded.limit_cents',p.target.id,p.combined_limit_cents);});return;
  }
  if(route==='/api/categories/archive'){
   const c=parent(x.id);if(!c||typeof x.archived!=='boolean'||x.expected_archived!==c.archived)throw Error('Catégorie modifiée. Actualisez et réessayez.');run('UPDATE categories SET archived=? WHERE id=?',x.archived?1:0,c.id);return;
  }
  if(route==='/api/subcategories'||route==='/api/subcategories/update'){
   const name=typeof x.name==='string'?x.name.trim():'',category=parent(x.category_id),id=route.endsWith('/update')?Number(x.id):null,old=id?q('SELECT * FROM subcategories WHERE id=?',id)[0]:null;
   if(!name||name.length>60||!category||category.archived||route.endsWith('/update')&&(!Number.isSafeInteger(id)||id<1||!old||old.category_id!==category.id||x.expected_name!==old.name))throw Error('Nom, catégorie ou sous-catégorie invalide ou modifiée.');
   if(q('SELECT * FROM subcategories WHERE category_id=?',category.id).some(s=>s.id!==id&&normalizeCategory(s.name)===normalizeCategory(name)))throw Error('Cette sous-catégorie existe déjà dans cette catégorie.');
   if(id)run('UPDATE subcategories SET name=? WHERE id=?',name,id);else run('INSERT INTO subcategories(category_id,name) VALUES(?,?)',category.id,name);return;
  }
  if(route==='/api/subcategories/archive'){const s=q('SELECT * FROM subcategories WHERE id=?',Number(x.id))[0];if(!s||typeof x.archived!=='boolean'||x.expected_archived!==s.archived)throw Error('Sous-catégorie modifiée. Actualisez.');run('UPDATE subcategories SET archived=? WHERE id=?',x.archived?1:0,s.id);return;}
  throw Error('Action inconnue.');
 }
 return {post,subcategoryId,catalog};
}
