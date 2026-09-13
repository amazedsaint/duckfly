import UIKit
import WebKit

@main class App: UIResponder, UIApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate {
    var window: UIWindow?
    var web: WKWebView!
    let logURL = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("probe.jsonl")
    func log(_ value: Any) {
        let row: [String: Any] = ["time": Date().timeIntervalSince1970, "data": value]
        guard let data = try? JSONSerialization.data(withJSONObject: row, options: [.fragmentsAllowed]) else { return }
        if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
        if let file = try? FileHandle(forWritingTo: logURL) { defer { try? file.close() }; try? file.seekToEnd(); try? file.write(contentsOf: data + Data([10])) }
    }
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        try? FileManager.default.removeItem(at: logURL)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.userContentController.add(self, name: "probe")
        config.userContentController.addUserScript(WKUserScript(source: Self.script, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        let controller = UIViewController()
        controller.view = web
        window = UIWindow(frame: UIScreen.main.bounds)
        window?.rootViewController = controller
        window?.makeKeyAndVisible()
        let args = ProcessInfo.processInfo.arguments
        let target = args.dropFirst().first(where: { $0.hasPrefix("http") }) ?? "https://makeduckfly.com/?ar=1"
        log(["launch": target])
        web.load(URLRequest(url: URL(string: target)!))
        return true
    }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) { log(message.body) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { log(["fatal": "Web content process terminated"]) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { log(["navigationError": error.localizedDescription]) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { log(["navigationError": error.localizedDescription]) }
    static let script = #"""
    (()=>{
      const report=(type,data)=>window.webkit.messageHandlers.probe.postMessage({type,data});
      report('features',{ua:navigator.userAgent,decompress:typeof DecompressionStream,wasm:typeof WebAssembly,shared:typeof SharedArrayBuffer,isolated:crossOriginIsolated});
      window.addEventListener('error',e=>report('error',{message:e.message,file:e.filename,line:e.lineno,stack:e.error?.stack}));
      window.addEventListener('unhandledrejection',e=>report('rejection',{message:String(e.reason),stack:e.reason?.stack}));
      for(const level of ['error','warn']){const orig=console[level];console[level]=(...a)=>{report(level,a.map(String));orig.apply(console,a);};}
      const OriginalWorker=window.Worker;
      window.Worker=class extends OriginalWorker {
        constructor(...args){super(...args);report('worker-created',String(args[0]));this.addEventListener('message',e=>{
          if(['loading','ready','error'].includes(e.data?.type))report('worker-message',{type:e.data.type,message:e.data.message});
        });this.addEventListener('error',e=>report('worker-error',{message:e.message,file:e.filename,line:e.lineno}));}
      };
      const fetchOriginal=window.fetch;
      window.fetch=async(...args)=>{const url=String(args[0]);report('fetch',url);try{const r=await fetchOriginal(...args);report('response',{url,status:r.status});return r;}catch(e){report('fetch-error',{url,message:String(e)});throw e;}};
      let ticks=0;
      const timer=setInterval(()=>{
        report('status',{loading:document.querySelector('#loading-detail')?.textContent,home:document.querySelector('#home-status')?.textContent,launch:document.querySelector('#launch-status')?.textContent,ready:document.querySelector('#loading')?.hidden,ar:document.querySelector('#ar-mode-dialog')?.open,bridge:!!window.duckflyLab,time:document.querySelector('#time')?.textContent});
        if(++ticks>=40)clearInterval(timer);
      },2000);
      if (location.search.includes('probe=1')) (async()=>{
        let needsResume=false;
        document.addEventListener('webglcontextlost',()=>{needsResume=true;report('graphics-lost',{});},true);
        document.addEventListener('webglcontextrestored',()=>report('graphics-restored',{}),true);
        const wait=async fn=>{const start=Date.now();while(!fn()){if(Date.now()-start>90000)throw Error('iOS probe timed out');await new Promise(resolve=>setTimeout(resolve,100));}};
        const click=selector=>{const node=document.querySelector(selector);if(!node)throw Error('Missing '+selector);node.click();};
        await wait(()=>window.duckflyTelemetry?.ready&&document.querySelector('#ar-dialog')?.open);
        report('startup-result',{startup:window.duckflyStartup,resources:performance.getEntriesByType('resource').map(e=>({name:e.name,ms:Math.round(e.duration)}))});
        click('#ar-cancel');
        for(const id of ['cue-workshop','scent','air','touch']){
          click('#back-home');click('[data-scenario="'+id+'"]');
          await wait(()=>{
            if(needsResume&&window.duckflyTelemetry.paused&&document.querySelector('#loading').hidden&&!document.querySelector('#arena canvas').getContext('webgl2').isContextLost()){
              needsResume=false;click('#pause');report('resume-after-recovery',{});
            }
            return window.duckflyTelemetry.tick>=150&&!window.duckflyTelemetry.paused;
          });
          click('#pause');await wait(()=>window.duckflyTelemetry.paused);
          const t=window.duckflyTelemetry;
          report('scene-result',{id,tick:t.tick,ducks:t.ducks,inputs:Object.fromEntries(Object.entries(t.agents).map(([id,a])=>[id,a.input]))});
        }
        const canvas=document.querySelector('#arena canvas'),gl=canvas.getContext('webgl2'),loss=gl.getExtension('WEBGL_lose_context');
        loss.loseContext();await wait(()=>!document.querySelector('#loading').hidden);loss.restoreContext();
        await wait(()=>document.querySelector('#loading').hidden);
        const before=window.duckflyTelemetry.tick;click('#pause');await wait(()=>window.duckflyTelemetry.tick>before+30);
        click('#pause');await wait(()=>window.duckflyTelemetry.paused);
        report('exercise-complete',{recovered:true,tick:window.duckflyTelemetry.tick,contextLost:gl.isContextLost()});
      })().catch(error=>report('exercise-error',{message:String(error),stack:error.stack}));
    })();
    """#
}
