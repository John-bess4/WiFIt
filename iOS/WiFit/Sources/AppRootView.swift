import SwiftUI
import WiFitAppCore

struct AppRootView: View {
    let coordinator: AppCoordinator
    @Environment(\.colorScheme) private var systemScheme
    @Environment(\.scenePhase) private var scenePhase
    // Appearance preferences contain no credentials or account data.
    @AppStorage("wifit.themeFamily") private var family: ThemeFamily = .cottonCandy
    @AppStorage("wifit.appearance") private var appearance: AppearanceChoice = .system
    @State private var started = false
    @State private var clockRevision = UUID()

    private var theme: WiFitTheme {
        WiFitTheme(family: family, dark: (appearance.colorScheme ?? systemScheme) == .dark)
    }

    var body: some View {
        ZStack {
            ThemeBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack {
                        Text("WiFit").font(.title2.weight(.heavy)).tracking(-1)
                        Spacer()
                        ThemeMenu(family: $family, appearance: $appearance)
                        if coordinator.stage != .signedOut && coordinator.stage != .launching {
                            Button("Sign out") { Task { await coordinator.signOut() } }
                                .font(.subheadline.weight(.semibold)).frame(minHeight: 44)
                                .disabled(coordinator.isBusy).accessibilityIdentifier("signOutButton")
                        }
                    }
                    #if DEBUG
                    if ProcessInfo.processInfo.arguments.contains("--uitesting") {
                        Text("UI TEST • SYNTHETIC DATA").font(.system(.caption2, design: .monospaced))
                            .foregroundStyle(theme.warning).accessibilityIdentifier("testModeLabel")
                    }
                    #endif
                    content
                }.padding(.horizontal, 22).padding(.top, 8).padding(.bottom, 32)
                    .frame(maxWidth: 560).frame(maxWidth: .infinity)
            }.scrollDismissesKeyboard(.interactively)
        }
        .foregroundStyle(theme.text).tint(theme.accentText)
        .environment(\.wiFitTheme, theme)
        .preferredColorScheme(appearance.colorScheme)
        .task {
            guard !started else { return }
            started = true
            #if DEBUG
            if let raw = ProcessInfo.processInfo.environment["WIFIT_UI_THEME"], let value = ThemeFamily(rawValue: raw) { family = value }
            if let raw = ProcessInfo.processInfo.environment["WIFIT_UI_APPEARANCE"], let value = AppearanceChoice(rawValue: raw) { appearance = value }
            #endif
            await coordinator.start()
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, started { Task { await coordinator.refreshForLifecycle() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.significantTimeChangeNotification)) { _ in
            clockRevision = UUID()
            if scenePhase == .active { Task { await coordinator.refreshForLifecycle() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: .NSSystemTimeZoneDidChange)) { _ in
            clockRevision = UUID()
            if scenePhase == .active { Task { await coordinator.refreshForLifecycle() } }
        }
        .task(id: MidnightSchedule(active: scenePhase == .active, revision: clockRevision)) {
            guard scenePhase == .active else { return }
            while !Task.isCancelled {
                let now = Date()
                let midnight = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: now)) ?? now.addingTimeInterval(60)
                do { try await Task.sleep(for: .seconds(max(1, midnight.timeIntervalSince(now)))) }
                catch { return }
                await coordinator.refreshForLifecycle()
            }
        }
    }

    @ViewBuilder private var content: some View {
        switch coordinator.stage {
        case .launching:
            LoadingState(title: "Welcome back")
        case .signedOut:
            SignInView(coordinator: coordinator)
        case .sessionRecovery:
            FailedState(title: "Let’s reconnect", message: UserFacingError.message(coordinator.failure)) {
                Task { await coordinator.retrySession() }
            }
        case .loadingProfile:
            LoadingState(title: "Getting your profile")
        case .profileFailure:
            FailedState(title: "Your profile is unavailable", message: UserFacingError.message(coordinator.failure)) {
                Task { await coordinator.retryProfile() }
            }
        case .profileSetup:
            ProfileSetupView(coordinator: coordinator).id(coordinator.userID)
        case .ready:
            AccountReadyView(coordinator: coordinator)
        }
    }
}

private struct MidnightSchedule: Equatable {
    let active: Bool
    let revision: UUID
}
