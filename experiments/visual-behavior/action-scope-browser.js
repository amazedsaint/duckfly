async host => {
  const base=host.url().split('/').slice(0,3).join('/'),context=await host.context().browser().newContext({viewport:{width:1280,height:900}}),guest=await context.newPage();
  const receipts=[],errors=[],report={format:'duckfly-action-recording-scope-browser',version:1,transport:'Actual local WebRTC; no STUN/TURN servers configured',independentContexts:true,receipts,errors};
  const check=(condition,message)=>{if(!condition)throw Error(message);};
  let stage='initialize';
  const instrument=()=>{
    const RTC=window.RTCPeerConnection;window.__actionPeers=[];
    window.RTCPeerConnection=class extends RTC{constructor(configuration){super({...configuration,iceServers:[]});window.__actionPeers.push(this);}};
    const WorkerClass=window.Worker;window.__actionMessages=[];
    window.Worker=class extends WorkerClass{postMessage(message,...rest){if(message?.type==='action-evidence')window.__actionMessages.push(structuredClone(message));return super.postMessage(message,...rest);}};
  };
  for(const page of [host,guest]){page.on('pageerror',error=>errors.push({page:page===host?'host':'guest',message:error.message}));await page.addInitScript(instrument);}
  const pause=async page=>{if(!await page.evaluate(()=>window.duckflyTelemetry.paused)){await page.locator('#pause').click();await page.waitForFunction(()=>window.duckflyTelemetry.paused);}};
  const startScene=async(page,seconds)=>{
    await page.goto(base);await page.waitForFunction(()=>window.duckflyTelemetry?.ready,null,{timeout:60000});
    await page.getByRole('button',{name:'Open studio',exact:true}).click();
    await page.locator('[data-scenario="vision"]').click();
    for(let index=0;index<3;index++)await page.getByRole('button',{name:'Continue →',exact:true}).click();
    await page.getByRole('button',{name:'Start scene',exact:true}).click();
    await page.waitForFunction(time=>window.duckflyTelemetry.time>=time,seconds,{timeout:30000});await pause(page);
  };
  const inspection=async(page,{expectImage=false}={})=>{
    await page.locator('#inspect-event').click();
    if(expectImage)await page.waitForFunction(()=>!document.querySelector('#event-image').hidden);
    const data=await page.evaluate(()=>({label:document.querySelector('#event-time').textContent,imageStatus:document.querySelector('#event-image-status').textContent,imageHidden:document.querySelector('#event-image').hidden,choiceCount:document.querySelector('#event-choice').options.length,choices:[...document.querySelector('#event-choice').options].map(option=>option.textContent),requestCount:window.__actionMessages.length,tick:window.duckflyTelemetry.tick,recordingId:window.duckflyTelemetry.recordingId}));
    await page.getByRole('button',{name:'Close action inspector'}).click();return data;
  };
  const openRoom=async page=>{if(!await page.locator('#room-button').isVisible())await page.locator('.topbar .app-menu > summary').click();await page.locator('#room-button').click();};
  const pair=async()=>{
    await openRoom(host);await host.getByRole('button',{name:'Create invitation',exact:true}).click();
    await host.waitForFunction(()=>document.querySelector('#room-output').value.length>100);
    const offer=await host.locator('#room-output').inputValue();
    await openRoom(guest);await guest.locator('#room-input').fill(offer);await guest.getByRole('button',{name:'Join with invitation',exact:true}).click();
    await guest.waitForFunction(()=>document.querySelector('#room-output').value.length>100);
    const answer=await guest.locator('#room-output').inputValue();
    await host.locator('#room-input').fill(answer);await host.getByRole('button',{name:'Accept collaborator reply',exact:true}).click();
    await Promise.all([host.waitForFunction(()=>window.duckflyRoomTelemetry?.state==='connected',null,{timeout:20000}),guest.waitForFunction(()=>window.duckflyRoomTelemetry?.state==='connected',null,{timeout:20000})]);
    await host.getByRole('button',{name:'Close collaboration'}).click();await guest.getByRole('button',{name:'Close collaboration'}).click();
    const expected=await host.evaluate(()=>({tick:window.duckflyTelemetry.tick,recordingId:window.duckflyTelemetry.recordingId}));
    await guest.waitForFunction(value=>window.duckflyTelemetry.tick===value.tick&&window.duckflyTelemetry.recordingId===value.recordingId,expected);
  };
  const rtc=page=>page.evaluate(async()=>{
    const peer=window.__actionPeers.at(-1);if(!peer)return null;
    const stats=await peer.getStats(),values=[...stats.values()],transport=values.find(item=>item.type==='transport');
    const selected=values.find(item=>item.id===transport?.selectedCandidatePairId);
    const candidate=id=>{const value=values.find(item=>item.id===id);return value?{candidateType:value.candidateType,protocol:value.protocol}:null;};
    return {connection:peer.connectionState,ice:peer.iceConnectionState,selectedPair:selected?{state:selected.state,nominated:selected.nominated,bytesSent:selected.bytesSent,bytesReceived:selected.bytesReceived,local:candidate(selected.localCandidateId),remote:candidate(selected.remoteCandidateId)}:null};
  });
  try{
    await startScene(host,.6);await startScene(guest,2.2);
    const hostBefore=await host.evaluate(()=>window.duckflyTelemetry.tick),guestBefore=await inspection(guest,{expectImage:true});
    check(guestBefore.tick>hostBefore+50,'Local guest fixture needs a substantially longer history');
    stage='rapid native dialog close/reopen';
    await host.locator('#inspect-event').click();await host.waitForFunction(()=>!document.querySelector('#event-image').hidden);
    await host.evaluate(()=>{for(let index=0;index<20;index++){document.querySelector('#event-dialog').close();document.querySelector('#inspect-event').click();}});
    await host.waitForFunction(()=>document.querySelector('#event-dialog').open&&!document.querySelector('#event-image').hidden);
    check((await host.locator('#event-time').textContent()).includes('tick '+hostBefore),'Rapid reopen selected another event');
    receipts.push({check:'20 native close/reopen cycles retain a working exact-frame request',passed:true,selected:await host.locator('#event-time').textContent()});
    await host.getByRole('button',{name:'Close action inspector'}).click();
    stage='malformed import';
    await host.evaluate(()=>{const original=URL.createObjectURL;URL.createObjectURL=function(blob){if(blob.type.includes('json'))window.__actionExport=blob.text().then(JSON.parse);return original.call(this,blob);};document.querySelector('#export').click();});
    await host.waitForFunction(()=>!!window.__actionExport);
    const recording=await host.evaluate(async()=>await window.__actionExport),beforeImport=await host.evaluate(()=>JSON.stringify(window.duckflyTelemetry));
    const malformed=JSON.parse(JSON.stringify(recording));malformed.events[0].causes=null;
    await host.locator('#file').evaluate((input,text)=>{const transfer=new DataTransfer();transfer.items.add(new File([text],'invalid-events.json',{type:'application/json'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));},JSON.stringify(malformed));
    await host.waitForFunction(()=>document.querySelector('#notice').textContent.includes('Invalid recorded action'));
    check(await host.evaluate(()=>JSON.stringify(window.duckflyTelemetry))===beforeImport,'Invalid recording changed the current world or run identity');
    const afterInvalid=await inspection(host,{expectImage:true});
    check(afterInvalid.label.includes('tick '+hostBefore),'Invalid import changed retained actions');
    receipts.push({check:'malformed imported causes rejected without changing paused world, run identity or retained image',passed:true,notice:await host.locator('#notice').textContent()});
    stage='actual local RTC pairing';await pair();
    const firstGuest=await inspection(guest);
    check(firstGuest.label.includes('tick '+hostBefore),'Guest selected its old longer local history');
    check(firstGuest.choiceCount===1,'Initial shared cache contains local events');
    check(firstGuest.imageHidden&&firstGuest.imageStatus.includes('host retains'),'Guest inspection exposed a local camera image');
    check(firstGuest.requestCount===guestBefore.requestCount,'Guest requested private evidence from its local worker');
    report.initialTransport={host:await rtc(host),guest:await rtc(guest)};
    check(report.initialTransport.host?.selectedPair?.state==='succeeded','No actual successful WebRTC candidate pair');
    receipts.push({check:'joining shorter host run clears longer local history and suppresses private image requests',passed:true,localGuestTick:guestBefore.tick,hostTick:hostBefore,inspector:firstGuest});
    stage='identical host scene reset';
    const firstId=await host.evaluate(()=>window.duckflyTelemetry.recordingId),sceneKey=await host.evaluate(()=>JSON.stringify(window.duckflyTelemetry.scene));
    await guest.locator('#inspect-event').click();
    await host.locator('#reset').click();await host.waitForFunction(id=>window.duckflyTelemetry.recordingId!==id&&window.duckflyTelemetry.tick===0,firstId);
    const resetId=await host.evaluate(()=>window.duckflyTelemetry.recordingId);
    await guest.waitForFunction(id=>window.duckflyTelemetry.recordingId===id&&window.duckflyTelemetry.tick===0,resetId);
    check(await host.evaluate(()=>JSON.stringify(window.duckflyTelemetry.scene))===sceneKey,'Reset fixture changed scene content');
    check(!await guest.locator('#event-dialog').evaluate(dialog=>dialog.open),'Host reset left stale inspector open');
    const resetView=await inspection(guest);check(resetView.choiceCount===0,'Identical scene reset retained prior actions');
    await host.locator('#pause').click();await host.waitForFunction(()=>window.duckflyTelemetry.time>.35);await pause(host);
    const resetTick=await host.evaluate(()=>window.duckflyTelemetry.tick);await guest.waitForFunction(tick=>window.duckflyTelemetry.tick===tick,resetTick);
    const postReset=await inspection(guest);check(postReset.label.includes('tick '+resetTick),'New host run selected a prior-run event');
    receipts.push({check:'identical host scene reset changes authority and clears open inspector/cache',passed:true,firstId,resetId,emptyChoices:resetView.choiceCount,newest:postReset.label});
    stage='leave and rejoin';
    await openRoom(guest);await guest.getByRole('button',{name:'Leave room',exact:true}).click();await guest.getByRole('button',{name:'Close collaboration'}).click();
    await guest.waitForFunction(()=>window.duckflyRoomTelemetry.role==='local'&&window.duckflyTelemetry.tick===0);
    const left=await inspection(guest);check(left.choiceCount===0,'Leaving room retained shared actions');
    await guest.locator('#pause').click();await guest.waitForFunction(()=>window.duckflyTelemetry.time>1.5);await pause(guest);
    const newLocalTick=await guest.evaluate(()=>window.duckflyTelemetry.tick);await pair();
    const rejoined=await inspection(guest);check(rejoined.tick===resetTick&&rejoined.choiceCount===1,'Rejoining mixed old local or shared action histories');
    check(rejoined.imageHidden,'Rejoined guest displayed a private image');
    receipts.push({check:'leave creates an empty local run; rejoin replaces later local history with host authority',passed:true,newLocalTick,hostTick:resetTick,inspector:rejoined});
    await guest.locator('#inspect-event').click();await guest.screenshot({path:'output/playwright/action-scope-guest.png'});await guest.getByRole('button',{name:'Close action inspector'}).click();
    check(errors.length===0,'Browser page errors: '+JSON.stringify(errors));
    report.passed=true;
  }catch(error){report.passed=false;report.stage=stage;report.failure=error.message;report.transportAtFailure={host:await rtc(host),guest:await rtc(guest)};await host.screenshot({path:'output/playwright/action-scope-failure-host.png'});await guest.screenshot({path:'output/playwright/action-scope-failure-guest.png'});}
  finally{await host.evaluate(report=>window.__actionScopeReport=report,report);await context.close();}
  return report;
}
