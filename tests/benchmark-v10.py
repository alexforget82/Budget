import sys,importlib.util,shutil,time,json
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).parent))
spec=importlib.util.spec_from_file_location('api',str(Path(__file__).with_name('api-tests.py')));a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a);f=a.BudgetAPI();f.setUp()
try:
 aid=f.account(balance=5000)
 for i in range(80):f.transaction(aid,-10,description='Commerce '+str(i))
 for i in range(20):f.post('/api/recurring',{'description':'Facture '+str(i),'type':'expense','amount':5,'account_id':aid,'frequency':'monthly','start_on':a.DAY})
 api=[]
 for i in range(5):
  start=time.perf_counter();f.get('/api/state');api.append(round((time.perf_counter()-start)*1000,1))
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path=shutil.which('chromium'));page=b.new_page(viewport={'width':1440,'height':1000});page.add_init_script("window.longTasks=[];new PerformanceObserver(l=>window.longTasks.push(...l.getEntries().map(e=>e.duration))).observe({type:'longtask',buffered:true});");page.goto(f.base);page.get_by_label('Apparence',exact=True).select_option('dark');page.wait_for_timeout(700);r=[]
  for i in range(3):
   r.append(round(page.evaluate('()=>{const t=performance.now();render(state);return performance.now()-t}'),1));page.wait_for_timeout(500)
  print(json.dumps({'state_ms':api,'render_ms':r,'long_tasks_ms':page.evaluate('window.longTasks'),'dom_nodes':page.locator('body *').count()}));b.close()
finally:f.tearDown()
