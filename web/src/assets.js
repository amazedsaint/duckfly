export async function fetchBytes(url) {
  const response=await fetch(url);
  if(!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  // Some static servers add Content-Encoding for .gz and browsers decode it.
  // Others serve raw gzip. Detect the payload, avoiding double decompression.
  if(bytes[0]===0x1f&&bytes[1]===0x8b){
    return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  }
  return bytes;
}
