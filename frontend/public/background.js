console.log("Background Script Running");

const serverURL = 'http://localhost:3000';

// Extract Domain
function extractDomain(url)  {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch {
    return "Invalid URL";
  }
};

function calculateTrustScore()  {
  return 100;
};

const TRUST_THRESHOLD = 70; // Minimum score to allow downloads/uploads
let currentDomainScore = 0; // Track current domain score
let currentDomain = '';

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
    currentDomain = domain; // Update current domain
    currentDomainScore = score; // Update current score
    console.log(`Processing: Domain: ${domain}, Score: ${score}`);

    await chrome.storage.local.set({ 
      currentData: { domain, score }
    });

    const { whitelistedDomains, blockedDomains } = await chrome.storage.local.get([
      'whitelistedDomains',
      'blockedDomains'
    ]);
    // await updateRules(whitelistedDomains, blockedDomains);

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
    blockedDomains: [],
    blockedFileTypes: [
      'zip', 'exe', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 
      'ppt', 'pptx', 'rar', '7z', 'tar', 'gz', 'bin', 
      'iso', 'msi', 'dmg', 'csv', 'txt', 'mp3', 'mp4', 
      'wav', 'avi', 'mov', 'pkg', 'jpg', 'jpeg', 'png', 'gif'
    ]
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

  // await updateRules(updatedWhitelist, updatedBlocklist);
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


  // await updateRules(updatedWhitelist, updatedBlocklist);
}

// async function updateRules(whitelist, blocklist) {
//   // Skip if both lists are empty or invalid
//   if (!whitelist) whitelist = [];
//   if (!blocklist) blocklist = [];
//   if (blocklist[0] === 'newtab') return;

//   try {
//     const { blockedFileTypes } = await chrome.storage.local.get(['blockedFileTypes']);
//     const fileTypesPattern = blockedFileTypes?.length > 0 
//       ? `.*\\.(${blockedFileTypes.join('|')})$`
//       : ".*\\.(exe|bin)$"; // Default blocking at minimum

//     const rules = [];
    
//     // If we have domains to block, add comprehensive blocking rules
//     if (blocklist.length > 0) {
//       rules.push(
//         {
//           id: 1,
//           priority: 100,
//           action: { type: "block" },
//           condition: {
//             resourceTypes: ["sub_frame", "object", "media", "xmlhttprequest", "other"],
//             initiatorDomains: blocklist
//           }
//         },
//         {
//           id: 2,
//           priority: 100,
//           action: { type: "block" },
//           condition: {
//             regexFilter: fileTypesPattern,
//             initiatorDomains: blocklist
//           }
//         },
//         {
//           id: 3,
//           priority: 100,
//           action: { type: "block" },
//           condition: {
//             requestMethods: ["post", "put"],
//             initiatorDomains: blocklist
//           }
//         }
//       );
//     }

//     const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
//     const oldRuleIds = oldRules.map(rule => rule.id);

//     await chrome.declarativeNetRequest.updateDynamicRules({
//       removeRuleIds: oldRuleIds,
//       addRules: rules
//     });

//     console.log('Rules updated - Whitelist:', whitelist, 'Blocklist:', blocklist);
//   } catch (error) {
//     console.error('Error updating rules:', error);
//   }
// }


// Listen for new downloads
const sendMessageToContentScript = async () => {
  try {
    const tabs = await new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (result) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(result);
        }
      });
    });

    if (tabs[0]) {
      const message = {
        type: "DOWNLOAD_DETECTED",
        url: currentDomain,
      };

      await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tabs[0].id, message, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });

      console.log("Message sent to content script.");
    } else {
      console.warn("No active tab found.");
    }
  } catch (error) {
    console.error("Error sending message:", error);
  }
};


chrome.downloads.onCreated.addListener(async (downloadItem) => {
  console.log("Download detected:", downloadItem);

  const blockedFileExtensions = ["zip", "exe", "rar", "jpg", "png", "gif", "jpeg"];
  const url = downloadItem.finalUrl || downloadItem.url || "";
  const mimeType = (downloadItem.mime || "").toLowerCase();
  const fileName = (downloadItem.filename || "").toLowerCase();

  const isBlocked = blockedFileExtensions.some((ext) =>
    url.toLowerCase().endsWith(`.${ext}`) || mimeType.toLowerCase().includes(ext) || fileName.toLowerCase().endsWith(`.${ext}`)
  );

  if (isBlocked) {
    // Stop the download
    chrome.downloads.cancel(downloadItem.id);

    // Get the active tab to send message to content script
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: "DOWNLOAD_DETECTED",
        url: currentDomain
      });
    }
  }
});