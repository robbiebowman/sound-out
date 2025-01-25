let excludedDomains = [];
let includedDomains = [];
let muteSpecificOnly = false;
let excludedTabs = new Set();
let includedTabs = new Set();

// Create context menu when extension loads
browser.contextMenus.create({
  id: "open-options",
  title: "Options",
  contexts: ["browser_action"]
});

// Add context menu click handler
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-options") {
    browser.runtime.openOptionsPage();
  }
});

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
      const isManaged = isTabManaged(hostname, tab.id);

      // Skip tabs that aren't managed - let user control their mute state
      if (!isManaged) {
        return;
      }

      // For managed tabs, mute if not active
      browser.tabs.update(tab.id, { 
        muted: tab.id !== activeTabId 
      });
    });
  });
}

// Modify isTabManaged to check both exclusions and inclusions
function isTabManaged(hostname, tabId) {
  if (excludedTabs.has(tabId)) {
    return false;
  }
  
  if (includedTabs.has(tabId)) {
    return true;
  }
  
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
    const managed = isTabManaged(hostname, tabId);
    
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

// Modify the browserAction click handler
browser.browserAction.onClicked.addListener((tab) => {
  const hostname = getHostname(tab.url);
  const wasManaged = isTabManaged(hostname, tab.id);
  
  if (wasManaged) {
    if (muteSpecificOnly && !domainMatches(hostname, includedDomains)) {
      // In inclusion mode, if this tab was only managed because it was in includedTabs
      includedTabs.delete(tab.id);
    } else {
      // Normal exclusion case
      excludedTabs.add(tab.id);
    }
    // Unmute initially when excluding a tab
    browser.tabs.update(tab.id, { muted: false });
  } else {
    if (muteSpecificOnly && !domainMatches(hostname, includedDomains)) {
      // In inclusion mode, if this tab isn't in the domain rules, add it to includedTabs
      includedTabs.add(tab.id);
    } else {
      // Normal inclusion case - remove from excludedTabs
      excludedTabs.delete(tab.id);
    }
    // Reapply muting rules when re-enabling management
    browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      if (tabs[0]) {
        muteAllExcept(tabs[0].id);
      }
    });
  }
  
  updateIcon(tab.id);
});

// Add cleanup for both sets when tabs are closed
browser.tabs.onRemoved.addListener((tabId) => {
  excludedTabs.delete(tabId);
  includedTabs.delete(tabId);
});
  