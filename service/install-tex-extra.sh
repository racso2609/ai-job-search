#!/bin/sh
# Extract only fontawesome5 + academicons from the huge texlive-fonts-extra .deb.
#
# Both packages live in texlive-fonts-extra (1.7 GB installed, ~624 MB .deb) but
# the CV/cover templates only need these two icon fonts. Installing the whole
# package wastes >1.5 GB. Each package is spread over several kpathsea trees
# (tex/latex or tex/generic, plus fonts/{type1,tfm,opentype,map,enc}); academicons
# in particular keeps its .otf/.ttf under fonts/opentype and fonts/truetype and
# its .sty under tex/generic, so a naive copy of tex/latex misses the font and
# lualatex/xelatex fail with "academicons.ttf not loadable".
#
# We stream the .deb data tarball through tar and extract only members whose path
# contains /fontawesome5/ or /academicons/. This never unpacks the full 2.6 GB
# tree, so it cannot run out of disk mid-extract.
set -eu

cd /tmp
apt-get update
apt-get download texlive-fonts-extra

deb="$(ls texlive-fonts-extra_*.deb)"
dpkg-deb --fsys-tarfile "$deb" \
  | tar -x -C / --wildcards --no-anchored "*/fontawesome5/*" "*/academicons/*"

rm -f "$deb"
rm -rf /var/lib/apt/lists/*

texhash || mktexlsr

# Fail the build if either package — or its font — is not resolvable. kpsewhich
# returns 0 even when some arguments are missing, so check each path on its own.
# Note: Debian trixie ships academicons v1.9.1, which only provides the .ttf
# (loaded via \usefont{TU}{academicons}); the .otf only exists in newer
# TeX Live (>= 2025). Do not require the .otf here or the build fails on trixie.
for f in fontawesome5.sty academicons.sty academicons.ttf \
         FontAwesome5Free-Solid-900.otf; do
  kpsewhich "$f" | grep -q . || { echo "MISSING TeX file: $f" >&2; exit 1; }
done
