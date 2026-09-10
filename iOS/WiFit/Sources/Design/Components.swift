import SwiftUI
import FitDataKit

struct GlassCard<Content: View>: View {
    @Environment(\.wiFitTheme) private var theme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ViewBuilder var content: Content
    var body: some View {
        content.padding(20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(theme.surface.opacity(reduceTransparency ? 1 : (theme.dark ? 0.79 : 0.8)), in: RoundedRectangle(cornerRadius: 24))
            .overlay(RoundedRectangle(cornerRadius: 24).stroke(theme.border, lineWidth: 1))
            .shadow(color: theme.shadow.opacity(theme.dark ? 0.15 : 0.06), radius: 18, y: 7)
    }
}

struct PrimaryButton: ButtonStyle {
    @Environment(\.wiFitTheme) private var theme
    @Environment(\.isEnabled) private var enabled
    func makeBody(configuration: Configuration) -> some View {
        configuration.label.font(.headline).foregroundStyle(theme.onAccent)
            .frame(maxWidth: .infinity, minHeight: 52)
            .background(theme.accent.opacity(enabled ? (configuration.isPressed ? 0.8 : 1) : 0.4), in: RoundedRectangle(cornerRadius: 16))
    }
}

struct InputField: View {
    @Environment(\.wiFitTheme) private var theme
    let title: String
    @Binding var text: String
    var keyboard: UIKeyboardType = .default
    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title).font(.subheadline.weight(.medium)).foregroundStyle(theme.secondaryText)
            TextField(title, text: $text)
                .keyboardType(keyboard).padding(13)
                .background(theme.surface.opacity(0.6), in: RoundedRectangle(cornerRadius: 12))
                .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border))
                .accessibilityIdentifier(title)
        }
    }
}

struct LoadingState: View {
    @Environment(\.wiFitTheme) private var theme
    let title: String
    var body: some View {
        GlassCard {
            VStack(spacing: 16) {
                ProgressView().tint(theme.accent)
                Text(title).font(.headline)
                Text("One moment while we get everything ready.")
                    .font(.subheadline).foregroundStyle(theme.secondaryText)
            }.multilineTextAlignment(.center).frame(maxWidth: .infinity).padding(.vertical, 24)
        }.accessibilityIdentifier("loadingState")
    }
}

struct FailedState: View {
    @Environment(\.wiFitTheme) private var theme
    let title: String
    let message: String
    let retry: () -> Void
    var body: some View {
        GlassCard {
            VStack(alignment: .leading, spacing: 16) {
                Image(systemName: "arrow.clockwise.circle").font(.largeTitle).foregroundStyle(theme.accent)
                Text(title).font(.title2.bold())
                Text(message).foregroundStyle(theme.secondaryText)
                Button("Try again", action: retry).buttonStyle(PrimaryButton()).accessibilityIdentifier("retryButton")
            }
        }
    }
}

struct EmptyState: View {
    @Environment(\.wiFitTheme) private var theme
    let title: String
    let message: String
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline)
            Text(message).font(.subheadline).foregroundStyle(theme.secondaryText)
        }.accessibilityElement(children: .combine)
    }
}

enum UserFacingError {
    static func message(_ error: DataError?, signingIn: Bool = false) -> String {
        switch error {
        case .network: "A connection couldn’t be made. Check your internet connection and try again."
        case .http(let status, _) where signingIn && (status == 400 || status == 401 || status == 422):
            "Sign-in didn’t work. Check your email and password and try again."
        case .http(let status, _) where status == 429: "Too many attempts. Please wait a little and try again."
        case .authenticationRequired, .sessionChanged: "Please sign in again to continue."
        case .outcomeUnknown: "We couldn’t confirm the save. Reload your profile before making another change."
        case .storage: "Your secure session couldn’t be updated. Try again before continuing."
        default: "Your information couldn’t be loaded. Please try again."
        }
    }
}
