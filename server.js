import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { readFileSync, mkdirSync } from 'node:fs';
import { extname, resolve } from 'node:path';
mkdirSync('data',{recursive:true});
const db = new DatabaseSync(process.env.DB_PATH || 'data/reads.sqlite');
db.exec(`PRAGMA foreign_keys=ON; CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, salt TEXT, admin INTEGER DEFAULT 0); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires INTEGER); CREATE TABLE IF NOT EXISTS books(id INTEGER PRIMARY KEY,title TEXT,author TEXT,category TEXT,description TEXT,cover TEXT,pages TEXT); CREATE TABLE IF NOT EXISTS progress(user_id INTEGER REFERENCES users(id),book_id INTEGER REFERENCES books(id),page INTEGER,PRIMARY KEY(user_id,book_id));`);
const insert=db.prepare('INSERT INTO books(title,author,category,description,cover,pages) VALUES(?,?,?,?,?,?)');
if(!db.prepare('SELECT id FROM books LIMIT 1').get()) {
 const stories=[['Ramayana','Valmiki','Mythology','A timeless journey of courage, compassion, and the triumph of light.','rama'],['Mahabharata','Vyasa','Mythology','Discover the choices and wisdom at the heart of an enduring epic.','temple'],['Stories of the Forest','MystiqMode Originals','Short Stories','Small adventures. Unexpected friendships. A little everyday wonder.','forest']];
 const content=[['The Birth of Rama','In the ancient city of Ayodhya, the morning light fell across palace courtyards and quiet gardens. King Dasharatha longed for children to fill his home with joy.\n\nWhen Rama was born, the city celebrated. Lamps shone in doorways, music drifted through the streets, and hope found a place in every heart.'],['A Child of Light','Rama grew up with compassion, courage, and a deep sense of truth. From a young age, he showed kindness to all living beings.\n\nHe listened carefully to his teachers and learned beside his brothers. Strength, he discovered, mattered most when it protected someone else.'],['Into the Forest','The forest stretched beyond the familiar roads of Ayodhya. Beneath its trees, each day brought new lessons: patience, resilience, and the comfort of companionship.\n\nWith Sita and Lakshmana beside him, Rama walked onward. A simple shelter and a shared meal became a home.'],['The Strength of Friendship','On the long journey, friendship became a source of strength. Hanuman offered his courage and devotion, asking for nothing in return.\n\nTogether they faced distances and doubts that no one could have overcome alone.'],['A Light to Carry','These stories have travelled through generations, changing with every voice that tells them. Their questions remain close to us: how do we act with courage, and how do we care for one another?\n\nCarry those questions with you beyond the final page.']];
 stories.forEach((b,i)=>insert.run(...b,JSON.stringify(i===0?content:content.map((p,j)=>[j===0?b[0]:p[0],i===1?'An original introductory reflection inspired by the epic.\n\nThe great stories invite us to consider duty, friendship, and the consequences of our choices. Every reader brings a new perspective to these enduring questions.':'At the edge of a green forest, a traveller paused to listen. Leaves rustled, birds called, and the path ahead curved into the sunlight.\n\nEach encounter offered a small lesson in kindness. Sometimes the most remarkable adventure begins by paying attention.']))));
}
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
function user(req){const token=(req.headers.cookie||'').match(/(?:^|;\s*)session=([a-f0-9]+)/)?.[1];return token?db.prepare('SELECT u.id,u.name,u.email,u.admin FROM users u JOIN sessions s ON s.user_id=u.id WHERE token=? AND expires>?').get(token,Date.now()):null;}
async function body(req){let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>2_000_000)throw new Error('Request too large');}return JSON.parse(data||'{}');}
const server=http.createServer(async(req,res)=>{
 try{
 const url=new URL(req.url,'http://localhost');const path=url.pathname;const me=user(req);
 if(req.method==='POST' && path.startsWith('/api/')) {
 if(req.headers.origin && req.headers.origin!==`http://${req.headers.host}` && req.headers.origin!==`https://${req.headers.host}`)return json(res,403,{error:'Origin not allowed'});
 const b=await body(req);
 if(path==='/api/register'||path==='/api/login'){
 const email=String(b.email||'').trim().toLowerCase();const password=String(b.password||'');
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<8||password.length>256)return json(res,400,{error:'Use a valid email and a password of 8–256 characters.'});
 let account;
 if(path==='/api/register'){
 const name=String(b.name||'').trim().slice(0,80);if(!name)return json(res,400,{error:'Enter your name.'});
 if(db.prepare('SELECT id FROM users WHERE email=?').get(email))return json(res,409,{error:'This email is already registered.'});
 const salt=randomBytes(16).toString('hex'); const admin=db.prepare('SELECT COUNT(*) AS n FROM users').get().n===0?1:0;
 const result=db.prepare('INSERT INTO users(name,email,password,salt,admin) VALUES(?,?,?,?,?)').run(name,email,scryptSync(password,salt,64).toString('hex'),salt,admin);account={id:Number(result.lastInsertRowid),name,email,admin};
 }else{
 const row=db.prepare('SELECT * FROM users WHERE email=?').get(email);
 if(!row||!timingSafeEqual(Buffer.from(row.password,'hex'),scryptSync(password,row.salt,64)))return json(res,401,{error:'Email or password is incorrect.'});
 account={id:row.id,name:row.name,email:row.email,admin:row.admin};
 }
 const token=randomBytes(32).toString('hex');db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(token,account.id,Date.now()+604800000);
 res.setHeader('Set-Cookie',`session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${process.env.COOKIE_SECURE==='1'?'; Secure':''}`);return json(res,200,account);
 }
 if(path==='/api/logout'){const token=(req.headers.cookie||'').match(/session=([a-f0-9]+)/)?.[1];if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(token);res.setHeader('Set-Cookie','session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');return json(res,200,{ok:true});}
 if(!me)return json(res,401,{error:'Please sign in first.'});
 if(path==='/api/progress'){
 const book=db.prepare('SELECT pages FROM books WHERE id=?').get(Number(b.bookId));if(!book||!Number.isInteger(b.page)||b.page<0||b.page>=JSON.parse(book.pages).length)return json(res,400,{error:'Invalid reading position.'});
 db.prepare('INSERT INTO progress VALUES(?,?,?) ON CONFLICT(user_id,book_id) DO UPDATE SET page=excluded.page').run(me.id,b.bookId,b.page);return json(res,200,{ok:true});
 }
 if(path==='/api/books'){
 if(!me.admin)return json(res,403,{error:'Only the library admin can upload books.'});
 const title=String(b.title||'').trim().slice(0,120),author=String(b.author||'').trim().slice(0,100),text=String(b.text||'').trim();
 if(!title||!author||!text||text.length>500000)return json(res,400,{error:'Provide a title, author, and text (up to 500 KB).'});
 const paragraphs=text.split(/\n\s*\n/);const pages=[];let page='';for(const p of paragraphs){for(let start=0;start<p.length;start+=1200){const piece=p.slice(start,start+1200);if(page.length+piece.length>1500&&page){pages.push(['',page]);page='';}page+=(page?'\n\n':'')+piece;}}if(page)pages.push(['',page]);pages[0][0]=title;
 const id=insert.run(title,author,['Mythology','Short Stories','History','Originals'].includes(b.category)?b.category:'Originals',String(b.description||'').slice(0,500),'temple',JSON.stringify(pages)).lastInsertRowid;return json(res,201,{id:Number(id)});
 }
 }
 if(req.method==='GET'&&path==='/api/me')return json(res,200,me||null);
 if(req.method==='GET'&&path==='/api/books')return json(res,200,db.prepare('SELECT id,title,author,category,description,cover FROM books').all());
 if(req.method==='GET'&&/^\/api\/books\/\d+$/.test(path)){const book=db.prepare('SELECT * FROM books WHERE id=?').get(Number(path.split('/').pop()));if(!book)return json(res,404,{error:'Book not found'});book.pages=JSON.parse(book.pages);book.progress=me?db.prepare('SELECT page FROM progress WHERE user_id=? AND book_id=?').get(me.id,book.id)?.page||0:0;return json(res,200,book);}
 if(req.method==='GET'&&path==='/api/progress')return me?json(res,200,db.prepare('SELECT book_id,page FROM progress WHERE user_id=?').all(me.id)):json(res,401,{error:'Sign in first'});
 if(path.startsWith('/api/'))return json(res,404,{error:'Not found'});
 const file=resolve('public',path==='/'?'index.html':'.'+path);if(!file.startsWith(resolve('public')+'/'))return json(res,403,{error:'Forbidden'});
 try{const data=readFileSync(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.css':'text/css','.js':'text/javascript','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'}[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(data);}catch{json(res,404,{error:'Not found'});}
 }catch(err){json(res,400,{error:err.message==='Request too large'?'Upload is too large.':'Could not process this request.'});}
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('MystiqMode Reads running on port '+(process.env.PORT||3000)));
