// State management
let state = {
  excludedDomains: [],
  includedDomains: [],
  muteSpecificOnly: false,
  stickyMode: false,
  excludedTabs: new Set(),
  includedTabs: new Set()
};

let stateLoaded = false;
const lastManagedByWindow = new Map();

async function loadState() {
  return new Promise((resolve) => {
    chrome.storage.local.get([
      "excludedDomains", 
      "includedDomains", 
      "muteSpecificOnly",
      "stickyMode",
      "excludedTabsArray",
      "includedTabsArray"
    ], (result) => {
      state.excludedDomains = result.excludedDomains || [];
      state.includedDomains = result.includedDomains || [];
      state.muteSpecificOnly = result.muteSpecificOnly || false;
      state.stickyMode = result.stickyMode || false;
      
      // Restore tab-specific states
      state.excludedTabs = new Set(result.excludedTabsArray || []);
      state.includedTabs = new Set(result.includedTabsArray || []);
      
      // Get all tabs
      chrome.tabs.query({}, (allTabs) => {
        // Clean up any stored tab IDs that no longer exist
        const existingTabIds = new Set(allTabs.map(tab => tab.id));
        state.excludedTabs = new Set([...state.excludedTabs].filter(id => existingTabIds.has(id)));
        state.includedTabs = new Set([...state.includedTabs].filter(id => existingTabIds.has(id)));
        
        // Save the cleaned up sets
        saveTabStates();
        
        // Update states for all windows
        const tabsByWindow = allTabs.reduce((acc, tab) => {
          if (!acc[tab.windowId]) {
            acc[tab.windowId] = [];
          }
          acc[tab.windowId].push(tab);
          return acc;
        }, {});
        
        Object.values(tabsByWindow).forEach(windowTabs => {
          const activeTab = windowTabs.find(tab => tab.active);
          if (activeTab) {
            updateTabMutes(activeTab.id, activeTab.windowId);
            updateIcon(activeTab.id);
            updateContextMenuState(activeTab.id);
          }
        });

        // Indicate that we've finished loading
        stateLoaded = true;
        resolve();
      });
    });
  });
}

// Add this new function to save tab states
function saveTabStates() {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      excludedTabsArray: Array.from(state.excludedTabs),
      includedTabsArray: Array.from(state.includedTabs)
    }, resolve);
  });
}

// 1) Create an "init()" function that loads state, then attaches listeners:
async function init() {
  stateLoaded = false;
  await loadState();

  // Once state is loaded, register all listeners:

  // Context menu click handler
  chrome.contextMenus.onClicked.removeListener(onContextMenuClicked);
  chrome.contextMenus.onClicked.addListener(onContextMenuClicked);

  // Listen for changes in storage
  chrome.storage.onChanged.removeListener(onStorageChanged);
  chrome.storage.onChanged.addListener(onStorageChanged);

  // Tabs: onActivated
  chrome.tabs.onActivated.removeListener(onTabActivated);
  chrome.tabs.onActivated.addListener(onTabActivated);

  // Tabs: onCreated
  chrome.tabs.onCreated.removeListener(onTabCreated);
  chrome.tabs.onCreated.addListener(onTabCreated);

  // Tabs: onUpdated
  chrome.tabs.onUpdated.removeListener(onTabUpdated);
  chrome.tabs.onUpdated.addListener(onTabUpdated);

  // Cleanup on tab removal
  chrome.tabs.onRemoved.removeListener(onTabRemoved);
  chrome.tabs.onRemoved.addListener(onTabRemoved);

  // 2) Now that we have *real* state, update the current active tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      updateTabMutes(activeTab.id, activeTab.windowId);
      updateIcon(activeTab.id);
      updateContextMenuState(activeTab.id);
    }
  });
}

// 3) Use normal event callbacks that check "stateLoaded" if needed:
function onContextMenuClicked(info, tab) {
  if (!stateLoaded) return;
  if (info.menuItemId === "open-options") {
    chrome.runtime.openOptionsPage();
  } else if (info.menuItemId === "toggle-managed") {
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
      updateTabMutes(tab.id, tab.windowId);
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
}

function onStorageChanged(changes, area) {
  if (!stateLoaded || area !== "local") return;
  Object.entries(changes).forEach(([key, { newValue }]) => {
    state[key] = newValue;
  });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTab = tabs[0];
    if (activeTab) {
      updateTabMutes(activeTab.id, activeTab.windowId);
    }
  });
}

function onTabActivated({ tabId, windowId }) {
  if (!stateLoaded) return;
  updateTabMutes(tabId, windowId);
  updateIcon(tabId);
  updateContextMenuState(tabId);
}

function onTabCreated(tab) {
  if (!stateLoaded) return;
  chrome.tabs.query({ active: true, windowId: tab.windowId }, (activeTabs) => {
    const activeTabId = activeTabs[0]?.id;
    const hostname = getHostname(tab.url);

    if (state.stickyMode) {
      if (activeTabId && isTabManaged(hostname, tab.id) && tab.id !== activeTabId) {
        const lastManaged = lastManagedByWindow.get(tab.windowId);
        if (lastManaged && lastManaged !== tab.id) {
          chrome.tabs.update(tab.id, { muted: true });
        }
      }
      return;
    }

    if (state.muteSpecificOnly) {
      if (activeTabId && isTabManaged(hostname, tab.id)) {
        chrome.tabs.update(tab.id, { muted: tab.id !== activeTabId });
      }
      return;
    }

    if (activeTabId && !isTabManaged(hostname, tab.id)) {
      chrome.tabs.update(tab.id, { muted: tab.id !== activeTabId });
    }
  });
}

function onTabUpdated(tabId, changeInfo, tab) {
  if (!stateLoaded) return;
  if (changeInfo.url) {
    updateIcon(tabId);
    updateContextMenuState(tabId);
  }
}

async function onTabRemoved(tabId) {
  if (!stateLoaded) return;
  state.excludedTabs.delete(tabId);
  state.includedTabs.delete(tabId);
  for (const [windowId, managedTabId] of lastManagedByWindow.entries()) {
    if (managedTabId === tabId) {
      lastManagedByWindow.delete(windowId);
    }
  }
  await saveTabStates();
}

// 4) Finally, handle extension lifecycle events to call init():

chrome.runtime.onInstalled.addListener(() => {
  // Create context menus if needed
  chrome.contextMenus.create({
    id: "open-options",
    title: "Options",
    contexts: ["browser_action"]
  });
  chrome.contextMenus.create({
    id: "toggle-managed",
    title: "Tab is managed",
    type: "checkbox",
    contexts: ["browser_action"]
  });
  chrome.contextMenus.create({
    id: "keep-muted",
    title: "Keep muted",
    contexts: ["browser_action"]
  });
  chrome.contextMenus.create({
    id: "keep-unmuted",
    title: "Keep unmuted",
    contexts: ["browser_action"]
  });
  
  init();
});

chrome.runtime.onStartup.addListener(init);

// If your background script might run right away:
if (chrome.runtime?.id) {
  init();
}

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
  console.log("[Debug] isTabManaged called:", { hostname, tabId });

  // Check manual overrides first
  if (state.excludedTabs.has(tabId)) {
    console.log(`[Debug] Tab #${tabId} is in excludedTabs => Not Managed.`);
    return false;
  }
  if (state.includedTabs.has(tabId)) {
    console.log(`[Debug] Tab #${tabId} is in includedTabs => Managed.`);
    return true;
  }

  // Then check domain rules
  console.log("[Debug] Checking domain rules for:", hostname);
  console.log("> muteSpecificOnly =", state.muteSpecificOnly);
  console.log("> includedDomains =", state.includedDomains);
  console.log("> excludedDomains =", state.excludedDomains);

  const matchesDomain = (domain) => {
    // Log each domain check
    console.log(`[Debug]   Checking if hostname="${hostname}" matches domain="${domain}"...`);
    domain = domain.toLowerCase();
    const lowerHostname = hostname.toLowerCase();
    const isMatch = (lowerHostname === domain || lowerHostname.endsWith(`.${domain}`));
    console.log(`[Debug]   => ${isMatch ? "Match" : "No match"}`);
    return isMatch;
  };

  const isIncluded = state.includedDomains.some(matchesDomain);
  const isExcluded = state.excludedDomains.some(matchesDomain);

  const result = state.muteSpecificOnly ? isIncluded : !isExcluded;
  console.log(`[Debug] => isTabManaged result: ${result}`);
  return result;
}

// Core functionality: update tab mute states
function updateTabMutes(activeTabId, activeWindowId) {
  console.log("[Debug] updateTabMutes called:", { activeTabId, activeWindowId });
  const query = typeof activeWindowId === "number" ? { windowId: activeWindowId } : {};

  chrome.tabs.query(query, (tabs) => {
    console.log("[Debug] Found tabs:", tabs.map(t => ({ id: t.id, url: t.url })));
    const activeTab = tabs.find(tab => tab.id === activeTabId);

    if (state.stickyMode) {
      if (!activeTab || !activeTab.url) {
        return;
      }

      const activeHostname = getHostname(activeTab.url);
      const activeManaged = isTabManaged(activeHostname, activeTab.id);

      if (!activeManaged) {
        return;
      }

      if (typeof activeWindowId === "number") {
        lastManagedByWindow.set(activeWindowId, activeTabId);
      }

      tabs.forEach((tab) => {
        if (!tab.id || !tab.url) {
          return;
        }
        const hostname = getHostname(tab.url);
        const managed = isTabManaged(hostname, tab.id);
        if (managed) {
          chrome.tabs.update(tab.id, { muted: tab.id !== activeTabId });
        }
      });
      return;
    }

    tabs.forEach((tab) => {
      if (!tab.id || !tab.url) {
        console.log("[Debug] Skipping tab with missing ID or URL:", tab);
        return;
      }
      const hostname = getHostname(tab.url);
      const managed = isTabManaged(hostname, tab.id);
      console.log(`[Debug] Tab #${tab.id} (${hostname}) => managed? ${managed}`);

      if (managed) {
        const shouldMute = (tab.id !== activeTabId);
        console.log(`[Debug]   => Muting? ${shouldMute}`);
        chrome.tabs.update(tab.id, { muted: shouldMute });
      } else {
        console.log(`[Debug]   => Not managed; skipping.`);
      }
    });
  });
}

// Replace browserAction with action for Chrome compatibility
const browserAPI = chrome.browserAction || chrome.action;

// Update the updateIcon function
function updateIcon(tabId) {
  chrome.tabs.get(tabId, (tab) => {
    const hostname = getHostname(tab.url);
    const iconState = isTabManaged(hostname, tabId) ? 'on' : 'off';
    browserAPI.setIcon({
      path: {
        16: `icons/icon_${iconState}16.png`,
        32: `icons/icon_${iconState}32.png`
      },
      tabId
    });
  });
}

// Add function to update context menu items' enabled state
function updateContextMenuState(tabId) {
  chrome.tabs.get(tabId, (tab) => {
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

// Replace chrome.browserAction.onClicked with browserAPI.onClicked
browserAPI.onClicked.addListener((tab) => {
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
    updateTabMutes(tab.id, tab.windowId);
  }
  
  saveTabStates().then(() => {
    updateIcon(tab.id);
    updateContextMenuState(tab.id);
  });
});
  
