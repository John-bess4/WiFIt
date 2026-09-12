// Synthetic browser acceptance. Supabase traffic is intercepted; no live writes.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.WIFIT_PLAYWRIGHT_MODULE || 'playwright');
const localURL=new URL(process.env.WIFIT_WEB_QA_URL || 'http://127.0.0.1:5198/');
assert.ok(['127.0.0.1','localhost','[::1]'].includes(localURL.hostname),'Use a local QA server only');
const owner='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:390,height:844}});
let generation=1, writes=0;const failures=[],consoleErrors=[],requests=[];
page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
page.on('pageerror',error=>failures.push(error.message));
await page.addInitScript(({owner})=>{
 localStorage.setItem('sb_session',JSON.stringify({access_token:'synthetic-browser-token',refresh_token:'synthetic-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:owner}}));
 localStorage.setItem('wifit_chat_'+owner,JSON.stringify([{bot:false,text:'Synthetic old private chat'}]));
 localStorage.setItem('wifit_workout_'+owner,JSON.stringify({workout:{name:'Synthetic old personal draft'},sets:[],startedAt:Date.now()}));
},{owner});
await page.route('https://vghqqksbjpgdzmvfmnru.supabase.co/**',async route=>{
 const request=route.request(),url=new URL(request.url());requests.push({path:url.pathname,method:request.method()});
 let body=[];let status=200;
 if(url.pathname.endsWith('/rpc/wifit_data_generation'))body=generation;
 else if(url.pathname.endsWith('/profiles'))body=[{id:owner,name:'Synthetic Browser QA',cal_goal:2200,protein_goal:140,carbs_goal:180,fat_goal:78,theme:'cottoncandy_light',created_at:'2026-09-11T12:00:00Z'}];
 else if(request.method()==='POST'&&url.pathname.endsWith('/water_log')){
   writes++;assert.equal(request.headers()['x-wifit-data-generation'],'1');
   status=409;body={code:'PT409',message:'WiFit data was removed. Discard old drafts and refresh before writing.'};
 }
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
});
try{
 await page.goto(localURL.href);
 await page.getByTestId('water-add').waitFor();
 assert.equal(await page.evaluate(owner=>(localStorage.getItem('wifit_chat_'+owner)||'').includes('Synthetic old private chat'),owner),false);
 assert.equal(await page.evaluate(owner=>localStorage.getItem('wifit_workout_'+owner),owner),null);
 generation=2;
 await page.getByTestId('water-add').click();
 await page.getByTestId('data-generation-recovery').waitFor();
 assert.equal(await page.getByRole('heading',{name:'Your WiFit data was removed'}).count(),1);
 assert.equal(writes,1);
 await page.getByRole('button',{name:'Reload current data'}).click();
 await page.getByTestId('water-add').waitFor();
 const state=await page.evaluate(async()=>{const {sb}=await import('/src/lib/supabase.js');return {generation:sb.dataContext().generation,owner:sb.getUser().id};});
 assert.equal(state.generation,2);assert.equal(state.owner,owner);assert.equal(writes,1);
 assert.deepEqual(failures,[]);
 const expected=consoleErrors.filter(message=>message.includes('[sb.upsert] water_log 409')||message.includes('Failed to load resource: the server responded with a status of 409'));
 assert.equal(consoleErrors.length,expected.length,JSON.stringify(consoleErrors));
 console.log(JSON.stringify({result:'passed',synthetic:true,writeAttempts:writes,verifiedGeneration:state.generation,pages:'Initial Home → removal recovery → fresh empty Home',requests:requests.length,expectedConsoleErrors:expected.length}));
}finally{await browser.close();}
