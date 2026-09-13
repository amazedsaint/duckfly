export async function fetchBytes(url, {label = 'Scene asset', onProgress, signal, timeoutMs = 30000} = {}) {
  const controller = new AbortController();
  let timer, timedOut = false;
  const cancel = () => controller.abort();
  const touch = () => {
    clearTimeout(timer);
    timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  };
  signal?.addEventListener('abort', cancel, {once: true});
  if (signal?.aborted) controller.abort();
  touch();
  let bytes;
  try {
    const response = await fetch(url, {signal: controller.signal});
    if (!response.ok) throw Error(`${label} could not download (HTTP ${response.status}).`);
    if (response.body) {
      const reader = response.body.getReader(), chunks = [];
      let length = 0, lastProgress = -Infinity;
      try {
        while (true) {
          const {done, value} = await reader.read();
          if (done) break;
          chunks.push(value); length += value.byteLength; touch();
          if (performance.now() - lastProgress > 250) {
            onProgress?.(`Downloading ${label.toLowerCase()} · ${(length / 1048576).toFixed(1)} MB`);
            lastProgress = performance.now();
          }
        }
      } finally { reader.releaseLock(); }
      bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    } else bytes = new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (timedOut) throw Error(`${label} stopped downloading. Check your connection and reload.`);
    if (signal?.aborted) throw error;
    if (error instanceof TypeError) throw Error(`${label} could not download. Check your connection and reload.`);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
  // Servers may already have decoded Content-Encoding: gzip. Check the bytes.
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  onProgress?.(`Opening ${label.toLowerCase()}…`);
  if (typeof DecompressionStream === 'function') {
    try {
      return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
    } catch { /* Some WebKit versions reject otherwise valid gzip streams. */ }
  }
  const {gunzipSync} = await import('fflate');
  return gunzipSync(bytes);
}

export async function fetchJSON(url, options) {
  return JSON.parse(new TextDecoder().decode(await fetchBytes(url, options)));
}
