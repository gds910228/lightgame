#!/bin/bash
# Round 2: brighter title, better desert strip, full-frame soil textures for underground layers.
GEN="D:/WorkProjects/AI/Lightgame/.scratch/gm-pilot/gen"
PL="https://image.pollinations.ai/prompt"
STYLE="cartoon%20flat%20illustration%2C%20casual%20mobile%20game%20art%2C%20clean%20composition%2C%20no%20text%2C%20no%20letters%2C%20no%20characters%2C%20no%20people%2C%20no%20watermark"
TEXNEG="no%20objects%2C%20no%20items%2C%20no%20borders%2C%20no%20frames%2C%20no%20vignette%2C%20no%20cube%2C%20no%20isometric%2C%20no%20text%2C%20no%20watermark"

declare -A JOBS=(
  [t2b]="bright%20cheerful%20cartoon%20game%20poster%3A%20sunny%20gold%20mining%20valley%2C%20bright%20blue%20sky%20with%20fluffy%20white%20clouds%2C%20wooden%20mining%20headframe%20tower%20with%20rope%20and%20hook%2C%20piles%20of%20shiny%20gold%20nuggets%20and%20a%20treasure%20chest%2C%20green%20hills%2C%20vibrant%20saturated%20colors%2C%20warm%20daylight%2C%20simple%20shapes%3B%20$STYLE&width=768&height=768&seed=33"
  [l2a2]="wide%20landscape%20band%3A%20desert%20gold%20mine%20in%20bright%20daylight%2C%20wooden%20mining%20tower%2C%20cactus%2C%20sand%20dunes%2C%20blue%20sky%20with%20clouds%2C%20simple%20flat%20cartoon%2C%20bright%20saturated%20colors%3B%20$STYLE&width=768&height=768&seed=68"
  [b1]="full-frame%20seamless%20texture%20of%20layered%20brown%20soil%20wall%2C%20cross%20section%20of%20earth%20strata%20with%20thin%20darker%20bands%20and%20small%20embedded%20pebbles%2C%20even%20flat%20lighting%2C%20texture%20fills%20the%20entire%20frame%20edge%20to%20edge%2C%20subtle%2C%20low%20contrast%3B%20$TEXNEG&width=768&height=768&seed=101"
  [b2]="full-frame%20seamless%20texture%20of%20dry%20sandy%20strata%2C%20banded%20tan%20and%20ochre%20sandstone%20wall%2C%20fine%20grain%2C%20even%20flat%20lighting%2C%20texture%20fills%20the%20entire%20frame%20edge%20to%20edge%2C%20subtle%2C%20low%20contrast%3B%20$TEXNEG&width=768&height=768&seed=102"
  [b3]="full-frame%20seamless%20texture%20of%20frozen%20ground%20strata%2C%20grey%20blue%20permafrost%20layers%20with%20frost%20cracks%20and%20small%20stones%2C%20even%20flat%20lighting%2C%20texture%20fills%20the%20entire%20frame%20edge%20to%20edge%2C%20subtle%2C%20low%20contrast%3B%20$TEXNEG&width=768&height=768&seed=103"
)

cd "$GEN" || exit 1
for k in t2b l2a2 b1 b2 b3; do
  f="$k.jpg"
  if [ -f "$f" ] && file "$f" | grep -q JPEG; then echo "SKIP $k"; continue; fi
  ok=0
  for try in 1 2 3 4; do
    if curl -s --fail -m 150 -o "$f" "$PL/${JOBS[$k]}"; then
      if file "$f" | grep -q JPEG; then echo "OK   $k (try $try)"; ok=1; break; fi
    fi
    echo "retry $k ($try)"; sleep 10
  done
  [ $ok -eq 0 ] && echo "GIVEUP $k"
  sleep 2
done
echo "=== results ==="
for k in t2b l2a2 b1 b2 b3; do
  file "$k.jpg" 2>/dev/null | grep -q JPEG && echo "$k.jpg valid $(stat -c%s "$k.jpg")B" || echo "$k.jpg MISSING"
done
