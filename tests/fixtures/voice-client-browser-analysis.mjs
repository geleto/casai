import { AsyncEnvironment, PrecompiledLoader } from 'cascada-engine/precompiled';
import { Experimental_AbstractRealtimeSession } from 'ai';
import create from '../../.cache/voice-analysis/create.mjs';
import connect from '../../.cache/voice-analysis/connect.mjs';
import send from '../../.cache/voice-analysis/send.mjs';
import close from '../../.cache/voice-analysis/close.mjs';
import fail from '../../.cache/voice-analysis/fail.mjs';

// Analysis adapter over the real SDK class, not a Casai implementation.
class ObservableSession extends Experimental_AbstractRealtimeSession {
 listeners = new Set();
 setState() {for(const notify of this.listeners)notify();}
 getSnapshot = () => this.state;
 subscribe = listener => {this.listeners.add(listener);return()=>this.listeners.delete(listener);};
}
let sockets=0;
const sent=[];
class FixtureSocket {
 static OPEN=1; static CLOSED=3; static CONNECTING=0;
 readyState=0;
 constructor(){sockets++;setTimeout(()=>{if(this.readyState!==0)return;this.readyState=1;this.onopen?.();},20);}
 send(raw){const event=JSON.parse(raw);sent.push(event.type);if(event.type==='session-update')setTimeout(()=>this.onmessage?.({data:JSON.stringify({type:'session-created',sessionId:'test'})}),10);}
 close(){if(this.readyState===3)return;this.readyState=3;sockets--;this.onclose?.({code:1000,wasClean:true,reason:''});}
}
globalThis.WebSocket=FixtureSocket;
const model={specificationVersion:'v4',provider:'fixture',modelId:'fixture',capabilities:{connections:['server-websocket']},serializeClientEvent:event=>JSON.stringify(event),parseServerEvent:raw=>raw};

// Deliberately finish the first credential request after a second attempt is already connected.
export async function reconnectAfterTimeout() {
 const delayed = Promise.withResolvers(), failure = Promise.withResolvers(), ready = Promise.withResolvers();
 const originalFetch = globalThis.fetch, connections = [];
 let requests = 0, firstSignal;
 globalThis.fetch = async (_url, init) => {
   if (++requests === 1) { firstSignal = init.signal; return delayed.promise; }
   return Response.json({ token: 'current', url: 'wss://fixture.invalid' });
 };
 const session = new ObservableSession({
   model: { ...model, capabilities: { connections: ['client-secret-websocket'] },
     getWebSocketConfig({ token, url }) { connections.push(token); return { url, protocols: [] }; } },
   api: { token: '/credential' }, startupTimeoutMs: 300, onError: error => failure.resolve(error),
 });
 const unsubscribe = session.subscribe(() => { if (session.getSnapshot().status === 'connected') ready.resolve(); });
 try {
   const first = session.connect();
   const error = await failure.promise;
   await session.connect();
   await ready.promise;
   delayed.resolve(Response.json({ token: 'obsolete', url: 'wss://fixture.invalid' }));
   await first;
   return { requests, connections, timeout: error.message, aborted: firstSignal.aborted, status: session.getSnapshot().status };
 } finally { unsubscribe(); session.dispose(); globalThis.fetch = originalFetch; }
}

export async function run(){
 const env=new AsyncEnvironment(new PrecompiledLoader({...create,...connect,...send,...close,...fail}));
 const factory=()=>new ObservableSession({model,api:{websocket:'ws://fixture.invalid'},startupTimeoutMs:500,onError:error=>console.log('SDK ERROR',error.message)});
 const [a,b]=await Promise.all([env.renderScript('create',{createSession:factory}),env.renderScript('create',{createSession:factory})]);
 let notifications=0;const unsubscribe=a.subscribe(()=>notifications++);
 const initial=a.getSnapshot();
 let nativeConnectReturnsBeforeReady=false;
 try{
  await env.renderScript('connect',{session:a});
  nativeConnectReturnsBeforeReady=a.getSnapshot().status==='connecting';
  await new Promise((resolve,reject)=>{
   if(a.getSnapshot().status==='connected')return resolve();
   const stop=a.subscribe(()=>{const status=a.getSnapshot().status;if(status==='connected'){clearTimeout(timer);stop();resolve();}else if(status==='error'){clearTimeout(timer);stop();reject(new Error('native startup failure'));}});
   const timer=setTimeout(()=>{stop();reject(new Error('startup timed out: '+JSON.stringify({state:a.getSnapshot(),sockets,sent})));},1000);
  });
  const connected=await env.renderScript('send',{session:a});
  const closed=await env.renderScript('close',{session:a});
  const failure=await env.renderScript('fail',{session:a});
  return {connected,closed,failure,independent:a!==b&&b.getSnapshot().status==='disconnected',sameHandle:a instanceof ObservableSession,notifications,nativeConnectReturnsBeforeReady,snapshotChanged:initial!==a.getSnapshot(),sent,
    get sockets(){return sockets;},get listenersAfterTeardown(){return a.listeners.size;}};
 }finally{unsubscribe();a.dispose();b.dispose();}
}
