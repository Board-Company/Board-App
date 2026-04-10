#!/usr/bin/env node
/**
 * Applies the @react-native-voice/voice AndroidX patch using system `patch`.
 * Run from project root (nimbus). Patch is applied in package dir with -p1.
 */
const path = require('path');
const { execSync } = require('child_process');
const fs = require('fs');

const root = path.resolve(__dirname, '..');
const patchFile = path.join(root, 'scripts', 'patches', 'voice-androidx.patch');
const pkgDir = path.join(root, 'node_modules', '@react-native-voice', 'voice');

if (!fs.existsSync(patchFile)) {
  console.warn('apply-voice-patch: patch file not found, skipping');
  process.exit(0);
}
if (!fs.existsSync(pkgDir)) {
  console.warn('apply-voice-patch: @react-native-voice/voice not installed, skipping');
  process.exit(0);
}

try {
  execSync(`patch -p1 -f -i "${path.relative(pkgDir, patchFile)}"`, {
    cwd: pkgDir,
    stdio: 'inherit',
  });
  console.log('apply-voice-patch: voice AndroidX patch applied');
} catch (e) {
  if (e.status === 1 && (e.stderr || e.stdout || '').toString().includes('ignoring')) {
    console.log('apply-voice-patch: patch already applied or skipped');
    process.exit(0);
  }
  if (e.status === 1) {
    console.warn('apply-voice-patch: patch reported issues (may already be applied)');
    process.exit(0);
  }
  throw e;
}
