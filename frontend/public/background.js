console.log("Background Script Running");

const serverURL = 'https://ping-3k57.onrender.com/calculate-score';

// Extract Domain
function extractDomain(url)  {
  try {
    const urlObject = new URL(url);
    return urlObject.hostname;
  } catch {
    return "Invalid URL";
  }
};

async function calculateTrustScore(domain)  {
  try {
    // Sending a POST request
    const response = await fetch(serverURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ domain: currentDomain }),
    });

    // Parsing JSON response
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Logging and returning the desired value
    console.log("Data:", data);
    return data.totalScore;
  } catch (error) {
    console.log("Error: " + error);
    return 100;
  }
  
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
    const score = await calculateTrustScore(domain);
    currentDomain = domain; // Update current domain
    currentDomainScore = score; // Update current score
    console.log(`Processing: Domain: ${domain}, Score: ${score}`);

    await chrome.storage.local.set({ 
      currentData: { domain, score }
    });

  } catch (error) {
    console.error("Error in getCurrentTab:", error);
  }
}

// Initialize data when background script starts
getCurrentTab();

// listen to Tab Change and Active Tab
chrome.tabs.onActivated.addListener(getCurrentTab);
chrome.tabs.onUpdated.addListener(getCurrentTab);

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
}


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
  const { whitelistedDomains, blockedDomains, blockedFileTypes } = await chrome.storage.local.get([
    'whitelistedDomains',
    'blockedDomains',
    'blockedFileTypes'
  ]);

  const isWhiteListed = whitelistedDomains.includes(currentDomain);

  if(isWhiteListed) return;

  const isBlackListed = blockedDomains.includes(currentDomain);

  if(!isBlackListed) return;

  const blockedFileExtensions = blockedFileTypes;
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