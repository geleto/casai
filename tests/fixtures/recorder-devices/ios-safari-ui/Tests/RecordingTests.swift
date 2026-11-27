import XCTest

final class RecordingTests: XCTestCase {
    private let probe = URL(string: "https://127.0.0.1:8765/ios-safari-probe.html")!

    private func reached(_ state: String, within seconds: TimeInterval) async -> Bool {
        let deadline = Date().addingTimeInterval(seconds)
        let status = URL(string: "/status", relativeTo: probe)!.absoluteURL
        let request = URLRequest(url: status, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 3)
        repeat {
            if let (data, _) = try? await URLSession.shared.data(for: request),
               String(decoding: data, as: UTF8.self) == state { return true }
            try? await Task.sleep(nanoseconds: 1_000_000_000)
        } while Date() < deadline
        return false
    }

    @MainActor
    func testRecordInMobileSafari() async {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.activate()
        if !(await reached("loaded", within: 3)) { safari.open(probe) }
        if !(await reached("loaded", within: 15)) {
            let address = safari.textFields["TabBarItemTitle"].firstMatch
            guard address.waitForExistence(timeout: 10) else { XCTFail(safari.debugDescription); return }
            address.tap()
            safari.typeText(probe.absoluteString + "\n")
        }
        guard await reached("loaded", within: 120) else {
            XCTFail("Safari never loaded the recording page. " + safari.debugDescription)
            return
        }
        for _ in 0..<4 {
            let record = safari.buttons["Record tones"].firstMatch
            if record.waitForExistence(timeout: 8) && record.isHittable {
                record.tap()
            } else {
                safari.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.45)).tap()
            }
            if await reached("running", within: 10) { break }
            print(safari.debugDescription)
        }
        let captured = await reached("captured", within: 850)
        XCTAssertTrue(captured, safari.debugDescription)
    }
}
