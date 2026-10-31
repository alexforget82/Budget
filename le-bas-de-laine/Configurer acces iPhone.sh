#!/bin/sh
set -eu
cd -- "$(dirname -- "$0")"
exec node private-access.js
