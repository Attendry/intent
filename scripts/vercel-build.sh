#!/bin/sh
set -e
echo "=== Vercel build starting ==="
npm install
npm run build
echo "=== Vercel build complete ==="
