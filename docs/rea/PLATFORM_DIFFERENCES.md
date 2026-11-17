# Platform differences

- SongbookPro Windows 26.0.2 settings and library were observed directly. The default ordering observed was Title. Public set guidance identifies Windows drag handles and right-click removal, compared with long-press and swipe interactions in the touch flows.
- Reference camera acquisition is documented on Android and iOS. Android also supports camera-roll input through that flow. Android has a confirm-on-app-exit setting. The reference manual documents fit-to-page as Windows-only and automatic local backup as unavailable on iOS.
- SongbookPro Groups and the Manager browser companion are separately documented. Account, billing, device and cross-platform sync behavior remain untested.
- Muse Windows runs with WebView2. The same markup is responsive at phone and tablet widths. Actual phone, tablet, stylus and OS accessibility testing requires native builds and devices.
- The Windows host built an x64 debug installer and exercised the native WebView2 application. Android ARM64 debug packaging succeeded after provisioning NDK and SDK dependencies. Signature inspection confirmed the package. ADB found no attached device or emulator. Android device runs and macOS, Linux, iOS and iPadOS builds are **NOT EXECUTED**.
