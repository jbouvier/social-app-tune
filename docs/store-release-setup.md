# Go On The Sky Store Release Setup

This checklist tracks the account-side setup required to publish this fork as a
new app while keeping production Bluesky server connectivity.

## 1) App Store Connect (iOS)

- Create a new app record:
  - Name: `Go On The Sky`
  - Bundle ID: `com.goonthesky.app`
  - SKU: your internal value
- Create/verify bundle IDs for extensions:
  - `com.goonthesky.app.Share-with-Bluesky`
  - `com.goonthesky.app.BlueskyNSE`
  - `com.goonthesky.app.AppClip`
- Enable App Groups and set:
  - `group.com.goonthesky.app`
- Configure Associated Domains for:
  - `applinks:goonthesky.com`
  - `appclips:goonthesky.com`
- Generate and install provisioning profiles/certificates for all targets.
- In EAS, set the iOS submit target once App Store Connect ID exists:
  - `eas.json` -> `submit.production.ios.ascAppId`

## 2) Google Play Console (Android)

- Create a new app:
  - App name: `Go On The Sky`
  - Package: `com.goonthesky.app`
- Configure Play App Signing and upload key.
- Add SHA-256 fingerprint(s) to:
  - `bskyweb/static/.well-known/assetlinks.json`
  - Replace placeholder:
    `REPLACE_WITH_RELEASE_UPLOAD_OR_APP_SIGNING_FINGERPRINT`
- Upload new `google-services.json` for `com.goonthesky.app` if Firebase is used.

## 3) Domain Association Publish/Verify

- Host and verify:
  - `https://goonthesky.com/.well-known/apple-app-site-association`
  - `https://goonthesky.com/.well-known/assetlinks.json`
- Confirm IDs match:
  - TeamID + iOS bundle IDs
  - Android package + SHA-256 fingerprint

## 4) Listing Metadata

- App title/subtitle/description/screenshots/privacy links must use
  `Go On The Sky` branding and `goonthesky.com`.
- Confirm no legacy placeholder names (`Nimbolta`, `followtune`) remain in
  store copy.

