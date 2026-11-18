#!/bin/bash
# Final layer builds: wood(l1b), procedural sand ripples(l2b), frost(l3b). Crop y<720 (watermark), blur-fill bottom to 824.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/gen"
PROC="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/proc"

build() { # $1=srcjpg $2=outname $3=preproc-or-PROCEDURAL
  if [ "$3" = "PROCEDURAL" ]; then
    ffmpeg -y -v error -f lavfi -i "nullsrc=s=768x720" -vf "
      geq=lum='172+15*sin(X/48+Y/18)+7*sin(Y/9)+6*random(1)':cb='100-10*sin(X/48+Y/18)':cr='152+12*sin(X/48+Y/18)',format=yuv420p,
      split=2[c1][c2];[c2]scale=768:104,gblur=sigma=18[fill];[c1][fill]vstack=inputs=2" -frames:v 1 -q:v 3 "$PROC/$2" && echo "OK $2 (procedural)"
  else
    ffmpeg -y -v error -i "$1" -filter_complex "
    [0:v]$3crop=768:720:0:0,split=2[c1][c2];
    [c2]scale=768:104,gblur=sigma=18[fill];
    [c1][fill]vstack=inputs=2" -frames:v 1 -q:v 3 "$PROC/$2" && echo "OK $2"
  fi
}

build "$GEN/wood.jpg" "l1b.jpg" "eq=saturation=1.05:brightness=0.02,"
build ""               "l2b.jpg" "PROCEDURAL"
build "$GEN/b3.jpg"    "l3b.jpg" "null,"

for f in l1b l2b l3b; do
  ffmpeg -y -v error -i "$PROC/$f.jpg" -vf "scale=384:412:flags=lanczos" -q:v 5 "$PROC/zz_$f.jpg" && echo "OK zz_$f.jpg"
done
ffmpeg -y -v error -i "$PROC/l1b.jpg" -i "$PROC/l2b.jpg" -i "$PROC/l3b.jpg" -filter_complex "[0]scale=260:-1[a];[1]scale=260:-1[b];[2]scale=260:-1[c];[a][b][c]hstack=3" "$PROC/chk_layers2.jpg"
echo done
