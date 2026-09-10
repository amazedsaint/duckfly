// Loopback-only fixture; never deploy this development relay.
const Turn=require('node-turn');
const server=new Turn({listeningPort:3499,listeningIps:['127.0.0.1'],relayIps:['127.0.0.1'],minPort:35000,maxPort:35020,
  authMech:'long-term',credentials:{'duckfly-test':'local-loopback-only'},debugLevel:'ERROR'});
server.start();
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{server.stop();process.exit(0);});
