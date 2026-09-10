import SwiftUI
import WiFitAppCore
import FitDataKit

struct ProfileSetupView: View {
    let coordinator: AppCoordinator
    private let draftUserID: UUID?
    @Environment(\.wiFitTheme) private var theme
    @State private var draft: ProfileCompletionDraft
    @State private var validationMessage: String?

    init(coordinator: AppCoordinator) {
        self.coordinator = coordinator
        draftUserID = coordinator.userID
        _draft = State(initialValue: coordinator.profileDraft)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text(draft.original == nil ? "Make it yours." : "Let’s finish your profile.")
                .font(.largeTitle.bold()).accessibilityIdentifier("profileSetupTitle")
            Text("A few details help shape your daily targets. You can keep or enter your own targets below.")
                .foregroundStyle(theme.secondaryText)
            GlassCard {
                VStack(spacing: 18) {
                    InputField(title: "Name", text: $draft.name)
                    InputField(title: "Age", text: $draft.age, keyboard: .numberPad)
                    HStack(alignment: .top, spacing: 12) {
                        InputField(title: "Weight (lb)", text: $draft.weightLbs, keyboard: .decimalPad)
                        InputField(title: "Height (in)", text: $draft.heightIn, keyboard: .decimalPad)
                    }
                    selection("Energy equation", value: $draft.gender, choices: [("male", "Male"), ("female", "Female")])
                    Text("Used only for the energy estimate.").font(.footnote).foregroundStyle(theme.secondaryText).frame(maxWidth: .infinity, alignment: .leading)
                    selection("Activity", value: $draft.activityLevel, choices: [
                        ("bmr", "Resting energy only"), ("sedentary", "Sedentary"), ("light", "Lightly active"),
                        ("moderate", "Moderately active"), ("active", "Very active"),
                        ("very_active", "Extra active"), ("extremely", "Extremely active")])
                    selection("Goal", value: $draft.goalRate, choices: [
                        ("lose_2", "Lose 2 lb / week"), ("lose_1", "Lose 1 lb / week"),
                        ("lose_0.5", "Lose ½ lb / week"), ("maintain", "Maintain weight"),
                        ("gain_0.5", "Gain ½ lb / week"), ("gain_1", "Gain 1 lb / week"), ("gain_2", "Gain 2 lb / week")])
                }
            }.disabled(coordinator.isBusy)
            GlassCard {
                DisclosureGroup("Daily targets") {
                    VStack(spacing: 16) {
                        Text("Existing targets are kept. Leave a missing target blank to calculate an estimate from your details.")
                            .font(.footnote).foregroundStyle(theme.secondaryText)
                        InputField(title: "Calories (kcal)", text: $draft.calGoal, keyboard: .numberPad)
                        InputField(title: "Protein (g)", text: $draft.proteinGoal, keyboard: .numberPad)
                        InputField(title: "Carbs (g)", text: $draft.carbsGoal, keyboard: .numberPad)
                        InputField(title: "Fat (g)", text: $draft.fatGoal, keyboard: .numberPad)
                        if draft.original != nil {
                            Toggle("Refresh energy estimates", isOn: $draft.recalculateEstimates)
                            Text("Updates resting and daily energy estimates while keeping your targets.")
                                .font(.footnote).foregroundStyle(theme.secondaryText)
                        }
                    }.padding(.top, 16)
                }
            }.disabled(coordinator.isBusy)
            if let validationMessage {
                Text(validationMessage).font(.subheadline).foregroundStyle(theme.warning).accessibilityIdentifier("profileValidation")
            }
            if let failure = coordinator.failure {
                Text(UserFacingError.message(failure)).font(.subheadline).foregroundStyle(theme.warning)
            }
            Button(action: save) {
                if coordinator.isBusy { ProgressView().tint(theme.onAccent) }
                else { Text("Save and continue") }
            }.buttonStyle(PrimaryButton()).disabled(coordinator.isBusy).accessibilityIdentifier("saveProfileButton")
        }
        .onChange(of: draft) { _, value in
            if let draftUserID { coordinator.rememberProfileDraft(value, userID: draftUserID) }
        }
    }

    private func selection(_ title: String, value: Binding<String>, choices: [(String, String)]) -> some View {
        HStack {
            Text(title).font(.subheadline.weight(.medium))
            Spacer()
            Picker(title, selection: value) {
                Text("Choose").tag("")
                if !value.wrappedValue.isEmpty && !choices.contains(where: { $0.0 == value.wrappedValue }) {
                    Text("Saved: " + value.wrappedValue).tag(value.wrappedValue)
                }
                ForEach(choices, id: \.0) { item in Text(item.1).tag(item.0) }
            }.labelsHidden().pickerStyle(.menu).accessibilityIdentifier(title)
        }.frame(minHeight: 44)
    }

    private func save() {
        guard let userID = draftUserID else { return }
        do {
            if draft.original == nil { _ = try draft.buildCreate(userID: userID) }
            else { _ = try draft.buildPatch(userID: userID) }
            validationMessage = nil
            let submittedDraft = draft
            Task { await coordinator.completeProfile(submittedDraft, userID: userID) }
        } catch DataError.invalidInput(let message) {
            validationMessage = message
        } catch {
            validationMessage = "Check your name, age, measurements and selections. Any target you enter must be a valid whole number."
        }
    }
}
