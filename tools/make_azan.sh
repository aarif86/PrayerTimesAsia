#!/usr/bin/env bash
# Turns one azan recording (and, optionally, a Subuh azan) into the files each
# app needs, in the right places:
#   iPhone   ios/PrayerTimesAsia/Resources/azan.caf, azan-subuh.caf  (first 30 s: iOS plays no more of an alert sound)
#   Android  android/app/src/main/res/raw/azan.ogg, azan_subuh.ogg  (full length)
#   Web      web/src/assets/azan/azan.mp3, azan-subuh.mp3           (full length)
# The "Play the azan" switch appears in each app as soon as these files exist.
#
# Usage:  tools/make_azan.sh AZAN.(wav|m4a|mp3...) [SUBUH_AZAN.(...)]
# Needs ffmpeg. Record in a quiet room; the script evens out the volume,
# trims silence at the start and fades out the iPhone clip.
#
# Every recording needs written permission from the person who recorded it,
# noted in docs/azan.md (who, when, and the permission).
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -ge 1 ] || { sed -n 2,14p "$0"; exit 1; }

clean="silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11"

# AZAN_SECONDS=9.4 makes a short call (for example the first two "Allahu akbar")
# for every platform, with a short fade at the end. Without it, iPhone gets the
# first 29.5 s and Android and web the full azan.
secs="${AZAN_SECONDS:-}"
if [ -n "$secs" ]; then
  ios_cut="-t $secs"; ios_fade="afade=t=out:st=$(echo "$secs - 0.6" | bc -l):d=0.6"
  all_cut="-t $secs"; all_fade="$ios_fade"
else
  ios_cut="-t 29.5"; ios_fade="afade=t=out:st=27.5:d=2"
  all_cut=""; all_fade=""
fi
all_af="$clean"; [ -n "$all_fade" ] && all_af="$clean,$all_fade"

make() { # source, ios name, android name, web name
  ffmpeg -loglevel error -y -i "$1" -af "$clean,$ios_fade" $ios_cut -ac 1 -ar 22050 \
    -c:a adpcm_ima_qt -f caf "ios/PrayerTimesAsia/Resources/$2.caf"
  ffmpeg -loglevel error -y -i "$1" -af "$all_af" $all_cut -ac 1 -ar 44100 -c:a libvorbis -q:a 4 \
    "android/app/src/main/res/raw/$3.ogg"
  ffmpeg -loglevel error -y -i "$1" -af "$all_af" $all_cut -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k \
    "web/src/assets/azan/$4.mp3"
  echo "Made $2 for iPhone, Android and web."
}

mkdir -p web/src/assets/azan android/app/src/main/res/raw
make "$1" azan azan azan
if [ $# -ge 2 ]; then make "$2" azan-subuh azan_subuh azan-subuh; fi
