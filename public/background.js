console.log("Background Script Running");

// Extract Domain
function extractDomain(url)  {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch {
    return "Invalid URL";
  }
};

function calculateTrustScore(domain)  {
  // Mock trust score calculation - replace with real logic
  if (!domain || domain === "Invalid URL") return 0;
  // Simple example: longer domains get lower scores
  const baseScore = Math.max(0, 100 - (domain.length * 2));
  // Add bonus for common TLDs
  const commonTlds = ['.com', '.org', '.edu', '.gov'];
  const tldBonus = commonTlds.some(tld => domain.endsWith(tld)) ? 20 : 0;
  return Math.min(100, Math.max(0, baseScore + tldBonus));

};

const TRUST_THRESHOLD = 70; // Minimum score to allow downloads/uploads
let currentDomainScore = 0; // Track current domain score

//Callback to Get Current Tab
async function getCurrentTab() {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true, active: true });
    if (!tabs || tabs.length === 0) {
      console.log("No tabs found");
      return;
    }

    const tab = await chrome.tabs.get(tabs[0].id);
    if (!tab?.url) {
      console.log("No URL found");
      return;
    }

    const domain = extractDomain(tab.url);
    const score = calculateTrustScore(domain);
    currentDomainScore = score; // Update current score
    console.log(`Processing: Domain: ${domain}, Score: ${score}`);

    await chrome.storage.local.set({ 
      currentData: { domain, score }
    });

    const { whitelistedDomains, blockedDomains } = await chrome.storage.local.get([
      'whitelistedDomains',
      'blockedDomains'
    ]);
    await updateRules(whitelistedDomains, blockedDomains);

  } catch (error) {
    console.error("Error in getCurrentTab:", error);
  }
}

// Initialize data when background script starts
getCurrentTab();

// listen to Tab Change and Active Tab
chrome.tabs.onActivated.addListener(getCurrentTab);
chrome.tabs.onUpdated.addListener(getCurrentTab);


// Trigger When Rule Matched
chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((details) => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.storage.local.get(['blockedDomains'], (result) => {
        const domain = extractDomain(tabs[0].url);
        if (result.blockedDomains && result.blockedDomains.includes(domain)) {
          chrome.tabs.sendMessage(tabs[0].id, {
        type: "RULE_TRIGGERED",
        details,
        score: currentDomainScore,
        blocked: currentDomainScore < TRUST_THRESHOLD
          });
        }
      });
    }
  });
});

// Initialize storage on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    whitelistedDomains: [],
    blockedDomains: []
  });
});

// Handle messages from popup
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.type === "ADD_TO_WHITELIST") {
    await handleWhitelist(request.domain);
  } else if (request.type === "ADD_TO_BLOCKLIST") {
    await handleBlock(request.domain);
  }
});

async function handleWhitelist(domain) {
  const { whitelistedDomains, blockedDomains } = await chrome.storage.local.get([
    'whitelistedDomains',
    'blockedDomains'
  ]);

  const updatedWhitelist = [...new Set([...whitelistedDomains, domain])];
  const updatedBlocklist = blockedDomains.filter(d => d !== domain);

  await chrome.storage.local.set({
    whitelistedDomains: updatedWhitelist,
    blockedDomains: updatedBlocklist
  });

  await updateRules(updatedWhitelist, updatedBlocklist);
}

async function handleBlock(domain) {
  const { whitelistedDomains, blockedDomains } = await chrome.storage.local.get([
    'whitelistedDomains',
    'blockedDomains'
  ]);

  const updatedBlocklist = [...new Set([...blockedDomains, domain])];
  const updatedWhitelist = whitelistedDomains.filter(d => d !== domain);

  await chrome.storage.local.set({
    whitelistedDomains: updatedWhitelist,
    blockedDomains: updatedBlocklist
  });


  await updateRules(updatedWhitelist, updatedBlocklist);
}

async function updateRules(whitelist, blocklist) {
  // Skip if both lists are empty or invalid
  if (!whitelist) whitelist = [];
  if (!blocklist) blocklist = [];
  if (blocklist[0] === 'newtab') return;

  try {
    const rules = [];
    
    // Only add blocking rules if we have domains to block
    if (blocklist.length > 0) {
      rules.push({
        id: 1,
        priority: 100,
        action: { type: "block" },
        condition: {
          regexFilter: ".*",
          resourceTypes: ["sub_frame", "xmlhttprequest", "other", "object", "media"],
          initiatorDomains: blocklist
        }
      });
    }

    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules.map(rule => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: rules
    });

    console.log('Rules updated - Whitelist:', whitelist, 'Blocklist:', blocklist);
  } catch (error) {
    console.error('Error updating rules:', error);
  }
}
