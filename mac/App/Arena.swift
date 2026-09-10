import SwiftUI
import AppKit
import RealityKit
import simd

struct SceneDescription: Decodable {
    struct Mesh:Decodable { let vertices:Data; let normals:Data; let indices:Data }
    struct Geometry:Decodable { let id:Int; let mesh:Int; let color:[Float] }
    let meshes:[String:Mesh]
    let geometries:[Geometry]
}

struct ArenaView:NSViewRepresentable {
    @ObservedObject var model:AppModel
    func makeCoordinator()->ArenaCoordinator { ArenaCoordinator() }
    func makeNSView(context:Context)->ARView {
        let view=ARView(frame:.zero)
        context.coordinator.setup(view,resources:model.resources)
        return view
    }
    func updateNSView(_ view:ARView,context:Context) {
        context.coordinator.follow=model.followCamera
        if context.coordinator.resetID != model.cameraReset {
            context.coordinator.resetID=model.cameraReset; context.coordinator.resetCamera()
        }
        if let state=model.state { context.coordinator.update(state) }
    }
}

final class ArenaCoordinator:NSObject {
    weak var view:ARView?
    let root=AnchorEntity(world:.zero)
    let camera=PerspectiveCamera()
    var entities:[ModelEntity]=[]
    var target=SIMD3<Float>(0,0.1,0)
    var angle:Float=0.85
    var elevation:Float=0.37
    var distance:Float=0.68
    var follow=true
    var resetID=0
    var lastTime:Double = -1
    var lastPan=NSPoint.zero
    func setup(_ view:ARView,resources:URL) {
        self.view=view
        view.environment.background = .color(NSColor(calibratedRed:0.055,green:0.068,blue:0.09,alpha:1))
        view.scene.addAnchor(root)
        camera.camera.fieldOfViewInDegrees=45
        camera.camera.near=0.005; camera.camera.far=100
        root.addChild(camera)
        let ground=ModelEntity(mesh:.generatePlane(width:60,depth:60),materials:[SimpleMaterial(color:NSColor(calibratedWhite:0.12,alpha:1),roughness:0.9,isMetallic:false)])
        ground.position.y = -0.001
        root.addChild(ground)
        let lineMaterial=UnlitMaterial(color:NSColor(calibratedRed:0.16,green:0.19,blue:0.23,alpha:1))
        for i in -60...60 {
            let x=Float(i)*0.1
            let a=ModelEntity(mesh:.generateBox(size:[0.0005,0.0002,12]),materials:[lineMaterial]); a.position=[x,0,0]
            let b=ModelEntity(mesh:.generateBox(size:[12,0.0002,0.0005]),materials:[lineMaterial]); b.position=[0,0,x]
            root.addChild(a); root.addChild(b)
        }
        let light=DirectionalLight()
        light.light.intensity=2800
        light.light.color=NSColor(calibratedRed:1,green:0.96,blue:0.89,alpha:1)
        light.shadow=DirectionalLightComponent.Shadow(maximumDistance:8,depthBias:2)
        light.look(at:.zero,from:[1,3,2],relativeTo:nil); root.addChild(light)
        let fill=PointLight(); fill.light.intensity=90; fill.light.attenuationRadius=5
        fill.position=[-0.6,0.8,-0.8]; root.addChild(fill)
        do {
            let description=try JSONDecoder().decode(SceneDescription.self,from:Data(contentsOf:resources.appendingPathComponent("scene.json")))
            var meshes:[Int:MeshResource]=[:]
            for (id,source) in description.meshes {
                var descriptor=MeshDescriptor(name:"duck-\(id)")
                func vectors(_ data:Data)->[SIMD3<Float>] {
                    data.withUnsafeBytes { raw in
                        stride(from:0,to:data.count,by:12).map { i in
                            SIMD3<Float>(raw.loadUnaligned(fromByteOffset:i,as:Float.self),
                                raw.loadUnaligned(fromByteOffset:i+4,as:Float.self),raw.loadUnaligned(fromByteOffset:i+8,as:Float.self))
                        }
                    }
                }
                descriptor.positions=MeshBuffers.Positions(vectors(source.vertices))
                descriptor.normals=MeshBuffers.Normals(vectors(source.normals))
                let indices:[UInt32]=source.indices.withUnsafeBytes {raw in
                    stride(from:0,to:source.indices.count,by:4).map{raw.loadUnaligned(fromByteOffset:$0,as:UInt32.self)}
                }
                descriptor.primitives = .triangles(indices)
                meshes[Int(id)!]=try MeshResource.generate(from:[descriptor])
            }
            for g in description.geometries {
                let c=g.color
                let color=NSColor(calibratedRed:CGFloat(c[0]),green:CGFloat(c[1]),blue:CGFloat(c[2]),alpha:1)
                let entity=ModelEntity(mesh:meshes[g.mesh]!,materials:[SimpleMaterial(color:color,roughness:0.55,isMetallic:false)])
                entity.name="geom_\(g.id)"
                root.addChild(entity); entities.append(entity)
            }
        } catch { NSLog("DuckFly geometry load failed: %@",error.localizedDescription) }
        let pan=NSPanGestureRecognizer(target:self,action:#selector(pan(_:))); view.addGestureRecognizer(pan)
        let zoom=NSMagnificationGestureRecognizer(target:self,action:#selector(zoom(_:)));view.addGestureRecognizer(zoom)
        updateCamera()
    }
    func update(_ state:BodyState) {
        guard state.time != lastTime else {return}; lastTime=state.time
        let conversion=simd_quatf(angle:-.pi/2,axis:[1,0,0])
        for (e,p) in zip(entities,state.poses) {
            e.position=[p[0],p[2],-p[1]]
            e.orientation=conversion*simd_quatf(ix:p[4],iy:p[5],iz:p[6],r:p[3])
        }
        if follow {
            let next=SIMD3<Float>(state.position[0],0.1,-state.position[1])
            target += (next-target)*0.16
            updateCamera()
        }
    }
    func resetCamera() { angle=0.85;elevation=0.37;distance=0.68;target=[0,0.1,0];lastTime = -1;updateCamera() }
    func updateCamera() {
        let offset=SIMD3<Float>(cos(angle)*distance,elevation,sin(angle)*distance)
        camera.look(at:target,from:target+offset,relativeTo:nil)
    }
    @objc func pan(_ gesture:NSPanGestureRecognizer) {
        let movement=gesture.translation(in:view)
        if gesture.state == .began {lastPan=movement}
        angle -= Float(movement.x-lastPan.x)*0.008
        elevation=min(1.2,max(0.04,elevation+Float(movement.y-lastPan.y)*0.002))
        lastPan=movement;updateCamera()
    }
    @objc func zoom(_ gesture:NSMagnificationGestureRecognizer) {
        distance=min(2.5,max(0.25,distance*(1-Float(gesture.magnification))))
        gesture.magnification=0;updateCamera()
    }
}
