import SwiftUI

let accent=Color(red:1,green:0.57,blue:0.29)
let muted=Color(red:0.55,green:0.61,blue:0.68)
let panel=Color(red:0.085,green:0.098,blue:0.12)

struct ContentView:View {
    @ObservedObject var model:AppModel
    var body:some View {
        VStack(spacing:0) {
            HStack(spacing:12) {
                Image(systemName:"bird.fill").font(.system(size:25)).foregroundStyle(accent)
                VStack(alignment:.leading,spacing:2) {
                    Text("DuckFly").font(.system(size:18,weight:.semibold))
                    Text("A fly circuit. A duck body.").font(.system(size:11)).foregroundStyle(muted)
                }
                Spacer()
                HStack(spacing:6) {
                    Circle().fill(model.ready ? (model.paused ? Color.yellow:Color.green):Color.orange).frame(width:6,height:6)
                    Text(model.ready ? (model.paused ? "PAUSED":"LIVE SIMULATION"):"STARTING ENGINE").font(.system(size:10,weight:.semibold,design:.monospaced)).tracking(1)
                }.foregroundStyle(muted)
                Divider().frame(height:22).padding(.horizontal,8)
                Button {model.setPaused(!model.paused)} label: {Label(model.paused ? "Resume":"Pause",systemImage:model.paused ? "play.fill":"pause.fill")}.keyboardShortcut(.space,modifiers:[])
                Button {model.reset()} label: {Label("Reset",systemImage:"arrow.counterclockwise")}.keyboardShortcut("r",modifiers:.command)
            }.buttonStyle(.bordered).padding(.horizontal,24).padding(.vertical,16).background(panel)
            Divider()
            HStack(spacing:0) {
                VStack(alignment:.leading,spacing:0) {
                    HStack {
                        Text("CONTROL").font(.system(size:10,weight:.semibold)).tracking(1.8).foregroundStyle(muted)
                        Spacer()
                        Text("01").font(.system(size:10,design:.monospaced)).foregroundStyle(muted)
                    }.padding(.bottom,12)
                    Picker("Controller",selection:Binding(get:{model.mode},set:{model.setMode($0)})) {
                        Text("Fly brain").tag("Fly brain")
                        Text("Manual").tag("Manual")
                    }.pickerStyle(.segmented).labelsHidden()
                    if model.mode == "Fly brain" {
                        Text("The fly circuit chooses motion. The duck policy handles balance.")
                            .font(.system(size:11)).foregroundStyle(muted).lineSpacing(3).fixedSize(horizontal:false,vertical:true).padding(.top,12)
                    } else {
                        Text("Drive the duck directly. The fly circuit keeps running alongside it.")
                            .font(.system(size:11)).foregroundStyle(muted).lineSpacing(3).fixedSize(horizontal:false,vertical:true).padding(.top,12)
                    }
                    Divider().padding(.vertical,16)
                    HStack {
                        Text("FLYWIRE CIRCUIT").font(.system(size:10,weight:.semibold)).tracking(1.6).foregroundStyle(muted)
                        Spacer()
                        Text("668 cells").font(.system(size:10,design:.monospaced)).foregroundStyle(accent)
                    }
                    BrainCanvas(circuit:model.circuit,fired:model.brain.fired).frame(height:142).padding(.vertical,4)
                    HStack {
                        Label("Live spikes",systemImage:"circle.fill").font(.system(size:10)).foregroundStyle(accent)
                        Spacer()
                        Text("1,000 neural steps/s").font(.system(size:10,design:.monospaced)).foregroundStyle(muted)
                    }.padding(.bottom,17)
                    RateRow(name:"Forward · DNp09",rate:model.brain.forward,color:accent,maxRate:100)
                    RateRow(name:"Steering · left",rate:model.brain.left,color:.cyan,maxRate:100)
                    RateRow(name:"Steering · right",rate:model.brain.right,color:.cyan,maxRate:100)
                    RateRow(name:"Looming · LC/LPLC",rate:model.brain.loom,color:.purple,maxRate:180)
                    Divider().padding(.vertical,18)
                    if model.mode == "Fly brain" {
                        Text("STIMULATE THE CIRCUIT").font(.system(size:10,weight:.semibold)).tracking(1.6).foregroundStyle(muted).padding(.bottom,10)
                        HStack(spacing:8) {
                            ControlButton(title:"Walk",icon:"figure.walk",tint:accent) {model.stimulate("walk")}
                            ControlButton(title:"Loom",icon:"scope",tint:.purple) {model.stimulate("loom")}
                        }
                        HStack(spacing:8) {
                            ControlButton(title:"Left",icon:"arrow.turn.up.left",tint:.cyan) {model.stimulate("left")}
                            ControlButton(title:"Right",icon:"arrow.turn.up.right",tint:.cyan) {model.stimulate("right")}
                        }.padding(.top,8)
                        Toggle("Silence fly output",isOn:Binding(get:{model.outputSilenced},set:{model.silence($0)}))
                            .toggleStyle(.switch).controlSize(.mini).font(.system(size:11)).padding(.top,16)
                        Toggle("Motion feedback",isOn:Binding(get:{model.feedbackEnabled},set:{model.feedback($0)}))
                            .toggleStyle(.switch).controlSize(.mini).font(.system(size:11)).padding(.top,8)
                    } else {
                        Text("MOVEMENT").font(.system(size:10,weight:.semibold)).tracking(1.6).foregroundStyle(muted).padding(.bottom,10)
                        HStack(spacing:8) {
                            ControlButton(title:"Walk",icon:"figure.walk",tint:accent) {model.drive(forward:true)}
                            ControlButton(title:"Stop",icon:"stop.fill",tint:.white) {model.drive(forward:false)}
                        }
                        HStack(spacing:8) {
                            ControlButton(title:"Left",icon:"arrow.turn.up.left",tint:.cyan) {model.drive(forward:true,yaw:0.65)}
                            ControlButton(title:"Right",icon:"arrow.turn.up.right",tint:.cyan) {model.drive(forward:true,yaw:-0.65)}
                        }.padding(.top,8)
                        Text("Walking command: 0.30 m/s\nActual speed appears in the arena.").font(.system(size:11)).foregroundStyle(muted).lineSpacing(4).padding(.top,16)
                    }
                    Spacer(minLength:16)
                    Text("Measured wiring · modeled dynamics\nExperimental body-to-brain interface")
                        .font(.system(size:9)).foregroundStyle(muted.opacity(0.75)).lineSpacing(3).fixedSize(horizontal:false,vertical:true)
                }.padding(22).frame(width:312).background(panel)
                Divider()
                VStack(spacing:0) {
                    ZStack(alignment:.topLeading) {
                        ArenaView(model:model)
                        VStack(alignment:.leading,spacing:7) {
                            Text("MICRODUCK / ARENA").font(.system(size:10,weight:.semibold)).tracking(1.8).foregroundStyle(muted)
                            Text(model.state?.fallen == true ? "Fallen. Reset to continue.":(model.mode == "Fly brain" ? model.brain.event:(model.manualForward ? "Manual walking":"Manual stand")))
                                .font(.system(size:18,weight:.medium)).foregroundStyle(model.state?.fallen == true ? .orange:.white)
                        }.padding(24).allowsHitTesting(false)
                        VStack {
                            Spacer()
                            HStack(alignment:.bottom) {
                                Text("Drag to orbit  ·  Pinch to zoom\nGrid spacing 10 cm").font(.system(size:10)).foregroundStyle(muted).lineSpacing(4)
                                Spacer()
                                Toggle("Follow",isOn:$model.followCamera).toggleStyle(.button).controlSize(.small)
                                Button {model.cameraReset+=1} label: {Image(systemName:"viewfinder")}.help("Reset camera")
                                Button {model.push()} label: {Label("Nudge",systemImage:"hand.point.up.left")}.help("Apply a brief physical push")
                            }.buttonStyle(.bordered).padding(20)
                        }
                        if let error=model.error {
                            VStack(spacing:12) {
                                Image(systemName:"exclamationmark.triangle").font(.largeTitle).foregroundStyle(.orange)
                                Text("Engine stopped").font(.headline)
                                Text(error).font(.caption).multilineTextAlignment(.center).textSelection(.enabled)
                            }.padding(30).frame(maxWidth:.infinity,maxHeight:.infinity).background(panel.opacity(0.95))
                        } else if !model.ready {
                            VStack(spacing:12) {ProgressView();Text("Loading the duck and its circuit…").font(.caption).foregroundStyle(muted)}
                                .frame(maxWidth:.infinity,maxHeight:.infinity).background(panel.opacity(0.9))
                        }
                    }
                    Divider()
                    HStack(alignment:.top,spacing:0) {
                        VStack(alignment:.leading,spacing:12) {
                            HStack {
                                Text("LIVE RESPONSE").font(.system(size:10,weight:.semibold)).tracking(1.4).foregroundStyle(muted)
                                Spacer()
                                Text("6 seconds").font(.system(size:10,design:.monospaced)).foregroundStyle(muted)
                            }
                            TraceView(samples:model.samples).frame(height:52)
                            HStack(spacing:14) {
                                Label("Neural drive",systemImage:"minus").foregroundStyle(accent)
                                Label("Actual speed",systemImage:"minus").foregroundStyle(.cyan)
                            }.font(.system(size:10))
                        }.padding(20).frame(maxWidth:.infinity)
                        Divider().frame(height:114).padding(.top,16)
                        VStack(alignment:.leading,spacing:12) {
                            HStack(spacing:28) {
                                Metric(name:"SPEED",value:String(format:"%.2f",model.state?.speed ?? 0),unit:"m/s")
                                Metric(name:"TRAVEL",value:String(format:"%.2f",model.state?.distance ?? 0),unit:"m")
                                Metric(name:"TILT",value:String(format:"%.1f",model.state?.tilt ?? 0),unit:"°")
                            }
                            HStack(spacing:8) {
                                FootPill(name:"L",contact:model.state?.contacts.first ?? false)
                                FootPill(name:"R",contact:model.state?.contacts.last ?? false)
                                Spacer()
                                Text(String(format:"%.1f s",model.state?.time ?? 0)).font(.system(size:11,design:.monospaced)).foregroundStyle(muted)
                            }
                        }.padding(20).frame(width:315)
                    }.frame(height:146).background(panel)
                }
            }
            Divider()
            HStack(spacing:8) {
                Text("MuJoCo + BAM").foregroundStyle(muted)
                Text("·").foregroundStyle(muted)
                Text("50 Hz policy").foregroundStyle(muted)
                Spacer()
                Text(String(format:"Physics %.2f ms  ·  %.2f× real time",model.state?.cost ?? 0,model.wallRate)).foregroundStyle(muted)
                Text("LOCAL / OFFLINE").foregroundStyle(accent.opacity(0.8)).padding(.leading,14)
            }.font(.system(size:10,design:.monospaced)).padding(.horizontal,22).frame(height:30).background(panel)
        }.background(panel).preferredColorScheme(.dark).frame(minWidth:1100,minHeight:780)
    }
}

struct ControlButton:View {
    let title:String,icon:String,tint:Color,action:()->Void
    var body:some View {
        Button(action:action) {
            HStack {Image(systemName:icon).foregroundStyle(tint);Text(title);Spacer()}
                .font(.system(size:12,weight:.medium)).padding(.horizontal,12).frame(height:35).frame(maxWidth:.infinity)
                .background(Color.white.opacity(0.045),in:RoundedRectangle(cornerRadius:7))
                .overlay(RoundedRectangle(cornerRadius:7).stroke(Color.white.opacity(0.08)))
        }.buttonStyle(.plain)
    }
}
struct RateRow:View {
    let name:String,rate:Float,color:Color,maxRate:Float
    var body:some View {
        VStack(spacing:5) {
            HStack {Text(name).foregroundStyle(muted);Spacer();Text(String(format:"%.1f Hz",rate)).monospacedDigit()}.font(.system(size:11))
            GeometryReader {g in
                ZStack(alignment:.leading) {
                    Capsule().fill(Color.white.opacity(0.07))
                    Capsule().fill(color.opacity(0.8)).frame(width:max(2,g.size.width*CGFloat(min(1,rate/maxRate))))
                }
            }.frame(height:3)
        }.padding(.bottom,9)
    }
}
struct Metric:View {
    let name:String,value:String,unit:String
    var body:some View {
        VStack(alignment:.leading,spacing:7) {
            Text(name).font(.system(size:9,weight:.medium)).tracking(1.2).foregroundStyle(muted)
            HStack(alignment:.firstTextBaseline,spacing:4) {
                Text(value).font(.system(size:23,weight:.light,design:.monospaced));Text(unit).font(.system(size:10)).foregroundStyle(muted)
            }
        }
    }
}
struct FootPill:View {
    let name:String,contact:Bool
    var body:some View {
        HStack(spacing:5) {Circle().fill(contact ? Color.cyan:muted.opacity(0.35)).frame(width:5,height:5);Text("\(name) foot")}
            .font(.system(size:10)).foregroundStyle(muted).padding(.horizontal,8).padding(.vertical,5)
            .background(Color.white.opacity(0.04),in:Capsule())
    }
}
struct TraceView:View {
    let samples:[Sample]
    var body:some View {
        Canvas {context,size in
            for i in 0...2 {
                var line=Path();let y=size.height*CGFloat(i)/2
                line.move(to:CGPoint(x:0,y:y));line.addLine(to:CGPoint(x:size.width,y:y))
                context.stroke(line,with:.color(.white.opacity(0.06)),lineWidth:1)
            }
            guard samples.count>1 else{return}
            for trace in 0...1 {
                var path=Path()
                for (i,s) in samples.enumerated() {
                    let level=trace==0 ? min(1,s.drive/100):min(1,s.speed/0.4)
                    let p=CGPoint(x:CGFloat(i)*size.width/149,y:size.height*(1-CGFloat(level)))
                    if i==0 {path.move(to:p)}else{path.addLine(to:p)}
                }
                context.stroke(path,with:.color(trace==0 ? accent:.cyan),lineWidth:1.4)
            }
        }
    }
}
struct BrainCanvas:View {
    let circuit:CircuitFile
    let fired:[Int]
    var body:some View {
        Canvas {context,size in
            let points=circuit.neurons.map{$0.pos}
            guard !points.isEmpty else{return}
            let xmin=points.map{$0[0]}.min()!,xmax=points.map{$0[0]}.max()!
            let zmin=points.map{$0[2]}.min()!,zmax=points.map{$0[2]}.max()!
            let active=Set(fired)
            func project(_ i:Int)->CGPoint {
                let p=points[i]
                return CGPoint(x:14+CGFloat((p[0]-xmin)/max(1,xmax-xmin))*(size.width-28),y:18+CGFloat((p[2]-zmin)/max(1,zmax-zmin))*(size.height-36))
            }
            for e in circuit.edges.prefix(450) {
                var path=Path();path.move(to:project(Int(e[0])));path.addLine(to:project(Int(e[1])))
                context.stroke(path,with:.color(.cyan.opacity(0.04)),lineWidth:0.4)
            }
            for i in points.indices {
                let p=project(i),a=active.contains(i)
                let role=circuit.neurons[i].role
                let base:Color = role=="gf" ? .yellow:((role=="dna01" || role=="dna02") ? .cyan:accent)
                let r:CGFloat=a ? 2.3:1.25
                if a {context.fill(Path(ellipseIn:CGRect(x:p.x-5,y:p.y-5,width:10,height:10)),with:.color(base.opacity(0.15)))}
                context.fill(Path(ellipseIn:CGRect(x:p.x-r,y:p.y-r,width:r*2,height:r*2)),with:.color(base.opacity(a ? 1:0.27)))
            }
        }.background(RoundedRectangle(cornerRadius:10).fill(Color.black.opacity(0.14)))
    }
}
