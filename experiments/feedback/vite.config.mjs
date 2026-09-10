// Local research runner: save each completed trial without a huge browser DOM.
import base from '../../web/vite.config.js';
import { fileURLToPath } from 'node:url';
import { mkdir,writeFile,appendFile,readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const reports=fileURLToPath(new URL('./reports/',import.meta.url));
export default {...base,root:fileURLToPath(new URL('../../web',import.meta.url)),server:{host:'127.0.0.1',port:5188,strictPort:true,hmr:false,watch:null},plugins:[{name:'local-feedback-reports',configureServer(server){
 server.middlewares.use('/__research',async(req,res)=>{
  try{
   if(req.method!=='POST')throw Error('POST required');
   if(req.headers.origin!=='http://127.0.0.1:5188')throw Error('Local experiment origin required');
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4000000)throw Error('Trial too large');}
   const {run,event,data}=JSON.parse(raw);if(!/^[a-z0-9-]{1,70}$/.test(run))throw Error('Invalid report name');
   await mkdir(reports,{recursive:true});const path=reports+run+'.jsonl';
   if(event==='start')await writeFile(path,JSON.stringify({event,data})+'\n',{flag:'wx'});
   else if(event==='resume'){
    const lines=(await readFile(path,'utf8')).trim().split('\n').map(s=>JSON.parse(s)),meta=lines[0].data;
    if(lines.some(l=>l.event==='complete'))throw Error('Study already complete');
    for(const key of ['format','split','seeds','conditions','run'])if(JSON.stringify(meta[key])!==JSON.stringify(data[key]))throw Error('Resume metadata mismatch: '+key);
    const compact=lines.filter(l=>l.event==='trial').map(({data:{trace,...trial}})=>trial);
    await appendFile(path,JSON.stringify({event:'resume',data:{at:new Date().toISOString(),retained:compact.length}})+'\n');
    res.statusCode=200;res.end(JSON.stringify({trials:compact}));return;
   }else if(event==='trial'||event==='complete'){
    await appendFile(path,JSON.stringify({event,data})+'\n');
    if(event==='complete'){
     const lines=(await readFile(path,'utf8')).trim().split('\n').map(s=>JSON.parse(s));
     const result={...lines[0].data,...data,trials:lines.filter(l=>l.event==='trial').map(l=>l.data)};
     if(new Set(result.trials.map(t=>t.id+'/'+t.condition)).size!==result.trials.length)throw Error('Duplicate trial');
     if(result.trials.length!==result.seeds*4*result.conditions.length)throw Error('Incomplete trial count');
     await writeFile(reports+run+'.json.gz',gzipSync(JSON.stringify(result)),{flag:'wx'});
    }
   }else throw Error('Invalid report event');
   res.statusCode=200;res.end(JSON.stringify({saved:true,trials:[]}));
  }catch(error){res.statusCode=400;res.end(error.message);}
 });
}}]};
