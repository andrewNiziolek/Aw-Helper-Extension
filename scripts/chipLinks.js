//Linking to docs from detection Chips.
const GTMChip = document.getElementById("gtmChip");
GTMChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/gtm-client-side", active: false });
});

const gtSSChip = document.getElementById("gtSSChhip");
gtSSChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/gtm-s2s", active: false });
});

const ShopChip = document.getElementById("shopifyChip");
ShopChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/shopify", active: false });
});

const wooChip = document.getElementById("wooCommChip");
wooChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/wordpress-woocommerce", active: false });
});

const magChip = document.getElementById("magentoChip");
magChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/magento", active: false });
});

const launchChip = document.getElementById("launchChip");
launchChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://wiki.awin.com/index.php/Adobe_Tag_Manager", active: false });
});

const tealiumChip = document.getElementById("tealChip");
tealiumChip.addEventListener("click", () => {
    chrome.tabs.create({ url:"https://developer.awin.com/docs/client-side-tracking", active: false });
});