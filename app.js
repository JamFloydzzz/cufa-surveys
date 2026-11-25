'use strict';
const app=document.querySelector('#app'), brand=BRAND_URL;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=s=>app.querySelector(s);
let key=sessionStorage.getItem('cufa-admin')||'', draft, survey, route=[], values={}, token;
const types={single:'Один вариант',multi:'Несколько вариантов',text:'Текстовое поле'};
function show(markup){app.innerHTML=markup+'<p id="notice" role="alert"></p>';app.focus({preventScroll:true});scrollTo(0,0)}
function error(e){$('#notice').textContent=e.message;$('#notice').scrollIntoView({block:'nearest'})}
async function api(path,data){
 const headers={};if(path.startsWith('/api/admin/'))headers['X-Admin-Key']=key;
 if(data)headers['Content-Type']='application/json';
 const response=await fetch(path,{headers,method:data?'POST':'GET',body:data?JSON.stringify(data):undefined});
 const result=await response.json();if(!response.ok)throw Error(result.error||'Ошибка сервера');return result;
}
function cover(heading,description,actions){return '<section class="cover"><img src="'+brand+'" alt="Эмблема CUFA"><div class="eyebrow">Финансовый клуб ЦУ</div><h1>'+heading+'</h1><p class="lead">'+esc(description)+'</p>'+actions+'</section>'}
async function home(){
 const forms=await api('/api/forms');
 show(cover('Обратная<br><span class="accent">связь</span>','Поделись впечатлениями и помоги выбрать, какими будут следующие встречи клуба.','')+'<section class="directory"><h3>Открытые опросы</h3>'+forms.map(f=>'<article class="survey-row"><small>Вопросов: '+f.count+'</small><div><a href="/s/'+f.id+'">'+esc(f.title)+'</a></div><p>'+esc(f.description)+'</p></article>').join('')+'</section>');
}
async function start(){
 survey=await api('/api/form/'+location.pathname.split('/').pop());
 show(cover(esc(survey.title),survey.description,'<div class="actions"><button class="btn" id="begin">Начать опрос</button><small>Вопросов: '+survey.questions.length+'</small></div>'));
 $('#begin').onclick=()=>{route=[0];values={};token=crypto.randomUUID();question()};
}
function question(){
 const i=route.at(-1),q=survey.questions[i],v=values[i];
 show('<section class="quiz"><div class="row"><span>'+esc(survey.title)+'</span><small>Страница '+(i+1)+' из '+survey.questions.length+'</small></div><div class="bar"><i style="width:'+100*(i+1)/survey.questions.length+'%"></i></div><h2 id="prompt">'+esc(q.title)+'</h2><p class="hint">'+types[q.type]+' · '+(q.required?'обязательный вопрос':'можно пропустить')+'</p><form id="step"><div class="opts" role="group" aria-labelledby="prompt">'+(q.type==='text'?'<textarea aria-label="Ваш ответ" maxlength="5000" placeholder="Ваш ответ">'+esc(v)+'</textarea>':q.options.map((o,n)=>'<label class="opt"><input type="'+(q.type==='single'?'radio':'checkbox')+'" name="choice" value="'+n+'" '+((Array.isArray(v)?v.includes(n):v===n)?'checked':'')+'>'+esc(o.label)+'</label>').join(''))+'</div><div class="row nav"><button type="button" class="link" id="back">Назад</button><button class="btn" id="next"></button></div></form></section>');
 function read(){const selected=Array.from(app.querySelectorAll(':checked'),x=>+x.value);return q.type==='text'?$('textarea').value.trim():q.type==='multi'?selected:selected[0]}
 function target(){return q.type==='single'?(q.options[read()]?.next??i+1):i+1}
 function finish(){return target()===-1||target()>=survey.questions.length}
 function refresh(){const v=read();$('#next').disabled=q.required&&(v==null||v===''||Array.isArray(v)&&!v.length);$('#next').textContent=finish()?'Отправить ответы':'Дальше'}
 $('#step').oninput=refresh;refresh();
 $('#back').onclick=()=>{values[i]=read();if(route.length===1)return start().catch(error);route.pop();question()};
 $('#step').onsubmit=async e=>{e.preventDefault();values[i]=read();if(!finish()){route.push(target());return question()}$('#next').disabled=true;$('#back').disabled=true;
 try{await api('/api/form/'+survey.id,{token,answers:values});show(cover('Спасибо<br><span class="accent">за ответы!</span>','Твоя анкета сохранена.','<div class="actions"><a class="btn" href="/">К списку опросов</a></div>'))}catch(e){error(e);refresh();$('#back').disabled=false}};
}
function login(){
 show('<section class="quiz"><h2>Вход в админку</h2><form id="login"><label class="field">Пароль<input type="password" autocomplete="current-password" required></label><button class="btn">Войти</button></form></section>');
 $('#login').onsubmit=async e=>{e.preventDefault();key=$('input').value;try{await dashboard();sessionStorage.setItem('cufa-admin',key)}catch(e){error(e)}};
}
async function dashboard(){
 await api('/api/admin/list');const forms=await api('/api/forms');
 show('<section class="result-head"><div class="eyebrow">Кабинет CUFA</div><h2>Мои опросы</h2></section><div class="tools"><button class="btn" id="create">'+(localStorage.getItem('cufa-draft')?'Продолжить черновик':'Создать опрос')+'</button><button id="logout" class="link">Выйти</button></div>'+forms.map(f=>'<article class="survey-row"><h3>'+esc(f.title)+'</h3><p>'+esc(f.description)+'</p><div class="tools"><a href="/s/'+f.id+'">Открыть анкету</a><button class="quiet" data-results="'+f.id+'">Ответы и статистика</button></div></article>').join(''));
 $('#logout').onclick=()=>{key='';sessionStorage.removeItem('cufa-admin');login()};
 $('#create').onclick=()=>{draft=JSON.parse(localStorage.getItem('cufa-draft')||'null')||{title:'',description:'',questions:[blank()]};editor()};
 app.querySelectorAll('[data-results]').forEach(b=>b.onclick=()=>results(b.dataset.results).catch(error));
}
function blank(){return {title:'',type:'single',required:true,options:[{label:''},{label:''}]}}
function save(){localStorage.setItem('cufa-draft',JSON.stringify(draft))}
function editor(){
 const qs=draft.questions;
 show('<section class="quiz"><button id="list" class="link">К списку опросов</button><h2>Конструктор опроса</h2><label class="field">Название<input data-root="title" maxlength="200" value="'+esc(draft.title)+'"></label><label class="field">Описание<textarea data-root="description" maxlength="3000">'+esc(draft.description)+'</textarea></label>'+qs.map((q,i)=>'<section class="panel" data-index="'+i+'"><small>Страница '+(i+1)+'</small><label class="field">Вопрос<input data-field="title" value="'+esc(q.title)+'" maxlength="500"></label><label class="field">Тип ответа<select data-field="type">'+Object.entries(types).map(([k,v])=>'<option value="'+k+'" '+(k===q.type?'selected':'')+'>'+v+'</option>').join('')+'</select></label><label><input type="checkbox" data-field="required" '+(q.required?'checked':'')+'> Обязательный вопрос</label>'+(q.type==='text'?'':'<p class="hint">'+(q.type==='single'?'Варианты и переходы после ответа':'Варианты ответа')+'</p>'+q.options.map((o,n)=>'<div class="option-edit"><input data-option="'+n+'" aria-label="Вариант '+(n+1)+'" placeholder="Вариант '+(n+1)+'" value="'+esc(o.label)+'">'+(q.type==='single'?'<select data-next="'+n+'" aria-label="Переход для варианта '+(n+1)+'"><option value="">По порядку</option>'+qs.map((s,j)=>j<=i?'':'<option value="'+j+'" '+(o.next===j?'selected':'')+'>Стр. '+(j+1)+' · '+esc(s.title)+'</option>').join('')+'<option value="-1" '+(o.next===-1?'selected':'')+'>Завершить опрос</option></select>':'')+'<button class="quiet" data-drop="'+n+'" '+(q.options.length<=2?'disabled':'')+' aria-label="Удалить вариант">×</button></div>').join('')+'<button class="link" data-add>Добавить вариант</button>')+'<div><button class="link" data-remove '+(qs.length===1?'disabled':'')+'>Удалить вопрос</button></div></section>').join('')+'<div class="tools"><button class="quiet" id="add">Добавить страницу с вопросом</button><button class="btn" id="publish">Опубликовать опрос</button></div><small>Черновик сохраняется в этом браузере.</small></section>');
 app.oninput=e=>{
 const t=e.target,d=t.dataset;
 if(d.root)draft[d.root]=t.value;
 const q=qs[t.closest('[data-index]')?.dataset.index];
 if(d.field)q[d.field]=d.field==='required'?t.checked:t.value;
 if(d.option!=null)q.options[d.option].label=t.value;
 if(d.next!=null)q.options[d.next].next=t.value===''?null:+t.value;
 save();if(d.field==='type')editor();
 };
 function rebuild(){save();editor()}
 app.querySelectorAll('[data-index]').forEach((panel,i)=>{
 const q=qs[i];panel.querySelector('[data-add]')?.addEventListener('click',()=>{q.options.push({label:''});rebuild()});
 panel.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{q.options.splice(+b.dataset.drop,1);rebuild()});
 panel.querySelector('[data-remove]').onclick=()=>{qs.splice(i,1);qs.forEach(x=>x.options.forEach(o=>{if(o.next===i)o.next=null;else if(o.next>i)o.next--}));rebuild()};
 });
 $('#add').onclick=()=>{qs.push(blank());rebuild();app.querySelector('[data-index="'+(qs.length-1)+'"] input').focus()};
 $('#list').onclick=()=>{app.oninput=null;dashboard().catch(error)};
 $('#publish').onclick=async()=>{const b=$('#publish');b.disabled=true;try{const f=await api('/api/admin/forms',draft);localStorage.removeItem('cufa-draft');app.oninput=null;show('<section class="result-head"><h2>Опрос опубликован</h2></section><label class="field">Ссылка для участников<input readonly value="'+esc(location.origin+'/s/'+f.id)+'"></label><div class="tools"><a href="/s/'+f.id+'">Открыть опрос</a><a href="/admin">В админку</a></div>');$('input').onclick=e=>e.target.select()}catch(e){error(e);b.disabled=false}};
}
async function results(id){
 const [f,rows]=await Promise.all([api('/api/form/'+id),api('/api/admin/results/'+id)]);
 function display(q,v){if(v==null)return 'Без ответа';return q.type==='text'?v:(Array.isArray(v)?v:[v]).map(i=>q.options[i].label).join(', ')}
 show('<a href="/admin">Мои опросы</a><section class="result-head"><small>Статистика</small><h2>'+esc(f.title)+'</h2><p>Получено анкет: '+rows.length+'</p></section>'+f.questions.map((q,i)=>{
 const vals=rows.map(r=>r.answers[i]).filter(v=>v!=null);
 return '<article class="card"><h3>'+esc(q.title)+'</h3><small>Ответили: '+vals.length+' из '+rows.length+'</small>'+(q.type==='text'?vals.map(v=>'<p>'+esc(v)+'</p>').join(''):q.options.map((o,n)=>{const count=vals.filter(v=>Array.isArray(v)?v.includes(n):v===n).length,pct=vals.length?Math.round(100*count/vals.length):0;return '<div class="score-label"><span>'+esc(o.label)+'</span><span>'+count+' · '+pct+'%</span></div><progress max="100" value="'+pct+'"></progress>'}).join(''))+'</article>'}).join('')+'<h3>Отдельные анкеты</h3>'+rows.map((r,n)=>'<details class="directory"><summary>Анкета '+(rows.length-n)+' · '+esc(r.date)+' UTC</summary>'+f.questions.map((q,i)=>'<p><b>'+esc(q.title)+'</b><br>'+esc(display(q,r.answers[i]))+'</p>').join('')+'</details>').join(''));
}
show('Загрузка…');
(location.pathname==='/admin'?(key?dashboard().catch(login):Promise.resolve(login())):location.pathname.startsWith('/s/')?start():home()).catch(error);
