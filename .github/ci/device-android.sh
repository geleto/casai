#!/usr/bin/env bash
set -euo pipefail
target=google_apis_playstore
graphics=(-gpu swiftshader_indirect)
if [[ "$1" == '37.2' ]]; then
  target=google_apis_playstore_ps16k
  # The guest's graphics mapper aborts when the host advertises read-color-buffer DMA.
  # Keep direct mappings for Android startup while disabling the other prerequisite for this extension.
  graphics=(-gpu swiftshader -feature -HasSharedSlotsHostMemoryAllocator)
fi
image="system-images;android-$1;$target;x86_64"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
export ANDROID_AVD_HOME="$HOME/.android/avd"
mkdir -p "$ANDROID_AVD_HOME" device-output
sdkmanager "$image"
echo no | avdmanager create avd --name casai --package "$image" --device pixel_7 --force
printf 'hw.cpu.ncore=2\ndisk.dataPartition.size=6G\n' >> "$ANDROID_AVD_HOME/casai.avd/config.ini"
df -h "$ANDROID_AVD_HOME"
"$ANDROID_HOME/emulator/emulator" -port 5554 -avd casai -memory 4096 -no-window "${graphics[@]}" -noaudio -no-boot-anim -no-snapshot -no-metrics > device-output/emulator-boot.log 2>&1 &
emulator_pid=$!
finish() {
  if (( $? != 0 )); then
    timeout 15 adb logcat -b crash -b system -d -t 1500 > device-output/android-services.log 2>&1 || true
    timeout 15 adb shell dumpsys activity activities > device-output/android-activities.txt 2>&1 || true
  fi
  adb emu kill >/dev/null 2>&1 || true
}
trap finish EXIT
ready=false
for ((attempt=0; attempt<160; attempt++)); do
  if ! kill -0 "$emulator_pid" 2>/dev/null; then tail -50 device-output/emulator-boot.log; exit 1; fi
  if [[ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" == '1' ]] &&
     adb shell service check input 2>/dev/null | grep -q ': found' &&
     adb shell am get-current-user 2>/dev/null | grep -Eq '^[0-9]+' &&
     adb shell cmd package resolve-activity --brief --user current -a android.intent.action.MAIN -c android.intent.category.LAUNCHER -p com.android.chrome 2>/dev/null | grep -q 'com.android.chrome/'; then
    ready=true
    break
  fi
  sleep 3
done
if [[ "$ready" != true ]]; then echo 'No callable Android activity for the foreground user'; exit 1; fi
adb shell input keyevent 82
adb shell wm dismiss-keyguard
adb shell settings put global device_provisioned 1
adb shell settings --user current put secure user_setup_complete 1
python -u tests/fixtures/recorder-devices/run.py android
