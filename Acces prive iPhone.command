#!/bin/bash
set -e
cd -- "$(dirname -- "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fail(){ echo "$1"; read -r -p "Appuyez sur Entrée pour fermer."; exit 1; }
command -v node >/dev/null 2>&1 || fail "Installez Node.js 22.13 ou plus avant de continuer."
node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)' || fail "Node.js 22.13 ou plus est requis."
BUDGET_TS_BIN="$(command -v tailscale || true)"
if [ -z "$BUDGET_TS_BIN" ] && [ -x /Applications/Tailscale.app/Contents/MacOS/Tailscale ]; then BUDGET_TS_BIN=/Applications/Tailscale.app/Contents/MacOS/Tailscale; fi
[ -n "$BUDGET_TS_BIN" ] || fail "Installez Tailscale sur ce Mac, connectez-vous, puis relancez ce fichier. Voir ACCES-IPHONE.md."
BUDGET_TS_STATUS="$("$BUDGET_TS_BIN" status --json)" || fail "Ouvrez Tailscale et connectez-vous à votre compte personnel."
# Read the identity from the locally authenticated Tailscale client, never from chat.
BUDGET_PRIVATE_ORIGIN="$(printf '%s' "$BUDGET_TS_STATUS" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const x=JSON.parse(s);if(x.BackendState!=="Running"||!x.Self?.DNSName)process.exit(1);process.stdout.write("https://"+x.Self.DNSName.replace(/\.$/,""));})')" || fail "Tailscale doit être connecté et MagicDNS activé."
BUDGET_OWNER_LOGIN="$(printf '%s' "$BUDGET_TS_STATUS" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const x=JSON.parse(s),u=x.User?.[String(x.Self?.UserID)];if(!u?.LoginName)process.exit(1);process.stdout.write(u.LoginName);})')" || fail "Impossible de déterminer le compte propriétaire dans Tailscale."
# Refuse to replace another existing Tailscale service or a public Funnel.
BUDGET_SERVE_STATUS="$("$BUDGET_TS_BIN" serve status --json)" || fail "Impossible de vérifier la configuration Tailscale Serve."
printf '%s' "$BUDGET_SERVE_STATUS" | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const x=JSON.parse(s);if(!x)process.exit(0);if(Object.values(x.AllowFunnel||{}).some(Boolean))process.exit(1);const web=Object.values(x.Web||{});if(web.length||Object.keys(x.TCP||{}).length){if(web.length!==1||Object.keys(web[0].Handlers||{}).join()!=="/"||web[0].Handlers["/"].Proxy!=="http://127.0.0.1:3031")process.exit(1);}})' || fail "Un autre service Tailscale ou un Funnel est configuré. Rien n’a été remplacé. Consultez ACCES-IPHONE.md."
BUDGET_PRIVATE_ORIGIN="$BUDGET_PRIVATE_ORIGIN" BUDGET_OWNER_LOGIN="$BUDGET_OWNER_LOGIN" node -e 'const fs=require("fs");fs.mkdirSync("data",{recursive:true,mode:0o700});const file="data/private-access.json",config={origin:process.env.BUDGET_PRIVATE_ORIGIN,login:process.env.BUDGET_OWNER_LOGIN,port:3031};if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file,"utf8"));if(JSON.stringify(old)!==JSON.stringify(config))throw Error("Une autre configuration privée existe; elle n’a pas été remplacée.");}else fs.writeFileSync(file,JSON.stringify(config,null,2),{mode:0o600,flag:"wx"});' || fail "Impossible de préparer la configuration privée. Les données du budget n’ont pas été modifiées."
# Installation of the background service prepares identity/Serve without owning a server.
if [ "${1:-}" = "--prepare-service" ]; then
 "$BUDGET_TS_BIN" serve --bg --https=443 http://127.0.0.1:3031 || fail "Activez Tailscale Serve avec le lien affiché, puis relancez l’installation."
 exit 0
fi
BUDGET_DATA_KEY="$(node -e 'process.stdout.write(require("crypto").createHash("sha256").update(require("path").resolve("data")).digest("hex"))')"
BUDGET_SERVER_PID=""
cleanup(){ if [ -n "$BUDGET_SERVER_PID" ]; then kill "$BUDGET_SERVER_PID" 2>/dev/null || true; fi; }
trap cleanup EXIT
if curl --silent --fail http://127.0.0.1:3030/api/private/status | BUDGET_DATA_KEY="$BUDGET_DATA_KEY" node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const x=JSON.parse(s);process.exit(x.version==="11.5.1"&&x.enabled&&x.port===3031&&x.data_key===process.env.BUDGET_DATA_KEY?0:1)}catch{process.exit(1)}})'; then
 echo "Mon Budget est déjà ouvert avec l’accès privé."
else
 if curl --silent --fail http://127.0.0.1:3030/api/state >/dev/null; then fail "Arrêtez l’ancienne fenêtre Mon Budget avec Control + C, puis relancez ce fichier."; fi
 node server.js &
 BUDGET_SERVER_PID=$!
fi
BUDGET_READY=false
for attempt in {1..50}; do
 if [ -n "$BUDGET_SERVER_PID" ] && ! kill -0 "$BUDGET_SERVER_PID" 2>/dev/null; then fail "Le serveur n’a pas pu démarrer. Consultez les messages ci-dessus."; fi
 if curl --silent --fail -H "Tailscale-User-Login: $BUDGET_OWNER_LOGIN" http://127.0.0.1:3031/api/private/status | BUDGET_PRIVATE_ORIGIN="$BUDGET_PRIVATE_ORIGIN" BUDGET_DATA_KEY="$BUDGET_DATA_KEY" node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{try{const x=JSON.parse(s);process.exit(x.version==="11.5.1"&&x.enabled&&x.origin===process.env.BUDGET_PRIVATE_ORIGIN&&x.data_key===process.env.BUDGET_DATA_KEY?0:1)}catch{process.exit(1)}})'; then BUDGET_READY=true; break; fi
 sleep 0.2
done
[ "$BUDGET_READY" = true ] || fail "L’accès privé n’est pas prêt. Vérifiez que le bon dossier de Mon Budget est ouvert."
"$BUDGET_TS_BIN" serve --bg --https=443 http://127.0.0.1:3031 || fail "Tailscale Serve doit être autorisé. Suivez son lien d’activation HTTPS, puis relancez ce fichier."
echo "Sur votre iPhone, connectez Tailscale au même compte puis ouvrez :"
echo "$BUDGET_PRIVATE_ORIGIN"
echo "Gardez ce Mac allumé, connecté et son couvercle ouvert. Il peut être verrouillé."
open "$BUDGET_PRIVATE_ORIGIN"
if [ -n "$BUDGET_SERVER_PID" ]; then
 echo "Gardez cette fenêtre ouverte. Control + C arrête le budget."
 if command -v caffeinate >/dev/null 2>&1; then caffeinate -i -w "$BUDGET_SERVER_PID" & fi
 wait "$BUDGET_SERVER_PID"
else
 echo "Gardez la fenêtre du serveur déjà ouvert."
 read -r -p "Appuyez sur Entrée pour fermer cette fenêtre."
fi
