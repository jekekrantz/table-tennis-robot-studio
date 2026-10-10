#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "$0")/.." && pwd)"

if [[ -z "${JAVA_HOME:-}" ]]; then
  if [[ -x /home/ekz/android-studio/jbr/bin/java ]]; then
    export JAVA_HOME=/home/ekz/android-studio/jbr
  elif [[ -x /home/ekz/Downloads/android-studio/jbr/bin/java ]]; then
    export JAVA_HOME=/home/ekz/Downloads/android-studio/jbr
  fi
fi

if [[ -z "${ANDROID_HOME:-}" && -d /home/ekz/Android/Sdk ]]; then
  export ANDROID_HOME=/home/ekz/Android/Sdk
fi

cd "$repo_dir/android"
./gradlew assembleDebug
printf 'APK: %s\n' "$repo_dir/android/app/build/outputs/apk/debug/app-debug.apk"

