#!/usr/bin/env bash
# Compose one theme's take into a 1920x1080, 60 fps MP4. For each segment in <take>/<theme>/timeline.json:
# a 'phone' frame is the recording with rounded corners and a soft shadow on a plain background; a
# 'window' frame is a rounded desktop window. Each voice clip <take>/vo/<id>.wav is placed at its beat's
# start. Segments are joined with a 0.4 s crossfade.
# usage: compose.sh <take-dir> <light|dark> [output.mp4]   (default output: <take>/<theme>/demo.mp4)
# Every ffmpeg call has -nostdin: inside a `while read` loop ffmpeg otherwise eats the loop's stdin and
# segments are silently dropped.
set -euo pipefail
[ $# -ge 2 ] || { echo "usage: compose.sh <take-dir> <light|dark> [output.mp4]" >&2; exit 64; }
TAKE=$(cd "$1" && pwd)
THEME=$2
T="$TAKE/$THEME"
OUT=${3:-$T/demo.mp4}
XF=0.4
TIMELINE="$T/timeline.json"
[ -f "$TIMELINE" ] || { echo "no $TIMELINE: record the take first" >&2; exit 1; }
mkdir -p "$(dirname "$OUT")"
BG=$([ "$THEME" = dark ] && echo 0x151a23 || echo 0xe8eef8)
PARTS=()

probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$2" -of csv=p=0 "$1"; }
length() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
calc() { python3 -c "print($1)"; }

segment() { # name frame viewport-width
  local name=$1 frame=$2 vw=$3 raw="$T/raw-$1.mp4"
  local W H DUR STRETCH FW FH RADIUS
  W=$(probe "$raw" width)
  H=$(probe "$raw" height)
  DUR=$(length "$raw")
  # Chrome won't make a window narrower than 500 px, so a narrower viewport records squeezed into the
  # left part of the frame: stretch x by 500/viewport, then crop back to the recorded size.
  STRETCH=$(calc "max(1.0, 500/$vw)")
  if [ "$frame" = phone ]; then
    FH=960; FW=$(calc "round($W/$H*960/2)*2"); RADIUS=46
  else
    FW=1680; FH=$(calc "min(960, round($H/$W*1680/2)*2)"); RADIUS=18
  fi

  ffmpeg -nostdin -v error -y -f lavfi -i "color=white:s=${FW}x${FH},format=gray" -frames:v 1 \
    -vf "geq=lum='if(gt(abs(X-W/2),W/2-$RADIUS)*gt(abs(Y-H/2),H/2-$RADIUS),if(lte(hypot(abs(X-W/2)-(W/2-$RADIUS),abs(Y-H/2)-(H/2-$RADIUS)),$RADIUS),255,0),255)'" "$T/mask-$name.png"

  local inputs=() afilters="" mix="" i=1 id start ms
  while read -r id start; do
    [ -f "$TAKE/vo/$id.wav" ] || { echo "missing voice clip $TAKE/vo/$id.wav" >&2; exit 1; }
    inputs+=(-i "$TAKE/vo/$id.wav")
    ms=$(calc "int($start*1000)")
    afilters+="[$i:a]adelay=${ms}|${ms},apad[a$i];"; mix+="[a$i]"; i=$((i+1))
  done < <(python3 -c "import json,sys;[print(b['id'], b['start']) for s in json.load(open(sys.argv[1]))['segments'] if s['name']==sys.argv[2] for b in s['beats']]" "$TIMELINE" "$name")
  local N=$((i-1))
  local audio
  if [ "$N" -gt 0 ]; then
    audio="${afilters}${mix}amix=inputs=$N:normalize=0:duration=longest,volume=1.6,atrim=0:$DUR,aformat=sample_rates=48000:channel_layouts=stereo[a]"
  else
    audio="anullsrc=r=48000:cl=stereo,atrim=0:$DUR[a]"
  fi

  ffmpeg -nostdin -v error -y -i "$raw" ${inputs[@]+"${inputs[@]}"} -loop 1 -i "$T/mask-$name.png" -filter_complex "
    [0:v]scale=iw*$STRETCH:ih,crop=$W:$H:0:0,setsar=1,scale=$FW:$FH:flags=lanczos,format=rgba[screen];
    [$((N+1)):v]format=gray,scale=$FW:$FH,split=2[m][m2];
    [screen][m]alphamerge[win];
    [m2]format=rgba,colorchannelmixer=rr=0:gg=0:bb=0:aa=0.30,pad=$((FW+160)):$((FH+160)):80:80:color=black@0,boxblur=28:2[shadow];
    color=c=$BG:s=1920x1080:r=60:d=$DUR[bg];
    [bg][shadow]overlay=(W-w)/2:(H-h)/2+14:shortest=1[bg2];
    [bg2][win]overlay=(W-w)/2:(H-h)/2:shortest=1,format=yuv420p[v];
    $audio
  " -map "[v]" -map "[a]" -r 60 -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k "$T/part-$name.mp4"
  PARTS+=("$T/part-$name.mp4")
}

while read -r name frame vw; do
  segment "$name" "$frame" "$vw"
done < <(python3 -c "import json,sys;[print(s['name'], s.get('frame', 'phone' if s['viewport']['w'] <= 600 else 'window'), s['viewport']['w']) for s in json.load(open(sys.argv[1]))['segments']]" "$TIMELINE")

[ ${#PARTS[@]} -gt 0 ] || { echo "no segments in $TIMELINE" >&2; exit 1; }

if [ ${#PARTS[@]} -eq 1 ]; then
  ffmpeg -nostdin -v error -y -i "${PARTS[0]}" -c copy -movflags +faststart "$OUT"
else
  # Chain crossfades so each switch (phone -> desktop) reads as a scene change.
  inputs=(-i "${PARTS[0]}") graph="" v="0:v" a="0:a" total=$(length "${PARTS[0]}")
  for ((k=1; k<${#PARTS[@]}; k++)); do
    inputs+=(-i "${PARTS[$k]}")
    offset=$(calc "round($total-$XF, 3)")
    graph+="[$v][$k:v]xfade=transition=fade:duration=$XF:offset=$offset[v$k];[$a][$k:a]acrossfade=d=$XF[a$k];"
    v="v$k"; a="a$k"
    total=$(calc "$total-$XF+$(length "${PARTS[$k]}")")
  done
  ffmpeg -nostdin -v error -y "${inputs[@]}" -filter_complex "${graph}[$v]format=yuv420p[vout]" \
    -map "[vout]" -map "[$a]" -r 60 -c:v libx264 -preset slow -crf 17 -c:a aac -b:a 192k -movflags +faststart "$OUT"
fi
echo "$OUT"
