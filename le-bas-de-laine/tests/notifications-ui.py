"""Permission/enrollment UI contracts with mocked browser push APIs; no real notification sent."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil,base64
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-notify-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(Path(tmp.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
point=bytes.fromhex('046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5');public=base64.urlsafe_b64encode(point).decode().rstrip('=');endpoint='https://web.push.apple.com/fake-browser-ui'
mock='''(() => {const key=Uint8Array.from(atob(KEY.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const tracker=window.__pushTest={permissions:0,registrations:0,subscriptions:0,unsubscriptions:0};let registered=false,hasSub=false;class MockNotification{}MockNotification.permission='default';MockNotification.requestPermission=async()=>{tracker.permissions++;MockNotification.permission='granted';return 'granted';};Object.defineProperty(window,'Notification',{value:MockNotification,configurable:true});Object.defineProperty(window,'PushManager',{value:class{},configurable:true});const sub={endpoint:ENDPOINT,options:{applicationServerKey:key.buffer},toJSON:()=>({endpoint:ENDPOINT,keys:{p256dh:KEY,auth:'AAAAAAAAAAAAAAAAAAAAAA'}}),unsubscribe:async()=>{hasSub=false;tracker.unsubscriptions++;return true;}};const registration={pushManager:{getSubscription:async()=>hasSub?sub:null,subscribe:async(options)=>{if(!options.userVisibleOnly)throw Error('userVisibleOnly');tracker.subscriptions++;hasSub=true;return sub;}}};Object.defineProperty(navigator,'serviceWorker',{value:{getRegistration:async()=>registered?registration:undefined,register:async(url,options)=>{if(!url.startsWith('/sw.js')||options.scope!=='/')throw Error('scope');tracker.registrations++;registered=true;return registration;},ready:Promise.resolve(registration)},configurable:true});})();'''.replace('KEY',json.dumps(public)).replace('ENDPOINT',json.dumps(endpoint))
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
try:
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 call('/api/setup',{'balance':1000,'paychecks':[{'name':'Paie','amount':1000,'start_on':state['simulation']['reference'],'frequency':'monthly','day_adjust':'none'}],'categories':[]});baseline=call('/api/export')['tables'];backend={'enabled':False,'details':False,'known':False,'tests':0}
 def intercept(route):
  action=route.request.url.rsplit('/',1)[-1];data=json.loads(route.request.post_data or '{}')
  if action=='key':out={'public_key':public}
  else:
   if action=='subscribe':assert data['subscription']['endpoint']==endpoint;backend.update(enabled=True,details=data.get('details',False),known=True)
   if action=='preferences':backend['details']=data['details']
   if action=='unsubscribe':backend.update(enabled=False,known=False)
   if action=='pause':backend['enabled']=False
   if action=='test':backend['tests']+=1
   device={'enabled':backend['enabled'],'details':backend['details'],'last_sent_at':None,'last_error':None,'last_status':None} if backend['known'] and (data.get('endpoint') or action in ['subscribe','preferences','test']) else None
   out={'hour':7,'time_zone':'America/Toronto','threshold_percent':80,'can_activate':True,'devices_count':int(backend['enabled']),'error':None,'device':device}
  route.fulfill(status=200,content_type='application/json',body=json.dumps(out))
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');page.add_init_script(mock);page.route('**/api/notifications/**',intercept);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#plan');page.locator('.settings').get_by_text('Réglages et sauvegardes',exact=True).click();page.get_by_role('button',name='Notifications du matin',exact=True).click();dialog=page.locator('#editor');expect(dialog).to_contain_text('7 h');expect(dialog.get_by_role('checkbox',name='Afficher les montants et les noms sur l’écran verrouillé')).not_to_be_checked();page.get_by_role('button',name='Activer sur cet appareil',exact=True).click();expect(dialog).to_contain_text('Actif sur cet appareil');assert page.evaluate('window.__pushTest.permissions')==1;assert backend['details'] is False
  dialog.get_by_role('button',name='Envoyer un test',exact=True).click();expect(dialog).to_contain_text('Test accepté');assert backend['tests']==1;dialog.get_by_role('checkbox',name='Afficher les montants et les noms sur l’écran verrouillé').check();page.wait_for_timeout(100);assert backend['details'] is True
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':844});page.emulate_media(color_scheme=theme);assert dialog.evaluate('(e)=>e.scrollWidth<=e.clientWidth+1'),(width,theme)
  dialog.get_by_role('button',name='Désactiver sur cet appareil',exact=True).click();expect(dialog).to_contain_text('Pas activé');assert page.evaluate('window.__pushTest.unsubscriptions')==1
  dialog.get_by_role('button',name='Activer sur cet appareil',exact=True).click();expect(dialog).to_contain_text('Actif sur cet appareil');dialog.get_by_text('Autres appareils',exact=True).click();dialog.get_by_role('button',name='Suspendre tous les rappels',exact=True).click();dialog.locator('#editor-save').click();expect(dialog).to_contain_text('Pas activé');assert backend['enabled'] is False;dialog.get_by_role('button',name='Fermer',exact=True).click();assert call('/api/export')['tables']==baseline
  iphone=browser.new_context(user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1');iphone.add_init_script(mock);phone=iphone.new_page();phone.route('**/api/notifications/**',intercept);phone.goto(base+'/#plan');phone.locator('.settings').get_by_text('Réglages et sauvegardes',exact=True).click();phone.get_by_role('button',name='Notifications du matin',exact=True).click();expect(phone.locator('#editor')).to_contain_text('Sur l’écran d’accueil');assert not phone.get_by_role('button',name='Activer sur cet appareil',exact=True).count();assert phone.evaluate('window.__pushTest.permissions')==0
  share=call('/api/share',{'action':'create'})['result']['path'];phone.goto(base+share);assert not phone.get_by_role('button',name='Notifications du matin',exact=True).count();assert not errors,errors;browser.close()
 print('PASS: browser permission gesture/enrollment, hidden details default, test/preferences/unsubscribe/pause, iPhone home-screen instruction, shared controls absent, unchanged financial tables; 4 widths/2 themes. Browser push/provider APIs mocked; no real delivery.')
finally:server.terminate();server.wait(timeout=5);log.close();tmp.cleanup()
