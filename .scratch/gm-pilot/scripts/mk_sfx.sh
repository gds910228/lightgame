#!/bin/bash
# Build snd/*.mp3: peak-normalize each source to -1.5 dBFS, 44.1 kHz mono-ish mp3.
DL="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/dl"
SND="D:/WorkProjects/AI/Lightgame/packages/games/gold-miner/snd"
mkdir -p "$SND"

norm() { # $1=src $2=out $3=extra filters
  peak=$(ffmpeg -i "$1" -af volumedetect -f null - 2>&1 | grep max_volume | grep -oE "[-0-9.]+ dB" | grep -oE "[-0-9.]+")
  gain=$(python -c "print(round(-1.5 - ($peak), 2))")
  ffmpeg -y -v error -i "$1" -af "volume=${gain}dB,$3" -ar 44100 -ac 2 -b:a 96k "$2" || return 1
  echo "OK $2 (peak ${peak}dB -> gain ${gain}dB)"
}

norm "$DL/swishes/swishes/swish-7.wav"   "$SND/launch.mp3" "anull"
norm "$DL/coin.mp3"                      "$SND/coin.mp3"   "afade=t=out:st=1.0:d=0.25,atrim=0:1.25"
norm "$DL/win_newthingget.ogg"           "$SND/win.mp3"    "anull"
norm "$DL/lose_gameover.ogg"             "$SND/lose.mp3"   "anull"
norm "$DL/bgm_stage1.ogg"                "$SND/bgm.mp3"    "anull"

echo "=== results ==="
for f in "$SND"/*.mp3; do d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f"); echo "$f: ${d}s $(stat -c%s "$f")B"; done
