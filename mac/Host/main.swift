import AppKit
import WebKit
import Network
import UniformTypeIdentifiers

// WKWebView needs an HTTP origin for module workers and camera permission.
// This server binds only to loopback and serves files from the signed bundle.
final class AssetServer {
    private let root: URL
    private let queue = DispatchQueue(label: "org.duckfly.assets")
    private var listener: NWListener?
    var port: UInt16 = 0
    init(root: URL) { self.root = root.resolvingSymlinksInPath() }
    func start(_ completion: @escaping (Result<URL, Error>) -> Void) throws {
        let parameters = NWParameters.tcp
        parameters.requiredLocalEndpoint = .hostPort(host: "127.0.0.1", port: .any)
        let listener = try NWListener(using: parameters)
        self.listener = listener
        listener.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready:
                guard let port = listener.port else { return }
                self.port = port.rawValue
                DispatchQueue.main.async { completion(.success(URL(string: "http://127.0.0.1:\(port.rawValue)/")!)) }
            case .failed(let error): DispatchQueue.main.async { completion(.failure(error)) }
            default: break
            }
        }
        listener.newConnectionHandler = { [weak self] connection in
            guard let self else { return }
            connection.start(queue: self.queue)
            self.receive(connection, buffer: Data())
        }
        listener.start(queue: queue)
    }
    private func receive(_ connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16384) { [weak self] bytes, _, ended, error in
            guard let self else { connection.cancel(); return }
            var data = buffer
            if let bytes { data.append(bytes) }
            if data.count > 32768 { connection.cancel(); return }
            guard let header = String(data: data, encoding: .utf8), header.contains("\r\n\r\n") else {
                if ended || error != nil { connection.cancel() } else { self.receive(connection, buffer: data) }
                return
            }
            let first = header.components(separatedBy: "\r\n")[0].split(separator: " ")
            guard first.count == 3, ["GET", "HEAD"].contains(String(first[0])) else {
                self.reply(connection, status: "405 Method Not Allowed", data: Data(), mime: "text/plain", head: false); return
            }
            // Reject DNS rebinding: only this exact loopback origin is accepted.
            let host = header.components(separatedBy: "\r\n").first { $0.lowercased().hasPrefix("host:") }?
                .dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard host == "127.0.0.1:\(self.port)" else {
                self.reply(connection, status: "403 Forbidden", data: Data(), mime: "text/plain", head: false); return
            }
            let raw = String(first[1]).components(separatedBy: "?")[0]
            guard let path = raw.removingPercentEncoding, path.hasPrefix("/"), !path.contains("\0") else { connection.cancel(); return }
            let relative = path == "/" ? "index.html" : String(path.dropFirst())
            let file = self.root.appendingPathComponent(relative).standardizedFileURL.resolvingSymlinksInPath()
            guard file.path.hasPrefix(self.root.path + "/"), let bytes = try? Data(contentsOf: file, options: .mappedIfSafe) else {
                self.reply(connection, status: "404 Not Found", data: Data("Not found".utf8), mime: "text/plain", head: first[0] == "HEAD"); return
            }
            let mime = ["html":"text/html; charset=utf-8", "js":"text/javascript", "mjs":"text/javascript", "css":"text/css", "json":"application/json", "wasm":"application/wasm", "gz":"application/gzip", "svg":"image/svg+xml", "png":"image/png", "jpg":"image/jpeg", "jpeg":"image/jpeg", "webp":"image/webp", "md":"text/plain; charset=utf-8"][file.pathExtension] ?? "application/octet-stream"
            self.reply(connection, status: "200 OK", data: bytes, mime: mime, head: first[0] == "HEAD")
        }
    }
    private func reply(_ connection: NWConnection, status: String, data: Data, mime: String, head: Bool) {
        var response = Data("HTTP/1.1 \(status)\r\nContent-Type: \(mime)\r\nContent-Length: \(data.count)\r\nX-Content-Type-Options: nosniff\r\nCache-Control: no-cache\r\nConnection: close\r\n\r\n".utf8)
        if !head { response.append(data) }
        connection.send(content: response, completion: .contentProcessed { _ in connection.cancel() })
    }
    func stop() { listener?.cancel() }
}

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var server: AssetServer!
    var testTimer: Timer?
    var testStarted = false
    var downloads: [ObjectIdentifier: (temporary: URL, destination: URL)] = [:]
    var testDeadline = Date().addingTimeInterval(90)
    let testing = CommandLine.arguments.contains("--self-test-connections") || CommandLine.arguments.contains("--self-test-launch") || CommandLine.arguments.contains("--self-test-setup") || CommandLine.arguments.contains("--self-test-skills") || CommandLine.arguments.contains("--self-test-scenarios") || CommandLine.arguments.contains("--self-test-guided") || CommandLine.arguments.contains("--self-test-playground") || CommandLine.arguments.contains("--self-test") || CommandLine.arguments.contains("--self-test-room") || CommandLine.arguments.contains("--self-test-vision")
    func applicationDidFinishLaunching(_ notification: Notification) {
        let menu = NSMenu()
        let appItem = NSMenuItem(); menu.addItem(appItem)
        let appMenu = NSMenu(); appItem.submenu = appMenu
        appMenu.addItem(withTitle: "Quit DuckFly", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        let editItem = NSMenuItem(); menu.addItem(editItem); let edit = NSMenu(title: "Edit"); editItem.submenu = edit
        for (name, action, key) in [("Undo", "undo:", "z"), ("Cut", "cut:", "x"), ("Copy", "copy:", "c"), ("Paste", "paste:", "v"), ("Select All", "selectAll:", "a")] {
            edit.addItem(withTitle: name, action: Selector(action), keyEquivalent: key)
        }
        NSApp.mainMenu = menu
        let configuration = WKWebViewConfiguration()
        if testing { configuration.websiteDataStore = .nonPersistent() }
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(self, name: "scene")
        if testing { configuration.userContentController.add(self, name: "acceptance") }
        let saved = testing ? nil : UserDefaults.standard.string(forKey: "duckfly.scene.v1")
        var script = "window.duckflyHost = {platform:'mac'};"
        if testing, let option = CommandLine.arguments.first(where: { $0.hasPrefix("--scenario=") }),
           let encoded = try? JSONSerialization.data(withJSONObject: ["scenario": String(option.dropFirst("--scenario=".count))]),
           let json = String(data: encoded, encoding: .utf8) {
            script += "window.duckflyTestOptions = \(json);"
        }
        if testing && CommandLine.arguments.contains("--vision-bench-only") {
            script += "window.duckflyTestOptions = {...window.duckflyTestOptions, visionBenchOnly:true};"
        }
        if let saved, let encoded = try? JSONSerialization.data(withJSONObject: [saved]), let array = String(data: encoded, encoding: .utf8) {
            script += "try{localStorage.setItem('duckfly.scene.v1',\(array)[0]);}catch(e){}"
        }
        configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: configuration)
        web.navigationDelegate = self; web.uiDelegate = self
        web.isInspectable = true
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1320, height: 860), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = "DuckFly · Robot behavior studio"
        window.minSize = NSSize(width: 560, height: 640)
        window.contentView = web; window.center()
        if testing {
            // Keep a real attached window for WebKit layout without redirecting
            // the user's foreground mouse or keyboard input into a test run.
            window.orderBack(nil)
        } else {
            window.makeKeyAndOrderFront(nil)
            NSApp.activate(ignoringOtherApps: true)
        }
        guard let root = Bundle.main.resourceURL?.appendingPathComponent("Web") else { fatalError("Bundled workspace missing") }
        server = AssetServer(root: root)
        do { try server.start { [weak self] result in
            guard let self else { return }
            switch result {
            case .success(let url):
                self.web.load(URLRequest(url: url))
                if self.testing { self.startSelfTest() }
            case .failure(let error): self.fail(error.localizedDescription)
            }
        }} catch { fail(error.localizedDescription) }
    }
    func fail(_ message: String) {
        if testing { print("MAC_LAB_FAIL \(message)"); exit(1) }
        let alert = NSAlert(); alert.messageText = "DuckFly could not start"; alert.informativeText = message; alert.runModal()
    }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
    func applicationWillTerminate(_ notification: Notification) { server?.stop() }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        if testing && message.name == "acceptance" && message.frameInfo.isMainFrame,
           let data = try? JSONSerialization.data(withJSONObject: message.body), data.count < 10000,
           let json = String(data: data, encoding: .utf8) {
            print("MAC_LAB_PROGRESS " + json)
            fflush(stdout)
            return
        }
        guard !testing, message.frameInfo.isMainFrame, message.frameInfo.securityOrigin.host == "127.0.0.1", message.frameInfo.securityOrigin.port == Int(server.port),
              let data = try? JSONSerialization.data(withJSONObject: message.body), data.count < 50000,
              let json = String(data: data, encoding: .utf8) else { return }
        UserDefaults.standard.set(json, forKey: "duckfly.scene.v1")
    }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { decisionHandler(.cancel); return }
        if navigationAction.shouldPerformDownload { decisionHandler(.download); return }
        if url.host == "127.0.0.1" && url.port == Int(server.port) { decisionHandler(.allow); return }
        if ["https", "http"].contains(url.scheme ?? ""), navigationAction.navigationType == .linkActivated { NSWorkspace.shared.open(url) }
        decisionHandler(.cancel)
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url, url.scheme == "https" || (url.host == "127.0.0.1" && url.port == Int(server.port)) { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(origin.host == "127.0.0.1" && origin.port == Int(server.port) && frame.isMainFrame && type == .camera ? .prompt : .deny)
    }
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel(); panel.allowedContentTypes = [.json]; panel.allowsMultipleSelection = false; panel.canChooseDirectories = false
        panel.beginSheetModal(for: window) { response in completionHandler(response == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { download.delegate = self }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { download.delegate = self }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel(); panel.nameFieldStringValue = suggestedFilename; panel.allowedContentTypes = [.json]
        panel.beginSheetModal(for: window) { response in
            guard response == .OK, let destination = panel.url else { completionHandler(nil); return }
            let temporary = destination.deletingLastPathComponent().appendingPathComponent(".duckfly-\(UUID().uuidString).json")
            self.downloads[ObjectIdentifier(download)] = (temporary, destination)
            completionHandler(temporary)
        }
    }
    func downloadDidFinish(_ download: WKDownload) {
        guard let file = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        do {
            if FileManager.default.fileExists(atPath: file.destination.path) { _ = try FileManager.default.replaceItemAt(file.destination, withItemAt: file.temporary) }
            else { try FileManager.default.moveItem(at: file.temporary, to: file.destination) }
        } catch { fail(error.localizedDescription) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        if let file = downloads.removeValue(forKey: ObjectIdentifier(download)) { try? FileManager.default.removeItem(at: file.temporary) }
        fail(error.localizedDescription)
    }
    func startSelfTest() {
        testTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            Task { @MainActor in
                guard let self, !self.testStarted else { return }
                if Date() > self.testDeadline {
                    self.testTimer?.invalidate()
                    let diagnostic = try? await self.web.evaluateJavaScript("JSON.stringify({url:location.href,ready:window.duckflyTelemetry?.ready,notice:document.querySelector('#notice')?.textContent,title:document.title,state:document.readyState})")
                    self.fail("Workspace initialization timed out: \(diagnostic ?? "No DOM response")"); return
                }
                guard (try? await self.web.evaluateJavaScript("window.duckflyTelemetry?.ready === true")) as? Bool == true else { return }
                self.testStarted = true; self.testTimer?.invalidate()
                do {
                    let path = Bundle.main.resourceURL!.appendingPathComponent(CommandLine.arguments.contains("--self-test-connections") ? "ConnectionsSmoke.js" : CommandLine.arguments.contains("--self-test-launch") ? "LaunchSmoke.js" : CommandLine.arguments.contains("--self-test-setup") ? "SetupSmoke.js" : CommandLine.arguments.contains("--self-test-skills") ? "SkillsSmoke.js" : CommandLine.arguments.contains("--self-test-scenarios") ? "ScenarioAudit.js" : CommandLine.arguments.contains("--self-test-guided") ? "GuidedSmoke.js" : CommandLine.arguments.contains("--self-test-playground") ? "PlaygroundSmoke.js" : CommandLine.arguments.contains("--self-test-room") ? "RoomSmoke.js" : CommandLine.arguments.contains("--self-test-vision") ? "VisionSmoke.js" : "NativeSmoke.js")
                    let helperPath = Bundle.main.resourceURL!.appendingPathComponent("SetupHelpers.js")
                    let script = try String(contentsOf: helperPath, encoding: .utf8) + "\n" + String(contentsOf: path, encoding: .utf8)
                    print("MAC_LAB_TEST_START " + path.lastPathComponent)
                    fflush(stdout)
                    let result = try await self.web.callAsyncJavaScript(script, arguments: [:], in: nil, contentWorld: .page)
                    let data = try JSONSerialization.data(withJSONObject: result ?? [])
                    print("MAC_LAB_RECEIPT " + String(data: data, encoding: .utf8)!)
                    NSApp.terminate(nil)
                } catch { self.fail("\(error.localizedDescription): \((error as NSError).userInfo)") }
            }
        }
    }
}
MainActor.assumeIsolated {
    let app = NSApplication.shared
    let delegate = AppDelegate()
    app.delegate = delegate
    app.setActivationPolicy(.regular)
    app.run()
}
