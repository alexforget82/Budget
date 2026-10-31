"""Complete first-run and payment flows on disposable data; Chromium, never a user's budget."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil,datetime
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1]
folder=tempfile.TemporaryDirectory(prefix='bdl-ui-');sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}'
log=open(Path(folder.name)/'server.log','w');server=subprocess.Popen(['node',str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_DATA':str(Path(folder.name)/'data'),'PORT':str(port)},stdout=log,stderr=log)
def api(route,data=None):
 req=urllib.request.Request(base+route,data=None if data is None else json.dumps(data).encode(),headers={} if data is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as r:return json.load(r)
captures=Path(os.environ.get('BDL_CAPTURES',tempfile.mkdtemp(prefix='bdl-captures-')));captures.mkdir(parents=True,exist_ok=True)
try:
 for i in range(80):
  try:initial=api('/api/state');break
  except Exception:time.sleep(.05)
 reference=initial['simulation']['reference'];tomorrow=(datetime.date.fromisoformat(reference)+datetime.timedelta(days=1)).isoformat()
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(viewport={'width':1440,'height':1000},locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base);expect(page.get_by_role('heading',name='Un budget plus léger.')).to_be_visible();page.get_by_label('Son solde réel aujourd’hui',exact=True).fill('1000');page.get_by_role('button',name='Continuer',exact=True).click();page.get_by_label('Montant',exact=True).fill('1000');page.get_by_label('Prochaine paie à recevoir',exact=True).fill(tomorrow);page.locator('[name=day_adjust]').select_option('none');page.get_by_role('button',name='Continuer',exact=True).click();page.get_by_role('button',name='Continuer',exact=True).click();expect(page.get_by_role('checkbox',name='Autres',exact=True)).to_be_checked();page.get_by_role('checkbox',name='Autres',exact=True).uncheck();page.get_by_role('checkbox',name='Essence',exact=True).uncheck();page.get_by_role('checkbox',name='Restaurant',exact=True).uncheck();page.get_by_role('button',name='Voir mon disponible',exact=True).click();expect(page.locator('.hero-amount')).to_contain_text('770,00');assert api('/api/state')['simulation']['available_cents']==77000
  def nav(view):
   page.locator(('.bottom-nav' if page.viewport_size['width']<=800 else '.sidebar')+f' [data-page="{view}"]').click()
  nav('plan');page.get_by_role('button',name='+ Compte / carte',exact=True).click();dialog=page.locator('#editor');dialog.get_by_label('Nom',exact=True).fill('CIBC');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();page.locator('#new-transaction').click();dialog.get_by_label('Montant',exact=True).fill('71.69');dialog.get_by_label('Description',exact=True).fill('Épicerie du jour');s=api('/api/state');card=next(a for a in s['accounts'] if a['kind']=='card');cat=next(c for c in s['categories'] if c['name']=='Épicerie');dialog.get_by_label('Catégorie',exact=True).select_option(str(cat['id']));dialog.get_by_label('Compte utilisé',exact=True).select_option(str(card['id']));dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();s=api('/api/state');assert s['simulation']['available_cents']==77000 and s['simulation']['bank_cents']==100000 and s['simulation']['card_cents']==7169
  for theme in ['light','dark']:
   page.emulate_media(color_scheme=theme)
   # Save through the API so navigation preserves the chosen appearance.
   page.reload()
   for width in [320,390,430,768,1440]:
    page.set_viewport_size({'width':width,'height':900})
    for view in ['today','transactions','plan']:
     nav(view);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(theme,width,view)
     if width in [390,1440]:page.screenshot(path=str(captures/f'{view}-{theme}-{width}.png'),full_page=True)
  nav('today');detail=page.locator('.limits-breakdown');detail.locator('summary').click();expect(detail).to_have_attribute('open','');expect(detail.locator('.limits-total')).to_contain_text('158,31');assert 'Le point le plus bas' not in page.locator('.minimum').inner_text();assert '90 jours' in page.locator('.minimum').inner_text();assert page.locator('select[name=theme]').count()==0;detail.locator('summary').click()
  # OS preference is the only appearance control; saved legacy choices cannot override it.
  page.evaluate('localStorage.setItem("bdl-theme","light")');page.emulate_media(color_scheme='dark');expect(page.locator('html')).to_have_attribute('data-theme','dark');page.emulate_media(color_scheme='light');expect(page.locator('html')).to_have_attribute('data-theme','light')
  # Shared view must exactly match owner calculations and never offer writes.
  token=api('/api/share',{'action':'create'})['result']['path'];page.goto(base+token);expect(page.locator('.hero-amount')).to_contain_text('770,00');expect(page.locator('#new-transaction')).to_be_hidden();expect(page.locator('.bottom-nav')).to_be_hidden();assert not page.get_by_role('button',name='Payée',exact=True).count()
  # Import preview and commit use the same resolved CSV mapping (no stale-token false alarm).
  page.goto(base+'/#transactions');page.get_by_role('button',name='Importer un CSV',exact=True).click();dialog=page.locator('#editor');bank=next(a for a in s['accounts'] if a['is_main']);dialog.get_by_label('Fichier CSV',exact=True).set_input_files({'name':'historique.csv','mimeType':'text/csv','buffer':('Date;Description;Montant\n'+reference+';Achat historique;-5,00').encode()});dialog.get_by_label('Compte',exact=True).select_option(str(bank['id']));dialog.get_by_label('Catégorie',exact=True).select_option(str(cat['id']));dialog.get_by_role('button',name='Voir l’aperçu',exact=True).click();expect(dialog.locator('.csv-row')).to_have_count(1);dialog.get_by_role('button',name='Importer les lignes choisies',exact=True).click();expect(dialog).not_to_be_visible();updated=api('/api/state');assert updated['simulation']['bank_cents']==100000 and updated['simulation']['available_cents']==77500
  api('/api/recurrence',{'name':'Facture lointaine','kind':'expense','amount':10000,'account_id':bank['id'],'start_on':(datetime.date.fromisoformat(reference)+datetime.timedelta(days=89)).isoformat(),'frequency':'yearly','one_time':True});page.goto(base+'/#today');page.locator('#refresh').click();expect(page.locator('.forecast-message')).to_contain_text('Facture lointaine');assert api('/api/state')['simulation']['available_cents']==77500
  for mode in ['laine','slate','paper']:
   page.goto(base+'/maquettes?direction='+mode);expect(page.locator('.hero-amount')).to_be_visible()
   for width in [390,1440]:
    page.set_viewport_size({'width':width,'height':1000 if width>800 else 900});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('maquette',mode,width);page.screenshot(path=str(captures/f'maquette-{mode}-{width}.png'),full_page=True)
   # A self-contained HTML preview works locally without a server or module loading.
   html=page.evaluate('''() => { const d=document.documentElement.cloneNode(true);for(const s of d.querySelectorAll('script'))s.remove();for(const l of d.querySelectorAll('link'))l.remove();for(const img of d.querySelectorAll('img'))img.src='../../public/logo.svg';return '<!doctype html>'+d.outerHTML;}''')
   css=(ROOT/'public/styles.css').read_text();html=html.replace('</head>','<style>'+css+'</style></head>');(captures/f'maquette-{mode}.html').write_text(html)
  assert not errors,errors;browser.close()
 print('PASS: four-step setup, one card purchase, exact protection, 3 views/5 widths/2 themes, readonly sharing, all 3 maquettes, self-contained HTML previews. Captures:',captures)
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait()
 log.close();folder.cleanup()
