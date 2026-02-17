"""
利用可能なGeminiモデルを確認するスクリプト
"""
import google.generativeai as genai

# APIキー
api_key_str = "AIzaSyCGNv9ywUDI8eMpNvfI1jHUwJ8BsghxwQE"

# 設定
genai.configure(api_key=api_key_str)

print("=" * 60)
print("利用可能なGeminiモデル一覧")
print("=" * 60)

try:
    for model_obj in genai.list_models():
        if 'generateContent' in model_obj.supported_generation_methods:
            print(f"\n✅ モデル名: {model_obj.name}")
            print(f"   表示名: {model_obj.display_name}")
            print(f"   説明: {model_obj.description}")
except Exception as error_obj:
    print(f"❌ エラー: {error_obj}")

print("\n" + "=" * 60)