// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "FitDataKit",
    platforms: [.iOS(.v17), .macOS(.v14), .watchOS(.v10)],
    products: [.library(name: "FitDataKit", targets: ["FitDataKit"])],
    targets: [
        .target(name: "FitDataKit"),
        .testTarget(name: "FitDataKitTests", dependencies: ["FitDataKit"], resources: [.process("Fixtures")])
    ]
)
