"""Classification rules, manual override, CSV review and safe bulk preview on fake data."""
import os,json,socket,subprocess,tempfile,time,urllib.request,shutil
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
ROOT=Path(__file__).resolve().parents[1];tmp=tempfile.TemporaryDirectory(prefix='bdl-classify-ui-');data=Path(tmp.name)/'data';clock=Path(tmp.name)/'clock.mjs';sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close();base=f'http://127.0.0.1:{port}';log=open(Path(tmp.name)/'server.log','w');server=None
seed=f'''import {{openDatabase}} from {json.dumps((ROOT/'database.js').as_uri())};import {{createService}} from {json.dumps((ROOT/'service.js').as_uri())};const db=openDatabase({json.dumps(str(data))});const api=createService(db,()=> '2026-11-10');db.atomic(()=>api.setup({{balance:1000,paychecks:[{{name:'Paie',amount:1000,start_on:'2026-11-25',frequency:'monthly',day_adjust:'none'}}],categories:[{{name:'Épicerie',limit:100,period:'monthly',renewal_day:1}}]}}));api.category({{name:'Autre'}});db.db.close();'''
subprocess.run(['node','--input-type=module'],input=seed,text=True,check=True,stdout=subprocess.DEVNULL)
clock.write_text("const Original=Date;globalThis.Date=class extends Original{constructor(...a){super(...(a.length?a:['2026-11-10T16:00:00Z']));}static now(){return Original.parse('2026-11-10T16:00:00Z');}};")
def call(url,payload=None):
 req=urllib.request.Request(base+url,data=None if payload is None else json.dumps(payload).encode(),headers={} if payload is None else {'Content-Type':'application/json'})
 with urllib.request.urlopen(req) as response:return json.load(response)
try:
 server=subprocess.Popen(['node','--import',str(clock),str(ROOT/'server.js')],cwd=ROOT,env={**os.environ,'BDL_UPDATE_CHECKS':'off','BDL_DATA':str(data),'PORT':str(port)},stdout=log,stderr=log)
 for _ in range(100):
  try:state=call('/api/state');break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=shutil.which('chromium'));page=browser.new_page(locale='fr-CA');errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto(base+'/#transactions');dialog=page.locator('#editor')
  before=call('/api/state')['simulation'];page.get_by_role('button',name='Règles de classement',exact=True).click();dialog.get_by_role('button',name='+ Une règle',exact=True).click();dialog.get_by_label('Commerçant ou motif',exact=True).fill('IGA');dialog.get_by_label('Catégorie proposée',exact=True).select_option('1');dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();assert call('/api/state')['simulation']==before
  page.locator('#new-transaction').click();dialog.get_by_label('Montant',exact=True).fill('20');dialog.get_by_label('Description',exact=True).fill('IGA #4521');expect(dialog.get_by_label('Catégorie',exact=True)).to_have_value('1');dialog.get_by_label('Catégorie',exact=True).select_option('2');dialog.get_by_label('Montant',exact=True).fill('25');page.wait_for_timeout(400);expect(dialog.get_by_label('Catégorie',exact=True)).to_have_value('2');dialog.get_by_label('Catégorie',exact=True).select_option('1');dialog.get_by_role('checkbox',name='Toujours proposer cette catégorie pour ce commerçant').check();dialog.get_by_role('button',name='Enregistrer',exact=True).click();expect(dialog).not_to_be_visible();assert call('/api/state')['transactions'][0]['reviewed']==1
  page.get_by_role('button',name='Importer un CSV',exact=True).click();dialog.get_by_label('Fichier CSV',exact=True).set_input_files({'name':'historique.csv','mimeType':'text/csv','buffer':b'Date;Description;Montant\n2026-11-10;IGA #1111;-20,00\n2026-11-10;AUTRE;-10,00\n2026-11-10;IGA #2222;-5,00'});dialog.get_by_role('button',name='Voir l’aperçu',exact=True).click();expect(dialog.get_by_label('Catégorie ligne 2',exact=True)).to_have_value('1');dialog.get_by_label('Catégorie ligne 4',exact=True).select_option('2');dialog.get_by_role('button',name='Importer les lignes choisies',exact=True).click();expect(dialog).not_to_be_visible();assert call('/api/state')['review_count']==3
  page.goto(base+'/#today');page.get_by_role('button',name='3 transactions à réviser',exact=True).click();expect(page.locator('.ledger tbody tr')).to_have_count(3);page.get_by_role('button',name='Valider celles qui ont une règle (1)',exact=True).click();expect(page.get_by_role('button',name='À réviser (2)',exact=True)).to_be_visible();expect(page.locator('.ledger tbody tr')).to_have_count(2)
  for check in page.locator('[name=selected_transaction]').all():check.check()
  expect(page.locator('.review-batch')).to_contain_text('Total');expect(page.locator('.review-batch')).to_contain_text('Moyenne')
  page.get_by_role('button',name='Changer la catégorie',exact=True).click();dialog.get_by_label('Nouvelle catégorie',exact=True).select_option('1');dialog.get_by_role('button',name='Voir l’effet sur le disponible',exact=True).click();expect(dialog).to_contain_text('Disponible sur 30 jours');dialog.get_by_role('button',name='Appliquer à la sélection',exact=True).click();expect(dialog).not_to_be_visible();assert call('/api/state')['review_count']==2
  page.get_by_role('button',name='Valider celles qui ont une règle (1)',exact=True).click();expect(page.get_by_role('button',name='À réviser (1)',exact=True)).to_be_visible();page.locator('.ledger').get_by_role('button',name='Valider',exact=True).click();assert call('/api/state')['review_count']==0
  page.get_by_role('button',name='À réviser (0)',exact=True).click();expect(page.locator('.ledger tbody tr')).to_have_count(4)
  sort=page.get_by_label('Trier les opérations',exact=True);sort.select_option('description_asc');names=page.locator('.ledger tbody .description').all_text_contents();assert names==sorted(names,key=str.casefold)
  for width in [320,390,768,1440]:
   for theme in ['light','dark']:
    page.set_viewport_size({'width':width,'height':900});page.emulate_media(color_scheme=theme);assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,theme)
  before=call('/api/state')['simulation'];page.get_by_role('button',name='Règles de classement',exact=True).click();dialog.locator('.classification-rule').first.get_by_role('button',name='Pause',exact=True).click();expect(dialog).to_contain_text('En pause');dialog.locator('.classification-rule').first.get_by_role('button',name='Supprimer',exact=True).click();dialog.locator('#editor-save').click();expect(dialog).not_to_be_visible();assert call('/api/state')['simulation']==before
  share=call('/api/share',{'action':'create'})['result']['path'];page.goto(base+share);assert not page.get_by_role('button',name='Règles de classement').count();assert call(share+'/data')['simulation']==call('/api/state')['simulation'];assert not errors,errors;browser.close()
 print('PASS: manual rules with explicit override/remember, overridable CSV proposals, imported review flags, filtered review and rule validation, bulk category effect before confirmation, rule pause without financial change, private sharing; 4 widths/2 themes.')
finally:
 if server is not None:server.terminate();server.wait(timeout=5)
 log.close();tmp.cleanup()
