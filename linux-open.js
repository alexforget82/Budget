import {spawnSync,spawn} from 'node:child_process';
const start=spawnSync('systemctl',['--user','start','sillage.service'],{encoding:'utf8'});
if(start.status!==0){console.error(start.stderr||'Impossible de démarrer Sillage.');process.exit(1);}
let ready=false;
for(let i=0;i<40;i++){
 try{ready=(await fetch('http://127.0.0.1:3030/api/state',{signal:AbortSignal.timeout(1000)})).ok;}catch{}
 if(ready)break;
 await new Promise(r=>setTimeout(r,250));
}
if(!ready){console.error('Le service ne répond pas. Consultez journalctl --user -u sillage.service.');process.exit(1);}
const browser=spawn('xdg-open',['http://localhost:3030'],{detached:true,stdio:'ignore'});
browser.on('error',error=>{console.error(error.message);process.exitCode=1;});browser.unref();
