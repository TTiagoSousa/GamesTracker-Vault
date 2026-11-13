#!/usr/bin/env node
// Builds the signed Android APK and publishes it with the web app.
//
//   npm run build:android
//
// 1. Finds the JDK (JAVA_HOME, or a Microsoft/Temurin JDK 17+ in the usual places)
//    and the Android SDK (ANDROID_HOME, or %LOCALAPPDATA%\Android\Sdk / ~/Android/Sdk).
// 2. The first time, creates the signing keystore OUTSIDE the repository, in
//    ~/.gametracker/ (android-release.jks + android-keystore.properties, random
//    password). Back that folder up: without the same keystore, phones cannot
//    update the app — they would have to uninstall it first.
// 3. Runs gradlew assembleSelfupdateRelease in apps/android (the build that updates
//    itself from the server; the "fdroid" build leaves updates to the store).
// 4. Copies the APK to apps/frontend/public/downloads/gametracker-vault.apk (served by
//    the site at /downloads/gametracker-vault.apk) and writes android.json next to it
//    (version, versionCode, size, sha256) for the app's update check and download button.
//
// The app has the same version as the server: APP_VERSION_NAME in apps/android/
// gradle.properties, which the release script keeps equal to package.json. The version
// code is derived from it (1.4.2 → 1004002), so each release is newer than the last.
//   npm run build:android                      build the current version
//   npm run build:android -- --version 1.1.0   set the version first
//
// In CI (CI=true) the keystore must already exist: GAMETRACKER_KEYSTORE_PROPERTIES points
// at its properties file. A new key is never generated there.
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = join(root, 'apps', 'android');
const downloadsDir = join(root, 'apps', 'frontend', 'public', 'downloads');
const windows = process.platform === 'win32';

const fail = (message) => {
  console.error(`✗ ${message}`);
  process.exit(1);
};

// --- JDK and SDK ---------------------------------------------------------------------------

const findJdk = () => {
  if (process.env.JAVA_HOME && existsSync(process.env.JAVA_HOME)) return process.env.JAVA_HOME;
  const bases = windows
    ? ['C:\\Program Files\\Microsoft', 'C:\\Program Files\\Eclipse Adoptium', 'C:\\Program Files\\Java']
    : ['/usr/lib/jvm', '/Library/Java/JavaVirtualMachines'];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const found = readdirSync(base)
      .filter((name) => /jdk-?(1[7-9]|2\d)/.test(name))
      .sort()
      .reverse()[0];
    if (found) {
      const home = join(base, found);
      return existsSync(join(home, 'Contents', 'Home')) ? join(home, 'Contents', 'Home') : home;
    }
  }
  return null;
};

const findSdk = () => {
  const candidates = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    windows ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Android', 'Sdk'),
    join(homedir(), 'Library', 'Android', 'sdk'),
  ];
  return candidates.find((path) => path && existsSync(join(path, 'platforms'))) ?? null;
};

const jdk = findJdk();
if (!jdk) fail('No JDK 17+ found. Install one (e.g. winget install Microsoft.OpenJDK.21) or set JAVA_HOME.');
const sdk = findSdk();
if (!sdk) fail('No Android SDK found. Install the command-line tools and "platforms;android-35", or set ANDROID_HOME.');

// Gradle reads the SDK path from local.properties (ignored by git)
writeFileSync(join(androidDir, 'local.properties'), `sdk.dir=${sdk.replace(/\\/g, '/')}\n`);

// --- signing keystore (outside the repository) -------------------------------------------

const keyDir = process.env.GAMETRACKER_KEYSTORE_DIR ?? join(homedir(), '.gametracker');
const keystore = join(keyDir, 'android-release.jks');
const keystoreProps = process.env.GAMETRACKER_KEYSTORE_PROPERTIES ?? join(keyDir, 'android-keystore.properties');

if (process.env.CI && !existsSync(keystoreProps)) {
  fail(`No keystore at ${keystoreProps}. In CI the signing key comes from the repository secrets.`);
}

if (!existsSync(keystoreProps)) {
  if (existsSync(keystore)) fail(`${keystore} exists but ${keystoreProps} is missing — restore it from your backup.`);
  mkdirSync(keyDir, { recursive: true });
  const password = randomBytes(24).toString('base64url');
  const keytool = join(jdk, 'bin', windows ? 'keytool.exe' : 'keytool');
  execFileSync(keytool, [
    '-genkeypair', '-noprompt',
    '-keystore', keystore,
    '-alias', 'gametracker',
    '-keyalg', 'RSA', '-keysize', '4096',
    '-validity', '36500',
    '-storepass', password, '-keypass', password,
    '-dname', 'CN=GamesTracker Vault',
  ], { stdio: 'ignore' });
  writeFileSync(
    keystoreProps,
    [
      '# Signing key of the GamesTracker Vault Android app. Back up this folder:',
      '# without this key, phones cannot update the app (they must uninstall first).',
      `storeFile=${keystore.replace(/\\/g, '/')}`,
      `storePassword=${password}`,
      'keyAlias=gametracker',
      `keyPassword=${password}`,
      '',
    ].join('\n'),
  );
  console.log(`✓ Created the signing key in ${keyDir} — back that folder up.`);
}

// --- version ------------------------------------------------------------------------------

const propsFile = join(androidDir, 'gradle.properties');
const args = process.argv.slice(2);
const versionArg = args.includes('--version') ? args[args.indexOf('--version') + 1]?.replace(/^v/, '') : undefined;
if (versionArg !== undefined && !/^\d+\.\d+\.\d+$/.test(versionArg)) fail(`--version must look like 1.2.3 (got "${versionArg}").`);

let props = readFileSync(propsFile, 'utf8');
if (versionArg) {
  props = props.replace(/^APP_VERSION_NAME=.*$/m, `APP_VERSION_NAME=${versionArg}`);
  writeFileSync(propsFile, props);
}
const versionName = /^APP_VERSION_NAME=(.*)$/m.exec(props)?.[1]?.trim();
if (!versionName || !/^\d+\.\d+\.\d+$/.test(versionName)) fail(`APP_VERSION_NAME in ${propsFile} is not x.y.z.`);
// Same formula as app/build.gradle
const [major, minor, patch] = versionName.split('.').map(Number);
const versionCode = major * 1000000 + minor * 1000 + patch;
console.log(`➜ Version ${versionName} (code ${versionCode})`);

// --- build ----------------------------------------------------------------------------------

console.log('➜ Building the APK (the first time Gradle downloads its tools)…');
// By its relative name, inside the folder: on Windows cmd splits paths with spaces
const gradlew = windows ? '.\\gradlew.bat' : './gradlew';
try {
  execFileSync(gradlew, ['assembleSelfupdateRelease', '--console=plain', '-q'], {
    cwd: androidDir,
    stdio: 'inherit',
    shell: windows,
    env: { ...process.env, JAVA_HOME: jdk, GAMETRACKER_KEYSTORE_PROPERTIES: keystoreProps },
  });
} catch {
  fail('The build failed.');
}

const apk = join(androidDir, 'app', 'build', 'outputs', 'apk', 'selfupdate', 'release', 'app-selfupdate-release.apk');
if (!existsSync(apk)) fail(`The build did not produce ${apk} (is the keystore configured?).`);

// --- publish with the web app ------------------------------------------------------------

mkdirSync(downloadsDir, { recursive: true });
const target = join(downloadsDir, 'gametracker-vault.apk');
copyFileSync(apk, target);

const bytes = readFileSync(target);
const info = {
  version: versionName,
  versionCode,
  size: statSync(target).size,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  builtAt: new Date().toISOString(),
};
writeFileSync(join(downloadsDir, 'android.json'), `${JSON.stringify(info, null, 2)}\n`);

console.log(`✓ APK ${info.version} (${(info.size / 1024).toFixed(0)} KB) → apps/frontend/public/downloads/gametracker-vault.apk`);
console.log(`  sha256 ${info.sha256}`);
