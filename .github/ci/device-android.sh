#!/usr/bin/env bash
set -euo pipefail
image="system-images;android-$1;google_apis_playstore;x86_64"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
sdkmanager "$image"
echo no | avdmanager create avd --name casai --package "$image" --device pixel_7 --force
"$ANDROID_HOME/emulator/emulator" -avd casai -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -no-snapshot > "$RUNNER_TEMP/casai-emulator.log" 2>&1 &
trap 'adb emu kill >/dev/null 2>&1 || true' EXIT
for ((attempt=0; attempt<160; attempt++)); do
  if adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1 &&
     adb shell service check input 2>/dev/null | grep -q ': found' &&
     adb shell pm path com.android.chrome 2>/dev/null | grep -q 'package:'; then
    adb shell input keyevent 82 && break
  fi
  sleep 3
done
adb shell wm dismiss-keyguard
python -u tests/fixtures/recorder-devices/run.py android
