const fs = require('fs');
const path = require('path');

const browser = process.argv[2];

if (!browser || !['chrome', 'firefox'].includes(browser)) {
  console.error('Please specify browser: node build.js [chrome|firefox]');
  process.exit(1);
}

// Read the appropriate manifest
const manifestPath = `manifest.${browser}.json`;
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Create dist directory if it doesn't exist
const distDir = path.join(__dirname, 'dist', browser);
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy manifest
fs.writeFileSync(
  path.join(distDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

// Copy other files
const filesToCopy = [
  'background.js',
  'options.js',
  'options.html',
  'icons'
];

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(distDir, file);
  
  if (fs.lstatSync(src).isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
});

console.log(`Built extension for ${browser} in ${distDir}`); 