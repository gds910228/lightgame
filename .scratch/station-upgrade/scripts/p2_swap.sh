#!/bin/bash
# P2: cover-crop generated art to exact original dimensions, backup originals, swap in place.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/gen"
BK="D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/backup/p2"
ROOT="D:/WorkProjects/AI/Lightgame/packages/games"
mkdir -p "$BK"

swap() { # $1=srcjpg $2=game/targetpath $3=WxH $4=extra(post-filter)
  local t="$ROOT/$2" out="/tmp/p2out.png" ext="${2##*.}"
  local W=${3%x*} H=${3#*x}
  mkdir -p "$(dirname "$BK/$2")"
  [ -f "$BK/$2" ] || cp "$t" "$BK/$2"
  local vf="crop=768:730:0:0,scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H$4"
  if [ "$ext" = "png" ]; then
    ffmpeg -y -v error -i "$1" -vf "$vf" -frames:v 1 "$t" || return 1
  else
    ffmpeg -y -v error -i "$1" -vf "$vf" -frames:v 1 -q:v 3 "$t" || return 1
  fi
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$t" | xargs echo "OK $2 ->"
}

swap "$GEN/menu_sea.jpg"      "sea-treasure-match/bitmap/menu.png"          400x415 ""
swap "$GEN/cover_mummy.jpg"   "mummy-maze-escape/img/cover.png"             320x480 ""
swap "$GEN/cover_mummy.jpg"   "mummy-maze-escape/img/menufront.png"         320x480 ",hflip"
swap "$GEN/splash_gunner.jpg" "hyper-gunner/library/splash.png"             320x480 ""
swap "$GEN/blockbg_prison.jpg" "prison-whack/images/block_bg.png"           640x960 ""
swap "$GEN/cellbg_prison.jpg" "prison-whack/images/jianyu_bg.jpg"           640x960 ""
echo "=== verify dims ==="
for f in sea-treasure-match/bitmap/menu.png mummy-maze-escape/img/cover.png mummy-maze-escape/img/menufront.png hyper-gunner/library/splash.png prison-whack/images/block_bg.png prison-whack/images/jianyu_bg.jpg; do
  ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$ROOT/$f" | xargs echo "$f:"
done
