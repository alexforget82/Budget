#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null 2>&1 || ! node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'; then
  echo "Mon Budget nécessite Node.js 22.13 ou plus (Node.js 24 recommandé)."
  echo "Installez Node.js depuis https://nodejs.org puis relancez ce fichier."
  read -r -p "Appuyez sur Entrée pour fermer."
  exit 1
fi
if curl --silent --fail http://127.0.0.1:3030/api/state | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const x=JSON.parse(s);process.exit(x.version==="5.0.0"?0:1)}catch{process.exit(1)}})'; then
  echo "Mon Budget est déjà ouvert. Vérifiez que cette instance utilise le dossier voulu."
  open http://127.0.0.1:3030
  exit 0
fi
node server.js &
BUDGET_SERVER_PID=$!
trap 'kill "$BUDGET_SERVER_PID" 2>/dev/null || true' EXIT
for attempt in {1..50}; do
  if ! kill -0 "$BUDGET_SERVER_PID" 2>/dev/null; then
    echo "Démarrage impossible. Vérifiez qu’aucune autre version n’occupe le port 3030."
    read -r -p "Appuyez sur Entrée pour fermer."
    exit 1
  fi
  if curl --silent --fail http://127.0.0.1:3030/api/state >/dev/null; then
    open http://127.0.0.1:3030
    echo "Mon Budget est ouvert. Gardez cette fenêtre ouverte; Control + C arrête le serveur."
    wait "$BUDGET_SERVER_PID"
    exit 0
  fi
  sleep 0.2
done
echo "Le serveur ne répond pas. Consultez les messages ci-dessus."
exit 1
