const { execSync } = require('child_process');
const { existsSync } = require('fs');

const DEFAULT_IOS_SIMULATOR_TYPE = 'iPhone 15 Pro';
const DEFAULT_ANDROID_AVD_NAME = 'Pixel_5_Pro_API_34';

function getIosSimulatorType() {
  if (process.env.DETOX_IOS_SIMULATOR_TYPE) {
    return process.env.DETOX_IOS_SIMULATOR_TYPE;
  }

  const preferredSimulatorTypes = [
    'iPhone 16 Pro',
    DEFAULT_IOS_SIMULATOR_TYPE,
    'iPhone 16',
    'iPhone 15',
  ];

  try {
    const output = execSync('xcrun simctl list devices available --json', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const devices = JSON.parse(output).devices ?? {};
    const availableSimulatorTypes = new Set(
      Object.values(devices)
        .flat()
        .map((device) => device.name)
        .filter(Boolean),
    );

    return (
      preferredSimulatorTypes.find((type) =>
        availableSimulatorTypes.has(type),
      ) ?? DEFAULT_IOS_SIMULATOR_TYPE
    );
  } catch {
    return DEFAULT_IOS_SIMULATOR_TYPE;
  }
}

const iosSimulatorType = getIosSimulatorType();

function getAndroidAvdName() {
  if (process.env.DETOX_ANDROID_AVD_NAME) {
    return process.env.DETOX_ANDROID_AVD_NAME;
  }

  const preferredAvdNames = [
    DEFAULT_ANDROID_AVD_NAME,
    'Pixel_7',
    'Medium_Phone_API_36',
  ];

  try {
    const output = execSync(
      `${process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Library/Android/sdk`}/emulator/emulator -list-avds`,
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    );
    const availableAvdNames = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    return (
      preferredAvdNames.find((name) => availableAvdNames.includes(name)) ??
      availableAvdNames[0] ??
      DEFAULT_ANDROID_AVD_NAME
    );
  } catch {
    return DEFAULT_ANDROID_AVD_NAME;
  }
}

const androidAvdName = getAndroidAvdName();

function getAttachedAndroidAdbName() {
  if (process.env.DETOX_ANDROID_ATTACHED_ADB_NAME) {
    return process.env.DETOX_ANDROID_ATTACHED_ADB_NAME;
  }

  try {
    const adbPath = `${
      process.env.ANDROID_SDK_ROOT || `${process.env.HOME}/Library/Android/sdk`
    }/platform-tools/adb`;
    const output = execSync(`${adbPath} devices`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const attachedDevice = output
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.endsWith('\tdevice'))
      .map((line) => line.split('\t')[0])
      .find((deviceId) => !deviceId.startsWith('emulator-'));

    return attachedDevice ?? '.*';
  } catch {
    return '.*';
  }
}

const attachedAndroidAdbName = getAttachedAndroidAdbName();

function getBinaryPath(prebuiltPathEnvVar, defaultPath) {
  const prebuiltPath = process.env[prebuiltPathEnvVar];

  if (prebuiltPath && existsSync(prebuiltPath)) {
    return prebuiltPath;
  }

  return defaultPath;
}

/** @type {Detox.DetoxConfig} */
module.exports = {
  artifacts: {
    rootDir: "./tests/artifacts",
    plugins: {
      screenshot: {
        shouldTakeAutomaticSnapshots: true,
        keepOnlyFailedTestsArtifacts: true,
        takeWhen: {
          testStart: false,
          testDone: false,
        },
      },
      video: {
        enabled: true,  // Enable video recording
        keepOnlyFailedTestsArtifacts: true,  // Keep only failed tests' videos
      },
    },
  },
  testRunner: {
    args: {
      $0: 'jest',
      config: 'tests/jest.e2e.detox.config.js',
      // CI only: Force Jest to exit after all tests complete, preventing indefinite hangs
      // from open handles (sockets, timers). Also detect what's keeping Jest open.
      ...({
        forceExit: true,
        detectOpenHandles: true,
      }),
    },
    detached: process.env.CI ? true : false,
    jest: {
      setupTimeout: 220000,
      teardownTimeout: 60000, // Increase teardown timeout from default 30s to 60s
    },
    retries: process.env.CI ? 1 : 0,
  },
  configurations: {
    'ios.sim.apiSpecs': {
      device: 'ios.simulator',
      app: process.env.CI ? `ios.${process.env.METAMASK_BUILD_TYPE}.release` : 'ios.debug',
      testRunner: {
        args: {
          "$0": "node tests/smoke/api-specs/run-api-spec-tests.js",
        },
      },
    },
    'android.emu.main': {
      device: 'android.emulator',
      app: 'android.debug',
    },
    'android.attached.main': {
      device: 'android.attached',
      app: 'android.attached.debug',
    },
    'android.attached.main.ci': {
      device: 'android.attached',
      app: 'android.release',
    },
    'android.emu.flask': {
      device: 'android.emulator',
      app: 'android.flask.debug',
    },
    'ios.sim.main': {
      device: 'ios.simulator',
      app: 'ios.debug',
    },
    'ios.sim.flask': {
      device: 'ios.simulator',
      app: 'ios.flask.debug',
    },
    'android.emu.main.ci': {
      device: 'android.github_ci.emulator',
      app: 'android.release',
    },
    'android.emu.flask.ci': {
      device: 'android.github_ci.emulator',
      app: 'android.flask.release',
    },
    'ios.sim.main.ci': {
      device: 'ios.simulator',
      app: 'ios.main.release',
    },
    'ios.sim.flask.ci': {
      device: 'ios.simulator',
      app: 'ios.flask.release',
    },
  },
  devices: {
    'ios.simulator': {
      type: 'ios.simulator',
      device: {
        type: iosSimulatorType,
      },
    },
    'android.emulator': {
      type: 'android.emulator',
      device: {
        avdName: androidAvdName,
      },
    },
    'android.attached': {
      type: 'android.attached',
      device: {
        adbName: attachedAndroidAdbName,
      },
    },
    'android.github_ci.emulator': {
      type: 'android.emulator',
      device: {
        avdName: 'emulator',
      },
      bootArgs: '-skin 1080x2340 -memory 12288 -cores 8 -gpu swiftshader_indirect -no-audio -no-boot-anim -partition-size 8192 -no-snapshot-save -no-snapshot-load -cache-size 2048 -accel on -wipe-data -read-only',
      forceAdbInstall: true,
      gpuMode: 'swiftshader_indirect',
    },
    'android.bitrise.emulator': {
      type: 'android.emulator',
      device: {
        avdName: 'emulator',
      },
      // optimized for Bitrise CI runners
      bootArgs: '-verbose -show-kernel -no-audio -netdelay none -no-snapshot -wipe-data -gpu auto -no-window -no-boot-anim -read-only',
      forceAdbInstall: true,
    }
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: getBinaryPath(
        'PREBUILT_IOS_APP_PATH',
        'ios/build/Build/Products/Debug-iphonesimulator/MetaMask.app',
      ),
      build: 'export CONFIGURATION="Debug" && yarn build:ios:main:e2e',
    },
    'ios.main.release': {
      type: 'ios.app',
      binaryPath: getBinaryPath(
        'PREBUILT_IOS_APP_PATH',
        'ios/build/Build/Products/Release-iphonesimulator/MetaMask.app',
      ),
      build: `export CONFIGURATION="Release" && yarn build:ios:main:e2e`,
    },
    'ios.flask.debug': {
      type: 'ios.app',
      binaryPath: getBinaryPath(
        'PREBUILT_IOS_APP_PATH',
        'ios/build/Build/Products/Debug-iphonesimulator/MetaMask-Flask.app',
      ),
      build: 'export CONFIGURATION="Debug" && yarn build:ios:flask:e2e',
    },
    'ios.flask.release': {
      type: 'ios.app',
      binaryPath: getBinaryPath(
        'PREBUILT_IOS_APP_PATH',
        'ios/build/Build/Products/Release-iphonesimulator/MetaMask-Flask.app',
      ),
      build: `export CONFIGURATION="Release" && yarn build:ios:flask:e2e`,
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: getBinaryPath(
        'PREBUILT_ANDROID_APK_PATH',
        'android/app/build/outputs/apk/prod/debug/app-prod-debug.apk',
      ),
      testBinaryPath: getBinaryPath(
        'PREBUILT_ANDROID_TEST_APK_PATH',
        'android/app/build/outputs/apk/androidTest/prod/debug/app-prod-debug-androidTest.apk',
      ),
      build: 'export CONFIGURATION="Debug" && yarn build:android:main:e2e',
    },
    'android.attached.debug': {
      type: 'android.apk',
      binaryPath: getBinaryPath(
        'PREBUILT_ANDROID_APK_PATH',
        'android/app/build/outputs/apk/prod/debug/app-prod-debug.apk',
      ),
      testBinaryPath: getBinaryPath(
        'PREBUILT_ANDROID_TEST_APK_PATH',
        'android/app/build/outputs/apk/androidTest/prod/debug/app-prod-debug-androidTest.apk',
      ),
      build: `export CONFIGURATION="Debug" && export DETOX_ANDROID_ARCHITECTURES="${process.env.DETOX_ANDROID_ARCHITECTURES || 'arm64-v8a'}" && yarn build:android:main:e2e`,
    },
    'android.release': {
      type: 'android.apk',
      binaryPath: getBinaryPath(
        'PREBUILT_ANDROID_APK_PATH',
        'android/app/build/outputs/apk/prod/release/app-prod-release.apk',
      ),
      testBinaryPath: getBinaryPath(
        'PREBUILT_ANDROID_TEST_APK_PATH',
        'android/app/build/outputs/apk/androidTest/prod/release/app-prod-release-androidTest.apk',
      ),
      build: `export CONFIGURATION="Release" && yarn build:android:main:e2e`,
    },
    'android.flask.debug': {
      type: 'android.apk',
      binaryPath: getBinaryPath(
        'PREBUILT_ANDROID_APK_PATH',
        'android/app/build/outputs/apk/flask/debug/app-flask-debug.apk',
      ),
      testBinaryPath: getBinaryPath(
        'PREBUILT_ANDROID_TEST_APK_PATH',
        'android/app/build/outputs/apk/androidTest/flask/debug/app-flask-debug-androidTest.apk',
      ),
      build: 'export CONFIGURATION="Debug" && yarn build:android:flask:e2e',
    },
    'android.flask.release': {
      type: 'android.apk',
      binaryPath: getBinaryPath(
        'PREBUILT_ANDROID_APK_PATH',
        'android/app/build/outputs/apk/flask/release/app-flask-release.apk',
      ),
      testBinaryPath: getBinaryPath(
        'PREBUILT_ANDROID_TEST_APK_PATH',
        'android/app/build/outputs/apk/androidTest/flask/release/app-flask-release-androidTest.apk',
      ),
      build: `export CONFIGURATION="Release" && yarn build:android:flask:e2e`,
    },
  },
};
