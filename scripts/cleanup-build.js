import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '../dist');

function cleanup() {
  console.log('[GitSolve Post-Build] Cleaning up build filenames...');

  const manifestPath = path.join(distDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('manifest.json not found in dist!');
    return;
  }

  let manifestContent = fs.readFileSync(manifestPath, 'utf8');

  // Find any files in assets/ that contain ".ts-" or ".ts"
  const assetsDir = path.join(distDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    const files = fs.readdirSync(assetsDir);
    for (const file of files) {
      if (file.includes('.ts-') || file.includes('.ts.')) {
        const oldPath = path.join(assetsDir, file);
        const newFile = file.replace(/\.ts-loader/, '-loader').replace(/\.ts-/, '-').replace(/\.ts\./, '.');
        const newPath = path.join(assetsDir, newFile);

        fs.renameSync(oldPath, newPath);
        console.log(`  Renamed: assets/${file} -> assets/${newFile}`);

        // Update all occurrences in manifest.json
        manifestContent = manifestContent.replaceAll(`assets/${file}`, `assets/${newFile}`);

        // Also check if other files in assets reference this file
        const otherFiles = fs.readdirSync(assetsDir);
        for (const f of otherFiles) {
          const filePath = path.join(assetsDir, f);
          if (fs.statSync(filePath).isFile()) {
            let content = fs.readFileSync(filePath, 'utf8');
            if (content.includes(`assets/${file}`) || content.includes(file)) {
              content = content.replaceAll(`assets/${file}`, `assets/${newFile}`);
              content = content.replaceAll(file, newFile);
              fs.writeFileSync(filePath, content, 'utf8');
              console.log(`    Updated references in: assets/${f}`);
            }
          }
        }
      }
    }
  }

  // Check the root directory loader files (like service-worker-loader.js)
  const rootFiles = fs.readdirSync(distDir);
  for (const file of rootFiles) {
    const filePath = path.join(distDir, file);
    if (fs.statSync(filePath).isFile() && file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf8');
      // Update any remaining references
      if (content.includes('.ts-') || content.includes('.ts.')) {
        const updated = content
          .replace(/assets\/([^'"]+)\.ts-loader\.js/g, 'assets/$1-loader.js')
          .replace(/assets\/([^'"]+)\.ts-([a-zA-Z0-9]+)\.js/g, 'assets/$1-$2.js')
          .replace(/assets\/([^'"]+)\.ts\.js/g, 'assets/$1.js');
        if (content !== updated) {
          fs.writeFileSync(filePath, updated, 'utf8');
          console.log(`  Updated references in root file: ${file}`);
        }
      }
    }
  }

  fs.writeFileSync(manifestPath, manifestContent, 'utf8');
  console.log('[GitSolve Post-Build] Cleanup completed successfully!');
}

cleanup();
