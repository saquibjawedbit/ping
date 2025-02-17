document.addEventListener('change', async function(event) {
  // Check if the change event is from an input type="file"
  if (event.target.type === 'file' && event.target.files.length > 0) {
    const { whitelistedDomains, blockedDomains, blockedFileTypes } = await chrome.storage.local.get([
      'whitelistedDomains',
      'blockedDomains',
      'blockedFileTypes',
    ]);
    console.log("Upload Detected");
    const url = window.location.hostname;

    const isWhiteListed = whitelistedDomains.includes(url);

    if(isWhiteListed) return;

    const isBlocked = blockedDomains.includes(url);

    if(!isBlocked) return;

    const file = event.target.files[0]; // Get the selected file
    const invalidExtensions = blockedFileTypes; // List of file types to block
    const fileExtension = file.name.split('.').pop().toLowerCase();

    // Check if the file extension is in the blocked list
    if (invalidExtensions.includes(fileExtension)) {
      // Clear the file input
      window.location.reload();
      showBlockPopup(url);
    }
  }
});

document.addEventListener('click', async function(event) {
  const keywords = ['upload', 'import', 'choose', 'select', 'browse', 'file', 'pick', 'drag', 'drop'];
  if(keywords.some(word => event.target.innerHTML.toLowerCase().includes(word))) {
    const {blockedDomains, blockedFileTypes, whitelistedDomains} = await chrome.storage.local.get(['blockedDomains', 'blockedFileTypes', 'whitelistedDomains']);
    
    const isWhiteListed = whitelistedDomains.includes(window.location.hostname);

    if(isWhiteListed) return;

    if(blockedDomains.includes(window.location.hostname)) {
      const isBlocked = blockedFileTypes.some((ext) => event.target.innerHTML.toLowerCase().includes(ext));
      if(isBlocked) {
        event.preventDefault();
        window.location.reload();
        showBlockPopup(window.location.hostname);
      }
    }

    console.log(event);
  }
});

document.addEventListener('drop', async function(event) {
  const keywords = ['upload', 'import', 'choose', 'select', 'browse', 'file', 'pick', 'drag', 'drop'];


  if(keywords.some(word => event.target.innerHTML.toLowerCase().includes(word))) {
    const {blockedDomains, blockedFileTypes, whitelistedDomains} = await chrome.storage.local.get(['blockedDomains', 'blockedFileTypes', 'whitelistedDomains']);

    const isWhiteListed = whitelistedDomains.includes(window.location.hostname);

    if(isWhiteListed) return;

    if(blockedDomains.includes(window.location.hostname)) {
      console.log(event);
      event.preventDefault();
      window.location.reload();
      showBlockPopup(window.location.hostname);
    }
  }
});

// Create and add popup styles
const style = document.createElement('style');
style.textContent = `
  .download-block-popup {
    position: fixed;
    top: 20px;
    right: 20px;
    background: #1E1B2E;
    color: white;
    padding: 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 999999;
    max-width: 300px;
    animation: slideIn 0.3s ease-out;
  }
  .download-block-popup h3 {
    margin: 0 0 10px 0;
    color: #F44336;
  }
  .download-block-popup p {
    margin: 5px 0;
    font-size: 14px;
  }
  .popup-buttons {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .popup-button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
  }
  .trust-button {
    background: #646CFF;
    color: white;
  }
  .close-button {
    background: #DC2626;
    color: white;
  }
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
`;
document.head.appendChild(style);

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "DOWNLOAD_DETECTED") {
    showBlockPopup(message.url);
  }
});

function showBlockPopup(domain) {
  // Remove existing popup if any
  const existingPopup = document.querySelector('.download-block-popup');
  if (existingPopup) {
    existingPopup.remove();
  }

  // Create popup
  const popup = document.createElement('div');
  popup.className = 'download-block-popup';
  popup.innerHTML = `
    <h3>⚠️ Download Blocked</h3>
    <p>A download was blocked from:</p>
    <p><strong>${domain}</strong></p>
    <div class="popup-buttons">
      <button class="popup-button trust-button">Trust Site</button>
      <button class="popup-button close-button">Close</button>
    </div>
  `;

  // Add event listeners
  const trustButton = popup.querySelector('.trust-button');
  const closeButton = popup.querySelector('.close-button');

  trustButton.addEventListener('click', () => {
    chrome.runtime.sendMessage({
      type: "ADD_TO_WHITELIST",
      domain: domain
    });
    popup.remove();
  });

  closeButton.addEventListener('click', () => {
    popup.remove();
  });

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (popup.parentNode) {
      popup.remove();
    }
  }, 5000);

  document.body.appendChild(popup);
}
