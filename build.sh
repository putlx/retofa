#!/usr/bin/env bash
wasm-pack build --release --target=web
minify -o static/retofa.min.js pkg/retofa.js
cp pkg/retofa_bg.wasm static