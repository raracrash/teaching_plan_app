#!/bin/bash
# Renderのビルドスクリプト

echo "=== Pythonパッケージのインストール ==="
pip install -r backend/requirements.txt

echo "=== Node.jsパッケージのインストール ==="
npm install

echo "=== ビルド完了 ==="
