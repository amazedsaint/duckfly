import{createServer}from'node:http';import{readFile,writeFile}from'node:fs/promises';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex'),sources={};
for(const f of['arena-marker-browser-v2.mjs','arena-marker-server-v2.mjs'])sources[f]=sha(await readFile(new URL(f,import.meta.url)));
for(const f of['web/src/arena.js','web/src/lab/lab-arena.js','web/src/lab/lab-world.js','web/src/lab/scene.js'])sources[f]=sha(await readFile(new URL('../../../'+f,import.meta.url)));
const server=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5182');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');try{
 if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
 if(req.method==='GET'&&req.url==='/arena-marker-browser-v2.mjs'){res.setHeader('Content-Type','text/javascript');res.end(await readFile(new URL('arena-marker-browser-v2.mjs',import.meta.url)));return;}
 if(req.method!=='POST'||req.url!=='/result'){res.writeHead(404);res.end();return;}
 let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65_000_000)throw Error('Probe body too large');chunks.push(chunk);}
 const data=JSON.parse(Buffer.concat(chunks));if(data.probe!=='actual-arena-marker-v2'||data.records.length!==32||data.records.some(r=>r.frames.length!==51))throw Error('Incomplete cohort');
 const bytes=gzipSync(JSON.stringify({...data,sources}),{level:9}),summary={probe:data.probe,movies:32,frames:1632,sources,artifactSha256:sha(bytes),interpretation:data.interpretation};
 await writeFile(new URL('../reports/candidates-arena-marker-v2.json.gz',import.meta.url),bytes);await writeFile(new URL('../reports/candidates-arena-marker-v2-summary.json',import.meta.url),JSON.stringify(summary,null,2)+'\n');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(summary));
 }catch(e){res.writeHead(400);res.end(e.message);}});server.listen(0,'127.0.0.1',()=>console.log(`Marker arena collector http://127.0.0.1:${server.address().port}`));
