# Carnage Arena — iOS app (Capacitor wrapper)

Wraps the touch-optimized game in `../mobile` as a native iOS app via
[Capacitor](https://capacitorjs.com). No native plugins are used — this is
just a WebView around the existing mobile build, so there's nothing here to
maintain beyond keeping it in sync with `../mobile`.

## Setup (first time)

```sh
npm install
```

Requires Xcode (not just the Command Line Tools) — check with:

```sh
xcode-select -p   # should print .../Xcode.app/Contents/Developer
```

If it doesn't: `sudo xcode-select -s /Applications/Xcode.app/Contents/Developer`

## After changing anything in `../mobile`

```sh
npx cap sync ios
```

This copies `../mobile`'s files into `ios/App/App/public` (gitignored —
it's a build artifact, not source) and updates native dependencies.

## Build & run

Open in Xcode and run from there (simplest — lets you pick a simulator or a
connected device, and handles code signing):

```sh
npx cap open ios
```

Or from the command line, for the simulator:

```sh
cd ios/App
xcodebuild -scheme App -destination 'platform=iOS Simulator,name=iPhone 17' -configuration Debug build
xcrun simctl boot "iPhone 17"   # if not already booted
open -a Simulator
xcrun simctl install "iPhone 17" <path to App.app from DerivedData>
xcrun simctl launch "iPhone 17" com.dcohen43.carnagearena
```

Running on a physical device or submitting to the App Store needs an Apple
Developer account for code signing — set that up in Xcode's Signing &
Capabilities tab.

## App icon

`ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` is a
1024x1024 PNG generated in the game's own visual style (same source as
`../mobile/icon-*.png`), not Capacitor's default placeholder.
