import XCTest

@MainActor
final class WiFitUITests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    private func app(_ scenario: String, session: String = UUID().uuidString, reset: Bool = true,
                     theme: String = "cottonCandy", appearance: String = "light") -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launchEnvironment = ["WIFIT_UI_SCENARIO": scenario, "WIFIT_UI_SESSION": session,
                                 "WIFIT_UI_RESET": reset ? "1" : "0",
                                 "WIFIT_UI_THEME": theme, "WIFIT_UI_APPEARANCE": appearance]
        app.launch()
        XCTAssertTrue(app.staticTexts["testModeLabel"].waitForExistence(timeout: 10))
        return app
    }

    func testSignInValidationAndKeychainRelaunchThenLogout() {
        let session = UUID().uuidString
        let first = app("signedOut", session: session)
        let button = first.buttons["signInButton"]
        XCTAssertTrue(button.waitForExistence(timeout: 10))
        XCTAssertFalse(button.isEnabled)
        signIn(first, email: "qa-a@example.invalid")
        XCTAssertTrue(first.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        XCTAssertEqual(first.staticTexts["accountGreeting"].label, "Hello, UI Test A.")
        first.terminate()

        let restored = app("signedOut", session: session, reset: false)
        XCTAssertTrue(restored.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        XCTAssertFalse(restored.textFields["signInEmail"].exists)
        restored.buttons["signOutButton"].tap()
        XCTAssertTrue(restored.textFields["signInEmail"].waitForExistence(timeout: 10))
        restored.terminate()

        let loggedOut = app("signedOut", session: session, reset: false)
        XCTAssertTrue(loggedOut.textFields["signInEmail"].waitForExistence(timeout: 10))
        XCTAssertFalse(loggedOut.staticTexts["accountGreeting"].exists)
    }

    func testFailedProfileDoesNotShowSetupOrSavedProgress() {
        let app = app("profileFailure")
        XCTAssertTrue(app.staticTexts["Your profile is unavailable"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["profileSetupTitle"].exists)
        XCTAssertFalse(app.buttons["saveProfileButton"].exists)
        XCTAssertFalse(app.staticTexts["accountGreeting"].exists)
        app.buttons["retryButton"].tap()
        XCTAssertTrue(app.staticTexts["Your profile is unavailable"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["profileSetupTitle"].exists)
        attach(app, name: "Profile failure preserves the gate")
    }

    func testPartialProfileKeepsSavedValuesAndUnsubmittedEditsAcrossForeground() {
        let app = app("partialProfile")
        XCTAssertTrue(app.staticTexts["profileSetupTitle"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.textFields["Name"].value as? String, "UI Test A")
        let age = app.textFields["Age"]
        age.tap(); age.typeText("37")
        XCUIDevice.shared.press(.home)
        app.activate()
        XCTAssertTrue(app.textFields["Age"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.textFields["Age"].value as? String, "37")
        XCTAssertEqual(app.textFields["Name"].value as? String, "UI Test A")
    }

    func testAccountSwitchClearsPriorGreeting() {
        let app = app("ready")
        XCTAssertTrue(app.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["accountGreeting"].label, "Hello, UI Test A.")
        app.buttons["signOutButton"].tap()
        XCTAssertTrue(app.textFields["signInEmail"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.staticTexts["accountGreeting"].exists)
        signIn(app, email: "qa-b@example.invalid")
        XCTAssertTrue(app.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        XCTAssertEqual(app.staticTexts["accountGreeting"].label, "Hello, UI Test B.")
    }

    func testPartialProfileSaveReadsBackBeforeOpeningAccount() {
        let app = app("partialProfile")
        XCTAssertTrue(app.staticTexts["profileSetupTitle"].waitForExistence(timeout: 10))
        let age = app.textFields["Age"]
        age.tap(); age.typeText("37")
        let height = app.textFields["Height (in)"]
        if !height.isHittable { app.swipeUp() }
        height.tap(); height.typeText("70")
        let save = app.buttons["saveProfileButton"]
        for _ in 0..<6 where !save.isHittable { app.swipeUp() }
        XCTAssertTrue(save.isHittable)
        save.tap()
        XCTAssertTrue(app.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        XCTAssertFalse(app.buttons["saveProfileButton"].exists)
    }

    func testFailedResourceIsNotAnEmptyState() {
        let app = app("resourceFailure")
        XCTAssertTrue(app.staticTexts["accountGreeting"].waitForExistence(timeout: 10))
        let row = app.otherElements["resource-foodLog"]
        XCTAssertTrue(row.waitForExistence(timeout: 10))
        XCTAssertTrue(row.staticTexts["Couldn’t load. Your saved information hasn’t been changed."].exists)
        XCTAssertFalse(row.staticTexts["Nothing logged yet"].exists)
        attach(app, name: "Independent resource failure")
    }

    func testAllThemePairsRenderSignIn() {
        for theme in ["cottonCandy", "purple", "rose", "aqua", "teal"] {
            for appearance in ["light", "dark"] {
                let app = app("signedOut", theme: theme, appearance: appearance)
                XCTAssertTrue(app.textFields["signInEmail"].waitForExistence(timeout: 10))
                XCTAssertTrue(app.buttons["themeMenu"].exists)
                attach(app, name: theme + "-" + appearance)
                app.terminate()
            }
        }
    }

    private func signIn(_ app: XCUIApplication, email: String) {
        let emailField = app.textFields["signInEmail"]
        XCTAssertTrue(emailField.waitForExistence(timeout: 10))
        emailField.tap(); emailField.typeText(email)
        let password = app.secureTextFields["signInPassword"]
        password.tap(); password.typeText("synthetic-password")
        // The keyboard's submit action also verifies the form's onSubmit path.
        password.typeText("\n")
    }

    private func attach(_ app: XCUIApplication, name: String) {
        let attachment = XCTAttachment(screenshot: app.screenshot())
        attachment.name = name; attachment.lifetime = .keepAlways
        add(attachment)
    }
}
