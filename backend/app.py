"""
教員向け指導計画作成アプリ - バックエンド
"""
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from gemini_service import GeminiService
from database_manager import DatabaseManager
import os
import sys
import json
import subprocess
import tempfile

# frontendフォルダのパスを設定
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, '..', 'frontend')

app = Flask(__name__,
    static_folder=FRONTEND_DIR,
    static_url_path='')
CORS(app)

GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', 'AIzaSyCGNv9ywUDI8eMpNvfI1jHUwJ8BsghxwQE')
gemini_service_obj = GeminiService(GEMINI_API_KEY)
db_manager_obj = DatabaseManager()


@app.route('/')
def index():
    """フロントエンドのindex.htmlを配信"""
    return send_file(os.path.join(FRONTEND_DIR, 'index.html'))


@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ok", "message": "サーバーは正常に動作しています"})


@app.route('/api/generate_plan', methods=['POST'])
def generate_plan():
    try:
        data_dict = request.json
        required_fields_list = ['grade', 'subject', 'unit', 'hours']
        for field_str in required_fields_list:
            if field_str not in data_dict:
                return jsonify({"error": f"'{field_str}'が必要です"}), 400

        grade_str = data_dict['grade']
        subject_str = data_dict['subject']
        unit_str = data_dict['unit']
        hours_int = int(data_dict['hours'])
        teacher_str = data_dict.get('teacher', '')
        school_str = data_dict.get('school', '')
        date_str = data_dict.get('date', '')
        school_level_str = data_dict.get('school_level', 'elementary')
        should_save_bool = data_dict.get('save', False)

        result_dict = gemini_service_obj.generate_lesson_plan_json(
            grade_str, subject_str, unit_str, hours_int,
            teacher_str, school_str, date_str, school_level_str
        )

        if not result_dict["success"]:
            return jsonify({"error": result_dict["error"]}), 500

        plan_data_dict = result_dict["data"]
        # 入力情報を追記
        plan_data_dict["teacher"] = teacher_str
        plan_data_dict["school"] = school_str
        plan_data_dict["date"] = date_str

        response_dict = {"success": True, "plan": plan_data_dict}

        if should_save_bool:
            plan_id_int = db_manager_obj.save_plan(
                plan_type_str='unit',
                grade_str=grade_str,
                subject_str=subject_str,
                content_str=json.dumps(plan_data_dict, ensure_ascii=False),
                unit_str=unit_str,
                hours_int=hours_int
            )
            response_dict['saved'] = True
            response_dict['plan_id'] = plan_id_int

        return jsonify(response_dict)

    except ValueError:
        return jsonify({"error": "授業時数は数値で入力してください"}), 400
    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500


@app.route('/api/generate_monthly_plan', methods=['POST'])
def generate_monthly_plan():
    try:
        data_dict = request.json
        grade_str = data_dict.get('grade')
        subject_str = data_dict.get('subject')
        month_str = data_dict.get('month')
        school_level_str = data_dict.get('school_level', 'elementary')
        weekly_units_list = data_dict.get('weekly_units', [])
        should_save_bool = data_dict.get('save', False)

        if not all([grade_str, subject_str, month_str]):
            return jsonify({"error": "grade, subject, monthが必要です"}), 400

        result_dict = gemini_service_obj.generate_monthly_plan_json(
            grade_str, subject_str, month_str, school_level_str, weekly_units_list
        )

        if not result_dict["success"]:
            return jsonify({"error": result_dict["error"]}), 500

        plan_data_dict = result_dict["data"]
        response_dict = {"success": True, "plan": plan_data_dict}

        if should_save_bool:
            plan_id_int = db_manager_obj.save_plan(
                plan_type_str='monthly',
                grade_str=grade_str,
                subject_str=subject_str,
                content_str=json.dumps(plan_data_dict, ensure_ascii=False),
                month_str=month_str
            )
            response_dict['saved'] = True
            response_dict['plan_id'] = plan_id_int

        return jsonify(response_dict)

    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500


@app.route('/api/export_docx', methods=['POST'])
def export_docx():
    """指導案をWord形式で出力"""
    try:
        data_dict = request.json
        plan_data_dict = data_dict.get('plan')
        plan_type_str = data_dict.get('plan_type', 'unit')

        if not plan_data_dict:
            return jsonify({"error": "planデータが必要です"}), 400

        # JSONをファイルに保存
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json',
                                         delete=False, encoding='utf-8') as tmp_file:
            json.dump({"plan": plan_data_dict, "plan_type": plan_type_str},
                     tmp_file, ensure_ascii=False)
            json_path_str = tmp_file.name

        output_path_str = json_path_str.replace('.json', '.docx')

        # Node.jsでdocx生成
        script_path_str = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'generate_docx.js')

        # nodeコマンドのパスを解決（Windows / Linux / Render対応）
        import shutil, copy
        node_cmd_str = shutil.which('node')
        if not node_cmd_str:
            win_paths_list = [
                r'C:\Program Files\nodejs\node.exe',
                r'C:\Program Files (x86)\nodejs\node.exe',
                os.path.join(os.path.expandvars('%APPDATA%'), 'npm', 'node.exe'),
                os.path.join(os.path.expandvars('%ProgramFiles%'), 'nodejs', 'node.exe'),
            ]
            for path_str in win_paths_list:
                if os.path.exists(path_str):
                    node_cmd_str = path_str
                    break

        if not node_cmd_str:
            return jsonify({
                "error": "Node.jsが見つかりません。https://nodejs.org/ からインストールし、'npm install -g docx' を実行してください。"
            }), 500

        # NODE_PATHを設定（Windows / Render両方に対応）
        env_dict = copy.copy(os.environ)
        node_path_candidates = []

        # Windows: AppDataのnpmグローバルパス
        appdata_str = os.environ.get('APPDATA', '')
        if appdata_str:
            node_path_candidates.append(os.path.join(appdata_str, 'npm', 'node_modules'))

        # Linux / Render: プロジェクトルートのnode_modules
        project_root_str = os.path.join(BASE_DIR, '..')
        node_path_candidates.append(os.path.join(project_root_str, 'node_modules'))

        # 存在するパスだけを追加
        valid_paths_list = [p for p in node_path_candidates if os.path.exists(p)]
        existing_node_path_str = env_dict.get('NODE_PATH', '')
        all_paths_list = valid_paths_list + ([existing_node_path_str] if existing_node_path_str else [])
        if all_paths_list:
            env_dict['NODE_PATH'] = os.pathsep.join(all_paths_list)

        result_obj = subprocess.run(
            [node_cmd_str, script_path_str, json_path_str, output_path_str],
            capture_output=True, text=True, timeout=60,
            env=env_dict
        )

        if result_obj.returncode != 0:
            return jsonify({"error": f"Word生成エラー: {result_obj.stderr}"}), 500

        # ファイルを送信
        return send_file(
            output_path_str,
            mimetype='application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            as_attachment=True,
            download_name='指導案.docx'
        )

    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500
    finally:
        # 一時ファイルの削除
        try:
            if 'json_path_str' in locals():
                os.unlink(json_path_str)
        except Exception:
            pass


@app.route('/api/plans', methods=['GET'])
def get_plans():
    try:
        grade_str = request.args.get('grade')
        subject_str = request.args.get('subject')
        plan_type_str = request.args.get('plan_type')

        if grade_str or subject_str or plan_type_str:
            plans_list = db_manager_obj.search_plans(
                grade_str=grade_str, subject_str=subject_str, plan_type_str=plan_type_str)
        else:
            plans_list = db_manager_obj.get_all_plans()

        return jsonify({"success": True, "plans": plans_list, "count": len(plans_list)})
    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500


@app.route('/api/plans/<int:plan_id>', methods=['GET'])
def get_plan(plan_id):
    try:
        plan_dict = db_manager_obj.get_plan_by_id(plan_id)
        if plan_dict:
            # JSONとして保存されている場合はパース
            try:
                plan_dict['content'] = json.loads(plan_dict['content'])
            except Exception:
                pass
            return jsonify({"success": True, "plan": plan_dict})
        return jsonify({"error": "計画が見つかりません"}), 404
    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500


@app.route('/api/plans/<int:plan_id>', methods=['DELETE'])
def delete_plan(plan_id):
    try:
        success_bool = db_manager_obj.delete_plan(plan_id)
        if success_bool:
            return jsonify({"success": True, "message": "削除しました"})
        return jsonify({"error": "計画が見つかりません"}), 404
    except Exception as error_obj:
        return jsonify({"error": str(error_obj)}), 500


if __name__ == '__main__':
    print("=" * 50)
    print("教員向け指導計画作成アプリ - サーバー起動")
    print("アクセスURL: http://localhost:5000")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
