"""Run both real released 0.9.0 and current HTTP apps against an isolated fake budget."""
import os,json,subprocess,tempfile,zipfile,socket,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];archive=ROOT/'releases/Le-bas-de-laine-0.9.0.zip'
if not archive.exists():print('SKIP: optional released 0.9.0 archive is outside this standalone delivery.');raise SystemExit(0)
with tempfile.TemporaryDirectory(prefix='bdl-real-recovery-') as tmp:
 tmp=Path(tmp);home=tmp/'home';home.mkdir();root=home/'.local/share/le-bas-de-laine';data=root/'data';clock=tmp/'clock.mjs';clock.write_text("const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-11-10T16:00:00Z']));}static now(){return Original.parse('2026-11-10T16:00:00Z');}};")
 with zipfile.ZipFile(archive) as z:z.extractall(tmp/'old')
 old=tmp/'old/Le-bas-de-laine-0.9.0'
 def node(code):return subprocess.check_output(['node','--input-type=module'],input=code,text=True,stderr=subprocess.DEVNULL)
 def install(release):node(f"import {{install}} from {json.dumps((ROOT/'install.js').as_uri())};await install({{home:{json.dumps(str(home))},release:{json.dumps(str(release))},command:()=>true,probe:async()=>false,ready:async()=>true}});")
 install(old)
 node(f"import {{openDatabase}} from {json.dumps((root/'app/database.js').as_uri())};import {{createService}} from {json.dumps((root/'app/service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2026-11-10');db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Paie',amount:1000,start_on:'2026-11-25',frequency:'monthly',day_adjust:'none'}}],categories:[{{name:'Maison',limit:100,period:'monthly',renewal_day:1}}]}}));db.put('share_token','fake-recovery-token');db.db.close();")
 def run_app(expected,change=False):
  sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}'
  server=subprocess.Popen(['node','--import',str(clock),str(root/'app/server.js')],env={**os.environ,'BDL_DATA':str(data),'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  def call(path,payload=None):
   req=urllib.request.Request(base+path,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
   with urllib.request.urlopen(req) as response:return json.load(response)
  try:
   for _ in range(150):
    try:state=call('/api/state');break
    except Exception:time.sleep(.05)
   assert state['version']==expected,state['version'];backup=call('/api/export');shared=call('/s/fake-recovery-token/data');assert shared['simulation']==state['simulation']
   if change:
    purchase={'description':'Achat récent','amount':-10,'account_id':1,'category_id':1,'date':'2026-11-10'}
    call('/api/transaction',purchase);restored=call('/api/restore',{'confirm':'REMPLACER','backup':backup});assert restored['simulation']==state['simulation'];assert call('/api/export')['tables']==backup['tables'];call('/api/transaction',purchase)
   return state,backup
  finally:server.terminate();server.wait(timeout=5)
 before,backup=run_app('0.9.0');install(ROOT);current,current_backup=run_app('1.0.0',True);assert before['simulation']==current['simulation'];assert backup['tables']==current_backup['tables']
 restored=json.loads(node(f"import {{rollback}} from {json.dumps((ROOT/'rollback.js').as_uri())};console.log(JSON.stringify(await rollback({{home:{json.dumps(str(home))},confirm:true,command:()=>true,ready:async()=>true}})));") )
 after,after_backup=run_app('0.9.0');assert after_backup['tables']==backup['tables'];assert after['simulation']==before['simulation'];assert Path(restored['saved'],'data','budget.sqlite').exists()
 print('PASS: actual 0.9.0 → 1.0.0 → 0.9.0 programs and HTTP APIs, identical financial forecast, actual JSON restore API and full exported tables restored, private link retained, recent budget separately preserved; isolated Linux service commands simulated.')
