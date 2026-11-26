#!/usr/bin/env bash
# Turns one azan recording into the small files each app needs, to the numbers
# in docs/azan-clip-spec.md. Each voice has up to three sounds:
#
#   short  the opening takbir only, the default alert
#   full   the whole azan (iPhone: as much as fits in 30 s, see below)
#   fajr   a Fajr azan (with the Fajr line), used at Fajr when "Full" is chosen
#
#   iPhone   ios/PrayerTimesAsia/Resources/azan-VOICE-short.caf, azan-VOICE.caf, azan-VOICE-fajr.caf
#   Android  android/app/src/main/res/raw/azan_VOICE_short.ogg, azan_VOICE.ogg, azan_VOICE_fajr.ogg
#   Web      web/src/assets/azan/azan-VOICE-short.mp3, azan-VOICE.mp3, azan-VOICE-fajr.mp3
#
# iOS plays no more than 30 seconds of an alert sound, and plays the default
# sound instead if the file is longer, so the iPhone file stops at the end of a
# phrase before 30 s (IOS_END). Android and the web play to FULL_END.
#
# Usage:
#   tools/make_azan.sh VOICE RECORDING START SHORT_END IOS_END FULL_END         (short + full)
#   tools/make_azan.sh VOICE RECORDING START SHORT_END IOS_END -                (short only)
#   tools/make_azan.sh VOICE RECORDING START - IOS_END FULL_END fajr            (fajr only)
# Times are seconds into the recording. VOICE is a short lower-case id (asim).
#
# The voices in the app today (sources and licences in docs/AUDIO_LICENSES.csv):
#   tools/make_azan.sh asim   asim-javed-2nd-adhan.flac 0 11.9 24.3 74.9
#   tools/make_azan.sh khalaf Developer_Athan-1.mp3 1.2 28.3 28.3 144.6
#   tools/make_azan.sh khalaf Developer_Athan-3_Fajr.mp3 0.5 - 29.0 99.5 fajr
#   tools/make_azan.sh makkah makkah-2013-seyfula.webm 7.4 32.6 32.6 -
#
# Needs ffmpeg. Every recording must be logged in docs/AUDIO_LICENSES.csv with
# its licence or written permission before it goes in the app.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -ge 6 ] || { sed -n 2,29p "$0"; exit 1; }
voice=$1 src=$2 start=$3 short_end=$4 ios_end=$5 full_end=$6 kind=${7:-}

# Cut (START is set by ear, so the first sound is never clipped), even out the loudness (-16 LUFS, peaks under
# -1 dB), then a 0.5 s fade at the very end (reversed, so the length need not be known).
shape() { # end-seconds
  echo "atrim=start=$start:end=$1,asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,areverse,afade=t=in:d=0.5,areverse"
}
ios()     { ffmpeg -loglevel error -y -i "$src" -vn -af "$(shape "$1")" -ac 1 -ar 22050 -c:a adpcm_ima_qt -f caf "ios/PrayerTimesAsia/Resources/$2.caf"; }
android() { ffmpeg -loglevel error -y -i "$src" -vn -af "$(shape "$1")" -ac 1 -ar 32000 -c:a libvorbis -q:a 1 "android/app/src/main/res/raw/$2.ogg"; }
web()     { ffmpeg -loglevel error -y -i "$src" -vn -af "$(shape "$1")" -ac 1 -ar 32000 -c:a libmp3lame -b:a 48k "web/src/assets/azan/$2.mp3"; }

mkdir -p web/src/assets/azan android/app/src/main/res/raw
made=()
if [ "$kind" = fajr ]; then
  ios "$ios_end" "azan-$voice-fajr"; android "$full_end" "azan_${voice}_fajr"; web "$full_end" "azan-$voice-fajr"
  made+=("ios/PrayerTimesAsia/Resources/azan-$voice-fajr.caf" "android/app/src/main/res/raw/azan_${voice}_fajr.ogg" "web/src/assets/azan/azan-$voice-fajr.mp3")
else
  ios "$short_end" "azan-$voice-short"; android "$short_end" "azan_${voice}_short"; web "$short_end" "azan-$voice-short"
  made+=("ios/PrayerTimesAsia/Resources/azan-$voice-short.caf" "android/app/src/main/res/raw/azan_${voice}_short.ogg" "web/src/assets/azan/azan-$voice-short.mp3")
  if [ "$full_end" != - ]; then
    ios "$ios_end" "azan-$voice"; android "$full_end" "azan_$voice"; web "$full_end" "azan-$voice"
    made+=("ios/PrayerTimesAsia/Resources/azan-$voice.caf" "android/app/src/main/res/raw/azan_$voice.ogg" "web/src/assets/azan/azan-$voice.mp3")
  fi
fi
for f in "${made[@]}"; do
  printf '%-52s %5.1f s %4d KB\n' "$f" "$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")" $(( $(stat -c %s "$f") / 1024 ))
done
