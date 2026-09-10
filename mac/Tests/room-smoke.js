// Run only with --self-test-room and the loopback TURN fixture described in docs.
const wait=async(fn,timeout=60000)=>{const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw Error('Native room check timed out: '+document.querySelector('#room-status').textContent);await new Promise(r=>setTimeout(r,50));}};
const $=s=>document.querySelector(s),select=(el,value)=>{el.value=value;el.dispatchEvent(new Event('change'));};
const check=(v,message)=>{if(!v)throw Error(message);};
await wait(()=>window.duckflyTelemetry?.ready);
select($('#preset'),'target');await wait(()=>duckflyTelemetry.time===0&&duckflyTelemetry.scene.name==='Follow the beacon');
const iframe=document.createElement('iframe');iframe.style.cssText='position:fixed;left:0;top:0;width:960px;height:760px;opacity:0;pointer-events:none';iframe.src=location.href;document.body.append(iframe);
await wait(()=>iframe.contentWindow.duckflyTelemetry?.ready);
const guest=iframe.contentWindow,g=s=>guest.document.querySelector(s);
try{
  for(const get of [$,g]){get('#turn-url').value='turn:127.0.0.1:3499';get('#turn-user').value='duckfly-test';get('#turn-password').value='local-loopback-only';}
  $('#room-host').click();await wait(()=>$('#room-output').value.length>20);g('#room-input').value=$('#room-output').value;g('#room-join').click();await wait(()=>g('#room-output').value.length>20);$('#room-input').value=g('#room-output').value;$('#room-accept').click();
  await wait(()=>window.duckflyRoomTelemetry?.state==='connected'&&guest.duckflyRoomTelemetry?.state==='connected');
  check(g('#pause').disabled,'Guest gained control of the native simulation clock');
  select(g('#add-kind'),'ball');g('#add').click();await wait(()=>duckflyTelemetry.scene.props.some(p=>p.kind==='ball')&&guest.duckflyTelemetry.scene.props.some(p=>p.kind==='ball'));
  $('#pause').click();await wait(()=>duckflyTelemetry.time>=1);$('#pause').click();await wait(()=>duckflyTelemetry.paused&&guest.duckflyTelemetry.time===duckflyTelemetry.time);
  check(JSON.stringify(guest.duckflyTelemetry.ducks)===JSON.stringify(duckflyTelemetry.ducks),'Native peers display different physical poses');
  const result={check:'native WebKit room',connected:true,remotePropAccepted:true,hostOwnership:true,identicalPoses:true,time:duckflyTelemetry.time,transport:'Local authenticated TURN relay'};
  $('#room-leave').click();g('#room-leave').click();return result;
}finally{iframe.remove();}
