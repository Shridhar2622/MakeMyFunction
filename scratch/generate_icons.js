import fs from 'fs';
import path from 'path';

// 1x1 transparent PNG base64 encoded, converted to valid buffer
const base64Png = 'iVBORw0KGgoAAAANSU5EUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const iconBuffer = Buffer.from(base64Png, 'base64');

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), iconBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), iconBuffer);
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), iconBuffer);

console.log('Icons generated successfully in public/icons/');
