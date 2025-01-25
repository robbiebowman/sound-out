document.addEventListener("DOMContentLoaded", () => {
    const excludedDomainsTextarea = document.getElementById("excluded-domains");
    const includedDomainsTextarea = document.getElementById("included-domains");
    const muteModeToggle = document.getElementById("mute-mode-toggle");
    const saveButton = document.getElementById("save-button");
    const exclusionSection = document.getElementById("exclusion-section");
    const inclusionSection = document.getElementById("inclusion-section");
  
    // Load current settings
    browser.storage.local.get(["excludedDomains", "includedDomains", "muteSpecificOnly"]).then((result) => {
      if (result.excludedDomains) {
        excludedDomainsTextarea.value = result.excludedDomains.join("\n");
      }
      if (result.includedDomains) {
        includedDomainsTextarea.value = result.includedDomains.join("\n");
      }
      if (result.muteSpecificOnly) {
        muteModeToggle.checked = result.muteSpecificOnly;
        exclusionSection.style.display = "none";
        inclusionSection.style.display = "block";
      }
    });

    // Toggle visibility of sections based on checkbox
    muteModeToggle.addEventListener("change", () => {
      if (muteModeToggle.checked) {
        exclusionSection.style.display = "none";
        inclusionSection.style.display = "block";
      } else {
        exclusionSection.style.display = "block";
        inclusionSection.style.display = "none";
      }
    });
  
    // Save the settings
    saveButton.addEventListener("click", () => {
      // Split by newline, remove empty lines, trim spaces
      const excludedDomains = excludedDomainsTextarea.value
        .split("\n")
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const includedDomains = includedDomainsTextarea.value
        .split("\n")
        .map(d => d.trim())
        .filter(d => d.length > 0);
  
      // Save to storage
      browser.storage.local.set({ 
        excludedDomains,
        includedDomains,
        muteSpecificOnly: muteModeToggle.checked
      }).then(() => {
        alert("Settings saved!");
      });
    });
  });
  