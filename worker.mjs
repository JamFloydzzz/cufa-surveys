const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
function check(ok,message){if(!ok)throw new Error(message)}
function validate(f){
  check(typeof f.title==='string'&&f.title.trim()&&f.title.length<=200,'Введите название до 200 символов.');
  check(typeof f.description==='string'&&f.description.length<=3000,'Сократите описание.');
  check(Array.isArray(f.questions)&&f.questions.length>0&&f.questions.length<=100,'Добавьте от 1 до 100 вопросов.');
  f.questions.forEach((q,i)=>{
    check(q.title?.trim()&&q.title.length<=500&&['single','multi','text'].includes(q.type),'Проверьте вопрос '+(i+1));
    if(q.type==='text')return;
    check(Array.isArray(q.options)&&q.options.length>=2&&q.options.length<=50,'Нужно от 2 до 50 вариантов.');
    check(new Set(q.options.map(o=>o.label.trim())).size===q.options.length,'Варианты должны различаться.');
    q.options.forEach(o=>{
      check(o.label.trim()&&o.label.length<=300,'Заполните варианты.');
      check(q.type!=='single'||o.next==null||o.next===-1||(Number.isInteger(o.next)&&o.next>i&&o.next<f.questions.length),'Проверьте переход.');
    });
  });
}
function answers(f,raw){
  const clean={};
  for(let i=0;i<f.questions.length;){
    const q=f.questions[i], value=raw[i];
    let next=i+1;
    if(value!=null && value!=='' && !(Array.isArray(value)&&!value.length)){
      if(q.type==='text')check(typeof value==='string'&&value.trim()&&value.length<=5000,'Проверьте текст ответа.');
      else{
        const indices=q.type==='multi'?value:[value];
        check(Array.isArray(indices)&&indices.length===new Set(indices).size&&indices.every(n=>Number.isInteger(n)&&q.options[n]),'Проверьте выбранные варианты.');
        if(q.type==='single')next=q.options[value].next??next;
      }
      clean[i]=value;
    }else check(!q.required,'Ответьте на обязательный вопрос.');
    if(next===-1)break;
    i=next;
  }
  return clean;
}
export default {async fetch(req,env){
 const path=new URL(req.url).pathname;
 if(!path.startsWith('/api/')){
   const script=path==='/app.js';
   if(!script&&!['/','/admin'].includes(path)&&!/^\/s\/[\w-]+$/.test(path))return new Response('Страница не найдена',{status:404});
   return new Response(script?client:html,{headers:{'content-type':script?'text/javascript; charset=utf-8':'text/html; charset=utf-8'}});
 }
 try{
 const db=env.DB, sql=(query,...args)=>db.prepare(query).bind(...args);
 await db.prepare('CREATE TABLE IF NOT EXISTS forms(id TEXT PRIMARY KEY, data TEXT NOT NULL)').run();
 await db.prepare('CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY, form TEXT, data TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP)').run();
 await sql('INSERT OR IGNORE INTO forms VALUES(?,?)',seed.id,JSON.stringify(seed)).run();
 if(path.startsWith('/api/admin')){
   const pass=req.headers.get('X-Admin-Key')||'';
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pass))),b=>b.toString(16).padStart(2,'0')).join('');
   if(!pass||(env.ADMIN_PASSWORD?pass!==env.ADMIN_PASSWORD:hash!=='a06c56db628557cda8fd745c8e1b8d502e65136da8bf7ba1a6006463f8652f80'))return json({error:'Неверный пароль администратора.'},403);
 }
 if(req.method==='GET'&&path==='/api/forms'){
   const {results}=await sql('SELECT data FROM forms ORDER BY rowid DESC').all();
   return json(results.map(r=>{const {id,title,description,questions}=JSON.parse(r.data);return {id,title,description,count:questions.length}}));
 }
 const parts=path.split('/'), id=parts.at(-1);
 if(req.method==='GET'&&path==='/api/admin/list')return json(true);
 if(req.method==='GET'&&path==='/api/admin/results/'+id){
   const {results}=await sql('SELECT data,created FROM responses WHERE form=? ORDER BY rowid DESC',id).all();return json(results.map(r=>({date:r.created,answers:JSON.parse(r.data)})));
 }
 if(req.method==='POST'&&path==='/api/admin/forms'){
   const f=await req.json();validate(f);f.id=crypto.randomUUID();await sql('INSERT INTO forms VALUES(?,?)',f.id,JSON.stringify(f)).run();return json({id:f.id},201);
 }
 if(path==='/api/form/'+id){
   const row=await sql('SELECT data FROM forms WHERE id=?',id).first();
   if(!row)return json({error:'Опрос не найден.'},404);
   const f=JSON.parse(row.data);
   if(req.method==='GET')return json(f);
   if(req.method==='POST'){
     const b=await req.json();check(/^[a-f0-9-]{36}$/.test(b.token),'Обновите страницу.');
     const clean=answers(f,b.answers);await sql('INSERT OR IGNORE INTO responses(id,form,data) VALUES(?,?,?)',id+b.token,id,JSON.stringify(clean)).run();return json(true);
   }
 }
 return json({error:'Страница не найдена.'},404);
 }catch(e){return json({error:e.message},400)}
}};
