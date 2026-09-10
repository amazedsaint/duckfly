import base from '../../web/vite.config.js';
import { fileURLToPath } from 'node:url';
import { mkdir,writeFile,appendFile,readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
const reports=fileURLToPath(new URL('./reports/',import.meta.url));
export default {...base,root:fileURLToPath(new URL('../../web',import.meta.url)),server:{host:'127.0.0.1',port:5190,strictPort:true,watch:null,hmr:false},plugins:[{name:'temporal-evidence',configureServer(server){
 server.middlewares.use('/__temporal',async(req,res)=>{
  try{
   if(req.method!=='POST'||req.headers.origin!=='http://127.0.0.1:5190')throw Error('Local experiment POST required');
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>5000000)throw Error('Oversized trial');}
   const {run,event,data}=JSON.parse(raw);if(!/^[a-z0-9-]{1,70}$/.test(run))throw Error('Invalid name');
   await mkdir(reports,{recursive:true});const path=reports+run+'.jsonl';
   if(event==='start')await writeFile(path,JSON.stringify({event,data})+'\n',{flag:'wx'});
   else if(event==='trial')await appendFile(path,JSON.stringify({event,data})+'\n');
   else if(event==='complete'){
    const lines=(await readFile(path,'utf8')).trim().split('\n').map(JSON.parse),header=lines[0].data,trials=lines.filter(e=>e.event==='trial').map(e=>e.data);
    if(trials.length!==header.expectedTrials||new Set(trials.map(t=>t.id+'/'+t.condition)).size!==trials.length)throw Error('Incomplete or duplicate trials');
    const result={...header,...data,trials};await writeFile(reports+run+'.json.gz',gzipSync(JSON.stringify(result)),{flag:'wx'});await appendFile(path,JSON.stringify({event,data})+'\n');
   }else throw Error('Invalid event');
   res.end(JSON.stringify({saved:true}));
  }catch(e){res.statusCode=400;res.end(e.message);}
 });
}}]};
