"""The engine's side of the parity check: every package of the cases file,
validated by BalatroEngine (balatro.mods.spec.validate), as JSON lines.

    uv run --project ../BalatroEngine python scripts/parity/engine.py cases.json out.json
"""

import json
import sys

from balatro.mods.spec import validate

cases = json.load(open(sys.argv[1], encoding="utf-8"))
out = []
for pkg in cases:
    try:
        out.append(validate(pkg))
    except Exception as e:  # (an engine crash: reported, not compared)
        out.append({"crash": f"{type(e).__name__}: {e}"})
json.dump(out, open(sys.argv[2], "w", encoding="utf-8"), ensure_ascii=False)
