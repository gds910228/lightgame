#!/bin/bash
# Post-process generated art into exact game asset dimensions.
# Sources are 768x768 with a bottom-right watermark; strategies per target:
#   portrait (768x1024): crop watermark rows, stretch top/bottom edge strips to extend, slight blur on extensions
#   strips (768x200):    crop a clean horizontal band
#   layers (768x824):    zoom into clean texture region, extend bottom
GEN="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/gen"
OUT="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/proc"
FONT="C\:/Windows/Fonts/msyhbd.ttc"
mkdir -p "$OUT"

# --- title t.jpg (768x1024) from t2b: remove red blob top-left, crop watermark, extend, draw logo ---
ffmpeg -y -v error -i "$GEN/t2b.jpg" -filter_complex "
[0:v]delogo=x=2:y=2:w=155:h=88[dm];
[dm]crop=768:720:0:0,split=3[c1][c2][c3];
[c1]crop=768:110:0:0,scale=768:256,gblur=sigma=5[top];
[c3]crop=768:60:0:660,scale=768:48,gblur=sigma=5[bot];
[top][c2][bot]vstack=inputs=3,
drawtext=fontfile='$FONT':textfile='D\:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/scripts/title.txt':fontsize=120:fontcolor=0xFFD34A:borderw=8:bordercolor=0x5B3A10:shadowx=0:shadowy=7:shadowcolor=black@0.4:x=(w-text_w)/2:y=42
" -frames:v 1 -q:v 3 "$OUT/t.jpg" && echo "OK t.jpg"

# --- splash dse.jpg (768x1024) from dse1 ---
ffmpeg -y -v error -i "$GEN/dse1.jpg" -filter_complex "
[0:v]crop=768:720:0:0,split=3[c1][c2][c3];
[c1]crop=768:110:0:0,scale=768:256,gblur=sigma=5[top];
[c3]crop=768:60:0:660,scale=768:48,gblur=sigma=5[bot];
[top][c2][bot]vstack=inputs=3" -frames:v 1 -q:v 3 "$OUT/dse.jpg" && echo "OK dse.jpg"

# --- above-ground strips (768x200) ---
ffmpeg -y -v error -i "$GEN/l1a.jpg"  -vf "crop=768:200:0:20"  -q:v 3 "$OUT/l1a.jpg" && echo "OK l1a.jpg"
ffmpeg -y -v error -i "$GEN/l2a2.jpg" -vf "crop=768:200:0:230" -q:v 3 "$OUT/l2a.jpg" && echo "OK l2a.jpg"
ffmpeg -y -v error -i "$GEN/l3a.jpg"  -vf "crop=768:200:0:280" -q:v 3 "$OUT/l3a.jpg" && echo "OK l3a.jpg"

# --- underground layers (768x824): zoom into clean texture, extend bottom ---
ffmpeg -y -v error -i "$GEN/b1.jpg" -filter_complex "
[0:v]eq=brightness=0.05:saturation=1.05,scale=1250:1250[c];
[c]crop=768:760:180:80,split=2[d1][d2];
[d2]crop=768:50:0:710,scale=768:64,gblur=sigma=4[ext];
[d1][ext]vstack=inputs=2" -frames:v 1 -q:v 3 "$OUT/l1b.jpg" && echo "OK l1b.jpg"

# --- mobile zz_ halves ---
for f in t l1a l2a l3a l1b; do
  case $f in
    t)   H=512;; l1a|l2a|l3a) H=100;; l1b) H=412;;
  esac
  ffmpeg -y -v error -i "$OUT/$f.jpg" -vf "scale=384:$H:flags=lanczos" -q:v 5 "$OUT/zz_$f.jpg" && echo "OK zz_$f.jpg"
done
echo "=== done ==="
ls -la "$OUT"
