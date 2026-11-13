#!/usr/bin/env bash
# Mise à jour sûre vers 2.4.0 de l’installation qui tourne sur le port 3045.
# Les données restent dans ~/.local/share/le-bas-de-laine-nouveau/data.
set -u

SOURCE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
ROOT="$HOME/.local/share/le-bas-de-laine-nouveau"
APP="$ROOT/app"
DATA="$ROOT/data"
UNIT="le-bas-de-laine-nouveau.service"
WANTED="2.4.0"
NODE="$(command -v node 2>/dev/null || true)"

if [ -z "$NODE" ] || [ ! -f "$SOURCE/app/server.js" ] || [ ! -f "$SOURCE/app/VERSION" ]; then
  echo "Archive de mise à jour incomplète. Aucune modification effectuée."
  exit 1
fi
if [ "$(tr -d '[:space:]' < "$SOURCE/app/VERSION")" != "$WANTED" ]; then
  echo "Cette archive n’est pas la version $WANTED. Aucune modification effectuée."
  exit 1
fi
if [ ! -f "$APP/server.js" ] || [ ! -d "$DATA" ]; then
  echo "Installation 3045 introuvable dans $ROOT. Aucune modification effectuée."
  exit 1
fi

STAMP="$(date +%Y-%m-%d-%H%M%S)"
BACKUP="$ROOT/sauvegardes-mise-a-jour/$STAMP"
NEXT="$ROOT/app.next-$STAMP"
mkdir -p "$BACKUP"

if ! systemctl --user stop "$UNIT"; then
  echo "Impossible d’arrêter $UNIT. Aucune modification effectuée."
  exit 1
fi

if ! cp -a "$DATA" "$BACKUP/data-avant"; then
  echo "La copie de sécurité des données a échoué. Redémarrage de l’ancienne version."
  systemctl --user start "$UNIT" || true
  exit 1
fi

if ! cp -a "$SOURCE/app" "$NEXT" || ! "$NODE" --check "$NEXT/server.js" || ! "$NODE" --check "$NEXT/public/app.js"; then
  echo "La nouvelle version est invalide. Redémarrage de l’ancienne version."
  rm -rf "$NEXT"
  systemctl --user start "$UNIT" || true
  exit 1
fi

mv "$APP" "$BACKUP/app-avant"
mv "$NEXT" "$APP"

if ! systemctl --user start "$UNIT"; then
  echo "Le démarrage a échoué. Retour automatique à la version précédente."
  rm -rf "$APP" "$DATA"
  mv "$BACKUP/app-avant" "$APP"
  cp -a "$BACKUP/data-avant" "$DATA"
  systemctl --user start "$UNIT" || true
  exit 1
fi

READY=""
for TRY in $(seq 1 40); do
  READY="$("$NODE" -e "fetch('http://127.0.0.1:3045/api/state').then(r=>r.json()).then(s=>process.stdout.write(s.version||''))" 2>/dev/null || true)"
  [ "$READY" = "$WANTED" ] && break
  sleep 0.25
done

if [ "$READY" != "$WANTED" ]; then
  echo "La version $WANTED ne répond pas correctement. Retour automatique à la version précédente."
  systemctl --user stop "$UNIT" || true
  rm -rf "$APP" "$DATA"
  mv "$BACKUP/app-avant" "$APP"
  cp -a "$BACKUP/data-avant" "$DATA"
  systemctl --user start "$UNIT" || true
  exit 1
fi

echo "Le Bas de Laine $WANTED est installé sur http://localhost:3045"
echo "Copie complète avant mise à jour : $BACKUP"
echo "Actualisez la page sur le Chromebook et fermez/réouvrez l’app sur iPhone."
