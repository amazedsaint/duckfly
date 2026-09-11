import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sources={};
for(const f of ['arena-dd-browser.mjs','arena-dd-server.mjs'])sources[f]=sha(await readFile(new URL(f,import.meta.url)));
for(const f of ['web/src/arena.js','web/src/lab/lab-arena.js','web/src/lab/lab-world.js','web/src/lab/scene.js','shared/vision/frame.js'])sources[f]=sha(await readFile(new URL('../../../'+f,import.meta.url)));
const server=createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5182');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  try{
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&req.url==='/arena-dd-browser.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('arena-dd-browser.mjs',import.meta.url)));return;}
    if(req.method!=='POST'||req.url!=='/result'){res.writeHead(404);res.end();return;}
    let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>85_000_000)throw Error('Probe body exceeds bound');chunks.push(chunk);}
    const data=JSON.parse(Buffer.concat(chunks));if(data.probe!=='actual-arena-dd-transfer-v1'||data.records.length!==66||data.records.some(r=>r.frames.length!==31))throw Error('Incomplete cohort');
    const bytes=gzipSync(JSON.stringify({...data,sources}),{level:9});
    await writeFile(new URL('../reports/candidates-arena-dd-v1.json.gz',import.meta.url),bytes);
    const summary={probe:data.probe,movies:66,frames:2046,sourceSha256:sources,artifactSha256:sha(bytes),interpretation:data.interpretation};
    await writeFile(new URL('../reports/candidates-arena-dd-v1-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');
    res.setHeader('Content-Type','application/json');res.end(JSON.stringify(summary));
  }catch(e){res.writeHead(400);res.end(e.message);}
});server.listen(0,'127.0.0.1',()=>console.log(`DD arena collector http://127.0.0.1:${server.address().port}`));
