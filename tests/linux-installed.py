"""An actual copied Linux installation boots against the migrated SQLite data."""
import importlib.util,json,subprocess
from pathlib import Path
spec=importlib.util.spec_from_file_location('api',Path(__file__).with_name('api-tests.py'));api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
f=api.BudgetAPI();f.setUp()
try:
 bank=f.account(balance=5000);f.transaction(bank,-71.69,description='Achats migrés');before=f.get('/api/state');tables=f.get('/api/backup/export')['tables'];old=f.dir/'data';home=f.dir/'home';f.stop()
 script="import {installLinux} from './linux-install.js';await installLinux({home:process.argv[1],importData:process.argv[2],command:()=>false,probe:async()=>false,ready:async()=>true});"
 subprocess.run(['node','--input-type=module','-e',script,str(home),str(old)],cwd=api.ROOT,check=True)
 f.dir=home/'.local/share/sillage';api.ROOT=f.dir/'app';f.start();after=f.get('/api/state')
 assert before['cash_cents']==after['cash_cents'];assert before['safe_cents']==after['safe_cents'];assert before['forecast']==after['forecast'];assert tables==f.get('/api/backup/export')['tables']
 assert 'simple-workspace.js' in f.call('/ui-entry.js',raw=True)
 print('PASS: copied Linux app starts on real SQLite; balances, forecasts and all exported tables preserved after migration.')
finally:f.tearDown()
