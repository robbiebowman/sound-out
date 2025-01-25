if (typeof browser === 'undefined') {
  var browser = chrome;
}

// State management
let state = {
  excludedDomains: [],
  includedDomains: [],
  muteSpecificOnly: false,
  excludedTabs: new Set(),
  includedTabs: new Set()
};

// Create context menu when extension loads
browser.contextMenus.create({
  id: "open-options",
  title: "Options",
  contexts: ["browser_action"]
});

browser.contextMenus.create({
  id: "toggle-managed",
  title: "Tab is managed",
  type: "checkbox",
  contexts: ["browser_action"]
});

browser.contextMenus.create({
  id: "keep-muted",
  title: "Keep muted",
  contexts: ["browser_action"]
});

browser.contextMenus.create({
  id: "keep-unmuted",
  title: "Keep unmuted",
  contexts: ["browser_action"]
});

// Update the context menu click handler
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "open-options") {
    browser.runtime.openOptionsPage();
  } else if (info.menuItemId === "toggle-managed") {
    // Simulate extension icon click
    const hostname = getHostname(tab.url);
    const wasManaged = isTabManaged(hostname, tab.id);
    
    if (wasManaged) {
      if (state.muteSpecificOnly) {
        state.includedTabs.delete(tab.id);
      }
      state.excludedTabs.add(tab.id);
      browser.tabs.update(tab.id, { muted: false });
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
      browser.tabs.update(tab.id, { muted: true });
    }
  } else if (info.menuItemId === "keep-unmuted") {
    const hostname = getHostname(tab.url);
    if (!isTabManaged(hostname, tab.id)) {
      browser.tabs.update(tab.id, { muted: false });
    }
  }
});

// Load settings from storage
browser.storage.local.get(["excludedDomains", "includedDomains", "muteSpecificOnly"]).then((result) => {
  state.excludedDomains = result.excludedDomains || [];
  state.includedDomains = result.includedDomains || [];
  state.muteSpecificOnly = result.muteSpecificOnly || false;
});

// Listen for changes in storage
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "local") {
    Object.entries(changes).forEach(([key, { newValue }]) => {
      state[key] = newValue;
    });
    browser.tabs.query({ active: true, currentWindow: true })
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
  browser.tabs.query({}).then((tabs) => {
    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) return;
      
      const hostname = getHostname(tab.url);
      if (isTabManaged(hostname, tab.id)) {
        browser.tabs.update(tab.id, { muted: tab.id !== activeTabId });
      }
    });
  });
}

// UI feedback: update extension icon
function updateIcon(tabId) {
  browser.tabs.get(tabId).then((tab) => {
    const hostname = getHostname(tab.url);
    const iconState = isTabManaged(hostname, tabId) ? 'on' : 'off';
    browser.browserAction.setIcon({
      path: {
        16: `icons/icon_${iconState}16.png`,
        32: `icons/icon_${iconState}32.png`
      },
      tabId
    });
  });
}

// Event handlers
browser.tabs.onActivated.addListener(({ tabId }) => {
  updateTabMutes(tabId);
  updateIcon(tabId);
  updateContextMenuState(tabId);
});

// Update the onCreated listener
browser.tabs.onCreated.addListener((tab) => {
  browser.tabs.query({ active: true, currentWindow: true }).then((activeTabs) => {
    const activeTabId = activeTabs[0].id;
    const hostname = getHostname(tab.url);

    if (state.muteSpecificOnly) {
      // Only manage new tabs that are in the inclusion list
      if (isTabManaged(hostname, tab.id)) {
        browser.tabs.update(tab.id, { 
          muted: tab.id !== activeTabId 
        });
      }
      // Don't touch other tabs
    } else {
      // Only manage new non-excluded tabs
      if (!isTabManaged(hostname, tab.id)) {
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
    updateContextMenuState(tabId);
  }
});

// Update icon for active tab when extension starts
browser.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
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
  browser.tabs.get(tabId).then((tab) => {
    const hostname = getHostname(tab.url);
    const isManaged = isTabManaged(hostname, tabId);
    
    browser.contextMenus.update("toggle-managed", {
      checked: isManaged
    });
    
    browser.contextMenus.update("keep-muted", {
      enabled: !isManaged
    });
    browser.contextMenus.update("keep-unmuted", {
      enabled: !isManaged
    });
  });
}

// Add back the browserAction click handler
browser.browserAction.onClicked.addListener((tab) => {
  const hostname = getHostname(tab.url);
  const wasManaged = isTabManaged(hostname, tab.id);
  
  if (wasManaged) {
    if (state.muteSpecificOnly) {
      state.includedTabs.delete(tab.id);
    }
    state.excludedTabs.add(tab.id);
    browser.tabs.update(tab.id, { muted: false });
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
browser.tabs.onRemoved.addListener((tabId) => {
  state.excludedTabs.delete(tabId);
  state.includedTabs.delete(tabId);
});
  