// State management
let state = {
  excludedDomains: [],
  includedDomains: [],
  muteSpecificOnly: false,
  excludedTabs: new Set(),
  includedTabs: new Set()
};

// NEW: Track when state has finished loading
let stateLoaded = false;

// Add this new function to load state
async function loadState() {
  const result = await chrome.storage.local.get([
    "excludedDomains", 
    "includedDomains", 
    "muteSpecificOnly",
    "excludedTabsArray",  // Add these new items
    "includedTabsArray"
  ]);
  
  state.excludedDomains = result.excludedDomains || [];
  state.includedDomains = result.includedDomains || [];
  state.muteSpecificOnly = result.muteSpecificOnly || false;
  
  // Restore tab-specific states
  state.excludedTabs = new Set(result.excludedTabsArray || []);
  state.includedTabs = new Set(result.includedTabsArray || []);
  
  // Get all tabs
  const allTabs = await chrome.tabs.query({});
  
  // Clean up any stored tab IDs that no longer exist
  const existingTabIds = new Set(allTabs.map(tab => tab.id));
  state.excludedTabs = new Set([...state.excludedTabs].filter(id => existingTabIds.has(id)));
  state.includedTabs = new Set([...state.includedTabs].filter(id => existingTabIds.has(id)));
  
  // Save the cleaned up sets
  await saveTabStates();
  
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
      updateTabMutes(activeTab.id);
      updateIcon(activeTab.id);
      updateContextMenuState(activeTab.id);
    }
  });

  // Indicate that we've finished loading
  stateLoaded = true;
}

// Add this new function to save tab states
async function saveTabStates() {
  await chrome.storage.local.set({
    excludedTabsArray: Array.from(state.excludedTabs),
    includedTabsArray: Array.from(state.includedTabs)
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
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab) {
    updateTabMutes(activeTab.id);
    updateIcon(activeTab.id);
    updateContextMenuState(activeTab.id);
  }
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
}

function onStorageChanged(changes, area) {
  if (!stateLoaded || area !== "local") return;
  Object.entries(changes).forEach(([key, { newValue }]) => {
    state[key] = newValue;
  });
  chrome.tabs.query({ active: true, currentWindow: true })
    .then(tabs => tabs[0] && updateTabMutes(tabs[0].id));
}

function onTabActivated({ tabId }) {
  if (!stateLoaded) return;
  updateTabMutes(tabId);
  updateIcon(tabId);
  updateContextMenuState(tabId);
}

function onTabCreated(tab) {
  if (!stateLoaded) return;
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
  await saveTabStates();
}

// 4) Finally, handle extension lifecycle events to call init():

chrome.runtime.onInstalled.addListener(() => {
  // Create context menus if needed
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
chrome.action.onClicked.addListener(async (tab) => {
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
  
  await saveTabStates();  // Save after modifying the sets
  updateIcon(tab.id);
  updateContextMenuState(tab.id);
});
  