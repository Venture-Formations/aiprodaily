const fs = require('fs');
const path = require('path');

function findFilesRecursive(dir, pattern = /\.ts$/) {
  const files = [];
  const items = fs.readdirSync(dir, { withFileTypes: true });

  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      files.push(...findFilesRecursive(fullPath, pattern));
    } else if (pattern.test(item.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

function fixNextRequestImport(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // Check if file uses NextRequest but doesn't import it
  const usesNextRequest = /:\s*NextRequest/.test(content);
  const importsNextRequest = /import\s+\{[^}]*NextRequest[^}]*\}\s+from\s+['"]next\/server['"]/.test(content);

  if (usesNextRequest && !importsNextRequest) {
    // Check if it imports from 'next/server'
    const nextServerImport = content.match(/^import\s+\{([^}]+)\}\s+from\s+['"]next\/server['"]/m);

    if (nextServerImport) {
      const imports = nextServerImport[1];
      if (!imports.includes('NextRequest')) {
        // Add NextRequest to existing import
        const newImports = 'NextRequest, ' + imports.trim();
        const newContent = content.replace(
          /^import\s+\{[^}]+\}\s+from\s+['"]next\/server['"]/m,
          `import { ${newImports} } from 'next/server'`
        );
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`✓ Fixed: ${filePath}`);
        return true;
      }
    }
  }

  return false;
}

// Find all TypeScript files in src/app/api/debug
const debugDir = path.join(__dirname, '..', 'src', 'app', 'api', 'debug');
const files = findFilesRecursive(debugDir);

console.log(`Found ${files.length} TypeScript files in debug directory`);
console.log('Checking for missing NextRequest imports...\n');

let fixedCount = 0;
for (const file of files) {
  if (fixNextRequestImport(file)) {
    fixedCount++;
  }
}

console.log(`\n✅ Fixed ${fixedCount} files`);
