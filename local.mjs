import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {Readable} from 'node:stream';
import worker from './dist/server/index.js';
const db=new DatabaseSync(process.env.DB_PATH||'cufa.sqlite');
function prepare(query,args=[]){
 const statement=db.prepare(query);
 return {bind:(...values)=>prepare(query,values),run:()=>statement.run(...args),all:()=>({results:statement.all(...args)}),first:()=>statement.get(...args)};
}
const portIndex=process.argv.indexOf('--port');
const port=Number(process.env.PORT||(portIndex>=0?process.argv[portIndex+1]:3000));
http.createServer(async(req,res)=>{
 try{
 const method=req.method;
 const request=new Request(new URL(req.url,'http://localhost'),{method,headers:req.headers,...(['GET','HEAD'].includes(method)?{}:{body:Readable.toWeb(req),duplex:'half'})});
 const response=await worker.fetch(request,{DB:{prepare},ADMIN_PASSWORD:process.env.ADMIN_PASSWORD});
 res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.writeHead(500);res.end('Ошибка сервера')}
}).listen(port,'0.0.0.0',()=>console.log('CUFA listening on port',port));
