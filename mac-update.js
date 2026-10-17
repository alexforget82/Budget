// A locally installed shortcut selects a downloaded release explicitly.
// No global Gatekeeper changes and no quarantine attributes are removed.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
export function validateUpdateFolder(folder,currentVersion){
 const root=fs.realpathSync(folder),manifest=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
 const version=v=>/^\d+\.\d+\.\d+$/.test(v)?v.split('.').map(Number):null;
 const incoming=version(manifest.version),current=version(currentVersion);
 if(manifest.name!=='mon-budget-local'||!incoming||!current)throw Error('Choisissez le dossier complet de Mon Budget décompressé depuis votre dépôt GitHub.');
 for(let i=0;i<3;i++){if(incoming[i]<current[i])throw Error('Cette version est plus ancienne que la version installée.');if(incoming[i]>current[i])break;}
 for(const name of ['mac-service.js','mac-update.js','server.js','index.html','planning-v4.js','planning-v4.css','budget-support.js','budget-v41.js','budget-v41.css','free-budgets.js','free-budgets-ui.js','free-budgets.css','envelope-tools.js','envelope-v44.js','envelope-v44.css','category-tools.js','categories-v46.js','categories-v46.css','dashboard-layout.js','dashboard-v47.js','dashboard-v47.css','budget-life.js','budget-v50.js','budget-v50.css','Acces prive iPhone.command'])if(!fs.statSync(path.join(root,name)).isFile())throw Error('Version incomplète : '+name);
 return root;
}
function main(){
 if(process.platform!=='darwin')throw Error('Cette mise à jour nécessite macOS.');
 const chosen=spawnSync('/usr/bin/osascript',['-e','POSIX path of (choose folder with prompt "Choisissez le dossier Mon Budget du nouveau ZIP téléchargé depuis votre dépôt GitHub. Son installateur sera exécuté.")'],{encoding:'utf8'});
 if(chosen.status!==0){if(chosen.stderr?.includes('-128'))return;throw Error(chosen.stderr||'Impossible de choisir le dossier.');}
 const version=JSON.parse(fs.readFileSync(new URL('./package.json',import.meta.url))).version;
 const folder=validateUpdateFolder(chosen.stdout.trim(),version);
 const result=spawnSync(process.execPath,[path.join(folder,'mac-service.js'),'install','--no-open'],{cwd:folder,stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{main();}catch(e){console.error(e.message);process.exitCode=1;}
