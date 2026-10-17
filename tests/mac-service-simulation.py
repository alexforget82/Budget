"""Exercise installation/update/stop with a simulated launchctl, never host services.
macOS itself and real Tailscale remain manual checks on the user's Mac.
"""
import importlib.util,json,os,shutil,signal,socket,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI('runTest');f.setUp();f.account(balance=1234.56);f.stop()
# tearDown is handled manually because the fixture server is already stopped.
workspace=Path(tempfile.mkdtemp(prefix='budget-service-sim-'));home=workspace/'Alex & Jenny';incoming=workspace/'download';incoming.mkdir();control=workspace/'launchctl';state=workspace/'state';port=f.port
with socket.socket() as sock:sock.bind(('127.0.0.1',0));private_port=sock.getsockname()[1]
try:
 for p in api.ROOT.iterdir():
  if p.suffix in ['.js','.html','.css'] or p.name in ['package.json','Acces prive iPhone.command']:shutil.copy2(p,incoming/p.name)
 shutil.copytree(f.dir/'data',incoming/'data')
 # The fixture redirects only platform-specific dependencies and fixed ports.
 script=(incoming/'mac-service.js').read_text().replace("process.platform!=='darwin'","false").replace('home=os.homedir()','home='+json.dumps(str(home))).replace("'/bin/launchctl'",json.dumps(str(control))).replace("'/usr/bin/open'","'/usr/bin/true'").replace("'/usr/bin/caffeinate'","'/usr/bin/true'").replace('127.0.0.1:3030','127.0.0.1:'+str(port)).replace("PORT:'3030'","PORT:'"+str(port)+"'")
 (incoming/'mac-service.js').write_text(script)
 config={'origin':'https://budget.test.ts.net','login':'owner@example.test','port':private_port}
 (incoming/'Acces prive iPhone.command').write_text("#!/bin/bash\n[ \"$1\" = '--prepare-service' ] || exit 1\ncat > data/private-access.json <<'JSON'\n"+json.dumps(config)+"\nJSON\n")
 control.write_text('''#!/usr/bin/env python3
import json,os,signal,subprocess,sys,plistlib,time
from pathlib import Path
state=Path('''+repr(str(state))+''')
a=sys.argv[1:]
if a[0]=='print':sys.exit(0 if state.exists() else 1)
if a[0]=='enable':sys.exit(0)
if a[0]=='bootout':
 if state.exists():
  pid=json.loads(state.read_text())['pid']
  try:os.killpg(pid,signal.SIGTERM)
  except ProcessLookupError:pass
  state.unlink()
 sys.exit(0)
if a[0]=='bootstrap':
 p=plistlib.loads(Path(a[2]).read_bytes())
 child=subprocess.Popen(p['ProgramArguments'],cwd=p['WorkingDirectory'],stdout=open(p['StandardOutPath'],'a'),stderr=open(p['StandardErrorPath'],'a'),start_new_session=True)
 state.write_text(json.dumps({'pid':child.pid}));sys.exit(0)
sys.exit(2)
''');control.chmod(0o700)
 def run(action,ok=True):
  p=subprocess.run(['node',str(incoming/'mac-service.js'),action],capture_output=True,text=True,timeout=25)
  assert (p.returncode==0)==ok,(p.returncode,p.stdout,p.stderr)
  return p
 def status():
  with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/state',timeout=2) as r:return json.load(r)
 # First install copies data to the stable folder and starts a detached server.
 p=run('install');assert 'arrière-plan' in p.stdout;s=status();assert s['cash_cents']==123456
 root=home/'Library'/'Application Support'/'Mon Budget';assert (root/'data'/'budget.sqlite').exists();assert (home/'Library'/'LaunchAgents'/'ca.monbudget.private.plist').exists()
 shortcuts=home/'Applications'/'Mon Budget'
 for name in ['Ouvrir Mon Budget.command','Mettre a jour Mon Budget.command','Desactiver Mon Budget.command']:
  file=shortcuts/name;assert file.exists();assert file.stat().st_mode&0o777==0o700
  assert str(root) in file.read_text();assert 'xattr' not in file.read_text()
 run('open');assert status()['cash_cents']==123456
 # Install again while running: stop only this service, keep the stable database.
 (incoming/'data'/'budget.sqlite').unlink();run('install');assert status()['cash_cents']==123456;assert (root/'mac-update.js').exists()
 assert len(list((root/'data'/'backups').glob('budget-before-service-update-*.sqlite')))==2
 run('stop');assert not state.exists();assert not (home/'Library'/'LaunchAgents'/'ca.monbudget.private.plist').exists();assert (root/'data'/'budget.sqlite').exists()
 # A separately launched budget is detected, never killed or overwritten.
 child=subprocess.Popen(['node',str(api.ROOT/'server.js')],cwd=f.dir,env={**os.environ,'PORT':str(port)},stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(60):
   try:status();break
   except OSError:time.sleep(.05)
  p=run('install',False);assert 'Control + C' in p.stderr;assert child.poll() is None;assert not state.exists()
 finally:child.terminate();child.wait(timeout=10)
 print('PASS: simulated launchctl first install, detached server readiness, data migration, safe update/restart, coherent backups, stop/removal preserving data, refusal to stop an unrelated foreground server.')
finally:
 if state.exists():
  try:os.killpg(json.loads(state.read_text())['pid'],signal.SIGTERM)
  except ProcessLookupError:pass
 f.temp.cleanup();shutil.rmtree(workspace)
