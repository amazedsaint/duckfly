import Foundation
import Darwin
import Combine
import simd

struct BodyState: Decodable {
    var kind: String
    var time: Double
    var poses: [[Float]]
    var position: [Float]
    var heading: Float
    var speed: Float
    var tilt: Float
    var distance: Float
    var contacts: [Bool]
    var onsets: [Int]
    var joints: [Float]
    var phase: Float
    var fallen: Bool
    var cost: Float
    var command: [Float]
}
struct BrainSnapshot {
    var forward: Float = 0
    var left: Float = 0
    var right: Float = 0
    var loom: Float = 0
    var population: Float = 0
    var spikeCount: Int = 0
    var fired: [Int] = []
    var vx: Float = 0
    var yaw: Float = 0
    var event = "Circuit running"
}
struct Sample: Identifiable {
    var id: Int
    var speed: Float
    var drive: Float
}

final class PhysicsPipe {
    let process = Process()
    private let input = Pipe(), output = Pipe()
    private var buffer = Data()
    private var errorLog: FileHandle?
    init(resources: URL) throws {
        let python = resources.appendingPathComponent("Python/bin/python3.12")
        process.executableURL = python
        process.arguments = ["-u",resources.appendingPathComponent("Engine/worker.py").path,"--resources",resources.path]
        var env = ProcessInfo.processInfo.environment
        env["PYTHONHOME"] = resources.appendingPathComponent("Python").path
        env["PYTHONNOUSERSITE"] = "1"
        env["PYTHONDONTWRITEBYTECODE"] = "1"
        env.removeValue(forKey: "PYTHONPATH")
        process.environment = env
        process.currentDirectoryURL = resources
        process.standardInput=input; process.standardOutput=output
        let logs = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/DuckFly")
        try FileManager.default.createDirectory(at:logs,withIntermediateDirectories:true)
        let log=logs.appendingPathComponent("engine.log")
        FileManager.default.createFile(atPath:log.path,contents:nil)
        errorLog=try FileHandle(forWritingTo:log)
        process.standardError=errorLog
        try process.run()
    }
    func receive() throws -> BodyState {
        while true {
            if let end=buffer.firstIndex(of:10) {
                let line=buffer.prefix(upTo:end)
                buffer.removeSubrange(...end)
                if let error=try? JSONSerialization.jsonObject(with:line) as? [String:Any], error["kind"] as? String == "error" {
                    throw NSError(domain:"DuckFly",code:1,userInfo:[NSLocalizedDescriptionKey:error["message"] as? String ?? "Physics worker failed"])
                }
                return try JSONDecoder().decode(BodyState.self,from:line)
            }
            let fd=output.fileHandleForReading.fileDescriptor
            var pollFD=pollfd(fd:fd,events:Int16(POLLIN),revents:0)
            let available=Darwin.poll(&pollFD,1,10000)
            guard available>0 else {
                throw NSError(domain:"DuckFly",code:3,userInfo:[NSLocalizedDescriptionKey:"Physics worker timed out. Restart DuckFly to reconnect."])
            }
            var bytes=[UInt8](repeating:0,count:65536)
            let count=Darwin.read(fd,&bytes,bytes.count)
            guard count>0 else {
                throw NSError(domain:"DuckFly",code:2,userInfo:[NSLocalizedDescriptionKey:"Physics worker closed. See ~/Library/Logs/DuckFly/engine.log."])
            }
            buffer.append(contentsOf:bytes.prefix(count))
        }
    }
    func request(_ value: [String:Any]) throws -> BodyState {
        var data=try JSONSerialization.data(withJSONObject:value)
        data.append(10)
        try input.fileHandleForWriting.write(contentsOf:data)
        return try receive()
    }
    func close() {
        try? input.fileHandleForWriting.close()
        if process.isRunning { process.terminate() }
    }
    deinit { close() }
}

final class BrainDriver {
    let circuit: CircuitFile
    var sim: LIFSim
    let bus = SpikeBus()
    var baseline: Float = 0
    var walking=false
    var escapeUntil=0
    var event="Circuit running"
    var eventUntil=0
    var activeLoomUntil=0
    var silenced=false
    var feedback=true
    init(circuit: CircuitFile) {
        self.circuit=circuit
        TestRandom.reset("duckfly-v1")
        sim=LIFSim(circuit:circuit,spikeBus:bus)
    }
    func reset() {
        TestRandom.reset("duckfly-v1")
        sim=LIFSim(circuit:circuit,spikeBus:bus)
        _=bus.popAll(); baseline=0; walking=false; escapeUntil=0; activeLoomUntil=0
        event="Circuit reset"; eventUntil=1200
    }
    func stimulate(_ kind:String) {
        switch kind {
        case "walk": sim.stimulate(sim.fwd,strength:0.12,durationMs:3000); event="DNp09 · walk stimulus"
        case "left": sim.stimulate(sim.dnaL,strength:0.12,durationMs:1500); event="DNa left · turn stimulus"
        case "right": sim.stimulate(sim.dnaR,strength:0.12,durationMs:1500); event="DNa right · turn stimulus"
        case "loom": activeLoomUntil=sim.simMs+400; event="Loom · visual stimulus"
        default: break
        }
        eventUntil=sim.simMs+3200
    }
    func step(body:BodyState?) -> BrainSnapshot {
        if feedback, let body {
            sim.gaitDrive=min(1,body.speed/0.2)
            sim.gaitPhase=body.phase
        } else { sim.gaitDrive=0; sim.gaitPhase=0 }
        sim.loomL=sim.simMs<activeLoomUntil ? 1:0
        sim.loomR=sim.loomL
        sim.step(20)
        let escape=sim.consumeGF()
        if escape { escapeUntil=sim.simMs+1000; event="Giant Fiber · stop reflex"; eventUntil=escapeUntil }
        let difference=sim.rateDNaL-sim.rateDNaR
        baseline += (difference-baseline)*0.0025
        if sim.rateFwd>6 { walking=true }
        if sim.rateFwd<2 { walking=false }
        let stopped=sim.simMs<escapeUntil || silenced
        let vx:Float = walking && !stopped ? 0.3:0
        let yaw:Float = !stopped ? min(0.65,max(-0.65,(difference-baseline)*0.04)):0
        if sim.simMs>eventUntil { event=silenced ? "Output silenced":(walking ? "Neural walking drive":"Circuit at rest") }
        return BrainSnapshot(forward:sim.rateFwd,left:sim.rateDNaL,right:sim.rateDNaR,loom:sim.rateLoom,
            population:sim.ratePop,spikeCount:sim.totalSpikes,fired:bus.popAll().map{$0.neuron},vx:vx,yaw:yaw,event:event)
    }
}

final class AppModel: ObservableObject {
    @Published var state:BodyState?
    @Published var brain=BrainSnapshot()
    @Published var samples:[Sample]=[]
    @Published var paused=false
    @Published var mode="Fly brain"
    @Published var ready=false
    @Published var error:String?
    @Published var outputSilenced=false
    @Published var feedbackEnabled=true
    @Published var manualForward=false
    @Published var manualYaw:Float=0
    @Published var followCamera=true
    @Published var cameraReset=0
    @Published var wallRate:Float=1
    let circuit:CircuitFile
    let resources:URL
    private let queue=DispatchQueue(label:"org.duckfly.simulation",qos:.userInitiated)
    private var pipe:PhysicsPipe?
    private var timer:DispatchSourceTimer?
    private var driver:BrainDriver?
    private var lastBody:BodyState?
    private var isPaused=false
    private var useBrain=true
    private var forward:Float=0
    private var yaw:Float=0
    private var counter=0
    private var windowStart=Date()
    private var rateTicks=0
    private var currentRate:Float=1
    init(resources:URL) throws {
        self.resources=resources
        circuit=try JSONDecoder().decode(CircuitFile.self,from:Data(contentsOf:resources.appendingPathComponent("Brain/circuit.json")))
    }
    func start() {
        queue.async {
            do {
                self.driver=BrainDriver(circuit:self.circuit)
                let pipe=try PhysicsPipe(resources:self.resources); self.pipe=pipe
                let initial=try pipe.receive(); self.lastBody=initial
                self.driver?.stimulate("walk")
                DispatchQueue.main.async { self.ready=true; self.state=initial }
                let timer=DispatchSource.makeTimerSource(queue:self.queue)
                self.timer=timer
                timer.schedule(deadline:.now(),repeating:.milliseconds(20),leeway:.milliseconds(1))
                timer.setEventHandler { [weak self] in self?.tick() }
                timer.resume()
            } catch { self.fail(error) }
        }
    }
    private func tick() {
        guard !isPaused,let pipe,let driver else { return }
        do {
            let brain=driver.step(body:lastBody)
            let next=try pipe.request(["op":"step","vx":useBrain ? brain.vx:forward,"yaw":useBrain ? brain.yaw:yaw])
            lastBody=next; counter+=1; rateTicks+=1
            if Date().timeIntervalSince(windowStart)>1 {
                currentRate=Float(Double(rateTicks)*0.02/Date().timeIntervalSince(windowStart))
                windowStart=Date(); rateTicks=0
            }
            let id=counter,rate=currentRate
            DispatchQueue.main.async {
                self.state=next; self.brain=brain; self.wallRate=rate
                if id%2==0 {
                    self.samples.append(Sample(id:id,speed:next.speed,drive:brain.forward))
                    if self.samples.count>150 {self.samples.removeFirst(self.samples.count-150)}
                }
            }
        } catch { fail(error) }
    }
    private func fail(_ error:Error) {
        timer?.cancel(); timer=nil; pipe?.close()
        DispatchQueue.main.async { self.error=error.localizedDescription; self.ready=false }
    }
    func setPaused(_ value:Bool) {
        paused=value
        queue.async { self.isPaused=value; self.windowStart=Date(); self.rateTicks=0 }
    }
    func setMode(_ value:String) {
        mode=value; manualForward=false; manualYaw=0
        queue.async { self.useBrain=value=="Fly brain"; self.forward=0; self.yaw=0 }
    }
    func drive(forward:Bool,yaw:Float=0) {
        manualForward=forward; manualYaw=yaw
        queue.async { self.forward=forward ? 0.3:0; self.yaw=yaw }
    }
    func stimulate(_ kind:String) { queue.async { self.driver?.stimulate(kind) } }
    func silence(_ flag:Bool) {
        outputSilenced=flag; queue.async { self.driver?.silenced=flag }
    }
    func feedback(_ flag:Bool) {
        feedbackEnabled=flag; queue.async { self.driver?.feedback=flag }
    }
    func reset() {
        samples=[]; manualForward=false; manualYaw=0
        queue.async {
            do {
                self.driver?.reset(); self.forward=0; self.yaw=0
                self.lastBody=try self.pipe?.request(["op":"reset"])
                let state=self.lastBody
                DispatchQueue.main.async { self.state=state; self.brain=BrainSnapshot(); self.cameraReset+=1 }
            } catch { self.fail(error) }
        }
    }
    func push() { queue.async {
        do { _=try self.pipe?.request(["op":"push"]) } catch { self.fail(error) }
    } }
    func shutdown() {
        // Terminate outside the serial queue too, so an unresponsive child cannot survive the app.
        timer?.cancel(); pipe?.close()
    }
}
