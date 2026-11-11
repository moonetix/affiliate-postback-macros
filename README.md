# Affiliate postback macros

**The S2S postback reference to keep open while wiring conversions: macros, parameters, signatures and reversal rules for 8 tracking platforms and 9 offerwall networks, each fact linked to the vendor's own docs.**

[![CI](https://github.com/moonetix/affiliate-postback-macros/actions/workflows/ci.yml/badge.svg)](https://github.com/moonetix/affiliate-postback-macros/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Data: JSON](https://img.shields.io/badge/data-macros.json-555.svg)](data/macros.json)
[![Sources checked](https://img.shields.io/badge/sources%20checked-November%202026-0b7a75.svg)](#how-to-read-the-sheet)
[![Maintained by Moonetix](https://img.shields.io/badge/maintained%20by-Moonetix-004ABB.svg)](https://moonetix.com)

Maintained by [Moonetix](https://moonetix.com).

Every platform names the same handful of things differently. The click ID is `{transaction_id}` on Everflow, `#reqid#` on CAKE and `{clickid}` on Voluum. A reversal is `status=2` on one offerwall, `is_chargeback=1` with an `r-` prefix on another, and not documented at all on a third. This sheet puts them side by side. The same content is in [data/macros.json](data/macros.json), validated against [a JSON schema](data/macros.schema.json), so you can feed it into your own tooling.

## Contents

- [How to read the sheet](#how-to-read-the-sheet)
- [Part A: Tracking platforms](#part-a-tracking-platforms)
- [Part B: Offerwall publisher postbacks](#part-b-offerwall-publisher-postbacks)
- [Part C: Cross-platform mapping](#part-c-cross-platform-mapping)
- [Wiring notes](#wiring-notes)
- [Using the data](#using-the-data)
- [Not covered yet](#not-covered-yet)
- [About Moonetix](#about-moonetix)

## How to read the sheet

Conversion data moves in three directions, and the tables label each macro with one of them:

| Label | Who calls whom | Example |
| --- | --- | --- |
| **Offer URL** | The platform adds its click ID to the advertiser's landing URL. | `https://offer.example/?s2={clickid}` |
| **Inbound postback** | The advertiser or network reports the conversion back to the platform, server to server. | `https://tracker.example/postback?cid=...&payout=...` |
| **Outbound postback** | The platform passes the conversion on to its affiliate or traffic source. | `https://source.example/conv?click={externalid}` |

Part B covers the last hop for rewards publishers: the offerwall network calling your server so you can credit a user.

- Every row links the vendor page it comes from. All pages were read in November 2026.
- **n/d** means not documented on the linked pages. The feature may exist; we could not cite it, so it is not listed.
- Inbound parameter names are shown bare (`cid`). Macros are shown with the vendor's own delimiters (`{clickid}`, `#s2#`, `[%TX%]`, `{{userId}}`).
- Vendors change their docs. If a row is out of date, open an issue with the link to the current page.

## Part A: Tracking platforms

Affiliate network platforms (Affise, CAKE, Everflow) and media buying trackers (BeMob, Binom, Keitaro, RedTrack, Voluum), in alphabetical order.

<!-- part-a:start -->

### Inbound postback formats

The URL an advertiser or network calls to report a conversion to the platform.

| Platform | Method | Example from the vendor docs | Source |
| --- | --- | --- | --- |
| [Affise](#affise) | GET or POST | `https://abbbc.affise.com/postback?clickid={clickid}&pid={pub_id}` | [docs](https://help-center.affise.com/en/articles/6474604-set-up-s2s-integration-with-advertisers), checked November 2026 |
| [BeMob](#bemob) | GET | `https://xxxxx.bemobtrk.com/postback?cid=REPLACE&payout=OPTIONAL&txid=REPLACE&status=REPLACE` | [docs](https://docs.bemob.com/en/postback-settings-of-affiliate-network), checked November 2026 |
| [Binom](#binom) | GET | `https://binom.org/click?cnv_id={sub1}&payout={sum}&cnv_status={status}` | [docs](https://docs.binom.org/postback-v2.php), checked November 2026 |
| [CAKE](#cake) | GET | `https://demo-new.cakemarketing.com/p.ashx?o=976&e=ld&f=pb&r=REQUEST_SESSION_ID&t=TRANSACTION_ID` | [docs](https://support.getcake.com/support/solutions/articles/5000546408-how-to-implement-server-to-server-tracking-using-a-postback-url), checked November 2026 |
| [Everflow](#everflow) | GET | `https://trk.example.com/?nid=123&transaction_id={transaction_id}&amount=99.99&currency=USD` | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls), checked November 2026 |
| [Keitaro](#keitaro) | GET | `http://IP/postback-key/postback?subid=REPLACE&status=REPLACE&payout=REPLACE` | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html), checked November 2026 |
| [RedTrack](#redtrack) | GET | `https://your.dedicated.tracking.domain.com/postback?clickid={affiliate_network_parameter}` | [docs](https://help.redtrack.io/?p=423), checked November 2026 |
| [Voluum](#voluum) | GET | `https://voluum_dedicated_domain.com/postback?cid=REPLACE&payout=OPTIONAL&txid=OPTIONAL` | [docs](https://doc.voluum.com/en/submitting_postback_url.html), checked November 2026 |

### How inbound postbacks are secured

None of these platforms documents an HMAC signature on inbound postbacks. Protection is a shared token, an IP allowlist, or both.

| Platform | Mechanisms | Duplicates |
| --- | --- | --- |
| Affise | **Secure code.** Sent in the secure parameter. A wrong or missing code is answered with Access denied. [docs](https://help-center.affise.com/en/articles/6476587-server-postback-errors)<br>**IP allowlist.** Set at offer or advertiser level. Other addresses get Bad IP. [docs](https://help-center.affise.com/en/articles/6476587-server-postback-errors) | A postback for a conversion that already exists is answered with Conversion exists. The page does not say which field is the key. [docs](https://help-center.affise.com/en/articles/6476587-server-postback-errors) |
| BeMob | **IP allowlist.** Accept postbacks only from listed addresses, one per line. [docs](https://help.bemob.com/docs/double-postbacks-and-postbacks-from-white-ips) | Repeat postbacks for the same click ID are not accepted by default unless a payout, unique transaction ID or status value sets them apart. Accept Double Postbacks turns this off. [docs](https://help.bemob.com/docs/double-postbacks-and-postbacks-from-white-ips) |
| Binom | **IP allowlist.** Postback IP whitelist field on the affiliate network. [docs](https://docs.binom.org/affiliate-networks.php) | With Upsell checked on an offer, payouts of several postbacks for the same click ID are summed instead of replaced. [docs](https://docs.binom.org/postback-v2.php) |
| CAKE | **IP allowlist.** Advertiser pixel whitelist with an IP start and end. Conversions From Whitelist Only on the offer stores conversions from those servers only. [docs](https://support.getcake.com/support/solutions/articles/5000545795-how-to-whitelist-conversion-pixel-ip-addresses) | n/d |
| Everflow | **Verification token.** verification_token, up to 50 characters, case-sensitive, set per advertiser. Once enabled it is required on every postback for that advertiser's offers. [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls)<br>**IP or domain allowlist.** Set per advertiser, enforced per offer with Enforce Advertiser Whitelist. Ranges and wildcards are not allowed. [docs](https://helpdesk.everflow.io/customer/ip-domain-whitelisting-for-advertisers) | Turn off Allow Duplicate Conversions on the offer and send a unique order_id. [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Keitaro | **Postback key.** A unique key in the postback path protects the tracker from fake postback requests. Self-hosted installs change it with TRACKER_POSTBACK_KEY. [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) | A second postback with the same status overwrites the earlier conversion. Send a unique tid to keep them separate. [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| RedTrack | **Postback protection.** A toggle on the offer source adds a unique ptoken to the postback template. Conversions with a non-matching ptoken are ignored. [docs](https://help.redtrack.io/knowledgebase/kb/basic-setup-9785/offer-sources-brand-related-settings-9830/postback-protection/)<br>**IP allowlist.** Whitelist IP records conversions only from a given IP or range. [docs](https://help.redtrack.io/knowledgebase/kb/basic-setup-9785/offer-sources-brand-related-settings-9830/postback-protection/) | Duplicate postback mode per offer source, including Ignore duplicate postbacks and Ignore duplicate postbacks by event id (rdtk_event_id). [docs](https://help.redtrack.io/knowledgebase/tracking-event-types/) |
| Voluum | **IP allowlist.** Inbound postbacks from IPs that are not allowlisted are discarded. Does not work while IP anonymization is on. [docs](https://doc.voluum.com/article/add-an-affiliate-network-to-voluum) | Duplicate click IDs are discarded. The same cid and txid pair counts once. Accept duplicate postbacks keeps repeats with an empty txid. [docs](https://doc.voluum.com/article/upselling-tracking-subsequent-conversions) |

### Affise

Network platform. [affise.com](https://affise.com). Sources checked November 2026.

Inbound postback (GET or POST):

```text
https://abbbc.affise.com/postback?clickid={clickid}&pid={pub_id}
```

The advertiser receives the click ID in the tracking link, for example aff_sub={clickid}, and returns it as clickid. [docs](https://help-center.affise.com/en/articles/6474604-set-up-s2s-integration-with-advertisers)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `clickid` | Also click_id. Mandatory. | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Transaction ID | `action_id` | Conversion ID in the advertiser's system. | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Payout or revenue | `sum` | Revenue. | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Status | `status` | 1 approved, 2 pending, 3 declined, 5 hold. | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Event or goal | `goal` |  | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | IP address | `ip` |  | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Time | `action_timestamp` |  | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Security | `secure` | Secure code set at offer, advertiser or platform level. | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Inbound postback | Other | `custom_field1 ... custom_field15` |  | [docs](https://help-center.affise.com/en/articles/6475468-affise-postback-url-parameters) |
| Offer URL | Click ID | `{clickid}` | Also {click_id}. Required in the advertiser tracking URL. | [docs](https://help-center.affise.com/en/articles/6474898-advertiser-tracking-url-macros) |
| Offer URL | Affiliate ID | `{pid}` |  | [docs](https://help-center.affise.com/en/articles/6474898-advertiser-tracking-url-macros) |
| Offer URL | Offer ID | `{offer_id}` |  | [docs](https://help-center.affise.com/en/articles/6474898-advertiser-tracking-url-macros) |
| Offer URL | Sub ID | `{sub1} ... {sub8}` |  | [docs](https://help-center.affise.com/en/articles/6474898-advertiser-tracking-url-macros) |
| Offer URL | Country | `{geo}` | ISO alpha-2. | [docs](https://help-center.affise.com/en/articles/6474898-advertiser-tracking-url-macros) |
| Outbound postback | Partner click ID | `{sub1} ... {sub8}` | Affise has no clickid macro for affiliate postbacks. Pass your click ID in a sub and read it back. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Sub ID | `{sub1} ... {sub8}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Payout or revenue | `{sum}` | Conversion payout. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Sale amount | `{order_sum}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Status | `{status}` | 1 approved, 2 pending, 3 declined, 5 hold. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Transaction ID | `{transactionid}` | The advertiser's conversion identifier. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Offer ID | `{offerid}` | No underscore here, unlike {offer_id} in tracking URLs. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Currency | `{currency}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | IP address | `{ip}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Country | `{geo}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Time | `{timestamp}` | Unix time of conversion creation. | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |
| Outbound postback | Event or goal | `{goal}` |  | [docs](https://help-center.affise.com/en/articles/6483741-affiliate-postback-url-macros) |

**Not documented on the pages above:** HMAC signing; Currency parameter on inbound postbacks.

### BeMob

Tracker. [bemob.com](https://bemob.com). Sources checked November 2026.

Inbound postback (GET):

```text
https://xxxxx.bemobtrk.com/postback?cid=REPLACE&payout=OPTIONAL&txid=REPLACE&status=REPLACE
```

cid is the only required parameter. BeMob click IDs are 22 alphanumeric characters. [docs](https://docs.bemob.com/en/postback-settings-of-affiliate-network)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `cid` | Required. | [docs](https://docs.bemob.com/en/postback-settings-of-affiliate-network) |
| Inbound postback | Payout or revenue | `payout` |  | [docs](https://docs.bemob.com/en/postback-settings-of-affiliate-network) |
| Inbound postback | Transaction ID | `txid` | Unique per conversion, for example an order number. | [docs](https://docs.bemob.com/en/postback-settings-of-affiliate-network) |
| Inbound postback | Status | `status` | You map the network's values to New, Approved, Declined or Chargeback. | [docs](https://docs.bemob.com/en/postback-statuses) |
| Inbound postback | Event or goal | `cet` | Custom conversion type. | [docs](https://docs.bemob.com/en/postback-statuses) |
| Offer URL | Click ID | `{clickId}` | Example: subid={clickId}. | [docs](https://docs.bemob.com/en/offer-settings) |
| Outbound postback | Partner click ID | `{externalId}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Payout or revenue | `{payout}` | Account currency. {payout.USD} converts. | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Transaction ID | `{transactionId}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Status | `{status}` |  | [docs](https://help.bemob.com/docs/send-postbacks-for-selected-statuses) |
| Outbound postback | Sub ID | `{custom1} ... {customN}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Offer ID | `{offerId}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Campaign ID | `{campaignId}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | IP address | `{ip}` |  | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |
| Outbound postback | Country | `{country}` | Also {countryCode}. | [docs](https://help.bemob.com/docs/postback-settings-of-a-traffic-source) |

**Not documented on the pages above:** HMAC signing or a secret token; Currency parameter on inbound postbacks.

### Binom

Tracker. [binom.org](https://binom.org). Sources checked November 2026.

Inbound postback (GET):

```text
https://binom.org/click?cnv_id={sub1}&payout={sum}&cnv_status={status}
```

The values in braces are the network's own macros. click is the tracker file that handles clicks and conversions. [docs](https://docs.binom.org/postback-v2.php)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `cnv_id` |  | [docs](https://docs.binom.org/postback-v2.php) |
| Inbound postback | Payout or revenue | `payout` |  | [docs](https://docs.binom.org/postback-v2.php) |
| Inbound postback | Status | `cnv_status` | Free text. A second field, cnv_status2, also exists. | [docs](https://docs.binom.org/postback-v2.php) |
| Inbound postback | Currency | `cnv_currency` |  | [docs](https://docs.binom.org/postback-v2.php) |
| Inbound postback | Other | `disable_postback=1` | Do not fire the postback to the traffic source for this conversion. | [docs](https://docs.binom.org/postback-v2.php) |
| Offer URL | Click ID | `{clickid}` | Example: {offer_url}?sub1={clickid}. | [docs](https://docs.binom.org/affiliate-networks.php) |
| Outbound postback | Partner click ID | `{externalid}` |  | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | Payout or revenue | `{payout}` | Payout in USD. | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | Status | `{cnv_status}` | Also {status}. | [docs](https://docs.binom.org/tokens-v2.php) |
| Outbound postback | Currency | `{cnv_currency}` |  | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | Sub ID | `{t1} ... {t10}` | Traffic source tokens. | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | Offer ID | `{offer}` | The tokens page lists {offer_id}. | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | Campaign ID | `{campaign}` |  | [docs](https://docs.binom.org/conv-to-source.php) |
| Outbound postback | IP address | `{ip}` |  | [docs](https://docs.binom.org/tokens-v2.php) |
| Outbound postback | Country | `{country}` | Also {country_code}. | [docs](https://docs.binom.org/tokens-v2.php) |

**Not documented on the pages above:** HMAC signing or a secret token; Transaction ID parameter on inbound postbacks; Conversion ID macro on outbound postbacks.

### CAKE

Network platform. [getcake.com](https://getcake.com). Sources checked November 2026.

Inbound postback (GET):

```text
https://demo-new.cakemarketing.com/p.ashx?o=976&e=ld&f=pb&r=REQUEST_SESSION_ID&t=TRANSACTION_ID
```

Replace REQUEST_SESSION_ID with the advertiser's token for the parameter that received #reqid#, for example #s2#. The page does not define o, e and f. [docs](https://support.getcake.com/support/solutions/articles/5000546408-how-to-implement-server-to-server-tracking-using-a-postback-url)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `r` | Request Session ID. | [docs](https://support.getcake.com/support/solutions/articles/5000546408-how-to-implement-server-to-server-tracking-using-a-postback-url) |
| Inbound postback | Transaction ID | `t` | Shown as t=TRANSACTION_ID in the example. | [docs](https://support.getcake.com/support/solutions/articles/5000546408-how-to-implement-server-to-server-tracking-using-a-postback-url) |
| Inbound postback | Payout or revenue | `p` | Price. Overrides the offer's received amount. | [docs](https://support.getcake.com/support/solutions/articles/5000545957-how-to-set-up-a-revshare) |
| Offer URL | Click ID | `#reqid#` | Example: ?s2=#reqid#. | [docs](https://support.getcake.com/support/solutions/articles/5000546408-how-to-implement-server-to-server-tracking-using-a-postback-url) |
| Outbound postback | Partner click ID | `#s2#` | Example from CAKE: click_id=#s2#. s1 is reserved for the affiliate's sub-affiliate ID. | [docs](https://support.getcake.com/support/solutions/articles/5000546096-how-affiliates-can-use-tokens-to-send-dynamic-values-in-pixels) |
| Outbound postback | Sub ID | `#s1# ... #s5#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Payout or revenue | `#price#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Transaction ID | `#leadid#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Offer ID | `#oid#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Campaign ID | `#campid#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Affiliate ID | `#affid#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | IP address | `#ip#` | Conversion IP. #source_ip# is the click IP. | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |
| Outbound postback | Time | `#utcunixtime#` |  | [docs](https://support.getcake.com/support/articles/5000546436-tokens-in-3rd-party-affiliate-pixels-cake-basic) |

**Not documented on the pages above:** HMAC signing or a secret token; Status parameter; Duplicate handling on the pages we could read.

### Everflow

Network platform. [everflow.io](https://www.everflow.io). Sources checked November 2026.

Inbound postback (GET):

```text
https://trk.example.com/?nid=123&transaction_id={transaction_id}&amount=99.99&currency=USD
```

nid (your network ID) and transaction_id are required. Everflow accepts GET requests only. [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `transaction_id` | Required. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Payout or revenue | `amount` |  | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Currency | `currency` | Three-letter ISO code. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Transaction ID | `order_id` | Used for deduplication. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Event or goal | `event_id` | Also adv_event_id. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Time | `timestamp` | Unix, UTC. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Security | `verification_token` |  | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Inbound postback | Other | `adv1 ... adv10` | Custom names are ignored. | [docs](https://helpdesk.everflow.io/customer/accessing-editing-s2s-postback-urls) |
| Offer URL | Click ID | `{transaction_id}` | Example: click_id={transaction_id} in the Default Landing Page. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Offer URL | Offer ID | `{offer_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Offer URL | Affiliate ID | `{affiliate_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Partner click ID | `{sub1}` | Commonly used for the partner's click ID. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Sub ID | `{sub1} ... {sub10}` | Slots 6 to 10 were added in May 2026. | [docs](https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner) |
| Outbound postback | Payout or revenue | `{payout_amount}` | In the offer currency. The partner help article names this macro {payout}. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Sale amount | `{sale_amount}` | Visible to partners only if the network enables it. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Transaction ID | `{conversion_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Offer ID | `{offer_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Affiliate ID | `{affiliate_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Currency | `{offer_currency}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | IP address | `{session_ip}` | {conversion_ip} is the IP at conversion. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Country | `{geo_country_code}` | ISO 3166-1 alpha-2. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Time | `{timestamp}` | Unix, UTC. | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |
| Outbound postback | Event or goal | `{event_id}` |  | [docs](https://helpdesk.everflow.io/customer/your-guide-to-parameters-macros) |

**Delivery.** Partner postbacks: up to 5 attempts, any 2xx counts as success. A postback is deactivated after at least 10 consecutive failures spanning more than 72 hours. [docs](https://helpdesk.everflow.io/collaborator/managing-postbacks-as-a-partner)

**Not documented on the pages above:** HMAC signing; Status macro.

### Keitaro

Tracker. [keitaro.io](https://keitaro.io). Sources checked November 2026.

Inbound postback (GET):

```text
http://IP/postback-key/postback?subid=REPLACE&status=REPLACE&payout=REPLACE
```

The postback key in the path authenticates the request. subid and status are mandatory. [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `subid` | Mandatory. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Status | `status` | Mandatory. lead, sale, rejected, registration, deposit, trash, or custom. Unknown values are ignored and logged. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Payout or revenue | `payout` | Positive and negative values are supported. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Transaction ID | `tid` | Records repeat conversions without overwriting the previous one. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Currency | `currency` |  | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Sub ID | `sub_id_1 ... sub_id_30` | Updates click data. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Inbound postback | Other | `return` | Response text returned to the sender. | [docs](https://docs.keitaro.io/en/conversions-and-postback/postback.html) |
| Offer URL | Click ID | `{subid}` | The only required offer parameter. Example: &sub1={subid}. | [docs](https://docs.keitaro.io/en/conversions-and-postback/adding-affiliate-networks.html) |
| Outbound postback | Partner click ID | `{external_id}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Click ID | `{subid}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Status | `{status}` | Can be remapped, for example {status:lead=0 sale=1 rejected=2}. | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Payout or revenue | `{revenue}` | Also {conversion_revenue}. | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Transaction ID | `{tid}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Sub ID | `{sub_id_1} ... {sub_id_30}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Offer ID | `{offer_id}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Campaign ID | `{campaign_id}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | IP address | `{ip}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Country | `{country}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |
| Outbound postback | Time | `{conversion_time:format,timezone}` |  | [docs](https://docs.keitaro.io/en/campaigns-and-streams/s2s-postback-placeholders.html) |

**Not documented on the pages above:** HMAC signing; IP allowlist.

### RedTrack

Tracker. [redtrack.io](https://www.redtrack.io). Sources checked November 2026.

Inbound postback (GET):

```text
https://your.dedicated.tracking.domain.com/postback?clickid={affiliate_network_parameter}
```

Add sum for the payout and type for the conversion type. [docs](https://help.redtrack.io/?p=423)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `clickid` |  | [docs](https://help.redtrack.io/?p=423) |
| Inbound postback | Payout or revenue | `sum` |  | [docs](https://help.redtrack.io/?p=9054) |
| Inbound postback | Event or goal | `type` | Conversion type, for example type=InitiateCheckout. | [docs](https://help.redtrack.io/?p=21537) |
| Inbound postback | Transaction ID | `rdtk_event_id` | Used by the duplicate mode that ignores repeats by event ID. Integration guides use eventid. | [docs](https://help.redtrack.io/knowledgebase/tracking-event-types/) |
| Inbound postback | Time | `timestamp` | Unix time. The conversion is recorded at this time. | [docs](https://help.redtrack.io/?p=423) |
| Offer URL | Click ID | `{clickid}` | Example: offer_url?affiliate_network_parameter={clickid}. | [docs](https://help.redtrack.io/?p=423) |
| Outbound postback | Partner click ID | `{ref_id}` |  | [docs](https://help.redtrack.io/knowledgebase/adding-traffic-channel/) |
| Outbound postback | Payout or revenue | `{offer_payout}` | There is no {payout} macro. | [docs](https://help.redtrack.io/knowledgebase/adding-traffic-channel/) |
| Macro list | Transaction ID | `{postbackid}` | Conversion ID. | [docs](https://help.redtrack.io/?p=423) |
| Macro list | Sub ID | `{sub1} ... {sub20}` |  | [docs](https://help.redtrack.io/?p=423) |
| Macro list | Offer ID | `{offerid}` |  | [docs](https://help.redtrack.io/?p=423) |
| Macro list | Campaign ID | `{campaignid}` |  | [docs](https://help.redtrack.io/?p=423) |
| Macro list | IP address | `{ip}` |  | [docs](https://help.redtrack.io/?p=423) |
| Macro list | Country | `{country}` |  | [docs](https://help.redtrack.io/?p=423) |

**Not documented on the pages above:** HMAC signing; Name of the inbound status parameter (statuses are other, approved, pending, declined); Currency parameter.

### Voluum

Tracker. [voluum.com](https://voluum.com). Sources checked November 2026.

Inbound postback (GET):

```text
https://voluum_dedicated_domain.com/postback?cid=REPLACE&payout=OPTIONAL&txid=OPTIONAL
```

HTTPS needs SSL enabled on your dedicated domain. [docs](https://doc.voluum.com/en/submitting_postback_url.html)

| Where | Concept | Macro or parameter | Notes | Source |
| --- | --- | --- | --- | --- |
| Inbound postback | Click ID | `cid` | Required. c is also accepted; cid wins. | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Inbound postback | Payout or revenue | `payout` | p is also accepted; payout wins. | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Inbound postback | Transaction ID | `txid` | Unique within the scope of one click ID. | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Inbound postback | Event or goal | `et` | Conversion type. Needs custom conversions set up. | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Inbound postback | Currency | `currency` | Overrides the offer currency. | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Inbound postback | Other | `param1 ... param5` |  | [docs](https://doc.voluum.com/article/parameters-in-postback-urls) |
| Offer URL | Click ID | `{clickid}` | Example: https://offer_url.com?s2={clickid}. | [docs](https://doc.voluum.com/article/pass-information-to-an-affiliate-network) |
| Outbound postback | Partner click ID | `{externalid}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Click ID | `{click.id}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Payout or revenue | `{payout}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Transaction ID | `{transaction.id}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Sub ID | `{var1}, {var:name}` | Custom variables. | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Offer ID | `{offer.id}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Campaign ID | `{campaign.id}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | IP address | `{ip}` |  | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |
| Outbound postback | Country | `{country}` | Also {countryname}. | [docs](https://doc.voluum.com/article/traffic-source-postback-url) |

**Not documented on the pages above:** HMAC signing or a secret token; Status parameter.

<!-- part-a:end -->

## Part B: Offerwall publisher postbacks

What an offerwall network sends to your server when a user earns or loses a reward, and how to prove the request is genuine.

<!-- part-b:start -->

### Signatures

| Network | Scheme | Signed input | Sent in | Key | Source |
| --- | --- | --- | --- | --- | --- |
| [Moonetix](#moonetix) | HMAC-SHA256 | transaction_id:user_id:reward:status | {hash} macro, lowercase hex | Postback secret key | [docs](https://docs.moonetix.com/postbacks#verify), checked November 2026 |
| [AdGate Media](#adgate-media) | None documented |  |  |  | [docs](https://docs.prodegeads.com/postbacks/postback-information), checked November 2026 |
| [AdGem](#adgem) | HMAC-SHA256 | v2: the full postback URL with the verifier parameter removed. v3: the request body. | verifier query parameter (v2); Signature header (v3) | Postback secret key | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v3), checked November 2026 |
| [adjoe](#adjoe) | SHA-1 (keyed by concatenation) | trans_uuid + user_uuid + currency + coin_amount + device_id + sdk_app_id + s2s_token | sid query parameter, hex | S2S token from the Monetize Dashboard payout setup | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/), checked November 2026 |
| [ayeT-Studios](#ayet-studios) | HMAC-SHA256 | All request parameters sorted by key, values URL-encoded (space as +), joined as a query string | X-Ayetstudios-Security-Hash header, hex | Publisher API key | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callback-verification/hmac-security-hash-optional), checked November 2026 |
| [BitLabs](#bitlabs) | HMAC-SHA1 | The whole callback URL without the trailing &hash= value | hash query parameter, hex | App secret key | [docs](https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing), checked November 2026 |
| [Lootably](#lootably) | SHA-256 (keyed by concatenation) | userID + ip + revenue + currencyReward + postback secret | {hash} macro | Postback secret of the placement | [docs](https://documentation.lootably.com/docs/postbacks), checked November 2026 |
| [Monlix](#monlix) | Shared secret in the URL | None. The secret itself is sent. | {{secretKey}} macro | Site secret key | [docs](https://docs.monlix.com/docs/postback), checked November 2026 |
| [Tapjoy (Unity)](#tapjoy-unity) | MD5 (standard), HMAC-SHA256 (improved) | Standard: id:snuid:currency:secret_key. Improved: the request body. | verifier query parameter; X-Tapjoy-Signature header | Virtual currency secret key | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency), checked November 2026 |

### Reversals and responses

| Network | How a reversal arrives | What your endpoint must answer |
| --- | --- | --- |
| Moonetix | status=2 (state reversed) with the same transaction_id and the same positive reward and payout as the credit. [docs](https://docs.moonetix.com/credits-and-reversals#how-we-signal) | Any 2xx within 6 seconds. Redirects are not followed. Up to 5 retries, after about 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours. [docs](https://docs.moonetix.com/postbacks#responses-and-retries) |
| AdGate Media | Include {state} in the URL to receive chargebacks and reversals. Without it, only approved conversions are sent. [docs](https://docs.prodegeads.com/postbacks/postback-information) | HTTP 200. Otherwise up to 5 more attempts, 5 minutes apart. [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| AdGem | n/d | Any 2xx. Up to 3 attempts in total, 20 second timeout each. [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| adjoe | n/d | 200 after the sid is verified. 401 for a missing or wrong sid. 4xx and 5xx are retried for up to 4 days. [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| ayeT-Studios | Enable Reversal Callbacks on the placement. Reversals carry is_chargeback=1, the original transaction_id prefixed with r-, and negative amounts. [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) | Always HTTP 200. Otherwise resent 12 times over one hour. [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| BitLabs | [%ACTIVITY:TYPE%] is RECONCILIATION and [%REF%] points to the original transaction. Values may be negative, positive or 0, so do not detect reconciliations by amount alone. [docs](https://developer.bitlabs.ai/docs/general-reward-callbacks) | HTTP 200. Up to 10 retries after 1, 4, 9, 16, 25, 60, 120, 300, 300 and 300 seconds. 30 second timeout. [docs](https://developer.bitlabs.ai/docs/callbacks) |
| Lootably | status=0 marks a chargeback, but the docs note that postbacks are only sent with status 1 today. [docs](https://documentation.lootably.com/docs/postbacks) | Return the body 1. Retries are off by default and can be set from 0 to 5. [docs](https://documentation.lootably.com/docs/postbacks) |
| Monlix | {{status}}=2 marks a chargeback. [docs](https://docs.monlix.com/docs/postback) | n/d |
| Tapjoy (Unity) | n/d | 200 when the currency was granted. 403 for a wrong verifier or unknown snuid stops retries. Anything else is retried every 5 minutes for up to 4 days. 5 second timeout, UTF-8 responses. [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |

### Moonetix

[moonetix.com](https://moonetix.com). Method: GET. Sources checked November 2026.

```text
https://yoursite.com/postback?user={user_id}&tx={transaction_id}&event={event_id}&status={status}&reward={reward}&payout={payout}&hash={hash}
```

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{user_id}` | The user ID from your offerwall link. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Transaction ID | `{transaction_id}` | Same value on the credit and a later reversal. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Event or goal | `{event_id}` | Unique per event. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Status | `{status}` | 1 credited, 2 reversed. {state} gives the same in words. | [docs](https://docs.moonetix.com/postbacks#statuses) |
| Reward | `{reward}` | In your currency. Never negative. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Currency name | `{currency}` |  | [docs](https://docs.moonetix.com/postbacks#macros) |
| Payout or revenue | `{payout}` | What you earn, in USD. Never negative. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Offer ID | `{offer_id}` |  | [docs](https://docs.moonetix.com/postbacks#macros) |
| Offer name | `{offer_name}` |  | [docs](https://docs.moonetix.com/postbacks#macros) |
| Country | `{country}` | Two-letter code. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Other | `{device}` | desktop, android or ios. | [docs](https://docs.moonetix.com/postbacks#macros) |
| IP address | `{ip}` | IP the user started the offer from. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Sub ID | `{sub1} ... {sub5}` |  | [docs](https://docs.moonetix.com/postbacks#macros) |
| Other | `{integration}` | offerwall, api or sdk. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Other | `{app_id}` | Useful when one URL serves several offerwalls. | [docs](https://docs.moonetix.com/postbacks#macros) |
| Security | `{hash}` |  | [docs](https://docs.moonetix.com/postbacks#verify) |

**Signature.** HMAC-SHA256 over transaction_id:user_id:reward:status. Hash the values exactly as they arrive. The postback secret key is not the link hash salt. [docs](https://docs.moonetix.com/postbacks#verify)

**Source IPs.** 187.124.177.111 and 2a02:4780:79:782c::1. User agent Moonetix-Postback/1.0. [docs](https://docs.moonetix.com/postbacks#ip-addresses)

**Notes.** Test postbacks have a transaction_id that starts with test_ and offer_id 0.

### AdGate Media

[adgatemedia.com](https://adgatemedia.com). Method: GET. Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{s1}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Transaction ID | `{conversion_id}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Reward | `{points}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Payout or revenue | `{payout}` | USD. | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Status | `{state}` | approved, rejected or pending. {status} is deprecated. | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Offer ID | `{offer_id}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| IP address | `{session_ip}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Country | `{country}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |
| Sub ID | `{s2} ... {s5}` |  | [docs](https://docs.prodegeads.com/postbacks/postback-information) |

**Source IPs.** 52.42.57.125, 54.186.70.83, 52.39.181.185, 54.190.14.75, 52.11.36.128, 54.191.9.88, 3.21.111.51, 3.135.140.42, 3.133.245.65 (optional). [docs](https://docs.prodegeads.com/postbacks/postback-information)

**Notes.** The documentation now lives on docs.prodegeads.com. It describes no signature; keep the postback URL unique and use the IP allowlist.

### AdGem

[adgem.com](https://adgem.com). Method: GET (v2), POST JSON (v3). Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{player_id}` |  | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Transaction ID | `{transaction_id}` | AdGem ID of the conversion. request_id is unique per postback. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Reward | `{amount}` | Can be empty or null. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Payout or revenue | `{payout}` |  | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Offer ID | `{campaign_id}` | {offer_id} exists for Offer API integrations. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| IP address | `{ip}` | Publisher-supplied in the click URL. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Country | `{country}` | Publisher-supplied in the click URL. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Sub ID | `{c1} ... {c5}` |  | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |
| Security | `verifier` | Added after you generate a postback key, with request_id. | [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2) |

**Signature.** HMAC-SHA256 over v2: the full postback URL with the verifier parameter removed. v3: the request body.. v3 sends a JSON body with request_id and timestamp at the top and the conversion under data. [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v3)

**Source IPs.** Sent from a static IP. Ask your account manager for the production address. [docs](https://docs.adgem.com/docs/integrate/reward-mechanism/postbacks-v2)

### adjoe

[adjoe.io](https://adjoe.io). Method: GET. Sources checked November 2026.

```text
https://example.com/example?sid={sid}&trans_uuid={trans_uuid}&user_uuid={user_uuid}&currency={currency}&coin_amount={coin_amount}&device_id={device_id}&sdk_app_id={sdk_app_id}
```

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{user_uuid}` |  | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Transaction ID | `{trans_uuid}` | UUID v4. | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Reward | `{coin_amount}` | Integer. | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Currency name | `{currency}` |  | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Other | `{device_id}` | no-deviceid when unavailable. Hash it as received. | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Other | `{sdk_app_id}` |  | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Sub ID | `{publisher_sub_id1} ... {publisher_sub_id5}` |  | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |
| Security | `{sid}` |  | [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/) |

**Signature.** SHA-1 (keyed by concatenation) over trans_uuid + user_uuid + currency + coin_amount + device_id + sdk_app_id + s2s_token. Drop missing optional parameters from the concatenation and keep the order of the rest. [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/)

**Source IPs.** 3.121.65.44, 18.185.166.67, 52.29.52.48. [docs](https://docs.adjoe.io/rewarded-solutions/setting-up-rewarding/server-to-server-payouts/)

**Notes.** Parameter names in the URL can be customized. No USD payout, IP or country parameter is documented.

### ayeT-Studios

[ayetstudios.com](https://www.ayetstudios.com). Method: GET. Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{external_identifier}` | {user_id} is ayeT's internal ID. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Transaction ID | `{transaction_id}` | Prefixed with r- on chargebacks. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Reward | `{currency_amount}` | Negative on chargebacks. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Payout or revenue | `{payout_usd}` | Negative on chargebacks. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Status | `{is_chargeback}` | 0 conversion, 1 chargeback. {chargeback_reason} when 1. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Offer ID | `{offer_id}` |  | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Offer name | `{offer_name}` |  | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| IP address | `{ip}` | 0.0.0.0 if unknown. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Sub ID | `{custom_1} ... {custom_5}` |  | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callbacks/offerwall-callbacks) |
| Security | `X-Ayetstudios-Security-Hash` | Header, optional. | [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callback-verification/hmac-security-hash-optional) |

**Signature.** HMAC-SHA256 over All request parameters sorted by key, values URL-encoded (space as +), joined as a query string. Optional. The PHP reference uses ksort and http_build_query before hash_hmac. [docs](https://docs.ayetstudios.com/v/product-docs/callbacks-and-testing/callback-verification/hmac-security-hash-optional)

**Notes.** Every macro also has a _sanitized variant.

### BitLabs

[bitlabs.ai](https://bitlabs.ai). Method: GET. Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `[%USER:UID%]` | Up to 255 characters. | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Transaction ID | `[%TX%]` | Use it to prevent double-booking. | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Reward | `[%VALUE:CURRENCY%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Payout or revenue | `[%VALUE:USD%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Status | `[%ACTIVITY:TYPE%]` | COMPLETE, SCREENOUT, RECONCILIATION or START_BONUS. | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Other | `[%REF%]` | Links a reconciliation to the original transaction. | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Offer ID | `[%OFFER:ID%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Offer name | `[%OFFER:NAME%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| IP address | `[%USER:IP_ADDRESS%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Country | `[%COUNTRY%]` |  | [docs](https://developer.bitlabs.ai/docs/callback-parameters) |
| Security | `hash` | Appended as &hash=. | [docs](https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing) |

**Signature.** HMAC-SHA1 over The whole callback URL without the trailing &hash= value. Do not encode or decode the URL before hashing. [docs](https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing)

**Source IPs.** 20.76.54.40/29, 18.199.243.90, 18.157.62.114, 18.193.24.206. [docs](https://developer.bitlabs.ai/docs/callbacks)

### Lootably

[lootably.com](https://lootably.com). Method: GET. Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{userID}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |
| Transaction ID | `{transactionID}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |
| Reward | `{currencyReward}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |
| Payout or revenue | `{revenue}` | USD. | [docs](https://documentation.lootably.com/docs/postbacks) |
| Status | `{status}` | 1 completed, 0 chargeback. | [docs](https://documentation.lootably.com/docs/postbacks) |
| Offer ID | `{offerID}` | Also {numericOfferID}. | [docs](https://documentation.lootably.com/docs/postbacks) |
| Offer name | `{offerName}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |
| IP address | `{ip}` | IP when the user started the offer. | [docs](https://documentation.lootably.com/docs/postbacks) |
| Sub ID | `{sid2} ... {sid5}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |
| Security | `{hash}` |  | [docs](https://documentation.lootably.com/docs/postbacks) |

**Signature.** SHA-256 (keyed by concatenation) over userID + ip + revenue + currencyReward + postback secret. A plain hash with the secret appended, not an HMAC. [docs](https://documentation.lootably.com/docs/postbacks)

### Monlix

[monlix.com](https://monlix.com). Method: GET. Sources checked November 2026.

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `{{userId}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Transaction ID | `{{transactionId}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Reward | `{{rewardValue}}` | Conversion value times your currency multiplier. | [docs](https://docs.monlix.com/docs/postback) |
| Currency name | `{{rewardCurrency}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Payout or revenue | `{{payout}}` | USD. | [docs](https://docs.monlix.com/docs/postback) |
| Status | `{{status}}` | 1 valid, 2 invalid (chargeback). | [docs](https://docs.monlix.com/docs/postback) |
| Offer name | `{{taskName}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| IP address | `{{userIp}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Country | `{{countryCode}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Sub ID | `{{subId}}` |  | [docs](https://docs.monlix.com/docs/postback) |
| Security | `{{secretKey}}` | Your site secret, sent as is. | [docs](https://docs.monlix.com/docs/postback) |

**Signature.** Shared secret in the URL over None. The secret itself is sent.. Compare it in constant time and serve the endpoint over HTTPS only. [docs](https://docs.monlix.com/docs/postback)

**Notes.** Macros use double braces.

### Tapjoy (Unity)

[unity.com](https://unity.com/products/tapjoy). Method: GET (standard), POST JSON (improved). Sources checked November 2026.

```text
<callback_url>?snuid=<user_id>&currency=<currency>&mac_address=<mac_address>
```

| Concept | Macro | Notes | Source |
| --- | --- | --- | --- |
| User ID | `snuid` | Improved format: user.id. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Transaction ID | `id` | Sent when a secret key is set. Improved format: id. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Reward | `currency` | The amount to add. Improved format: currency.reward. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Payout or revenue | `rev` | Improved format only. USD. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Offer name | `offer.name` | Improved format only. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Sub ID | `cp` | Improved format only. Custom parameter set in the SDK. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |
| Security | `verifier` | Improved format: X-Tapjoy-Signature header. | [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency) |

**Signature.** MD5 (standard), HMAC-SHA256 (improved) over Standard: id:snuid:currency:secret_key. Improved: the request body.. The improved format is enabled through Tapjoy support. [docs](https://docs.unity.com/en-us/grow/offerwall/monetization/virtual-currency/self-managed-currency)

**Notes.** Self-managed currency callback.

<!-- part-b:end -->

## Part C: Cross-platform mapping

One concept per row. The column headers link to the platform sections above, where every macro has its source. Where a platform documents several macros for a concept, the table shows the first one listed in its section.

<!-- part-c:start -->

### Tracking platforms

| Concept | [Affise](#affise) | [BeMob](#bemob) | [Binom](#binom) | [CAKE](#cake) | [Everflow](#everflow) | [Keitaro](#keitaro) | [RedTrack](#redtrack) | [Voluum](#voluum) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Click ID in the offer URL | `{clickid}` | `{clickId}` | `{clickid}` | `#reqid#` | `{transaction_id}` | `{subid}` | `{clickid}` | `{clickid}` |
| Click ID parameter (inbound) | `clickid` | `cid` | `cnv_id` | `r` | `transaction_id` | `subid` | `clickid` | `cid` |
| Amount parameter (inbound) | `sum` | `payout` | `payout` | `p` | `amount` | `payout` | `sum` | `payout` |
| Status parameter (inbound) | `status` | `status` | `cnv_status` | n/d | n/d | `status` | n/d | n/d |
| Transaction ID parameter (inbound) | `action_id` | `txid` | n/d | `t` | `order_id` | `tid` | `rdtk_event_id` | `txid` |
| Currency parameter (inbound) | n/d | n/d | `cnv_currency` | n/d | `currency` | `currency` | n/d | `currency` |
| Partner click ID (outbound) | `{sub1} ... {sub8}` | `{externalId}` | `{externalid}` | `#s2#` | `{sub1}` | `{external_id}` | `{ref_id}` | `{externalid}` |
| Payout (outbound) | `{sum}` | `{payout}` | `{payout}` | `#price#` | `{payout_amount}` | `{revenue}` | `{offer_payout}` | `{payout}` |
| Status (outbound) | `{status}` | `{status}` | `{cnv_status}` | n/d | n/d | `{status}` | n/d | n/d |
| Conversion ID (outbound) | `{transactionid}` | `{transactionId}` | n/d | `#leadid#` | `{conversion_id}` | `{tid}` | `{postbackid}` | `{transaction.id}` |
| Sub IDs (outbound) | `{sub1} ... {sub8}` | `{custom1} ... {customN}` | `{t1} ... {t10}` | `#s1# ... #s5#` | `{sub1} ... {sub10}` | `{sub_id_1} ... {sub_id_30}` | `{sub1} ... {sub20}` | `{var1}, {var:name}` |
| Offer ID (outbound) | `{offerid}` | `{offerId}` | `{offer}` | `#oid#` | `{offer_id}` | `{offer_id}` | `{offerid}` | `{offer.id}` |
| IP (outbound) | `{ip}` | `{ip}` | `{ip}` | `#ip#` | `{session_ip}` | `{ip}` | `{ip}` | `{ip}` |
| Country (outbound) | `{geo}` | `{country}` | `{country}` | n/d | `{geo_country_code}` | `{country}` | `{country}` | `{country}` |

### Offerwall networks

| Concept | [Moonetix](#moonetix) | [AdGate Media](#adgate-media) | [AdGem](#adgem) | [adjoe](#adjoe) | [ayeT-Studios](#ayet-studios) | [BitLabs](#bitlabs) | [Lootably](#lootably) | [Monlix](#monlix) | [Tapjoy (Unity)](#tapjoy-unity) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| User ID | `{user_id}` | `{s1}` | `{player_id}` | `{user_uuid}` | `{external_identifier}` | `[%USER:UID%]` | `{userID}` | `{{userId}}` | `snuid` |
| Transaction ID | `{transaction_id}` | `{conversion_id}` | `{transaction_id}` | `{trans_uuid}` | `{transaction_id}` | `[%TX%]` | `{transactionID}` | `{{transactionId}}` | `id` |
| Reward (your currency) | `{reward}` | `{points}` | `{amount}` | `{coin_amount}` | `{currency_amount}` | `[%VALUE:CURRENCY%]` | `{currencyReward}` | `{{rewardValue}}` | `currency` |
| Payout to you | `{payout}` | `{payout}` | `{payout}` | n/d | `{payout_usd}` | `[%VALUE:USD%]` | `{revenue}` | `{{payout}}` | `rev` |
| Status | `{status}` | `{state}` | n/d | n/d | `{is_chargeback}` | `[%ACTIVITY:TYPE%]` | `{status}` | `{{status}}` | n/d |
| Offer ID | `{offer_id}` | `{offer_id}` | `{campaign_id}` | n/d | `{offer_id}` | `[%OFFER:ID%]` | `{offerID}` | n/d | n/d |
| IP address | `{ip}` | `{session_ip}` | `{ip}` | n/d | `{ip}` | `[%USER:IP_ADDRESS%]` | `{ip}` | `{{userIp}}` | n/d |
| Country | `{country}` | `{country}` | `{country}` | n/d | n/d | `[%COUNTRY%]` | n/d | `{{countryCode}}` | n/d |
| Sub IDs | `{sub1} ... {sub5}` | `{s2} ... {s5}` | `{c1} ... {c5}` | `{publisher_sub_id1} ... {publisher_sub_id5}` | `{custom_1} ... {custom_5}` | n/d | `{sid2} ... {sid5}` | `{{subId}}` | `cp` |
| Signature | `{hash}` | n/d | `verifier` | `{sid}` | `X-Ayetstudios-Security-Hash` | `hash` | `{hash}` | `{{secretKey}}` | `verifier` |

<!-- part-c:end -->

## Wiring notes

Patterns that hold across the vendors above, and the mistakes that cost the most when they do not.

**Hash exactly what arrived.** BitLabs signs the full callback URL and says not to encode or decode it first. AdGem v2 signs the URL minus its `verifier`. Moonetix signs four values as they arrive, so `150` and `150.00` give different hashes. Read the raw query string when the signature covers the URL; framework helpers often normalize it.

**Know which fields the signature covers.** Lootably's hash covers `userID`, `ip`, `revenue` and `currencyReward`. Tapjoy's standard verifier covers `id`, `snuid` and `currency`. Moonetix covers `transaction_id`, `user_id`, `reward` and `status`. Anything outside the signed set is informational. Never let it decide an amount.

**Compare in constant time.** `hash_equals` in PHP, `crypto.timingSafeEqual` in Node.js, `hmac.compare_digest` in Python, `MessageDigest.isEqual` in Java. Monlix sends a shared secret instead of a signature; compare that the same way.

**Plan for retries, then make them harmless.** Everflow tries up to 5 times, BitLabs up to 10, ayeT-Studios 12 times in an hour, Tapjoy every 5 minutes for up to 4 days. Put a unique constraint on the transaction ID in the database. A check in code alone loses to two identical requests arriving at the same moment.

**Handle reversals the way each network sends them.** Same transaction ID with a new status (Moonetix, Monlix, AdGate Media `{state}`). A new ID with an `r-` prefix and negative amounts (ayeT-Studios). A separate reference to the original transaction (BitLabs `[%REF%]`). Take back only what the original transaction credited, and only once.

**Answer with the code the sender expects.** Lootably wants the body `1`. Tapjoy treats `403` as final and retries everything else. adjoe asks for `401` on a bad `sid`. Moonetix and AdGem accept any 2xx, and Moonetix does not follow redirects, so an `http` to `https` redirect counts as a failure. Store the result first, then answer.

**Allowlists are a second layer.** adjoe, AdGate Media, BitLabs and Moonetix publish their source addresses; AdGem gives its address on request. On the tracker side, every platform in Part A documents an IP allowlist except Keitaro, which documents a key in the postback path instead. None replaces a signature where one is offered.

**Log the raw request.** Keep the full query string, headers, source IP and your answer for every call. A macro that arrives literally, such as `{user_id}`, is misspelled in the URL template, and the log is the only place you will see it.

## Using the data

[data/macros.json](data/macros.json) holds everything in the tables:

- `concepts`: the shared vocabulary (`click_id`, `transaction_id`, `status`, and so on).
- `tracking_platforms[]`: inbound postback format, macros tagged with `direction` and `concept`, security mechanisms, duplicate handling, and what is not documented.
- `offerwall_networks[]`: macros, `signature` (scheme, signed input, key, location), `reversal`, `response` and `ip_allowlist`.
- Every fact carries a `source` URL. Each entry has a `checked` month.

List the signature scheme of every offerwall network:

```sh
jq -r '.offerwall_networks[] | [.name, (.signature.scheme // "none documented")] | @tsv' data/macros.json
```

Find the payout macro a platform uses in its outbound postback:

```js
import { readFileSync } from 'node:fs';

const data = JSON.parse(readFileSync('data/macros.json', 'utf8'));
const voluum = data.tracking_platforms.find((p) => p.id === 'voluum');
const payout = voluum.macros.find((m) => m.direction === 'outbound' && m.concept === 'amount');
console.log(payout.macro, payout.source); // {payout} https://doc.voluum.com/...
```

The tables in this README are built from the JSON. Node.js 22 is the only requirement:

```sh
node scripts/build.mjs           # validate data/macros.json and rewrite the tables
node scripts/build.mjs --check   # validate and fail if the README is stale (CI runs this)
npm test                         # node --test
```

The build checks the schema, unknown concepts, duplicate IDs, alphabetical order, and house style (no en or em dashes, no emoji). Edit the JSON, never the tables.

## Not covered yet

We list a platform only when its public docs state the details. Pull requests are welcome for TUNE (HasOffers), Torox, CPX Research, TheoremReach, Wannads, TimeWall, Revlum, Notik and Upwall, with a link to the vendor page for every value. See [CONTRIBUTING.md](CONTRIBUTING.md), or use the **Add a platform** issue form.

## License

MIT. See [LICENSE](LICENSE). Product names belong to their owners and are used only to identify their documentation.

## About Moonetix

Moonetix is a pay-per-result affiliate network. Publishers add its offerwall to apps, games, websites and communities, and their users earn the publisher's own currency by completing offers. Postback reference: [docs.moonetix.com/postbacks](https://docs.moonetix.com/postbacks). Ready-made, tested handlers in four languages: [offerwall-postback-handlers](https://github.com/moonetix/offerwall-postback-handlers). Publisher sign-up: [moonetix.com/register](https://moonetix.com/register).
