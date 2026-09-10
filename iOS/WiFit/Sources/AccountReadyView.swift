import SwiftUI
import WiFitAppCore

/// Phase two exposes the actual load state. Phase three supplies the Home layout.
struct AccountReadyView: View {
    let coordinator: AppCoordinator
    @Environment(\.wiFitTheme) private var theme

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            Text("Hello, " + (coordinator.profile?.name ?? "you") + ".")
                .font(.largeTitle.bold()).accessibilityIdentifier("accountGreeting")
            Text("Your account is connected.").font(.title3).foregroundStyle(theme.secondaryText)
            GlassCard {
                VStack(alignment: .leading, spacing: 12) {
                    Label("Your profile is ready", systemImage: "checkmark.shield").font(.headline).foregroundStyle(theme.success)
                    Text(progressMessage)
                        .font(.subheadline).foregroundStyle(theme.secondaryText)
                }
            }
            ForEach(AppResource.allCases) { resource in
                ResourceStatusRow(resource: resource, state: coordinator.resources[resource] ?? ResourceState()) {
                    Task { await coordinator.retry(resource) }
                }
            }
        }
    }

    private var progressMessage: String {
        if coordinator.resources.values.contains(where: \.isLoading) {
            "We’re loading your saved progress. Each section will let you know if it needs another try."
        } else if coordinator.resources.values.contains(where: { $0.failure != nil }) {
            "Some of your progress couldn’t load. You can try those sections again below."
        } else {
            "Your saved progress is up to date."
        }
    }
}

private struct ResourceStatusRow: View {
    let resource: AppResource
    let state: ResourceState
    let retry: () -> Void
    @Environment(\.wiFitTheme) private var theme
    var body: some View {
        GlassCard {
            HStack(alignment: .top, spacing: 14) {
                if state.isLoading { ProgressView().tint(theme.accent).frame(width: 24) }
                else { Image(systemName: state.failure == nil ? "checkmark.circle" : "exclamationmark.circle").foregroundStyle(state.failure == nil ? theme.success : theme.warning).frame(width: 24) }
                VStack(alignment: .leading, spacing: 5) {
                    Text(resource.title).font(.headline)
                    if state.isLoading { Text("Loading…").font(.subheadline).foregroundStyle(theme.secondaryText) }
                    else if state.failure != nil {
                        Text("Couldn’t load. Your saved information hasn’t been changed.").font(.subheadline).foregroundStyle(theme.secondaryText)
                        Button("Try again", action: retry).frame(minHeight: 44)
                    } else if let count = state.count {
                        Text(count == 0 ? "Nothing logged yet" : "Loaded \(count) saved \(count == 1 ? "entry" : "entries")")
                            .font(.subheadline).foregroundStyle(theme.secondaryText)
                    }
                }
            }
        }.accessibilityElement(children: .contain)
            .accessibilityIdentifier("resource-" + resource.rawValue)
    }
}
