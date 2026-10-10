import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
test('accounts, admin uploads, library and saved reading progress',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'reads-test-'));
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:'3197',DB_PATH:join(dir,'test.sqlite')},stdio:'pipe'});
 let output='';child.stderr.on('data',d=>output+=d);
 try{
 let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:3197/api/books');if(r.ok){ready=true;break;}}catch{}await delay(50);}assert.ok(ready,output);
 const call=async(path,body,cookie)=>{const r=await fetch('http://127.0.0.1:3197/api/'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 assert.equal((await call('books')).data.length,3);
 const admin=await call('register',{name:'Owner',email:'owner@example.com',password:'good-password'});assert.equal(admin.status,200);assert.equal(admin.data.admin,1);assert.ok(admin.cookie);
 assert.equal((await call('login',{email:'owner@example.com',password:'incorrect'})).status,401);
 assert.equal((await call('register',{name:'Duplicate',email:'owner@example.com',password:'good-password'})).status,409);
 const reader=await call('register',{name:'Reader',email:'reader@example.com',password:'another-password'});assert.equal(reader.data.admin,0);
 assert.equal((await call('books',{title:'No',author:'No',text:'No'},reader.cookie)).status,403);
 const uploaded=await call('books',{title:'A new story',author:'Writer',text:'First paragraph.\n\nSecond paragraph.',category:'Originals',description:'A test story'},admin.cookie);assert.equal(uploaded.status,201);
 const book=await call('books/'+uploaded.data.id);assert.equal(book.data.pages[0][1],'First paragraph.\n\nSecond paragraph.');
 assert.equal((await call('progress',{bookId:1,page:2},reader.cookie)).status,200);
 assert.equal((await call('books/1',null,reader.cookie)).data.progress,2);
 assert.equal((await call('progress',{bookId:1,page:999},reader.cookie)).status,400);
 assert.equal((await call('progress',null,reader.cookie)).data.length,1);
 assert.equal((await call('logout',{},reader.cookie)).status,200);
 assert.equal((await call('me',null,reader.cookie)).data,null);
 const html=await fetch('http://127.0.0.1:3197/');assert.ok((await html.text()).includes('manifest.webmanifest'));
 const manifest=await fetch('http://127.0.0.1:3197/manifest.webmanifest');assert.equal((await manifest.json()).display,'standalone');
 }finally{child.kill();await new Promise(r=>child.once('exit',r));rmSync(dir,{recursive:true,force:true});}
});
