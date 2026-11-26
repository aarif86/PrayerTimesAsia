#!/usr/bin/env bash
# Turns one azan recording into the files each app needs, in two lengths, to
# the numbers in docs/azan-clip-spec.md:
#
#   Short call  the opening takbir only (about 12 s), the default alert
#   Full azan   the whole recording (iPhone: as much as fits in 30 s, see below)
#
#   iPhone   ios/PrayerTimesAsia/Resources/azan-short.caf, azan.caf
#   Android  android/app/src/main/res/raw/azan_short.ogg, azan.ogg
#   Web      web/src/assets/azan/azan-short.mp3, azan.mp3
#
# iOS plays no more than 30 seconds of an alert sound, and plays the default
# sound instead if the file is longer, so the iPhone "full" file stops at the
# end of a phrase before 30 s (IOS_END). Android and the web play it all.
#
# Usage:  tools/make_azan.sh RECORDING SHORT_END [IOS_END]
#   SHORT_END  seconds into the recording where the opening takbir ends
#   IOS_END    seconds where the iPhone full file ends (default 29.5)
# Example (Asim Javed, ICR 2nd adhan, 17 May 2024):
#   tools/make_azan.sh asim-javed-2nd-adhan.flac 11.9 24.3
#
# Needs ffmpeg. Every recording must be logged in docs/AUDIO_LICENSES.csv with
# its licence or written permission before it goes in the app.
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -ge 2 ] || { sed -n 2,24p "$0"; exit 1; }
src=$1 short_end=$2 ios_end=${3:-29.5}

# Remove the quiet start, even out the loudness (-16 LUFS, peaks under -1 dB),
# then a 0.5 s fade at the very end (reversed, so the length need not be known).
shape() { # end-seconds
  echo "atrim=end=$1,silenceremove=start_periods=1:start_threshold=-45dB,loudnorm=I=-16:TP=-1.5:LRA=11,areverse,afade=t=in:d=0.5,areverse"
}
full=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$src")

mkdir -p web/src/assets/azan android/app/src/main/res/raw
make() { # end, ios name, android name, web name, ios end
  ffmpeg -loglevel error -y -i "$src" -af "$(shape "$5")" -ac 1 -ar 22050 \
    -c:a adpcm_ima_qt -f caf "ios/PrayerTimesAsia/Resources/$2.caf"
  ffmpeg -loglevel error -y -i "$src" -af "$(shape "$1")" -ac 1 -ar 44100 -c:a libvorbis -q:a 4 \
    "android/app/src/main/res/raw/$3.ogg"
  ffmpeg -loglevel error -y -i "$src" -af "$(shape "$1")" -ac 1 -ar 44100 -c:a libmp3lame -b:a 96k \
    "web/src/assets/azan/$4.mp3"
}
make "$short_end" azan-short azan_short azan-short "$short_end"
make "$full" azan azan azan "$ios_end"

for f in ios/PrayerTimesAsia/Resources/azan-short.caf ios/PrayerTimesAsia/Resources/azan.caf \
         android/app/src/main/res/raw/azan_short.ogg android/app/src/main/res/raw/azan.ogg \
         web/src/assets/azan/azan-short.mp3 web/src/assets/azan/azan.mp3; do
  printf '%-48s %5.1f s\n' "$f" "$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")"
done
