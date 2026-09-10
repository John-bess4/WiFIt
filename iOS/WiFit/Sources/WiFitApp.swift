import SwiftUI
import FitDataKit
import WiFitAppCore

@main
struct WiFitApp: App {
    @State private var coordinator: AppCoordinator?
    private let configurationFailed: Bool

    init() {
        do {
            let service: LiveAppService
            #if DEBUG
            if let testService = UITestBootstrap.serviceIfRequested() {
                service = testService
            } else {
                service = try Self.liveService()
            }
            #else
            service = try Self.liveService()
            #endif
            _coordinator = State(initialValue: AppCoordinator(service: service))
            configurationFailed = false
        } catch {
            _coordinator = State(initialValue: nil)
            configurationFailed = true
        }
    }

    var body: some Scene {
        WindowGroup {
            if let coordinator {
                AppRootView(coordinator: coordinator)
            } else if configurationFailed {
                ContentUnavailableView("WiFit couldn’t start", systemImage: "exclamationmark.circle",
                                       description: Text("This build is missing its connection settings. Please install a corrected build."))
            }
        }
    }

    private static func liveService() throws -> LiveAppService {
        guard let address = Bundle.main.object(forInfoDictionaryKey: "SupabaseURL") as? String,
              let url = URL(string: address),
              let key = Bundle.main.object(forInfoDictionaryKey: "SupabasePublishableKey") as? String else {
            throw DataError.invalidInput("Missing public project configuration")
        }
        return LiveAppService(configuration: try SupabaseConfiguration(url: url, publishableKey: key),
                              keychainService: "com.wifit.gen2.auth.v1")
    }
}
