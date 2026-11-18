#!/bin/bash
# P2 art: 5 title/background images for 4 games. All square 768x768 (free tier lock), cover-crop later.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/station-upgrade/gen"
mkdir -p "$GEN"
PL="https://image.pollinations.ai/prompt"
S="no%20text%2C%20no%20letters%2C%20no%20words%2C%20no%20watermark%2C%20clean%20composition"

declare -A JOBS=(
  [menu_sea]="underwater%20treasure%20scene%3A%20coral%20reef%2C%20open%20treasure%20chest%20with%20gold%20coins%2C%20sun%20rays%20through%20blue%20water%2C%20bubbles%2C%20colorful%20fish%2C%20casual%20mobile%20game%20menu%20background%2C%20cartoon%20flat%20illustration%2C%20bright%2C%20$S&width=768&height=768&seed=71"
  [cover_mummy]="pyramid%20maze%20adventure%3A%20ancient%20egypt%20tomb%20corridor%20with%20glowing%20torch%2C%20golden%20treasure%20piles%2C%20hieroglyph%20walls%2C%20mysterious%20dark%20depths%2C%20cartoon%20flat%20illustration%2C%20warm%20torchlight%2C%20$S&width=768&height=768&seed=72"
  [splash_gunner]="retro%20space%20shooter%20title%20background%3A%20deep%20space%20nebula%2C%20stars%2C%20alien%20invader%20fleet%20silhouettes%20in%20formation%2C%20planet%20horizon%2C%20arcade%20style%2C%20vibrant%20colors%2C%20$S&width=768&height=768&seed=73"
  [blockbg_prison]="prison%20yard%20background%3A%20high%20concrete%20walls%20with%20barbed%20wire%2C%20watchtower%2C%20chain%20link%20fence%2C%20blue%20sky%2C%20casual%20cartoon%20game%20art%2C%20slightly%20plain%20for%20gameplay%20readability%2C%20$S&width=768&height=768&seed=74"
  [cellbg_prison]="cozy%20prison%20cell%20interior%3A%20moonlight%20through%20barred%20window%2C%20wooden%20bunk%2C%20stone%20walls%2C%20warm%20lantern%2C%20casual%20cartoon%20game%20art%2C%20slightly%20plain%2C%20$S&width=768&height=768&seed=75"
)

cd "$GEN" || exit 1
for k in menu_sea cover_mummy splash_gunner blockbg_prison cellbg_prison; do
  f="$k.jpg"
  if [ -f "$f" ] && file "$f" | grep -q JPEG; then echo "SKIP $k"; continue; fi
  ok=0
  for t in 1 2 3 4; do
    if curl -s --fail -m 150 -o "$f" "$PL/${JOBS[$k]}"; then
      if file "$f" | grep -q JPEG; then echo "OK   $k"; ok=1; break; fi
    fi
    echo "retry $k ($t)"; sleep 10
  done
  [ $ok -eq 0 ] && echo "GIVEUP $k"
  sleep 2
done
