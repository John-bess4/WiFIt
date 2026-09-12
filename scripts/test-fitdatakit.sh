#!/usr/bin/env bash
# Run the shared package's tests and compile every declared Apple mobile target.
# Requires macOS with full Xcode selected (xcode-select), not only Command Line Tools.
set -euo pipefail

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "FitDataKit uses Apple's Keychain and requires macOS with full Xcode." >&2
  exit 1
fi

script_directory="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_directory="$(cd -- "$script_directory/.." && pwd)"
package_directory="$repository_directory/Packages/FitDataKit"

# Set FITDATAKIT_TEST_CACHE_DIR to retain/reuse caches deliberately. The default
# is unique per invocation so simultaneous worktrees cannot corrupt each other.
temporary_cache=0
if [[ -n "${FITDATAKIT_TEST_CACHE_DIR:-}" ]]; then
  cache_directory="$FITDATAKIT_TEST_CACHE_DIR"
  mkdir -p "$cache_directory"
  cache_directory="$(cd -- "$cache_directory" && pwd)"
else
  cache_directory="$(mktemp -d "${TMPDIR:-/tmp}/fitdatakit-checks.XXXXXX")"
  temporary_cache=1
fi

finish() {
  local exit_status=$?
  if [[ "$temporary_cache" == 1 && "$exit_status" == 0 ]]; then
    rm -rf -- "$cache_directory"
  else
    echo "FitDataKit build caches and diagnostics: $cache_directory" >&2
  fi
}
trap finish EXIT

export CLANG_MODULE_CACHE_PATH="$cache_directory/clang-modules"
export SWIFTPM_MODULECACHE_OVERRIDE="$cache_directory/swift-modules"

echo "Testing FitDataKit on macOS"
# The package has no external dependencies or plugins. Disabling SwiftPM's
# nested sandbox allows this script to run inside the agent's existing sandbox.
swift test \
  --disable-sandbox \
  --package-path "$package_directory" \
  --scratch-path "$cache_directory/swift-build" \
  --cache-path "$cache_directory/swiftpm-cache" \
  --config-path "$cache_directory/swiftpm-config" \
  --security-path "$cache_directory/swiftpm-security"

cd -- "$package_directory"

echo "Compiling FitDataKit for generic iOS Simulator"
xcodebuild -quiet \
  -scheme FitDataKit \
  -destination 'generic/platform=iOS Simulator' \
  -derivedDataPath "$cache_directory/xcode-ios" \
  -clonedSourcePackagesDirPath "$cache_directory/xcode-packages" \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build

echo "Cross-compiling FitDataKit against the watchOS Simulator SDK"
# A generic watch destination requires an installed platform component on some
# Xcode releases. SDK cross-compilation verifies Foundation/Keychain availability
# at the package's watchOS 10 minimum without needing a simulator runtime.
watch_sdk="$(xcrun --sdk watchsimulator --show-sdk-path)"
swift build \
  --disable-sandbox \
  --package-path "$package_directory" \
  --scratch-path "$cache_directory/swift-watch" \
  --cache-path "$cache_directory/swiftpm-cache" \
  --config-path "$cache_directory/swiftpm-config" \
  --security-path "$cache_directory/swiftpm-security" \
  --triple arm64-apple-watchos10.0-simulator \
  --sdk "$watch_sdk"

echo "FitDataKit tests and iOS/watchOS Simulator builds passed."
