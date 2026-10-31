// Cole's Games: a native macOS app (Apple silicon) for Blackjack DX, Lines DX, Lucky Flip and Sky Glider.
// The games ship inside the app (Contents/Resources/www) and are served to WebKit from memory,
// so everything works offline and nothing is loaded from the internet.

import Cocoa
import WebKit

// MARK: - Serving the bundled games

/// Serves files from the app bundle at colesgames://localhost/<path>. A custom scheme (instead of file://)
/// lets the games load their music with fetch() and keep their saves in localStorage, like on the website.
/// Files are read once and kept in memory, and byte ranges are supported so the music player can stream and seek.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    private var cache: [String: Data] = [:]

    private static let mimeTypes: [String: String] = [
        "html": "text/html", "css": "text/css", "js": "text/javascript", "json": "application/json",
        "png": "image/png", "gif": "image/gif", "jpg": "image/jpeg", "ico": "image/x-icon", "svg": "image/svg+xml",
        "mp3": "audio/mpeg", "woff2": "font/woff2", "txt": "text/plain"
    ]

    init(root: URL) {
        self.root = root.standardizedFileURL
    }

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }
        var path = url.path
        if path.isEmpty || path.hasSuffix("/") { path += "index.html" }
        if path.hasPrefix("/") { path.removeFirst() }

        var file = root.appendingPathComponent(path).standardizedFileURL
        // never serve anything from outside the bundled games folder
        guard file.path.hasPrefix(root.path + "/") else {
            respond(urlSchemeTask, url: url, status: 403, body: Data("Forbidden".utf8), mime: "text/plain")
            return
        }
        var isDir: ObjCBool = false
        if FileManager.default.fileExists(atPath: file.path, isDirectory: &isDir), isDir.boolValue {
            file.appendPathComponent("index.html")
        }
        guard let data = load(file) else {
            respond(urlSchemeTask, url: url, status: 404, body: Data("Not found".utf8), mime: "text/plain")
            return
        }
        let mime = Self.mimeTypes[file.pathExtension.lowercased()] ?? "application/octet-stream"

        // the audio player asks for pieces of a song ("Range: bytes=start-end")
        if let header = urlSchemeTask.request.value(forHTTPHeaderField: "Range"),
           let range = Self.parseRange(header, length: data.count) {
            let slice = data.subdata(in: range.start..<(range.end + 1))
            respond(urlSchemeTask, url: url, status: 206, body: slice, mime: mime,
                    extra: ["Content-Range": "bytes \(range.start)-\(range.end)/\(data.count)"])
            return
        }
        respond(urlSchemeTask, url: url, status: 200, body: data, mime: mime)
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // every response is sent in one go, so there is nothing to cancel
    }

    private func load(_ file: URL) -> Data? {
        if let hit = cache[file.path] { return hit }
        guard let data = try? Data(contentsOf: file, options: .mappedIfSafe) else { return nil }
        cache[file.path] = data
        return data
    }

    /// "bytes=100-199", "bytes=100-" or "bytes=-500" -> inclusive byte offsets, or nil if it doesn't fit the file.
    private static func parseRange(_ header: String, length: Int) -> (start: Int, end: Int)? {
        guard length > 0, header.hasPrefix("bytes=") else { return nil }
        let spec = header.dropFirst(6).split(separator: ",").first.map(String.init) ?? ""
        let parts = spec.split(separator: "-", omittingEmptySubsequences: false)
            .map { $0.trimmingCharacters(in: .whitespaces) }
        guard parts.count == 2 else { return nil }
        var start: Int
        var end: Int
        if parts[0].isEmpty {                     // the last N bytes
            guard let n = Int(parts[1]), n > 0 else { return nil }
            start = max(0, length - n)
            end = length - 1
        } else {
            guard let s = Int(parts[0]) else { return nil }
            start = s
            end = parts[1].isEmpty ? length - 1 : (Int(parts[1]) ?? length - 1)
        }
        end = min(end, length - 1)
        guard start >= 0, start <= end else { return nil }
        return (start, end)
    }

    private func respond(_ task: WKURLSchemeTask, url: URL, status: Int, body: Data, mime: String,
                         extra: [String: String] = [:]) {
        let isText = mime.hasPrefix("text/") || mime == "application/json"
        var headers = [
            "Content-Type": isText ? mime + "; charset=utf-8" : mime,
            "Content-Length": String(body.count),
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache"
        ]
        for (key, value) in extra { headers[key] = value }
        guard let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers) else {
            task.didFailWithError(URLError(.cannotParseResponse))
            return
        }
        task.didReceive(response)
        task.didReceive(body)
        task.didFinish()
    }
}

// MARK: - The app

extension NSToolbarItem.Identifier {
    static let pages = NSToolbarItem.Identifier("pages")
    static let restart = NSToolbarItem.Identifier("restart")
    static let fullScreen = NSToolbarItem.Identifier("fullScreen")
}

struct Page {
    let title: String
    let short: String      // what the toolbar shows
    let path: String
    let symbol: String
    let key: String
}

final class AppDelegate: NSObject, NSApplicationDelegate, NSToolbarDelegate,
                         WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private var window: NSWindow!
    private var webView: WKWebView!
    private var schemeHandler: BundleSchemeHandler!
    private var pagePicker: NSSegmentedControl?
    private var activity: NSObjectProtocol?
    private var gameSize: CGSize?           // the game's own size in web pixels, for fitting it to the window
    private var shownOnce = false
    private var urlObservation: NSKeyValueObservation?

    static let scheme = "colesgames"
    static let home = "colesgames://localhost"

    /// The launcher, the three games and the music player, in toolbar order.
    private let pages: [Page] = [
        Page(title: "Home", short: "Home", path: "/", symbol: "house", key: "0"),
        Page(title: "Blackjack DX", short: "Blackjack", path: "/blackjack/", symbol: "suit.spade.fill", key: "1"),
        Page(title: "Lines DX", short: "Lines", path: "/linesdx/", symbol: "square.grid.3x3.fill", key: "2"),
        Page(title: "Lucky Flip", short: "Lucky Flip", path: "/luckyflip/", symbol: "sparkles", key: "3"),
        Page(title: "Music", short: "Music", path: "/#music", symbol: "music.note", key: "4"),
        // the hidden one: in the Games menu (Command-5) and the launcher, but not the toolbar
        Page(title: "Sky Glider", short: "Sky Glider", path: "/skyglider/", symbol: "airplane", key: "5")
    ]
    private var toolbarPages: [Page] { Array(pages.prefix(5)) }

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenus()

        guard let resources = Bundle.main.resourceURL else { fatalError("Missing app resources") }
        schemeHandler = BundleSchemeHandler(root: resources.appendingPathComponent("www"))

        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(schemeHandler, forURLScheme: Self.scheme)
        config.websiteDataStore = .default()                 // saves (chips, coins, high scores) persist between launches
        config.mediaTypesRequiringUserActionForPlayback = []  // the game music can start without an extra click
        config.suppressesIncrementalRendering = true          // show each page once it's ready, not half-drawn
        config.userContentController.add(self, name: "cgFit")

        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsMagnification = false
        webView.allowsBackForwardNavigationGestures = false   // a stray two-finger swipe shouldn't leave a game
        webView.alphaValue = 0                                // fades in with the first page, so there's no white flash
        // jumping to the Music section on the same page isn't a new page load, so follow the address itself
        urlObservation = webView.observe(\.url, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.syncChrome() }
        }
        if #available(macOS 12.0, *) { webView.underPageBackgroundColor = .windowBackgroundColor }

        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1180, height: 860),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Cole's Games"
        window.minSize = NSSize(width: 840, height: 620)
        window.collectionBehavior = [.fullScreenPrimary]
        window.tabbingMode = .disallowed
        window.contentView = webView

        let toolbar = NSToolbar(identifier: "ColesGamesToolbar")
        toolbar.delegate = self
        toolbar.displayMode = .iconOnly
        toolbar.allowsUserCustomization = false
        window.toolbar = toolbar
        window.toolbarStyle = .unified

        window.center()
        _ = window.setFrameAutosaveName("ColesGamesMainWindow")
        window.makeKeyAndOrderFront(nil)

        NotificationCenter.default.addObserver(self, selector: #selector(windowResized),
                                               name: NSWindow.didResizeNotification, object: window)
        show("/")
        NSApp.activate(ignoringOtherApps: true)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationSupportsSecureRestorableState(_ app: NSApplication) -> Bool { true }

    // Keeps macOS from slowing the app's timers down (App Nap) while you're playing, so frames stay smooth.
    func applicationDidBecomeActive(_ notification: Notification) {
        if activity == nil {
            activity = ProcessInfo.processInfo.beginActivity(options: [.userInitiated, .latencyCritical],
                                                             reason: "Playing Cole's Games")
        }
    }

    func applicationDidResignActive(_ notification: Notification) {
        if let current = activity {
            ProcessInfo.processInfo.endActivity(current)
            activity = nil
        }
    }

    private func show(_ path: String) {
        guard let url = URL(string: Self.home + path) else { return }
        webView.load(URLRequest(url: url))
        window.makeFirstResponder(webView)
    }

    // MARK: Toolbar

    func toolbarDefaultItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.pages, .flexibleSpace, .restart, .fullScreen]
    }

    func toolbarAllowedItemIdentifiers(_ toolbar: NSToolbar) -> [NSToolbarItem.Identifier] {
        [.pages, .flexibleSpace, .space, .restart, .fullScreen]
    }

    func toolbar(_ toolbar: NSToolbar, itemForItemIdentifier itemIdentifier: NSToolbarItem.Identifier,
                 willBeInsertedIntoToolbar flag: Bool) -> NSToolbarItem? {
        switch itemIdentifier {
        case .pages:
            let picker = NSSegmentedControl(labels: toolbarPages.map { $0.short }, trackingMode: .selectOne,
                                            target: self, action: #selector(pagePicked(_:)))
            for (i, page) in toolbarPages.enumerated() {
                picker.setImage(NSImage(systemSymbolName: page.symbol, accessibilityDescription: page.title), forSegment: i)
                picker.setImageScaling(.scaleProportionallyDown, forSegment: i)
                picker.setToolTip("\(page.title) (⌘\(page.key))", forSegment: i)
            }
            picker.selectedSegment = 0
            pagePicker = picker
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Games"
            item.paletteLabel = "Games"
            item.view = picker
            return item
        case .restart:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Restart"
            item.paletteLabel = "Restart"
            item.toolTip = "Restart the game (⌘R)"
            item.image = NSImage(systemSymbolName: "arrow.clockwise", accessibilityDescription: "Restart")
            item.isBordered = true
            item.target = self
            item.action = #selector(reloadGame)
            return item
        case .fullScreen:
            let item = NSToolbarItem(itemIdentifier: itemIdentifier)
            item.label = "Full Screen"
            item.paletteLabel = "Full Screen"
            item.toolTip = "Full screen (⌃⌘F)"
            item.image = NSImage(systemSymbolName: "arrow.up.left.and.arrow.down.right",
                                 accessibilityDescription: "Full Screen")
            item.isBordered = true
            item.action = #selector(NSWindow.toggleFullScreen(_:))
            return item
        default:
            return nil
        }
    }

    @objc private func pagePicked(_ sender: NSSegmentedControl) {
        let i = sender.selectedSegment
        guard pages.indices.contains(i) else { return }
        show(pages[i].path)
    }

    /// Keeps the toolbar and the window's subtitle in step with whatever page is showing.
    private func syncChrome() {
        guard let url = webView.url else { return }
        let path = url.path.isEmpty ? "/" : url.path
        var index = 0
        if path.hasPrefix("/blackjack") { index = 1 }
        else if path.hasPrefix("/linesdx") { index = 2 }
        else if path.hasPrefix("/luckyflip") { index = 3 }
        else if path.hasPrefix("/skyglider") { index = 5 }
        else if url.fragment == "music" { index = 4 }
        pagePicker?.selectedSegment = index < toolbarPages.count ? index : -1
        window.subtitle = (index == 0 || index == 4) ? "" : pages[index].title
    }

    // MARK: Fitting the game to the window

    /// Each game page reports its size; the whole page is zoomed so the game fills the window
    /// at the right shape, sharp at any size (it's real zoom, not a stretched picture).
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "cgFit", let body = message.body as? [String: Any],
              let w = (body["w"] as? NSNumber)?.doubleValue, let h = (body["h"] as? NSNumber)?.doubleValue,
              w > 0, h > 0 else { return }
        gameSize = CGSize(width: w, height: h)
        fitGame()
    }

    @objc private func windowResized() {
        fitGame()
    }

    private func fitGame() {
        guard let size = gameSize else { return }
        let view = webView.bounds.size
        guard view.width > 0, view.height > 0 else { return }
        var zoom = min((view.width - 16) / size.width, (view.height - 16) / size.height)
        zoom = min(zoom, view.width / 800)         // keep the games' desktop layout (their phone layout starts below 720)
        zoom = max(0.6, min(2.5, zoom))
        if abs(webView.pageZoom - zoom) > 0.005 { webView.pageZoom = zoom }
    }

    // MARK: Menus

    private func buildMenus() {
        let main = NSMenu()

        // Cole's Games
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Cole's Games", action: #selector(showAbout), keyEquivalent: "").target = self
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Cole's Games", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        let hideOthers = appMenu.addItem(withTitle: "Hide Others",
                                         action: #selector(NSApplication.hideOtherApplications(_:)), keyEquivalent: "h")
        hideOthers.keyEquivalentModifierMask = [.command, .option]
        appMenu.addItem(withTitle: "Show All", action: #selector(NSApplication.unhideAllApplications(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Cole's Games", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        main.addItem(submenu(appMenu, title: "Cole's Games"))

        // Edit (so copy and paste work in text boxes)
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        let redo = edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "z")
        redo.keyEquivalentModifierMask = [.command, .shift]
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        main.addItem(submenu(edit, title: "Edit"))

        // Games
        let games = NSMenu(title: "Games")
        for (i, page) in pages.enumerated() {
            let item = games.addItem(withTitle: page.title, action: #selector(openPage(_:)), keyEquivalent: page.key)
            item.target = self
            item.tag = i
            item.image = NSImage(systemSymbolName: page.symbol, accessibilityDescription: nil)
            if i == 0 || i == 3 || i == 4 { games.addItem(.separator()) }
        }
        games.addItem(.separator())
        games.addItem(withTitle: "Restart Game", action: #selector(reloadGame), keyEquivalent: "r").target = self
        main.addItem(submenu(games, title: "Games"))

        // View
        let view = NSMenu(title: "View")
        let fullScreen = view.addItem(withTitle: "Enter Full Screen",
                                      action: #selector(NSWindow.toggleFullScreen(_:)), keyEquivalent: "f")
        fullScreen.keyEquivalentModifierMask = [.command, .control]
        main.addItem(submenu(view, title: "View"))

        // Window
        let windowMenu = NSMenu(title: "Window")
        windowMenu.addItem(withTitle: "Minimize", action: #selector(NSWindow.performMiniaturize(_:)), keyEquivalent: "m")
        windowMenu.addItem(withTitle: "Zoom", action: #selector(NSWindow.performZoom(_:)), keyEquivalent: "")
        windowMenu.addItem(.separator())
        windowMenu.addItem(withTitle: "Bring All to Front", action: #selector(NSApplication.arrangeInFront(_:)), keyEquivalent: "")
        main.addItem(submenu(windowMenu, title: "Window"))
        NSApp.windowsMenu = windowMenu

        NSApp.mainMenu = main
    }

    private func submenu(_ menu: NSMenu, title: String) -> NSMenuItem {
        let item = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        item.submenu = menu
        return item
    }

    @objc private func openPage(_ sender: NSMenuItem) {
        guard pages.indices.contains(sender.tag) else { return }
        show(pages[sender.tag].path)
    }

    @objc private func reloadGame() {
        webView.reload()
    }

    @objc private func showAbout() {
        NSApp.orderFrontStandardAboutPanel(options: [
            .applicationName: "Cole's Games",
            .credits: NSAttributedString(
                string: "Blackjack DX, Lines DX, Lucky Flip and Sky Glider\nfrom coleswebsite.xyz",
                attributes: [.font: NSFont.systemFont(ofSize: 11), .foregroundColor: NSColor.secondaryLabelColor]
            )
        ])
    }

    // MARK: Navigation: the games stay in the app, anything else opens in the browser

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else {
            decisionHandler(.cancel)
            return
        }
        if scheme == Self.scheme || scheme == "about" {
            decisionHandler(.allow)
            return
        }
        if ["http", "https", "mailto"].contains(scheme) {
            NSWorkspace.shared.open(url)
        }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        // a new page: forget the old game's size; the launcher isn't zoomed
        gameSize = nil
        if webView.pageZoom != 1 { webView.pageZoom = 1 }
        syncChrome()
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        syncChrome()
        revealOnce()
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        revealOnce()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        revealOnce()
    }

    private func revealOnce() {
        guard !shownOnce else { return }
        shownOnce = true
        NSAnimationContext.runAnimationGroup { context in
            context.duration = 0.18
            webView.animator().alphaValue = 1
        }
    }

    // links that try to open a new window
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if url.scheme?.lowercased() == Self.scheme { webView.load(navigationAction.request) }
            else { NSWorkspace.shared.open(url) }
        }
        return nil
    }

    // if the game's web process ever crashes, bring it back instead of showing a blank window
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.reload()
    }

    // MARK: Browser dialogs shown as Mac dialogs

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.beginSheetModal(for: window) { _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let alert = NSAlert()
        alert.messageText = message
        alert.addButton(withTitle: "OK")
        alert.addButton(withTitle: "Cancel")
        alert.beginSheetModal(for: window) { response in completionHandler(response == .alertFirstButtonReturn) }
    }
}

// MARK: - Start

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
