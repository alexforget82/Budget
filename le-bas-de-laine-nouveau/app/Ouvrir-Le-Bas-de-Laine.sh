#!/usr/bin/env bash
set -euo pipefail
systemctl --user start le-bas-de-laine-nouveau.service
xdg-open http://localhost:3045 2>/dev/null || true
