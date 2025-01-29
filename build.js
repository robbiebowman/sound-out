const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

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

// Create a zip file
const zipFileName = `sound-out-${browser}-v${manifest.version}.zip`;
const zipFilePath = path.join(__dirname, 'dist', zipFileName);
const output = fs.createWriteStream(zipFilePath);
const archive = archiver('zip', {
  zlib: { level: 9 } // Maximum compression
});

// Listen for archive warnings
archive.on('warning', (err) => {
  if (err.code === 'ENOENT') {
    console.warn('Warning while creating zip:', err);
  } else {
    throw err;
  }
});

// Listen for archive errors
archive.on('error', (err) => {
  throw err;
});

// Pipe archive data to the output file
archive.pipe(output);

// Add the dist directory contents to the zip
archive.directory(distDir, false);

// Finalize the archive
archive.finalize();

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`Built extension for ${browser} in ${distDir}`);
  console.log(`Created ${zipFileName} (${sizeMB} MB)`);
}); 