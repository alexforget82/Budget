#!/bin/bash
cd -- "$(dirname -- "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1; then
 echo "Installez Node.js 22.13 ou plus avant de continuer."
else
 node mac-service.js install
fi
read -r -p "Appuyez sur Entrée; vous pouvez ensuite fermer cette fenêtre."
