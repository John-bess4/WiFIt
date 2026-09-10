import SwiftUI
import WiFitAppCore

struct SignInView: View {
    let coordinator: AppCoordinator
    @Environment(\.wiFitTheme) private var theme
    @State private var email = ""
    @State private var password = ""
    @FocusState private var focus: Field?
    @ScaledMetric(relativeTo: .largeTitle) private var titleSize = 46.0
    private enum Field { case email, password }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            VStack(alignment: .leading, spacing: 10) {
                Text("YOUR DAY, IN BALANCE").font(.system(.caption2, design: .monospaced).weight(.semibold)).tracking(3).foregroundStyle(theme.text)
                Text("Welcome to\nWiFit.").font(.system(size: titleSize, weight: .bold, design: .rounded))
                Text("A little more in tune with you.").font(.title3).foregroundStyle(theme.secondaryText)
            }
            GlassCard {
                VStack(alignment: .leading, spacing: 20) {
                    Text("Sign in").font(.title2.bold())
                    Text("Use your WiFit account to pick up where you left off.").font(.subheadline).foregroundStyle(theme.secondaryText)
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Email").font(.subheadline.weight(.medium))
                        TextField("Email", text: $email, prompt: Text(verbatim: "you@example.com").foregroundStyle(theme.secondaryText))
                            .textContentType(.username).keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never).autocorrectionDisabled()
                            .focused($focus, equals: .email).submitLabel(.next)
                            .onSubmit { focus = .password }
                            .padding(14).background(theme.surface.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border))
                            .accessibilityLabel("Email")
                            .accessibilityIdentifier("signInEmail")
                    }
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Password").font(.subheadline.weight(.medium))
                        SecureField("Password", text: $password, prompt: Text("Password").foregroundStyle(theme.secondaryText))
                            .textContentType(.password).focused($focus, equals: .password)
                            .submitLabel(.go).onSubmit(signIn)
                            .padding(14).background(theme.surface.opacity(0.65), in: RoundedRectangle(cornerRadius: 12))
                            .overlay(RoundedRectangle(cornerRadius: 12).stroke(theme.border))
                            .accessibilityIdentifier("signInPassword")
                    }
                    if let failure = coordinator.failure {
                        Text(UserFacingError.message(failure, signingIn: true)).font(.subheadline)
                            .foregroundStyle(theme.warning).accessibilityIdentifier("signInError")
                    }
                    Button(action: signIn) {
                        if coordinator.isBusy { ProgressView().tint(theme.onAccent) }
                        else { Text("Sign in") }
                    }.buttonStyle(PrimaryButton()).disabled(!valid || coordinator.isBusy).accessibilityIdentifier("signInButton")
                }
            }
            Label("Your progress, ready when you are.", systemImage: "lock.shield")
                .font(.footnote).foregroundStyle(theme.secondaryText).frame(maxWidth: .infinity)
        }
        .onDisappear { password = "" }
    }

    private var valid: Bool {
        let address = email.trimmingCharacters(in: .whitespacesAndNewlines)
        return address.contains("@") && !address.contains(" ") && !password.isEmpty
    }
    private func signIn() {
        guard valid, !coordinator.isBusy else { return }
        focus = nil
        Task { await coordinator.signIn(email: email.trimmingCharacters(in: .whitespacesAndNewlines), password: password) }
    }
}
