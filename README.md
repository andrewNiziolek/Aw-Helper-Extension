# Awin Helper

![Awin Helper icon](assets/icon128.png)

A community-developed browser extension to support Awin Staff in their daily responsibilities.

[Chrome Web Store](https://chrome.google.com/webstore/detail/awin-helper/ddfnphknakdknhcolehloanbkeppaomo?hl=en&authuser=0) | [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/awin-helper/bjlmofgpijnhhaclcifnjnafjmdehncl)

## Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Features](#features)
- [Contributing](#contributing)
- [Bug Reports & Feature Requests](#bug-reports--feature-requests)
- [License](#license)

## Installation

Install Awin Helper from your browser's store:

- [Chrome Web Store](https://chrome.google.com/webstore/detail/awin-helper/ddfnphknakdknhcolehloanbkeppaomo?hl=en&authuser=0)
- [Edge Add-ons](https://microsoftedge.microsoft.com/addons/detail/awin-helper/bjlmofgpijnhhaclcifnjnafjmdehncl)

Once it's installed, the extension appears in your toolbar or in the extensions menu. We recommend pinning it to the toolbar.

## Getting Started

The extension has two main views:

- **Glance**: click the toolbar icon for a quick summary of the site you're on.
- **Dock**: click **Open Dock** in Glance to open the side panel. Dock stays open and updates as you switch tabs, so use it for detailed readouts and tools.

## Features

### Glance (toolbar popup)

| Feature | What it does |
| --- | --- |
| Compatibility rating | Rates how easily the current site can integrate with Awin tracking. |
| Tech detection summary | Lists the ecommerce platforms and tag managers detected on the page. |
| Shopify domain copy | On Shopify sites, shows the store's `myshopify.com` URL and copies it with one click. |
| Consent & app summary | Shows the detected consent manager and whether a native app was found. |
| Announcements | Shows notices about the extension, labelled Info, Attention or Important. |
| Open Dock | Opens the Dock side panel for the current window. |

### Dock (side panel)

| Feature | What it does |
| --- | --- |
| Live updates | Refreshes automatically when you switch tabs or navigate. |
| Tech detection readout | Shows every detection in full. Platform chips link to the matching Awin integration docs. |
| Consent details | Shows the consent providers found, how they were found, and the consent state for each category. |
| App detection details | Lists iOS and Android apps linked from the site, with their App Store / Google Play IDs. |
| New Implementation | Takes an MID and opens the pages you need to set up a new advertiser. |
| Internal Review | Takes an MID and opens the review pages together in a tab group. |
| Test URL generator | Builds a test click URL for an MID. |
| Salesforce MID auto fill | When a Salesforce case is open, fills its MID into the Dock tools. |
| Clipboard | Saves an MID, commission rate and network fee across sessions. |

### Salesforce Lightning panel

| Feature | What it does |
| --- | --- |
| Case MID lookup | Finds the advertiser's MID on a Salesforce case and adds an Awin Helper panel to the page. |
| Quick actions | Opens a Client Site test click, Invite User, or Quick IR View for that MID in one click. |
| Links | Shortcuts to Tracking Settings, Test Diagnosis, Commission Groups and Delete Tests. |
| IR Start | Opens the full set of Internal Review tabs as a tab group. |

### Awin UI

| Feature | What it does |
| --- | --- |
| Provider Area shortcut | Finds the advertiser you're viewing in the Awin UI and links straight to its Provider Area. |

### General

| Feature | What it does |
| --- | --- |
| Theme | Switches Glance and Dock between System, Light and Dark. |

For screenshots and more detail, see the [full feature guide](https://aniziolek.notion.site/Extension-Feature-List-10416419acf180aebf0bcc04930b315d).

## Contributing

To contribute, fork the project from the `main` branch and make your changes on a new branch.

There's no build step. The extension is plain JavaScript, HTML and CSS (Manifest V3). To test your changes locally:

1. Go to `chrome://extensions` (or `edge://extensions` in Edge).
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select your project folder.
4. After making changes, click the reload icon on the extension card.

When your changes are ready, open a Pull Request that describes them and confirms you've tested the extension in your browser for Manifest V3 compliance.

Approved Pull Requests are merged and released in the next version.

## Bug Reports & Feature Requests

To report a bug or request a feature, use the [Issues](https://github.com/andrewNiziolek/Aw-Helper-Extension/issues) tab. For bugs, please use the Bug report template.

## License

This project is licensed under AGPL-3.0-or-later. See [LICENSE](LICENSE) for details.
