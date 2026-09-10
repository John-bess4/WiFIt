import SwiftUI

enum ThemeFamily: String, CaseIterable, Identifiable {
    case cottonCandy, purple, rose, aqua, teal
    var id: String { rawValue }
    var title: String {
        switch self {
        case .cottonCandy: "Cotton Candy"
        case .purple: "Purple"
        case .rose: "Rose"
        case .aqua: "Aqua"
        case .teal: "Teal"
        }
    }
}

enum AppearanceChoice: String, CaseIterable, Identifiable {
    case system, light, dark
    var id: String { rawValue }
    var title: String { rawValue.capitalized }
    var colorScheme: ColorScheme? {
        switch self { case .system: nil; case .light: .light; case .dark: .dark }
    }
}

/// All app colors live here. The reference PNGs are never rendered as wallpaper.
struct WiFitTheme {
    let family: ThemeFamily
    let dark: Bool
    var background: Color { Color(hex: dark ? palette.0 : palette.1) }
    var glow: Color { Color(hex: palette.2) }
    var secondaryGlow: Color { Color(hex: palette.3) }
    var accent: Color { Color(hex: dark ? palette.4 : palette.5) }
    var accentText: Color { dark ? glow : accent }
    var text: Color { Color(hex: dark ? 0xF8F6FF : 0x201B3F) }
    var secondaryText: Color { Color(hex: dark ? 0xC6BCD7 : 0x655E7D) }
    var surface: Color { Color(hex: dark ? 0x17132C : 0xFFFFFF) }
    var border: Color { (dark ? glow : accent).opacity(dark ? 0.42 : 0.17) }
    var onAccent: Color { Color(hex: 0xFFFFFF) }
    var warning: Color { Color(hex: dark ? 0xFFC48B : 0x9B4205) }
    var success: Color { Color(hex: dark ? 0x77EDC6 : 0x167255) }
    var shadow: Color { Color(hex: dark ? 0x030209 : 0x654777) }
    var protein: Color { Color(hex: dark ? 0xFF69BA : 0xB72176) }
    var carbs: Color { Color(hex: dark ? 0x7EDCCA : 0x167D74) }
    var fat: Color { Color(hex: dark ? 0xEACB6E : 0x907414) }

    // dark base, light base, first glow, second glow, dark accent, light accent
    private var palette: (UInt32, UInt32, UInt32, UInt32, UInt32, UInt32) {
        switch family {
        case .cottonCandy: (0x110920, 0xFCF5FA, 0xEF8CC6, 0x97CFFA, 0xC42888, 0xAE236E)
        case .purple: (0x0B0923, 0xF2F0FF, 0x9678F4, 0x6DBCF9, 0x8245F7, 0x7134DA)
        case .rose: (0x200C1E, 0xFFF3F1, 0xF577AE, 0xF6AD88, 0xC9316F, 0xB62965)
        case .aqua: (0x061B29, 0xEDFBFF, 0x64CFF1, 0x9EEBD5, 0x137DBA, 0x096C9D)
        case .teal: (0x061C1D, 0xECFBF6, 0x5BDDC0, 0x83CEE0, 0x128577, 0x087368)
        }
    }
}

private extension Color {
    init(hex: UInt32) {
        self.init(.sRGB, red: Double((hex >> 16) & 255) / 255,
                  green: Double((hex >> 8) & 255) / 255, blue: Double(hex & 255) / 255)
    }
}

private struct ThemeKey: EnvironmentKey {
    static let defaultValue = WiFitTheme(family: .cottonCandy, dark: false)
}

extension EnvironmentValues {
    var wiFitTheme: WiFitTheme {
        get { self[ThemeKey.self] }
        set { self[ThemeKey.self] = newValue }
    }
}

struct ThemeBackground: View {
    @Environment(\.wiFitTheme) private var theme
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    var body: some View {
        GeometryReader { geometry in
            ZStack {
                theme.background
                if !reduceTransparency {
                    Ellipse()
                        .fill(theme.glow.opacity(theme.dark ? 0.34 : 0.32))
                        .frame(width: geometry.size.width * 1.75, height: geometry.size.height * 0.6)
                        .rotationEffect(.degrees(-32))
                        .blur(radius: 34)
                        .offset(x: -geometry.size.width * 0.2, y: -geometry.size.height * 0.29)
                    Ellipse()
                        .fill(theme.secondaryGlow.opacity(theme.dark ? 0.25 : 0.55))
                        .frame(width: geometry.size.width * 1.6, height: geometry.size.height * 0.55)
                        .rotationEffect(.degrees(-40))
                        .blur(radius: 32)
                        .offset(x: geometry.size.width * 0.28, y: geometry.size.height * 0.36)
                    Ribbon()
                        .fill(LinearGradient(colors: [theme.surface.opacity(0.02), theme.glow.opacity(0.13), theme.surface.opacity(0.16)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    Ribbon().stroke(theme.surface.opacity(theme.dark ? 0.1 : 0.65), lineWidth: 1)
                }
            }
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
        .allowsHitTesting(false)
    }
}

private struct Ribbon: Shape {
    func path(in rect: CGRect) -> Path {
        Path { path in
            let w = rect.width, h = rect.height
            path.move(to: CGPoint(x: -w * 0.3, y: h * 0.2))
            path.addCurve(to: CGPoint(x: w * 1.15, y: h * 0.9),
                          control1: CGPoint(x: w * 1.2, y: h * 0.06),
                          control2: CGPoint(x: -w * 0.5, y: h * 0.88))
            path.addLine(to: CGPoint(x: w * 1.25, y: h * 1.15))
            path.addCurve(to: CGPoint(x: -w * 0.3, y: h * 0.35),
                          control1: CGPoint(x: -w * 0.85, y: h * 0.7),
                          control2: CGPoint(x: w * 1.3, y: h * 0.32))
            path.closeSubpath()
        }
    }
}

struct ThemeMenu: View {
    @Binding var family: ThemeFamily
    @Binding var appearance: AppearanceChoice
    var body: some View {
        Menu {
            Picker("Theme", selection: $family) {
                ForEach(ThemeFamily.allCases) { Text($0.title).tag($0) }
            }
            Picker("Appearance", selection: $appearance) {
                ForEach(AppearanceChoice.allCases) { Text($0.title).tag($0) }
            }
        } label: {
            Image(systemName: "paintpalette").font(.title3).frame(width: 44, height: 44)
        }
        .accessibilityLabel("Theme and appearance")
        .accessibilityIdentifier("themeMenu")
    }
}
