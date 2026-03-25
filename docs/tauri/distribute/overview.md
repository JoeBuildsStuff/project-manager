Distribute
Tauri provides the tooling you need to distribute your application either to the platform app stores or as platform-specific installers.

Building
Tauri builds your application directly from its CLI via the build, android build and ios build commands.

npm
yarn
pnpm
deno
bun
cargo
npm run tauri build

See the distributing section to learn more about the configuration options available for each bundle and how to distribute them to your users.

Note

Most platforms requires code signing. See the signing section for more information.

Bundling
By default the build command automatically bundles your application for the configured formats.

If you need further customization on how the platform bundles are generated, you can split the build and bundle steps:

npm
yarn
pnpm
deno
bun
cargo
npm run tauri build -- --no-bundle
# bundle for distribution outside the macOS App Store
npm run tauri bundle -- --bundles app,dmg
# bundle for App Store distribution
npm run tauri bundle -- --bundles app --config src-tauri/tauri.appstore.conf.json

Versioning
Your application version can be defined in the tauri.conf.json > version configuration option, which is the recommended way for managing the app version. If that config value is not set, Tauri uses the package > version value from your src-tauri/Cargo.toml file instead.

Note

Some platforms have some limitations and special cases for the version string. See the individual distribution documentation pages for more information.

Signing
Code signing enhances the security of your application by applying a digital signature to your application’s executables and bundles, validating your identity of the provider of your application.

Signing is required on most platforms. See the documentation for each platform for more information.

macOS
Code signing and notarization for macOS apps
Windows
Code signing Windows installers
Linux
Code signing Linux packages
Android
Code signing for Android
iOS
Code signing for iOS
Distributing
Learn how to distribute your application for each platform.

Linux
For Linux you can distribute your app using the Debian package, Snap, AppImage, Flatpak, RPM or Arch User Repository (AUR) formats.

AppImage
Distribute as an AppImage
AUR
Publishing To The Arch User Repository
Debian
Distribute as a Debian package
RPM
Distribute as an RPM package
Snapcraft
Distribute on Snapcraft.io
Code signing
macOS
For macOS you can either distribute your application directly to the App Store or ship a DMG installer as direct download. Both methods requires code signing, and distributing outside the App Store also requires notarization.

App Bundle
Distribute macOS apps as an App Bundle
App Store
Distribute iOS and macOS apps to the App Store
DMG
Distribute macOS apps as Apple Disk Images
Code signing and notarization

Windows
Learn how to distribute to the Microsoft Store or configure a Windows installer.

Microsoft Store
Distribute Windows apps to the Microsoft Store
Windows Installer
Distribute installers for Windows
Code signing
Android
Distribute your Android application to Google Play.

Google Play
Distribute Android apps to Google Play
Code signing
iOS
Learn how to upload your application to the App Store.

App Store
Distribute iOS and macOS apps to the App Store
Code signing
Cloud Services
Distribute your application to Cloud services that globally distribute your application and support auto updates out of the box.