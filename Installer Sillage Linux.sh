#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
exec node linux-install.js "$@"
