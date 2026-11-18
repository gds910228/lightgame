#!/bin/bash
# Build l*b.jpg (768x824) from flat textures: top-crop away watermark row, blur-fill bottom.
# l1b = b2 recolored brown, l2b = b2 as-is, l3b = b3 frost.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/gen"
PROC="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/proc"

layer() { # $1=src $2=out $3=extra-preproc
  ffmpeg -y -v error -i "$1" -filter_complex "
  [0:v]$3crop=768:760:0:0,split=2[c1][c2];
  [c2]scale=768:64,gblur=sigma=18[fill];
  [c1][fill]vstack=inputs=2" -frames:v 1 -q:v 3 "$2" && echo "OK $2"
}

layer "$GEN/b2.jpg" "$PROC/l1b.jpg" "eq=brightness=-0.09:saturation=1.28,hue=h=355,"
layer "$GEN/b2.jpg" "$PROC/l2b.jpg" "null,"
layer "$GEN/b3.jpg" "$PROC/l3b.jpg" "null,"

for f in l1b l2b l3b; do
  ffmpeg -y -v error -i "$PROC/$f.jpg" -vf "scale=384:412:flags=lanczos" -q:v 5 "$PROC/zz_$f.jpg" && echo "OK zz_$f.jpg"
done
# review montage
ffmpeg -y -v error -i "$PROC/l1b.jpg" -i "$PROC/l2b.jpg" -i "$PROC/l3b.jpg" -filter_complex "[0]scale=260:-1[a];[1]scale=260:-1[b];[2]scale=260:-1[c];[a][b][c]hstack=3" "$PROC/chk_layers.jpg"
echo done
