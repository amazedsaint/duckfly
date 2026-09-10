import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { fetchBytes } from '../src/assets.js';
test('compressed asset loader accepts raw gzip and browser-decoded responses',async()=>{
  const original=globalThis.fetch;
  try{
    for(const compressed of [false,true]){
      const data=Buffer.from('{"model":"Microduck"}');
      globalThis.fetch=async()=>new Response(compressed?gzipSync(data):data);
      assert.equal(new TextDecoder().decode(await fetchBytes('/test.json.gz')),data.toString());
    }
    globalThis.fetch=async()=>new Response('',{status:404});
    await assert.rejects(()=>fetchBytes('/missing'),/404/);
  }finally{globalThis.fetch=original;}
});
