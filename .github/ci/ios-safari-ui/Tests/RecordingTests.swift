import XCTest

final class RecordingTests: XCTestCase {
    func testRecordInMobileSafari() {
        let safari = XCUIApplication(bundleIdentifier: "com.apple.mobilesafari")
        safari.open(URL(string: "http://127.0.0.1:8765/ios-safari-probe.html")!)
        let record = safari.buttons["Record tones"]
        if !record.waitForExistence(timeout: 5) {
            for title in ["Continue", "Start Browsing", "Not Now"] {
                let onboarding = safari.buttons[title].firstMatch
                if onboarding.exists && onboarding.isHittable { onboarding.tap() }
            }
        }
        guard record.waitForExistence(timeout: 30) else {
            XCTFail(safari.debugDescription)
            return
        }
        record.tap()
        XCTAssertTrue(safari.buttons["Captured"].waitForExistence(timeout: 45), safari.debugDescription)
    }
}
