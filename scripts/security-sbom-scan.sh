#!/usr/bin/env bash
set -euo pipefail

OUT_DIR="${OUT_DIR:-.artifacts/security}"
mkdir -p "$OUT_DIR"

if command -v trivy >/dev/null 2>&1; then
  trivy fs --format cyclonedx --output "$OUT_DIR/trivy-sbom.cdx.json" .
  trivy fs --severity HIGH,CRITICAL --exit-code 1 .
elif command -v syft >/dev/null 2>&1 && command -v grype >/dev/null 2>&1; then
  syft dir:. -o cyclonedx-json="$OUT_DIR/syft-sbom.cdx.json"
  grype sbom:"$OUT_DIR/syft-sbom.cdx.json" --fail-on high
else
  echo "Install trivy, or syft+grype, then rerun this script. No secrets are required." >&2
  exit 2
fi
