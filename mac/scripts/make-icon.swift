import AppKit
let directory=CommandLine.arguments[1]
try FileManager.default.createDirectory(atPath:directory,withIntermediateDirectories:true)
for size in [16,32,128,256,512] {
    for scale in [1,2] {
        let px=size*scale
        let image=NSImage(size:NSSize(width:px,height:px))
        image.lockFocus()
        let context=NSGraphicsContext.current!.cgContext
        context.scaleBy(x:CGFloat(px)/1024,y:CGFloat(px)/1024)
        NSColor(calibratedRed:0.07,green:0.09,blue:0.12,alpha:1).setFill()
        NSBezierPath(roundedRect:NSRect(x:55,y:55,width:914,height:914),xRadius:205,yRadius:205).fill()
        let copper=NSColor(calibratedRed:1,green:0.57,blue:0.29,alpha:1)
        copper.withAlphaComponent(0.3).setStroke()
        for y in [300,420,540,660] {
            let path=NSBezierPath();path.move(to:NSPoint(x:130,y:y));path.line(to:NSPoint(x:285,y:y));path.line(to:NSPoint(x:350,y:y+50));path.lineWidth=9;path.stroke()
            copper.setFill();NSBezierPath(ovalIn:NSRect(x:112,y:y-12,width:24,height:24)).fill()
        }
        NSColor(calibratedWhite:0.96,alpha:1).setFill()
        let head=NSBezierPath(roundedRect:NSRect(x:310,y:465,width:440,height:290),xRadius:90,yRadius:90);head.fill()
        copper.setFill()
        NSBezierPath(roundedRect:NSRect(x:590,y:455,width:235,height:80),xRadius:23,yRadius:23).fill()
        NSColor(calibratedRed:0.07,green:0.09,blue:0.12,alpha:1).setFill()
        NSBezierPath(ovalIn:NSRect(x:618,y:584,width:78,height:78)).fill()
        copper.setStroke();let neck=NSBezierPath();neck.move(to:NSPoint(x:465,y:462));neck.line(to:NSPoint(x:465,y:370));neck.lineWidth=42;neck.stroke()
        NSColor(calibratedWhite:0.78,alpha:1).setFill()
        NSBezierPath(roundedRect:NSRect(x:346,y:298,width:242,height:84),xRadius:25,yRadius:25).fill()
        for x in [370,520] {
            let leg=NSBezierPath();leg.move(to:NSPoint(x:x,y:295));leg.line(to:NSPoint(x:x-20,y:225));leg.line(to:NSPoint(x:x+10,y:185));leg.lineWidth=27;leg.stroke()
            copper.setFill();NSBezierPath(roundedRect:NSRect(x:x-30,y:140,width:120,height:40),xRadius:12,yRadius:12).fill()
        }
        image.unlockFocus()
        let bitmap=NSBitmapImageRep(data:image.tiffRepresentation!)!
        let data=bitmap.representation(using:.png,properties:[:])!
        let suffix=scale==2 ? "@2x":""
        try data.write(to:URL(fileURLWithPath:"\(directory)/icon_\(size)x\(size)\(suffix).png"))
    }
}
