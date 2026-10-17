/* Move the existing dashboard nodes: no copied values or financial calculations. */
(()=>{
 const $=id=>document.getElementById(id),node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;},button=(label,fn)=>{const e=node('button',label,'secondary');e.type='button';e.onclick=fn;return e;};
 const definitions=[['summary','Soldes et disponible',[document.querySelector('.cards')]],['spending','Disponible par période',[document.querySelector('.sts-heading'),document.querySelector('.sts-windows')]],['alerts','Points à surveiller',[$('v44-alerts')]],['forecast','Prévision sur 30 jours',[document.querySelector('.budget-forecast-panel')]],['envelopes','Vos enveloppes',[document.querySelector('.budget-envelope-panel')]],['upcoming','Prochains mouvements',[document.querySelector('#app-dashboard>.upcoming')]]];
 const root=$('app-dashboard');root.classList.add('v47-dashboard');
 const mq=matchMedia('(max-width:760px)'),states={},widgets=new Map();let editing=false,dragId=null,loaded=false;
 const device=()=>mq.matches?'mobile':'desktop';
 const defaults=profile=>definitions.map(([id])=>({id,visible:true,width:profile==='desktop'&&['summary','spending','alerts','forecast'].includes(id)?'full':'normal'}));
 for(const profile of ['desktop','mobile'])states[profile]={layout:defaults(profile),revision:null,dirty:false,saving:false,error:null,conflict:null,timer:null};
 const toolbar=node('div',undefined,'v47-toolbar'),heading=node('div');heading.append(node('h2','Votre tableau de bord'),node('p','Organisez les informations qui comptent pour vous.','sub'));
 const customize=button('Personnaliser',()=>{editing=!editing;paint();}),reset=button('Rétablir la disposition par défaut',()=>change(layout=>{layout.splice(0,layout.length,...defaults(device()));}));customize.id='dashboard-customize';customize.disabled=true;reset.id='dashboard-layout-reset';const actions=node('div',undefined,'v47-toolbar-actions');actions.append(customize,reset);toolbar.append(heading,actions);
 const feedback=node('div',undefined,'v47-feedback');feedback.id='dashboard-layout-status';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
 const instruction=node('p','Sur ordinateur, glissez la poignée d’un bloc. Utilisez aussi Monter / Descendre, au clavier ou sur téléphone. Les blocs masqués restent accessibles pendant la personnalisation.','v47-instruction');
 const grid=node('div',undefined,'v47-grid');grid.id='dashboard-widgets';const empty=node('p','Tous les blocs sont masqués. Utilisez Personnaliser pour en afficher à nouveau.','v47-empty');
 root.prepend(toolbar,feedback,instruction);root.append(grid,empty);
 for(const [id,title,contents] of definitions){
  const widget=node('section',undefined,'v47-widget');widget.dataset.widget=id;widget.setAttribute('aria-label',title);const tools=node('div',undefined,'v47-widget-tools'),handle=node('span','⠿ '+title,'v47-handle');handle.setAttribute('role','img');handle.setAttribute('aria-label','Glisser le bloc '+title);handle.dataset.dragHandle=id;
  const up=button('Monter',()=>move(id,-1)),down=button('Descendre',()=>move(id,1));up.setAttribute('aria-label','Monter '+title);down.setAttribute('aria-label','Descendre '+title);
  const visible=node('input');visible.type='checkbox';visible.setAttribute('aria-label','Afficher '+title);visible.onchange=()=>change(layout=>layout.find(b=>b.id===id).visible=visible.checked);const visibleLabel=node('label','Afficher');visibleLabel.append(visible);
  const width=node('select');width.setAttribute('aria-label','Largeur de '+title);width.add(new Option('Largeur normale','normal'));width.add(new Option('Pleine largeur','full'));width.onchange=()=>change(layout=>layout.find(b=>b.id===id).width=width.value);
  tools.append(handle,up,down,visibleLabel,width);const body=node('div',undefined,'v47-widget-body');for(const content of contents)body.append(content);widget.append(tools,body);grid.append(widget);widgets.set(id,{widget,handle,up,down,visible,width,body});
  handle.ondragstart=event=>{if(!editing||device()!=='desktop')return event.preventDefault();dragId=id;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);widget.classList.add('v47-dragging');};handle.ondragend=()=>{dragId=null;for(const w of widgets.values())w.widget.classList.remove('v47-drop-target','v47-dragging');};
  widget.ondragover=event=>{if(editing&&dragId&&dragId!==id){event.preventDefault();event.dataTransfer.dropEffect='move';widget.classList.add('v47-drop-target');}};widget.ondragleave=event=>{if(!widget.contains(event.relatedTarget))widget.classList.remove('v47-drop-target');};
  widget.ondrop=event=>{if(!editing||!dragId||dragId===id)return;event.preventDefault();const moving=dragId,rect=widget.getBoundingClientRect(),after=event.clientY>=rect.top+rect.height/2;dragId=null;change(layout=>{const index=layout.findIndex(b=>b.id===moving),[item]=layout.splice(index,1),target=layout.findIndex(b=>b.id===id);layout.splice(target+(after?1:0),0,item);});for(const w of widgets.values())w.widget.classList.remove('v47-drop-target','v47-dragging');};
 }
 function move(id,delta){change(layout=>{const index=layout.findIndex(b=>b.id===id),target=index+delta;if(target>=0&&target<layout.length)[layout[index],layout[target]]=[layout[target],layout[index]];});requestAnimationFrame(()=>{const w=widgets.get(id),control=w[delta<0?'up':'down'];(control.disabled?w[delta<0?'down':'up']:control).focus();});}
 function change(mutator){if(!loaded)return;const profile=device(),s=states[profile];mutator(s.layout);s.dirty=true;if(!s.conflict)s.error=null;paint();clearTimeout(s.timer);s.timer=setTimeout(()=>save(profile),300);}
 function status(){
  const profile=device(),s=states[profile];feedback.replaceChildren();feedback.dataset.state=s.error?'error':s.saving||s.dirty?'pending':'saved';
  feedback.append(node('span',(profile==='mobile'?'Disposition téléphone':'Disposition ordinateur')+' · '+(!loaded?'Chargement…':s.error?s.error:s.saving||s.dirty?'Enregistrement…':'Enregistrée')));
  if(s.error){if(s.conflict){feedback.append(button('Charger la version enregistrée',()=>{clearTimeout(s.timer);s.layout=structuredClone(s.conflict.layout);s.revision=s.conflict.revision;s.dirty=false;s.error=s.conflict=null;paint();}),button('Conserver mes choix',()=>{s.revision=s.conflict.revision;s.error=s.conflict=null;s.dirty=true;save(profile);}));}else feedback.append(button('Réessayer l’enregistrement',()=>save(profile)));}
 }
 function paint(){
  const profile=device(),s=states[profile];root.classList.toggle('v47-editing',editing);root.dataset.layoutProfile=profile;customize.textContent=editing?'Terminer':'Personnaliser';customize.setAttribute('aria-pressed',String(editing));reset.hidden=instruction.hidden=!editing;empty.hidden=editing||s.layout.some(b=>b.visible);
  for(const [index,b] of s.layout.entries()){const w=widgets.get(b.id);if(!w)continue;if(grid.children[index]!==w.widget)grid.insertBefore(w.widget,grid.children[index]||null);w.widget.hidden=!editing&&!b.visible;w.widget.classList.toggle('v47-masked',!b.visible);w.widget.dataset.width=b.width;w.visible.checked=b.visible;w.width.value=b.width;w.width.hidden=profile==='mobile';w.handle.draggable=editing&&profile==='desktop';w.handle.hidden=profile==='mobile';w.up.disabled=index===0;w.down.disabled=index===s.layout.length-1;w.widget.setAttribute('aria-label',definitions.find(d=>d[0]===b.id)[1]+(!b.visible?' · masqué':''));}status();
 }
 async function save(profile){
  const s=states[profile];clearTimeout(s.timer);if(s.saving||!s.dirty||s.conflict)return;s.saving=true;s.dirty=false;s.error=null;status();
  try{const r=await fetch('/api/dashboard-layout',{method:'POST',keepalive:true,headers:{'Content-Type':'application/json'},body:JSON.stringify({device:profile,layout:structuredClone(s.layout),expected_revision:s.revision})}),out=await r.json();if(!r.ok){if(r.status===409)s.conflict=out.dashboard_layout[profile];throw Error(out.error||'Enregistrement impossible.');}s.revision=out.dashboard_layout[profile].revision;
  }catch(err){s.dirty=true;s.error=err instanceof TypeError?'Connexion interrompue : vos choix restent affichés.':err.message||'Enregistrement impossible : vos choix restent affichés.';}finally{s.saving=false;status();if(s.dirty&&!s.error)save(profile);}
 }
 document.addEventListener('dragover',event=>{if(!dragId||!editing)return;const delta=event.clientY>innerHeight-65?18:event.clientY<65?-18:0;if(delta)window.scrollBy({top:delta,behavior:'instant'});});
 mq.addEventListener('change',paint);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')for(const profile of ['desktop','mobile'])if(!states[profile].error)save(profile);});
 window.addEventListener('beforeunload',event=>{if(Object.values(states).some(s=>s.dirty||s.saving)){event.preventDefault();event.returnValue='';}});
 function receive(data){if(!data)return;for(const profile of ['desktop','mobile']){const s=states[profile];if(!s.dirty&&!s.saving&&!s.error){s.layout=structuredClone(data[profile].layout);s.revision=data[profile].revision;}}loaded=true;customize.disabled=false;paint();}
 const previousRender=render;render=function(s){previousRender(s);receive(s.dashboard_layout);};if(typeof state!=='undefined'&&state)receive(state.dashboard_layout);else paint();
})();
