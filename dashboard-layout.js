import {createHash} from 'node:crypto';
export const dashboardBlocks=['summary','spending','alerts','forecast','envelopes','upcoming'];
export const dashboardSetting=key=>/^dashboard_v47_(desktop|mobile)$/.test(key)||key==='appearance_theme_v50';
export const defaultDashboardLayout=device=>dashboardBlocks.map(id=>({id,visible:true,width:device==='desktop'&&['summary','spending','alerts','forecast'].includes(id)?'full':'normal'}));
export function validateDashboardLayout(layout){
 if(!Array.isArray(layout)||layout.length!==dashboardBlocks.length||new Set(layout.map(b=>b?.id)).size!==dashboardBlocks.length||layout.some(b=>!b||!dashboardBlocks.includes(b.id)||typeof b.visible!=='boolean'||!['normal','full'].includes(b.width)||Object.keys(b).some(k=>!['id','visible','width'].includes(k))))throw Error('Disposition invalide : conservez chaque bloc une seule fois.');
 return layout.map(({id,visible,width})=>({id,visible,width}));
}
export function createDashboardLayout({db,atomic}){
 const key=device=>'dashboard_v47_'+device;
 function read(device){const raw=db.prepare('SELECT value FROM app_settings WHERE key=?').get(key(device))?.value??null;let layout;try{layout=validateDashboardLayout(JSON.parse(raw));}catch{layout=defaultDashboardLayout(device);}return {layout,revision:createHash('sha256').update(JSON.stringify(raw)).digest('hex')};}
 function state(){return {desktop:read('desktop'),mobile:read('mobile')};}
 function save(x){
  if(!['desktop','mobile'].includes(x.device)||typeof x.expected_revision!=='string')throw Error('Choisissez une disposition ordinateur ou téléphone.');const layout=validateDashboardLayout(x.layout);
  atomic(()=>{if(x.expected_revision!==read(x.device).revision){const error=Error('Cette disposition a été modifiée ailleurs. Choisissez la version à conserver.');error.code='LAYOUT_CONFLICT';throw error;}db.prepare('INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key(x.device),JSON.stringify(layout));});return state();
 }
 return {state,save};
}
