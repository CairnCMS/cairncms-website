#!/usr/bin/env bash
set -euo pipefail

if [ -z "${DOCS_REPO:-}" ]; then
	echo "Error: DOCS_REPO env var must be set to the cairncms monorepo path." >&2
	echo "Example: DOCS_REPO=/path/to/cairncms ./scripts/sync-docs.sh" >&2
	exit 1
fi

if [ ! -d "$DOCS_REPO/docs" ]; then
	echo "Error: $DOCS_REPO/docs not found." >&2
	exit 1
fi

mkdir -p src/content/docs/docs
find src/content/docs/docs -mindepth 1 -not -name '.gitignore' -delete
cp -a "$DOCS_REPO/docs/." src/content/docs/docs/
echo "Synced docs from $DOCS_REPO/docs to src/content/docs/docs/"
