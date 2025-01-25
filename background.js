let excludedDomains = [];
let includedDomains = [];
let muteSpecificOnly = false;

// Load settings from storage when extension starts
browser.storage.local.get(["excludedDomains", "includedDomains", "muteSpecificOnly"]).then((result) => {
  excludedDomains = result.excludedDomains || [];
  includedDomains = result.includedDomains || [];
  muteSpecificOnly = result.muteSpecificOnly || false;
});

// Listen for changes in storage
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    if (changes.excludedDomains) {
      excludedDomains = changes.excludedDomains.newValue || [];
    }
    if (changes.includedDomains) {
      includedDomains = changes.includedDomains.newValue || [];
    }
    if (changes.muteSpecificOnly) {
      muteSpecificOnly = changes.muteSpecificOnly.newValue;
    }
    
    // Add this section to update icon for active tab when settings change
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        updateIcon(tabs[0].id);
      }
    });
  }
});

// Helper function to get the hostname from a URL
function getHostname(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    // If it's an invalid URL or something unexpected, return an empty string
    return "";
  }
}

// Modified muting logic
function muteAllExcept(activeTabId) {
  browser.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) return;

      const hostname = getHostname(tab.url);

      if (muteSpecificOnly) {
        // Only manage tabs that are in the inclusion list
        if (domainMatches(hostname, includedDomains)) {
          browser.tabs.update(tab.id, { 
            muted: tab.id !== activeTabId 
          });
        }
        // Don't touch other tabs
      } else {
        // In exclusion mode, only manage non-excluded domains
        if (!domainMatches(hostname, excludedDomains)) {
          browser.tabs.update(tab.id, { muted: tab.id !== activeTabId });
        }
        // Don't touch excluded domains
      }
    });
  });
}

// Add this function after the getHostname function
function isTabManaged(hostname) {
  if (muteSpecificOnly) {
    return domainMatches(hostname, includedDomains);
  } else {
    return !domainMatches(hostname, excludedDomains);
  }
}

// Add this function to update the extension icon
function updateIcon(tabId) {
  browser.tabs.get(tabId).then((tab) => {
    const hostname = getHostname(tab.url);
    const managed = isTabManaged(hostname);
    
    browser.browserAction.setIcon({
      path: {
        16: managed ? "icons/icon_on16.png" : "icons/icon_off16.png",
        32: managed ? "icons/icon_on32.png" : "icons/icon_off32.png"
      },
      tabId: tabId
    });
  });
}

// Modify the tabs.onActivated listener
browser.tabs.onActivated.addListener((activeInfo) => {
  muteAllExcept(activeInfo.tabId);
  updateIcon(activeInfo.tabId);
});

// Update the onCreated listener
browser.tabs.onCreated.addListener((tab) => {
  browser.tabs.query({ active: true, currentWindow: true }).then((activeTabs) => {
    const activeTabId = activeTabs[0].id;
    const hostname = getHostname(tab.url);

    if (muteSpecificOnly) {
      // Only manage new tabs that are in the inclusion list
      if (domainMatches(hostname, includedDomains)) {
        browser.tabs.update(tab.id, { 
          muted: tab.id !== activeTabId 
        });
      }
      // Don't touch other tabs
    } else {
      // Only manage new non-excluded tabs
      if (!domainMatches(hostname, excludedDomains)) {
        browser.tabs.update(tab.id, { muted: tab.id !== activeTabId });
      }
      // Don't touch excluded domains
    }
  });
});

// Add listeners for tab URL changes and updates
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateIcon(tabId);
  }
});

// Update icon for active tab when extension starts
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length > 0) {
    muteAllExcept(tabs[0].id);
    updateIcon(tabs[0].id);
  }
});

function domainMatches(hostname, exclusions) {
    // Convert both sides to lowercase to be case-insensitive
    hostname = hostname.toLowerCase();
    return exclusions.some((exclusion) => {
      exclusion = exclusion.toLowerCase();
      // If the hostname is exactly the same
      if (hostname === exclusion) {
        return true;
      }
      // Or if the hostname ends with ".exclusion"
      // e.g. "www.youtube.com".endsWith(".youtube.com")
      if (hostname.endsWith(`.${exclusion}`)) {
        return true;
      }
      return false;
    });
  }

// Add click handler for the toolbar icon
browser.browserAction.onClicked.addListener(() => {
  browser.runtime.openOptionsPage();
});
  