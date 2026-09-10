import AppKit
import SwiftUI

func selfTest(resources:URL) throws {
    let circuit=try JSONDecoder().decode(CircuitFile.self,from:Data(contentsOf:resources.appendingPathComponent("Brain/circuit.json")))
    let brain=BrainDriver(circuit:circuit)
    let pipe=try PhysicsPipe(resources:resources)
    defer{pipe.close()}
    var body=try pipe.receive()
    let initial=body
    var walkingTicks=0,maximumRate:Float=0,maxTilt:Float=0
    for i in 0..<650 {
        if i==50 || i==180 || i==310 || i==440 {brain.stimulate("walk")}
        let b=brain.step(body:body)
        maximumRate=max(maximumRate,b.forward)
        if b.vx>0 {walkingTicks+=1}
        body=try pipe.request(["op":"step","vx":b.vx,"yaw":b.yaw])
        maxTilt=max(maxTilt,body.tilt)
    }
    let traveled=body.distance
    guard walkingTicks>100,maximumRate>6,traveled>0.1,!body.fallen else {
        throw NSError(domain:"DuckFlyTest",code:1,userInfo:[NSLocalizedDescriptionKey:"Neural walk failed: ticks=\(walkingTicks), distance=\(traveled), tilt=\(maxTilt)"])
    }
    brain.silenced=true
    for _ in 0..<50 {
        let b=brain.step(body:body)
        guard b.vx==0,b.yaw==0 else {fatalError("Silencing bypassed")}
        body=try pipe.request(["op":"step","vx":b.vx,"yaw":b.yaw])
    }
    brain.silenced=false; brain.stimulate("loom")
    var sawReflex=false
    for _ in 0..<30 {
        let b=brain.step(body:body)
        if b.event.contains("stop reflex") && b.vx==0 {sawReflex=true}
        body=try pipe.request(["op":"step","vx":b.vx,"yaw":b.yaw])
    }
    guard sawReflex else {throw NSError(domain:"DuckFlyTest",code:2,userInfo:[NSLocalizedDescriptionKey:"Loom did not trigger stop reflex"])}
    body=try pipe.request(["op":"reset"]);brain.reset()
    guard body.time==0,body.poses==initial.poses,body.command==[0,0] else {fatalError("Reset mismatch")}
    let report:[String:Any] = ["pass":true,"circuit_neurons":circuit.neurons.count,"walking_ticks":walkingTicks,"distance_m":traveled,"max_tilt_degrees":maxTilt,"maximum_forward_rate_hz":maximumRate,"silence_pass":true,"loom_reflex_pass":sawReflex,"reset_exact":true,"scope":"Headless native fly circuit to CPU Microduck worker; forward and steering bridge, output silencing, looming reflex, reset. No biological or hardware validation."]
    print(String(data:try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]),encoding:.utf8)!)
}

let resources=Bundle.main.resourceURL!
if CommandLine.arguments.contains("--self-test") {
    do {try selfTest(resources:resources);exit(0)} catch {fputs("\(error)\n",stderr);exit(1)}
}

final class ApplicationDelegate:NSObject,NSApplicationDelegate,NSWindowDelegate {
    var window:NSWindow?
    var model:AppModel?
    func applicationDidFinishLaunching(_ notification:Notification) {
        do {
            let model=try AppModel(resources:resources);self.model=model
            let window=NSWindow(contentRect:NSRect(x:0,y:0,width:1320,height:860),styleMask:[.titled,.closable,.miniaturizable,.resizable],backing:.buffered,defer:false)
            window.title="DuckFly"
            window.minSize=NSSize(width:1100,height:810)
            window.titlebarAppearsTransparent=true
            window.backgroundColor=NSColor(calibratedWhite:0.08,alpha:1)
            window.appearance=NSAppearance(named:.darkAqua)
            window.contentView=NSHostingView(rootView:ContentView(model:model))
            window.delegate=self
            window.center();window.makeKeyAndOrderFront(nil)
            self.window=window
            NSApp.activate(ignoringOtherApps:true)
            model.start()
        } catch {
            let alert=NSAlert(error:error);alert.runModal();NSApp.terminate(nil)
        }
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender:NSApplication)->Bool {true}
    func applicationWillTerminate(_ notification:Notification) {model?.shutdown()}
}
let app=NSApplication.shared
app.setActivationPolicy(.regular)
let delegate=ApplicationDelegate();app.delegate=delegate
let menu=NSMenu()
let appItem=NSMenuItem();menu.addItem(appItem)
let appMenu=NSMenu();appItem.submenu=appMenu
appMenu.addItem(withTitle:"About DuckFly",action:#selector(NSApplication.orderFrontStandardAboutPanel(_:)),keyEquivalent:"")
appMenu.addItem(.separator())
appMenu.addItem(withTitle:"Quit DuckFly",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q")
app.mainMenu=menu
app.run()
