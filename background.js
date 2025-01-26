// State management
let state = {
  excludedDomains: [],
  includedDomains: [],
  muteSpecificOnly: false,
  excludedTabs: new Set(),
  includedTabs: new Set()
};

// Add this new function to load state
async function loadState() {
  const result = await chrome.storage.local.get([
    "excludedDomains", 
    "includedDomains", 
    "muteSpecificOnly"
  ]);
  
  state.excludedDomains = result.excludedDomains || [];
  state.includedDomains = result.includedDomains || [];
  state.muteSpecificOnly = result.muteSpecificOnly || false;
  
  // Re-apply mute states after loading
  chrome.tabs.query({ active: true, currentWindow: true })
    .then(tabs => {
      if (tabs[0]) {
        updateTabMutes(tabs[0].id);
        updateIcon(tabs[0].id);
        updateContextMenuState(tabs[0].id);
      }
    });
}

// Modify the initialization listener
chrome.runtime.onInstalled.addListener(async () => {
  // Create context menu items
  chrome.contextMenus.create({
    id: "open-options",
    title: "Options",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "toggle-managed",
    title: "Tab is managed",
    type: "checkbox",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "keep-muted",
    title: "Keep muted",
    contexts: ["action"]
  });

  chrome.contextMenus.create({
    id: "keep-unmuted",
    title: "Keep unmuted",
    contexts: ["action"]
  });

  // Load initial state
  await loadState();
});

// Add service worker wake-up listener
chrome.runtime.onStartup.addListener(loadState);

// Add this to handle service worker waking up
if (chrome.runtime?.id) { // Check if extension context exists
  loadState();
}

// Update the context menu click handler
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-options") {
    chrome.runtime.openOptionsPage();
  } else if (info.menuItemId === "toggle-managed") {
    // Simulate extension icon click
    const hostname = getHostname(tab.url);
    const wasManaged = isTabManaged(hostname, tab.id);
    
    if (wasManaged) {
      if (state.muteSpecificOnly) {
        state.includedTabs.delete(tab.id);
      }
      state.excludedTabs.add(tab.id);
      chrome.tabs.update(tab.id, { muted: false });
    } else {
      state.excludedTabs.delete(tab.id);
      if (state.muteSpecificOnly) {
        state.includedTabs.add(tab.id);
      }
      updateTabMutes(tab.id);
    }
    
    updateIcon(tab.id);
    updateContextMenuState(tab.id);
  } else if (info.menuItemId === "keep-muted") {
    const hostname = getHostname(tab.url);
    if (!isTabManaged(hostname, tab.id)) {
      chrome.tabs.update(tab.id, { muted: true });
    }
  } else if (info.menuItemId === "keep-unmuted") {
    const hostname = getHostname(tab.url);
    if (!isTabManaged(hostname, tab.id)) {
      chrome.tabs.update(tab.id, { muted: false });
    }
  }
});

// Listen for changes in storage
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    Object.entries(changes).forEach(([key, { newValue }]) => {
      state[key] = newValue;
    });
    chrome.tabs.query({ active: true, currentWindow: true })
      .then(tabs => tabs[0] && updateTabMutes(tabs[0].id));
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

// Core functionality: determine if a tab should be managed
function isTabManaged(hostname, tabId) {
  // Check manual overrides first
  if (state.excludedTabs.has(tabId)) return false;
  if (state.includedTabs.has(tabId)) return true;
  
  // Then check domain rules
  const matchesDomain = (domain) => {
    domain = domain.toLowerCase();
    hostname = hostname.toLowerCase();
    return hostname === domain || hostname.endsWith(`.${domain}`);
  };

  return state.muteSpecificOnly
    ? state.includedDomains.some(matchesDomain)
    : !state.excludedDomains.some(matchesDomain);
}

// Core functionality: update tab mute states
function updateTabMutes(activeTabId) {
  chrome.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) return;
      
      const hostname = getHostname(tab.url);
      if (isTabManaged(hostname, tab.id)) {
        chrome.tabs.update(tab.id, { muted: tab.id !== activeTabId });
      }
    });
  });
}

// UI feedback: update extension icon
function updateIcon(tabId) {
  chrome.tabs.get(tabId).then((tab) => {
    const hostname = getHostname(tab.url);
    const iconState = isTabManaged(hostname, tabId) ? 'on' : 'off';
    chrome.action.setIcon({
      path: {
        16: `icons/icon_${iconState}16.png`,
        32: `icons/icon_${iconState}32.png`
      },
      tabId
    });
  });
}

// Event handlers
chrome.tabs.onActivated.addListener(({ tabId }) => {
  updateTabMutes(tabId);
  updateIcon(tabId);
  updateContextMenuState(tabId);
});

// Update the onCreated listener
chrome.tabs.onCreated.addListener((tab) => {
  chrome.tabs.query({ active: true, currentWindow: true }).then((activeTabs) => {
    const activeTabId = activeTabs[0].id;
    const hostname = getHostname(tab.url);

    if (state.muteSpecificOnly) {
      // Only manage new tabs that are in the inclusion list
      if (isTabManaged(hostname, tab.id)) {
        chrome.tabs.update(tab.id, { 
          muted: tab.id !== activeTabId 
        });
      }
      // Don't touch other tabs
    } else {
      // Only manage new non-excluded tabs
      if (!isTabManaged(hostname, tab.id)) {
        chrome.tabs.update(tab.id, { muted: tab.id !== activeTabId });
      }
      // Don't touch excluded domains
    }
  });
});

// Add listeners for tab URL changes and updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    updateIcon(tabId);
    updateContextMenuState(tabId);
  }
});

// Update icon for active tab when extension starts
chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
  if (tabs.length > 0) {
    updateTabMutes(tabs[0].id);
    updateIcon(tabs[0].id);
    updateContextMenuState(tabs[0].id);
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

// Add function to update context menu items' enabled state
function updateContextMenuState(tabId) {
  chrome.tabs.get(tabId).then((tab) => {
    const hostname = getHostname(tab.url);
    const isManaged = isTabManaged(hostname, tabId);
    
    chrome.contextMenus.update("toggle-managed", {
      checked: isManaged
    });
    
    chrome.contextMenus.update("keep-muted", {
      enabled: !isManaged
    });
    chrome.contextMenus.update("keep-unmuted", {
      enabled: !isManaged
    });
  });
}

// Add back the browserAction click handler
chrome.action.onClicked.addListener((tab) => {
  const hostname = getHostname(tab.url);
  const wasManaged = isTabManaged(hostname, tab.id);
  
  if (wasManaged) {
    if (state.muteSpecificOnly) {
      state.includedTabs.delete(tab.id);
    }
    state.excludedTabs.add(tab.id);
    chrome.tabs.update(tab.id, { muted: false });
  } else {
    state.excludedTabs.delete(tab.id);
    if (state.muteSpecificOnly) {
      state.includedTabs.add(tab.id);
    }
    updateTabMutes(tab.id);
  }
  
  updateIcon(tab.id);
  updateContextMenuState(tab.id);
});

// Add back cleanup for both sets when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  state.excludedTabs.delete(tabId);
  state.includedTabs.delete(tabId);
});
  