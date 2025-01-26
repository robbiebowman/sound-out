const fs = require('fs');

// Get target browser from command line argument
const targetBrowser = process.argv[2];

if (!targetBrowser || !['chrome', 'firefox'].includes(targetBrowser)) {
  console.error('Please specify target browser: node build.js [chrome|firefox]');
  process.exit(1);
}

// Copy the appropriate manifest
const sourceFile = `manifest.${targetBrowser}.json`;
const targetFile = 'manifest.json';

try {
  fs.copyFileSync(sourceFile, targetFile);
  console.log(`Successfully created manifest.json for ${targetBrowser}`);
} catch (err) {
  console.error(`Error creating manifest.json: ${err.message}`);
  process.exit(1);
} 