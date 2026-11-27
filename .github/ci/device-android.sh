#!/usr/bin/env bash
set -euo pipefail
image="system-images;android-$1;google_apis_playstore;x86_64"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export ANDROID_AVD_HOME="$HOME/.android/avd"
mkdir -p "$ANDROID_AVD_HOME" device-output
sdkmanager "$image"
echo no | avdmanager create avd --name casai --package "$image" --device pixel_7 --force
printf 'hw.cpu.ncore=2\ndisk.dataPartition.size=2G\n' >> "$ANDROID_AVD_HOME/casai.avd/config.ini"
df -h "$ANDROID_AVD_HOME"
"$ANDROID_HOME/emulator/emulator" -port 5554 -avd casai -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -no-snapshot > device-output/emulator-boot.log 2>&1 &
emulator_pid=$!
trap 'adb emu kill >/dev/null 2>&1 || true' EXIT
for ((attempt=0; attempt<160; attempt++)); do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then tail -50 device-output/emulator-boot.log; exit 1; fi
  if adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1 &&
     adb shell service check input 2>/dev/null | grep -q ': found' &&
     adb shell cmd user is-user-unlocked 0 2>/dev/null | grep -q true &&
     adb shell pm path com.android.chrome 2>/dev/null | grep -q 'package:'; then
    adb shell input keyevent 82 && break
  fi
  sleep 3
done
adb shell wm dismiss-keyguard
adb shell settings put global device_provisioned 1
adb shell settings put secure user_setup_complete 1
adb shell pm enable --user 0 com.android.chrome
python -u tests/fixtures/recorder-devices/run.py android
