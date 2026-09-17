import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { loadTopicClusters, selectBalancedClusterRows } from './lib/internal-linking.js';
import { buildCandidates, validateTopicIdeas } from './replenish-drip-queue.js';
const data = loadTopicClusters();
const candidates = data.clusters.flatMap(c => Array.from({length: 3}, (_, n) => ({cluster: c.key, title: `${c.key} ${n}`, slug: `${c.key}-${n}`})));

test('all eleven clusters publish before a cluster repeats, despite historical AI dominance', () => {
  const history = Array.from({length: 200}, (_, i) => ({cluster: 'ai-creator-tools', date: `2026-08-${String(i % 28 + 1).padStart(2,'0')}`}));
  const plan = selectBalancedClusterRows(candidates, history, 22, data);
  assert.equal(new Set(plan.slice(0,11).map(r => r.cluster)).size, 11);
  assert.equal(new Set(plan.slice(11,22).map(r => r.cluster)).size, 11);
  assert.notEqual(plan[0].cluster, 'ai-creator-tools');
});
test('selection survives separate scheduler runs using persisted publish dates', () => {
  let remaining = [...candidates], history = [], selected = [];
  for(let i=0;i<22;i++) {
    const [row] = selectBalancedClusterRows(remaining, history, 1, data);
    selected.push(row); history.push({...row,date:new Date(Date.UTC(2026,8,16,0,i)).toISOString()});
    remaining = remaining.filter(r=>r.slug!==row.slug);
  }
  assert.equal(new Set(selected.slice(0,11).map(r=>r.cluster)).size,11);
  assert.equal(new Set(selected.slice(11).map(r=>r.cluster)).size,11);
});
test('reserve planning fills missing clusters before adding more AI drafts',()=>{
  const plan=selectBalancedClusterRows(candidates,[],10,data,candidates.filter(r=>r.cluster==='ai-creator-tools'));
  assert.equal(new Set(plan.map(r=>r.cluster)).size,10);
  assert.ok(plan.every(r=>r.cluster!=='ai-creator-tools'));
});
test('short reserves and unavailable clusters do not block healthy candidates',()=>{
  assert.equal(selectBalancedClusterRows(candidates.slice(0,2),[],28,data).length,2);
  assert.deepEqual(selectBalancedClusterRows([],[],8,data),[]);
});
test('explicit cluster is preserved where several clusters share one niche',()=>{
  const batches=[{niche:'ai-creator-tools',keywords:{informational:[{keyword:'how to archive finished creative projects',suggested_title:'An archive you can actually find again',cluster:'creator-automation'}]}}];
  const rows=buildCandidates([], '', batches, data);
  assert.equal(rows.find(r=>r.keyword==='how to archive finished creative projects').cluster,'creator-automation');
  assert.ok(rows.every(r=>r.niche!=='ai-advantage-campaign'));
});
test('topic gate rejects duplicates, invented clusters, news, and thin briefs',()=>{
  const base={cluster:'creator-automation',keyword:'how to archive finished creative projects',title:'An archive you can actually find again',brief:'A practical naming and retrieval workflow for completed creative work.'};
  const rows=validateTopicIdeas([base,base,{...base,cluster:'invented'},{...base,keyword:'latest AI product news 2026'},{...base,brief:'thin'}],data.clusters,[]);
  assert.equal(rows.length,1);
  assert.equal(rows[0].demand_verified,false);
  assert.equal(validateTopicIdeas([base],data.clusters,[{title:base.keyword}]).length,0);
});
test('Blogger invalid_grant produces a visible reconnect warning even after dismissal',()=>{
  const html=fs.readFileSync(new URL('../static/dashboard/index.html',import.meta.url),'utf8');
  const code=html.slice(html.indexOf('const TOKEN_PLATFORMS'),html.indexOf('function copyDashCommand'));
  const elements={'token-alerts':{innerHTML:''},'health-chips':{innerHTML:'',children:[],appendChild(c){this.children.push(c)}}};
  const context=vm.createContext({Date,JSON,console,navigator:{clipboard:{writeText:async()=>{}}},setTimeout,esc:s=>String(s),localStorage:{getItem:()=>JSON.stringify({blogger:Date.now()}),setItem(){}},document:{getElementById:id=>elements[id],createElement:()=>({})}});
  vm.runInContext(code,context);
  const results=[{syndication:{blogger:{status:'failed',error:'Blogger token refresh failed (invalid_grant): Bad Request'}}}];
  const health={checks:[{name:'Blogger token refresh',ok:false,detail:'invalid_grant'}]};
  assert.equal(context.getTokenStatusMap(results).blogger.state,'warn');
  context.renderTokenStatus(results,health); context.renderHealth(health,results);
  assert.ok(elements['health-chips'].children.some(c=>c.innerHTML.includes('npm run blogger-token')));
  assert.ok(html.includes('Copy Blogger reconnect command'));
});

import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
function fixture(t, failAfter = 100) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'voa-refill-test-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'scripts/lib'),{recursive:true});
  fs.mkdirSync(path.join(root,'static/_data'),{recursive:true});
  fs.mkdirSync(path.join(root,'static/blog/boom/drafts'),{recursive:true});
  fs.writeFileSync(path.join(root,'package.json'),'{"type":"module"}');
  fs.symlinkSync(path.resolve('node_modules'),path.join(root,'node_modules'),'dir');
  for(const f of ['replenish-drip-queue.js','content-niches.js','lib/internal-linking.js','lib/clean-url.js','lib/anthropic-client.js','lib/keyword-evidence.js']) fs.copyFileSync(path.join('scripts',f),path.join(root,'scripts',f));
  fs.copyFileSync('static/_data/topic-clusters.json',path.join(root,'static/_data/topic-clusters.json'));
  fs.writeFileSync(path.join(root,'static/_data/boom-posts.json'),'[]');
  const queueFile=path.join(root,'static/_data/drip-queue.json');
  fs.writeFileSync(queueFile,JSON.stringify({status:'active',queue:[],published:[]}));
  fs.writeFileSync(path.join(root,'scripts/generate-post.js'), `import fs from 'node:fs'; const dir='static/blog/boom/drafts';const n=fs.readdirSync(dir).length;if(n>=${failAfter})process.exit(1);fs.writeFileSync(dir+'/fixture-'+n+'.html','<h1>Fixture article '+n+'</h1>');`);
  const run=()=>spawnSync(process.execPath,['scripts/replenish-drip-queue.js','--execute','--no-topics'],{cwd:root,encoding:'utf8',env:{...process.env,ANTHROPIC_API_KEY:'',QUEUE_REPLENISH_MAX:'8',QUEUE_REPLENISH_THRESHOLD:'14',QUEUE_REPLENISH_TARGET:'22'}});
  return {root,queueFile,run,read:()=>JSON.parse(fs.readFileSync(queueFile,'utf8'))};
}
test('daily spend budget survives reruns and no-topics makes zero planning requests',t=>{
  const f=fixture(t);
  const first=f.run(); assert.equal(first.status,0,first.stderr);
  assert.equal(f.read().queue.length,8);
  assert.equal(f.read().replenishment.generationBudget.attempts,8);
  assert.equal(f.read().replenishment.lastTopicAttempt,undefined);
  const second=f.run(); assert.equal(second.status,0,second.stderr);
  assert.equal(f.read().queue.length,8);
});
test('one successful draft survives two later failures with attempts checkpointed',t=>{
  const f=fixture(t,1); const result=f.run();
  assert.equal(result.status,1);
  assert.equal(f.read().queue.length,1);
  assert.equal(f.read().replenishment.generationBudget.attempts,3);
});
test('paused queues do not spend or generate',t=>{
  const f=fixture(t); fs.writeFileSync(f.queueFile,JSON.stringify({status:'paused',queue:[]}));
  assert.equal(f.run().status,0); assert.equal(f.read().replenishment,undefined);
});

import { extractSearchEvidence, extractClusterEvidence, freshKeywordEvidence } from './lib/keyword-evidence.js';
test('research requires tool results, never treating model-written URLs as verified sources',()=>{
  const evidence=extractSearchEvidence({content:[{type:'text',text:'See https://invented.example/'},{type:'server_tool_use',name:'web_search',input:{query:'creator workflow'}},{type:'web_search_tool_result',content:[{type:'web_search_result',url:'https://observed.example/',title:'Observed'},{type:'web_search_result',url:'https://observed.example/',title:'Duplicate'}]}]});
  assert.deepEqual(evidence.queries,['creator workflow']);
  assert.equal(evidence.sources.length,1);
  assert.equal(evidence.sources[0].url,'https://observed.example/');
  assert.equal(extractSearchEvidence({content:[{type:'text',text:'https://invented.example/'}]}).sources.length,0);
});
test('research cache rejects stale and invalid dates and keeps newest valid cluster evidence',()=>{
  const now=Date.now();
  const batch=(age,value)=>({source:'cluster-search-evidence',date:new Date(now-age).toISOString(),research:[{cluster:'ai-creator-tools',observations:value}]});
  const rows=freshKeywordEvidence([batch(20*86400000,'old'),batch(86400000,'valid'),batch(1000,'new'),{source:'cluster-search-evidence',date:'invalid',research:[{cluster:'fake'}]}],now);
  assert.equal(rows.length,1);assert.equal(rows[0].observations,'new');
});
test('batched research keeps each cluster paired with its actual search results',()=>{
  const clusters=[{key:'ai-creator-tools'},{key:'purpose-direction'}];
  const message={content:[
    {type:'server_tool_use',name:'web_search',input:{query:'AI creator workflow'}},
    {type:'web_search_tool_result',content:[{type:'web_search_result',url:'https://ai.example/',title:'AI'}]},
    {type:'server_tool_use',name:'web_search',input:{query:'how to find purpose'}},
    {type:'web_search_tool_result',content:[{type:'web_search_result',url:'https://purpose.example/',title:'Purpose'}]},
    {type:'text',text:'[{"cluster":"ai-creator-tools","observations":"Observed AI workflow coverage."},{"cluster":"purpose-direction","observations":"Observed purpose coverage."}]'},
  ]};
  const rows=extractClusterEvidence(message,clusters);
  assert.equal(rows[0].queries[0],'AI creator workflow');
  assert.equal(rows[0].sources[0].url,'https://ai.example/');
  assert.equal(rows[1].sources[0].url,'https://purpose.example/');
});

import { selectBackfillBatch } from './lib/syndication-backlog.js';
test('Blogger daily cap leaves room for other platforms and survives exhausted allowance',()=>{
  const backlog=Array.from({length:8},(_,i)=>({slug:`post-${i}`,missing:['blogger']}));
  backlog.push({slug:'wordpress-pending',missing:['blogger','wordpress_earthstar']});
  const first=selectBackfillBatch(backlog,8,4);
  assert.equal(first.filter(r=>r.missing.includes('blogger')).length,4);
  assert.ok(first.some(r=>r.slug==='wordpress-pending'));
  const next=selectBackfillBatch(backlog,8,0);
  assert.deepEqual(next,[{slug:'wordpress-pending',missing:['wordpress_earthstar']}]);
});
