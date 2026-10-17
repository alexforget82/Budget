// Per-user macOS service. The installed copy owns the stable data directory.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const source=path.dirname(fileURLToPath(import.meta.url)),label='ca.monbudget.private',home=os.homedir();
export const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function servicePlist(node,root,logs){return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(node)}</string><string>${xml(path.join(root,'mac-service.js'))}</string><string>run</string></array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>15</integer><key>ExitTimeOut</key><integer>20</integer>
<key>StandardOutPath</key><string>${xml(path.join(logs,'budget.log'))}</string>
<key>StandardErrorPath</key><string>${xml(path.join(logs,'budget-error.log'))}</string>
</dict></plist>\n`;}
function command(exe,args,allowFailure=false){const r=spawnSync(exe,args,{encoding:'utf8'});if(r.error)throw r.error;if(r.status&&!allowFailure)throw Error((r.stderr||r.stdout||exe+' a échoué').trim());return r;}
async function status(){try{const r=await fetch('http://127.0.0.1:3030/api/private/status',{signal:AbortSignal.timeout(1500)});return r.ok?await r.json():null;}catch{return null;}}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 if(process.platform!=='darwin')throw Error('Ce lanceur nécessite macOS.');
 const action=process.argv[2],root=path.join(home,'Library','Application Support','Mon Budget'),logs=path.join(home,'Library','Logs','Mon Budget'),agents=path.join(home,'Library','LaunchAgents'),plist=path.join(agents,label+'.plist'),domain='gui/'+process.getuid(),service=domain+'/'+label;
 if(action==='run'){
  const child=spawn(process.execPath,[path.join(source,'server.js')],{cwd:source,stdio:'inherit',env:{...process.env,PORT:'3030'}});
  const awake=spawn('/usr/bin/caffeinate',['-i','-w',String(child.pid)],{stdio:'ignore'});awake.on('error',e=>console.error(e.message));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
  child.on('error',e=>{console.error(e.message);awake.kill();process.exitCode=1;});
  child.on('exit',code=>{awake.kill();process.exitCode=code||0;});return;
 }
 if(action==='stop'){
  const loaded=command('/bin/launchctl',['print',service],true).status===0;
  if(loaded)command('/bin/launchctl',['bootout',service]);
  if(fs.existsSync(plist))fs.unlinkSync(plist);
  console.log('Démarrage automatique désactivé. Le budget est arrêté. Vos données sont conservées dans '+root+'/data');return;
 }
 if(action!=='install')throw Error('Action attendue : install, stop ou run.');
 const major=Number(process.versions.node.split('.')[0]);if(major<22||(major===22&&Number(process.versions.node.split('.')[1])<13))throw Error('Node.js 22.13 ou plus est requis.');
 // Never stop an arbitrary Node process or a server from another budget folder.
 const loaded=command('/bin/launchctl',['print',service],true).status===0;
 const running=await status(),targetKey=createHash('sha256').update(path.join(root,'data')).digest('hex');
 if(running&&(!loaded||running.data_key!==targetKey))throw Error('Un budget est déjà ouvert dans une fenêtre Terminal. Arrêtez-le avec Control + C dans cette fenêtre, puis relancez cette installation. Tailscale peut rester connecté.');
 const existingData=path.join(root,'data','budget.sqlite'),incomingData=path.join(source,'data','budget.sqlite');
 if(!fs.existsSync(existingData)&&!fs.existsSync(incomingData))throw Error('Placez votre dossier data actuel à côté de ce fichier avant la première installation. Aucun budget vide n’a été créé.');
 if(loaded){command('/bin/launchctl',['bootout',service]);for(let i=0;i<50&&await status();i++)await delay(200);if(await status())throw Error('Le serveur précédent ne s’est pas arrêté. Aucune mise à jour effectuée.');}
 fs.mkdirSync(root,{recursive:true,mode:0o700});fs.mkdirSync(logs,{recursive:true,mode:0o700});fs.mkdirSync(agents,{recursive:true,mode:0o700});
 const data=path.join(root,'data');
 if(!fs.existsSync(existingData)){
  if(fs.existsSync(data))throw Error('Un dossier data incomplet existe dans '+root+'. Vos fichiers n’ont pas été fusionnés; conservez-les avant de réessayer.');
  if(fs.existsSync(path.join(source,'data')))fs.cpSync(path.join(source,'data'),data,{recursive:true,errorOnExist:true,force:false});
  else throw Error('Placez votre dossier data actuel à côté de ce fichier avant la première installation. Aucun budget vide n’a été créé.');
 }
 // VACUUM INTO includes committed WAL data and leaves a coherent recovery copy.
 if(fs.existsSync(path.join(data,'budget.sqlite'))){
  const {DatabaseSync}=await import('node:sqlite'),db=new DatabaseSync(path.join(data,'budget.sqlite'));const backups=path.join(data,'backups');fs.mkdirSync(backups,{recursive:true,mode:0o700});
  try{db.prepare('VACUUM INTO ?').run(path.join(backups,'budget-before-service-update-'+Date.now()+'.sqlite'));}finally{db.close();}
 }
 if(source!==root){for(const name of fs.readdirSync(source)){if(/\.(js|html|css)$/.test(name)||name==='package.json'||name==='Acces prive iPhone.command')fs.copyFileSync(path.join(source,name),path.join(root,name));}}
 // Reuse the same identity and Serve conflict checks as the interactive launcher.
 const prepare=spawnSync('/bin/bash',[path.join(root,'Acces prive iPhone.command'),'--prepare-service'],{cwd:root,stdio:'inherit'});if(prepare.status!==0)throw Error('Configuration Tailscale incomplète. Relancez l’installation après avoir corrigé le message ci-dessus.');
 fs.writeFileSync(plist,servicePlist(process.execPath,root,logs),{mode:0o600});
 command('/bin/launchctl',['enable',service]);command('/bin/launchctl',['bootstrap',domain,plist]);
 const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'))).version;let ready;
 for(let i=0;i<60;i++){const s=await status();if(s?.data_key===targetKey&&s.version===version&&s.enabled){ready=s;break;}await delay(200);}
 if(!ready)throw Error('Le service est installé mais ne répond pas. Consultez '+path.join(logs,'budget-error.log')+'.');
 console.log('\nMon Budget '+version+' fonctionne en arrière-plan. Vous pouvez fermer Terminal.');
 console.log('Démarrage automatique à chaque ouverture de session Mac.');console.log('Données utilisées : '+data);console.log('Accès iPhone : '+ready.origin);
 console.log('Gardez Tailscale connecté, le Mac allumé et le couvercle ouvert.');command('/usr/bin/open',[ready.origin],true);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error('\n'+e.message);process.exitCode=1;});
