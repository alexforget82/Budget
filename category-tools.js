import {createHash} from 'node:crypto';
export const normalizeCategory=value=>String(value).normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr-CA').replace(/\s+/g,' ').trim();
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
 function post(route,x){
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
 return {post,subcategoryId};
}
