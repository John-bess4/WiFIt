// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "WiFitAppCore",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "WiFitAppCore", targets: ["WiFitAppCore"])],
    dependencies: [.package(path: "../FitDataKit")],
    targets: [
        .target(name: "WiFitAppCore", dependencies: ["FitDataKit"]),
        .testTarget(name: "WiFitAppCoreTests", dependencies: ["WiFitAppCore", "FitDataKit"])
    ]
)
