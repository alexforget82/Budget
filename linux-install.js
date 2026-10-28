// Per-user Linux/ChromeOS installation. Code and finances live in separate directories.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {copyReleaseFiles} from './mac-service.js';
import {validateUpdateFolder} from './mac-update.js';
const source=path.dirname(fileURLToPath(import.meta.url));
export const unitQuote=value=>'"'+String(value).replace(/%/g,'%%').replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/\$/g,()=>'$$')+'"';
export function linuxUnit(node,root){return `[Unit]\nDescription=Sillage 2\nAfter=network.target\n\n[Service]\nType=simple\nWorkingDirectory=${unitQuote(root)}\nExecStart=${unitQuote(node)} ${unitQuote(path.join(root,'app','server.js'))}\nRestart=on-failure\nRestartSec=5\n\n[Install]\nWantedBy=default.target\n`;}
function run(args,allowFailure=false){const r=spawnSync('systemctl',['--user',...args],{encoding:'utf8'});if((r.error||r.status!==0)&&!allowFailure)throw Error(r.error?.message||(r.stderr||r.stdout||'systemctl a échoué').trim());return r.status===0;}
export function chooseData({root,home,importData,newBudget=false}){
 const live=path.join(root,'data');
 if(fs.existsSync(path.join(live,'budget.sqlite'))) {
  if(importData||newBudget)throw Error('Un budget existe déjà. Restaurez un fichier depuis Sauvegardes; l’installateur ne le remplacera pas.');
  return null;
 }
 if(fs.existsSync(live))throw Error('Le dossier de données existe mais est incomplet. Conservez-le avant de réessayer.');
 const candidates=importData?[path.resolve(importData)]:[path.join(home,'Applications','Budget-15.0.0','data'),path.join(home,'Applications','Budget-14.5.0','data')].filter(p=>fs.existsSync(path.join(p,'budget.sqlite')));
 if(candidates.length>1)throw Error('Plusieurs anciens budgets existent. Précisez --import-data suivi du dossier data à conserver.');
 if(candidates.length===1){if(!fs.existsSync(path.join(candidates[0],'budget.sqlite')))throw Error('Ce dossier ne contient pas budget.sqlite.');return candidates[0];}
 if(!newBudget)throw Error('Aucun budget trouvé. Utilisez --import-data /chemin/vers/data, ou --new pour un budget vide à restaurer ensuite depuis un JSON.');
 return null;
}
export async function installLinux({release=source,home=os.homedir(),importData,newBudget=false,command=run,probe=async()=>{try{return (await fetch('http://127.0.0.1:3030/api/state',{signal:AbortSignal.timeout(1000)})).ok;}catch{return false;}},ready=async(version)=>{for(let n=0;n<40;n++){try{const r=await fetch('http://127.0.0.1:3030/api/state',{signal:AbortSignal.timeout(1000)});if(r.ok&&(await r.json()).version===version)return true;}catch{}await new Promise(r=>setTimeout(r,250));}return false;}}={}) {
 const root=path.join(home,'.local','share','sillage'),app=path.join(root,'app'),previous=path.join(root,'app.previous'),unitDir=path.join(home,'.config','systemd','user'),unit=path.join(unitDir,'sillage.service');
 const current=fs.existsSync(path.join(app,'package.json'))?JSON.parse(fs.readFileSync(path.join(app,'package.json'),'utf8')).version:'0.0.0';
 validateUpdateFolder(release,current);
 for(const name of ['linux-install.js','linux-open.js'])if(!fs.existsSync(path.join(release,name)))throw Error('Version Linux incomplète : '+name);
 const version=JSON.parse(fs.readFileSync(path.join(release,'package.json'),'utf8')).version;
 const imported=chooseData({root,home,importData,newBudget});
 const oldUnit=fs.existsSync(unit)?fs.readFileSync(unit,'utf8'):null;
 const wasActive=command(['is-active','--quiet','sillage.service'],true);
 command(['stop','sillage.service'],true);
 if(await probe()){if(wasActive)command(['start','sillage.service'],true);throw Error('Le port 3030 est occupé. Arrêtez npm start avec Ctrl+C, puis recommencez.');}
 let staged=null,switched=false,importedThisRun=false;
 try {
  fs.mkdirSync(root,{recursive:true,mode:0o700});
  staged=fs.mkdtempSync(path.join(root,'app.next-'));
  copyReleaseFiles(release,staged);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  if(fs.existsSync(path.join(root,'data'))){const backup=path.join(root,'backups',stamp,'data');fs.mkdirSync(path.dirname(backup),{recursive:true,mode:0o700});fs.cpSync(path.join(root,'data'),backup,{recursive:true});}
  if(imported){fs.cpSync(imported,path.join(root,'data'),{recursive:true,errorOnExist:true,force:false});importedThisRun=true;}
  if(!fs.existsSync(path.join(root,'data')))fs.mkdirSync(path.join(root,'data'),{mode:0o700});
  if(fs.existsSync(path.join(previous,'data')))throw Error('L’ancienne copie du programme contient un dossier data inattendu. Conservez-le avant de réessayer.');
  if(fs.existsSync(previous))fs.rmSync(previous,{recursive:true});
  if(fs.existsSync(app))fs.renameSync(app,previous);
  fs.renameSync(staged,app);switched=true;
  fs.mkdirSync(unitDir,{recursive:true});fs.writeFileSync(unit,linuxUnit(process.execPath,root),{mode:0o600});
  command(['daemon-reload']);command(['enable','sillage.service']);command(['start','sillage.service']);
  if(!await ready(version))throw Error('Sillage ne répond pas après le démarrage. Consultez journalctl --user -u sillage.service.');
  const desktop=path.join(home,'.local','share','applications');fs.mkdirSync(desktop,{recursive:true});
  const quote=s=>'"'+s.replace(/\\/g,'\\\\').replace(/"/g,'\\"').replace(/%/g,'%%').replace(/\$/g,'\\$').replace(/`/g,'\\`')+'"';
  fs.writeFileSync(path.join(desktop,'sillage.desktop'),`[Desktop Entry]\nType=Application\nName=Sillage 2\nComment=Mon budget personnel\nExec=${quote(process.execPath)} ${quote(path.join(app,'linux-open.js'))}\nIcon=${path.join(app,'sillage-icon.png')}\nTerminal=false\nCategories=Office;Finance;\n`,{mode:0o644});
  return {root,version,imported:!!imported,previous:fs.existsSync(previous)?previous:null};
 } catch(error) {
  command(['stop','sillage.service'],true);
  if(importedThisRun&&fs.existsSync(path.join(root,'data'))){const failed=path.join(root,'backups','failed-import-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(failed,{recursive:true,mode:0o700});fs.renameSync(path.join(root,'data'),path.join(failed,'data'));}
  if(switched&&fs.existsSync(previous)){fs.rmSync(app,{recursive:true});fs.renameSync(previous,app);}
  if(oldUnit!==null){fs.mkdirSync(unitDir,{recursive:true});fs.writeFileSync(unit,oldUnit);}else if(fs.existsSync(unit))fs.unlinkSync(unit);
  command(['daemon-reload'],true);if(wasActive)command(['start','sillage.service'],true);
  throw error;
 } finally {if(staged&&fs.existsSync(staged))fs.rmSync(staged,{recursive:true});}
}
async function main(){
 if(process.platform!=='linux')throw Error('Ce programme est destiné à Linux et à l’environnement Linux de ChromeOS.');
 let release=source,importData,newBudget=false;
 const args=process.argv.slice(2);for(let i=0;i<args.length;i++){if(args[i]==='--new')newBudget=true;else if(['--release','--import-data'].includes(args[i])&&args[i+1]){const value=args[++i];if(args[i-1]==='--release')release=path.resolve(value);else importData=value;}else throw Error('Usage : node linux-install.js [--release dossier] [--import-data dossier-data | --new]');}
 const result=await installLinux({release,importData,newBudget});
 console.log(`Sillage 2 (${result.version}) installé.\nDonnées : ${result.root}/data\nOuvrez Sillage 2 dans le lanceur, ou http://localhost:3030.\nLe service démarre avec Linux; ChromeOS ne démarre pas nécessairement Linux à l’ouverture de session.\nMise à jour : exécutez le linux-install.js de la prochaine version décompressée.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(e=>{console.error(e.message);process.exitCode=1;});
