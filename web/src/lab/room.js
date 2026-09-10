// Static-host-compatible, encrypted peer connection. Offer/answer exchange is
// explicit; the host owns the sole simulation clock. Webcam frames are excluded.
const encode=value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
function decode(value){
  if(typeof value!=='string'||value.length>50000)throw Error('Pairing code is too large');
  try{const p=JSON.parse(decodeURIComponent(escape(atob(value.trim().replaceAll('-','+').replaceAll('_','/')))));
    if(p.version!==1||!['offer','answer'].includes(p.type)||typeof p.room!=='string'||p.room.length>50||typeof p.sdp!=='string'||p.sdp.length>30000||!p.sdp.startsWith('v=0'))throw Error('Invalid pairing data');return p;
  }catch{throw Error('Invalid pairing code');}
}
export class ExperimentRoom {
  constructor({onStatus=()=>{},onState=()=>{},onCommand=()=>{}}={}){
    Object.assign(this,{onStatus,onState,onCommand});this.role='local';this.connected=false;this.sequence=0;this.lastSequence=-1;this.parts=new Map();
  }
  setup(role,room,iceServers){
    this.disconnect();this.role=role;this.room=room;this.lastSequence=-1;
    this.pc=new RTCPeerConnection({iceServers:iceServers??[{urls:'stun:stun.l.google.com:19302'}]});
    this.pc.onconnectionstatechange=()=>{
      const state=this.pc?.connectionState;if(state==='failed'||state==='disconnected'||state==='closed'){this.connected=false;this.onStatus({role:this.role,state,message:'Connection lost. Pair again to reconnect; the host keeps ownership.'});}
    };
    this.pc.ondatachannel=event=>this.attach(event.channel);
    this.onStatus({role,state:'pairing',message:role==='host'?'Share the invitation, then paste the reply.':'Return the reply to the host.'});
  }
  attach(channel){
    this.channel=channel;
    channel.onopen=()=>{this.connected=true;this.onStatus({role:this.role,state:'connected',message:this.role==='host'?'Collaborator connected. This device runs the simulation.':'Connected to the host. Prop and controller edits are shared.'});};
    channel.onclose=()=>{this.connected=false;this.onStatus({role:this.role,state:'disconnected',message:'Connection closed. Pair again to reconnect.'});};
    channel.onmessage=event=>{
      try{
        if(typeof event.data!=='string'||event.data.length>20000)throw Error('Invalid room packet');
        const p=JSON.parse(event.data);
        if(!Number.isInteger(p.part)||!Number.isInteger(p.count)||p.count<1||p.count>80||p.part<0||p.part>=p.count||typeof p.id!=='string'||p.id.length>60||typeof p.data!=='string')throw Error('Invalid packet shape');
        const now=performance.now();for(const [id,part] of this.parts)if(now-part.time>10000)this.parts.delete(id);
        if(!this.parts.has(p.id)){if(this.parts.size>=8)throw Error('Too many partial messages');this.parts.set(p.id,{count:p.count,chunks:new Array(p.count),time:now});}
        const part=this.parts.get(p.id);if(part.count!==p.count)throw Error('Mismatched packet count');part.chunks[p.part]=p.data;
        if(part.chunks.filter(v=>v!==undefined).length!==p.count)return;
        this.parts.delete(p.id);const msg=JSON.parse(part.chunks.join(''));
        if(msg.kind==='state'&&this.role==='guest'&&Number.isSafeInteger(msg.sequence)&&msg.sequence>this.lastSequence){this.lastSequence=msg.sequence;this.onState(msg.data);}
        if(msg.kind==='command'&&this.role==='host')this.onCommand(msg.data);
      }catch(error){this.onStatus({role:this.role,state:'error',message:error.message});}
    };
  }
  async gathered(){
    const pc=this.pc;
    if(pc.iceGatheringState==='complete')return;
    await new Promise(resolve=>{const finish=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);resolve();},changed=()=>{if(pc.iceGatheringState==='complete')finish();},timer=setTimeout(finish,6000);pc.addEventListener('icegatheringstatechange',changed);});
  }
  async invite(iceServers){
    this.setup('host',crypto.randomUUID(),iceServers);this.attach(this.pc.createDataChannel('duckfly-experiment',{ordered:true}));
    await this.pc.setLocalDescription(await this.pc.createOffer());await this.gathered();
    return encode({version:1,room:this.room,type:'offer',sdp:this.pc.localDescription.sdp});
  }
  async join(value,iceServers){
    const offer=decode(value);if(offer.type!=='offer')throw Error('Paste a host invitation');
    this.setup('guest',offer.room,iceServers);await this.pc.setRemoteDescription({type:offer.type,sdp:offer.sdp});
    await this.pc.setLocalDescription(await this.pc.createAnswer());await this.gathered();
    return encode({version:1,room:this.room,type:'answer',sdp:this.pc.localDescription.sdp});
  }
  async accept(value){const answer=decode(value);if(this.role!=='host'||answer.type!=='answer'||answer.room!==this.room)throw Error('Reply belongs to another invitation');await this.pc.setRemoteDescription({type:answer.type,sdp:answer.sdp});}
  send(message){
    if(!this.connected||this.channel?.readyState!=='open')return false;
    const text=JSON.stringify(message);if(text.length>960000)throw Error('Room message is too large');
    if(this.channel.bufferedAmount>512000&&message.kind==='state')return false;
    const count=Math.ceil(text.length/12000),id=crypto.randomUUID();
    for(let part=0;part<count;part++)this.channel.send(JSON.stringify({id,part,count,data:text.slice(part*12000,(part+1)*12000)}));
    return true;
  }
  sendState(data){if(this.role==='host')this.send({kind:'state',sequence:this.sequence++,data});}
  command(data){return this.send({kind:'command',data});}
  disconnect(){
    if(this.channel){this.channel.onclose=null;this.channel.close();}if(this.pc){this.pc.onconnectionstatechange=null;this.pc.close();}
    this.pc=null;this.channel=null;this.connected=false;this.role='local';this.parts.clear();
    this.onStatus({role:'local',state:'local',message:'Local experiment. No collaborator connected.'});
  }
}
