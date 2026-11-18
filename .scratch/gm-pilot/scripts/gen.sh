#!/bin/bash
# Sequential generation with retries — Pollinations rate-limits parallel bursts.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/gen"
PL="https://image.pollinations.ai/prompt"
COMMON="cartoon%20flat%20illustration%2C%20casual%20mobile%20game%20art%2C%20warm%20colorful%20palette%2C%20clean%20composition%2C%20no%20text%2C%20no%20letters%2C%20no%20characters%2C%20no%20people%2C%20no%20watermark"

declare -A JOBS=(
  [t1]="vertical%20title%20screen%20background%20for%20a%20gold%20miner%20game%3A%20golden%20sunset%20valley%2C%20wooden%20mining%20headframe%20tower%20with%20hanging%20rope%20and%20hook%2C%20piles%20of%20glowing%20gold%20nuggets%2C%20distant%20mountains%2C%20big%20soft%20clouds%2C%20empty%20sky%20space%20in%20upper%20half%3B%20$COMMON&width=960&height=1280&seed=11"
  [t2]="vertical%20title%20screen%20background%20for%20a%20gold%20miner%20game%3A%20open-pit%20gold%20mine%20amphitheater%20at%20sunset%2C%20wooden%20crane%20with%20hook%2C%20treasure%20chest%2C%20glowing%20gold%2C%20dramatic%20clouds%2C%20empty%20upper%20area%3B%20$COMMON&width=960&height=1280&seed=27"
  [dse1]="dark%20cozy%20underground%20mine%20tunnel%2C%20wooden%20support%20beams%2C%20hanging%20lanterns%2C%20gold%20veins%20glowing%20in%20rock%20walls%2C%20warm%20lantern%20light%20in%20the%20dark%3B%20$COMMON&width=960&height=1280&seed=41"
  [dse2]="mine%20elevator%20shaft%20seen%20from%20inside%2C%20rope%20and%20hook%20silhouette%2C%20rays%20of%20light%20from%20above%2C%20gold%20sparkles%20in%20dark%20rock%3B%20$COMMON&width=960&height=1280&seed=53"
  [l1a]="wide%20panoramic%20strip%3A%20sunny%20grassland%20gold%20mine%20site%2C%20blue%20sky%2C%20wooden%20mining%20tower%20on%20the%20left%2C%20green%20grass%2C%20flat%20dirt%20ground%20at%20bottom%20edge%2C%20mostly%20empty%20center%3B%20$COMMON&width=960&height=250&seed=61"
  [l2a]="wide%20panoramic%20strip%3A%20desert%20gold%20mine%20at%20sunset%2C%20orange%20sky%2C%20cactus%2C%20sand%20dunes%2C%20wooden%20mining%20tower%20on%20the%20left%2C%20mostly%20empty%20center%3B%20$COMMON&width=960&height=250&seed=67"
  [l3a]="wide%20panoramic%20strip%3A%20snowy%20mountain%20mine%20at%20dusk%2C%20pale%20blue%20sky%2C%20snow%20ground%2C%20pine%20trees%2C%20wooden%20mining%20tower%20on%20the%20left%2C%20mostly%20empty%20center%3B%20$COMMON&width=960&height=250&seed=71"
  [l1b]="vertical%20underground%20soil%20cross-section%3A%20brown%20earth%20layers%2C%20small%20embedded%20stones%2C%20slightly%20darker%20toward%20bottom%2C%20very%20plain%20subtle%20texture%20for%20game%20readability%3B%20no%20objects%2C%20no%20gold%2C%20no%20items%3B%20$COMMON&width=960&height=1030&seed=81"
  [l2b]="vertical%20underground%20cross-section%3A%20dry%20sandy%20desert%20soil%20strata%2C%20warm%20tan%20and%20ochre%20layers%2C%20small%20stones%2C%20slightly%20darker%20toward%20bottom%2C%20very%20plain%20subtle%20texture%3B%20no%20objects%2C%20no%20gold%2C%20no%20items%3B%20$COMMON&width=960&height=1030&seed=87"
  [l3b]="vertical%20underground%20cross-section%3A%20frozen%20ground%20strata%2C%20cold%20blue-grey%20layers%20with%20frost%20patches%2C%20small%20stones%2C%20slightly%20darker%20toward%20bottom%2C%20very%20plain%20subtle%20texture%3B%20no%20objects%2C%20no%20gold%2C%20no%20items%3B%20$COMMON&width=960&height=1030&seed=93"
)

cd "$GEN" || exit 1
for k in t1 t2 dse1 dse2 l1a l2a l3a l1b l2b l3b; do
  f="$k.jpg"
  # skip valid existing (script is resumable)
  if [ -f "$f" ] && file "$f" | grep -q JPEG; then echo "SKIP $k (have)"; continue; fi
  ok=0
  for try in 1 2 3; do
    if curl -s --fail -m 150 -o "$f" "$PL/${JOBS[$k]}"; then
      if file "$f" | grep -q JPEG; then echo "OK   $k (try $try)"; ok=1; break; fi
    fi
    echo "retry $k (try $try failed)"; sleep 12
  done
  [ $ok -eq 0 ] && echo "GIVEUP $k"
  sleep 2
done
echo "=== results ==="
for f in t1 t2 dse1 dse2 l1a l2a l3a l1b l2b l3b; do
  file "$f.jpg" 2>/dev/null | grep -q JPEG && echo "$f.jpg valid $(stat -c%s "$f.jpg")B" || echo "$f.jpg MISSING/INVALID"
done
