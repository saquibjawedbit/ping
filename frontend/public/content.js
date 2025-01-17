chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RULE_TRIGGERED") {
      showPopup(message.details.url);
    }
  });
  
  function showPopup(blockedUrl) {
    // Create a popup container
    const popup = document.createElement("div");
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.right = "20px";
    popup.style.padding = "15px";
    popup.style.backgroundColor = "rgba(0, 0, 0, 0.8)";
    popup.style.color = "white";
    popup.style.borderRadius = "8px";
    popup.style.zIndex = "9999";
    popup.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.2)";
    popup.textContent = `Download and Upload Request are Blocked: ${blockedUrl}, Whitelist the domain to allow`;
  
    // Add a close button
    const closeButton = document.createElement("button");
    closeButton.textContent = "×";
    closeButton.style.marginLeft = "10px";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.color = "white";
    closeButton.style.cursor = "pointer";
    closeButton.addEventListener("click", () => {
      document.body.removeChild(popup);
    });
  
    popup.appendChild(closeButton);
    document.body.appendChild(popup);
  
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (popup.parentNode) {
        document.body.removeChild(popup);
      }
    }, 5000);
  }
  