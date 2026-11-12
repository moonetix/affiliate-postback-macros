# Changelog

All notable changes to the data and tooling. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-11-12

### Added

- Monthly source watch: `scripts/watch-sources.mjs` fetches every page cited as a `source`, one request per second, hashes its main text and lists changed or missing pages in one open issue. Hashes are kept in `data/source-hashes.json`, which the first scheduled run fills.
- `.github/workflows/source-watch.yml`, which runs it on the 2nd of every month, reports failed runs in an issue and keeps the schedule enabled.
- README: a `jq` example that reads click ID and payout macros per tracker from `data/macros.json`, and a sequence diagram of the click, inbound and outbound postback hops.

### Changed

- Signature notes name the signed input explicitly ("Signed input: ...") instead of "over ...", and no longer print a doubled period.

### Fixed

- Monlix: the signature input now reads "Nothing is signed: the secret itself is sent in the URL."

## [1.0.0] - 2026-11-11

### Added

- Part A: Affise, BeMob, Binom, CAKE, Everflow, Keitaro, RedTrack and Voluum. Inbound postback formats, offer URL and outbound macros, security mechanisms and duplicate handling.
- Part B: Moonetix, AdGate Media, AdGem, adjoe, ayeT-Studios, BitLabs, Lootably, Monlix and Tapjoy (Unity). Publisher postback macros, signatures, reversal signalling, expected responses and source IPs.
- Part C: concept mapping across all platforms.
- `data/macros.json` with a JSON schema, `scripts/build.mjs` to validate it and rebuild the README tables, and `node --test` tests.
- All sources checked November 2026.

[1.1.0]: https://github.com/moonetix/affiliate-postback-macros/releases/tag/v1.1.0
[1.0.0]: https://github.com/moonetix/affiliate-postback-macros/releases/tag/v1.0.0
