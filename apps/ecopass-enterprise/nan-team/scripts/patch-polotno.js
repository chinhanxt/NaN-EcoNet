import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const bundlePath = path.join(rootDir, 'node_modules/polotno/polotno.bundle.js');
const validateKeyPath = path.join(rootDir, 'node_modules/polotno/utils/validate-key.js');
const photosPanelPath = path.join(rootDir, 'node_modules/polotno/side-panel/photos-panel.js');
const backgroundPanelPath = path.join(rootDir, 'node_modules/polotno/side-panel/background-panel.js');
const videosPanelPath = path.join(rootDir, 'node_modules/polotno/side-panel/videos-panel.js');
const downloadButtonPath = path.join(rootDir, 'node_modules/polotno/toolbar/download-button.js');

// 1. Patch validate-key.js (License bypass)
if (fs.existsSync(validateKeyPath)) {
  let content = fs.readFileSync(validateKeyPath, 'utf8');
  content = content.replace(/export async function isKeyPaid\(n\)\{[\s\S]*?return console\.error\([\s\S]*?!0\}/,
    'export async function isKeyPaid(n){ return true; }');
  content = content.replace(/export async function validateKey\(e,o\)\{[\s\S]*?r\(\)\}/,
    'export async function validateKey(e,o){ return; }');
  fs.writeFileSync(validateKeyPath, content, 'utf8');
  console.log('[patch-polotno] Patched validate-key.js');
}

// 2. Patch polotno.bundle.js (License bypass & Hardcoded strings localization)
if (fs.existsSync(bundlePath)) {
  let content = fs.readFileSync(bundlePath, 'utf8');
  // License bypass
  content = content.replace(/async function bL\(e\)\{[\s\S]*?return console\.error\([\s\S]*?!0\}/,
    'async function bL(e){ return !0; }');
  content = content.replace(/async function bN\(e,t\)\{[\s\S]*?bE\(\)\}/,
    'async function bN(e,t){ return; }');
  content = content.replace(/bk\.value>0&&/g, 'false&&');
  content = content.replace(/bS\.value&&/g, 'false&&');

  // Hardcoded Vietnamese translations
  content = content.replace(/"Photos by"/g, '"Hình ảnh từ"');
  content = content.replace(/"Photo by"/g, '"Ảnh bởi"');
  content = content.replace(/"Videos by"/g, '"Video từ"');
  content = content.replace(/"Video by"/g, '"Video bởi"');
  content = content.replace(/"Save as Video"/g, '"Lưu dạng Video"');
  content = content.replace(/"Failed to render video"/g, '"Kết xuất video thất bại"');
  content = content.replace(/"Failed to export video\. Please try again\."/g, '"Xuất video thất bại. Vui lòng thử lại."');

  fs.writeFileSync(bundlePath, content, 'utf8');
  console.log('[patch-polotno] Patched polotno.bundle.js');
}

// 3. Patch photos-panel.js
if (fs.existsSync(photosPanelPath)) {
  let content = fs.readFileSync(photosPanelPath, 'utf8');
  content = content.replace(/"Photos by"/g, '"Hình ảnh từ"');
  content = content.replace(/"Photo by"/g, '"Ảnh bởi"');
  fs.writeFileSync(photosPanelPath, content, 'utf8');
  console.log('[patch-polotno] Patched photos-panel.js');
}

// 4. Patch background-panel.js
if (fs.existsSync(backgroundPanelPath)) {
  let content = fs.readFileSync(backgroundPanelPath, 'utf8');
  content = content.replace(/"Photos by"/g, '"Hình ảnh từ"');
  content = content.replace(/"Photo by"/g, '"Ảnh bởi"');
  fs.writeFileSync(backgroundPanelPath, content, 'utf8');
  console.log('[patch-polotno] Patched background-panel.js');
}

// 5. Patch videos-panel.js
if (fs.existsSync(videosPanelPath)) {
  let content = fs.readFileSync(videosPanelPath, 'utf8');
  content = content.replace(/"Videos by"/g, '"Video từ"');
  content = content.replace(/"Video by"/g, '"Video bởi"');
  fs.writeFileSync(videosPanelPath, content, 'utf8');
  console.log('[patch-polotno] Patched videos-panel.js');
}

// 6. Patch download-button.js
if (fs.existsSync(downloadButtonPath)) {
  let content = fs.readFileSync(downloadButtonPath, 'utf8');
  content = content.replace(/"Save as Video"/g, '"Lưu dạng Video"');
  content = content.replace(/"Failed to render video"/g, '"Kết xuất video thất bại"');
  content = content.replace(/"Failed to export video\. Please try again\."/g, '"Xuất video thất bại. Vui lòng thử lại."');
  fs.writeFileSync(downloadButtonPath, content, 'utf8');
  console.log('[patch-polotno] Patched download-button.js');
}
