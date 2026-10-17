#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node mac-service.js stop
read -r -p "Appuyez sur Entrée pour fermer."
