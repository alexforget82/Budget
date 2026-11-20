#!/usr/bin/env bash
# Le Bas de Laine v9 — installation Linux / Chromebook
# Cette installation est indépendante : elle ne modifie pas les anciennes
# versions de Le Bas de Laine ni leurs données.
set -euo pipefail

SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_SOURCE="$SOURCE_DIR/app"
INSTALL_ROOT="$HOME/.local/share/le-bas-de-laine-v9"
APP_DEST="$INSTALL_ROOT/app"
DATA_DEST="$INSTALL_ROOT/data"
BACKUP_DEST="$INSTALL_ROOT/backups"
UNIT_NAME="le-bas-de-laine-v9.service"
UNIT_FILE="$HOME/.config/systemd/user/$UNIT_NAME"
DESKTOP_FILE="$HOME/.local/share/applications/le-bas-de-laine-v9.desktop"
NODE_BIN="$(command -v node || true)"
PORT="3050"

if [ ! -f "$APP_SOURCE/server.js" ] || [ ! -f "$APP_SOURCE/VERSION" ]; then
  echo "Installation incomplète : le dossier app est introuvable."
  exit 1
fi
if [ -z "$NODE_BIN" ]; then
  echo "Node.js est requis. Installez Node.js 22 ou plus, puis relancez ce fichier."
  exit 1
fi

NODE_MAJOR="$($NODE_BIN -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Node.js 22 ou plus est requis (version détectée : $NODE_MAJOR)."
  exit 1
fi

STAMP="$(date +%Y-%m-%d-%H%M%S)"
mkdir -p "$INSTALL_ROOT" "$DATA_DEST" "$BACKUP_DEST" "$HOME/.config/systemd/user" "$HOME/.local/share/applications"

if [ -d "$APP_DEST" ]; then
  cp -a "$APP_DEST" "$BACKUP_DEST/app-$STAMP"
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cp -a "$APP_SOURCE" "$WORK/app"
"$NODE_BIN" --check "$WORK/app/server.js"
"$NODE_BIN" --check "$WORK/app/public/app.js"
"$NODE_BIN" --check "$WORK/app/public/simple.js"
(cd "$WORK/app" && "$NODE_BIN" --test test/*.test.js >/dev/null)

rm -rf "$APP_DEST"
mv "$WORK/app" "$APP_DEST"

cat > "$UNIT_FILE" <<EOF
[Unit]
Description=Le Bas de Laine v9
After=network.target

[Service]
Type=simple
WorkingDirectory=$APP_DEST
Environment=PORT=$PORT
Environment=BDL9_DATA=$DATA_DEST
ExecStart=$NODE_BIN $APP_DEST/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

cat > "$DESKTOP_FILE" <<EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Le Bas de Laine v9
Comment=Budget familial simple
Exec=xdg-open http://localhost:$PORT
Icon=$APP_DEST/public/logo.svg
Terminal=false
Categories=Office;Finance;
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$UNIT_NAME"

if ! systemctl --user is-active --quiet "$UNIT_NAME"; then
  echo "Le service n’a pas démarré. Dernières lignes :"
  journalctl --user -u "$UNIT_NAME" -n 20 --no-pager || true
  exit 1
fi

TAIL_IP=""
if command -v tailscale >/dev/null 2>&1; then
  TAIL_IP="$(tailscale ip -4 2>/dev/null | head -n 1 || true)"
fi

echo
echo "Le Bas de Laine v9 est prêt."
echo "Cet ordinateur : http://localhost:$PORT"
if [ -n "$TAIL_IP" ]; then
  echo "iPhone sur Tailscale : http://$TAIL_IP:$PORT"
  echo "Vue simplifiée : http://$TAIL_IP:$PORT/simple"
fi
echo "Données séparées : $DATA_DEST"
echo "Les anciennes versions et leurs données sont intactes."
