"""
Gemini APIと連携して指導計画を生成するモジュール
"""
import google.generativeai as genai
import json
import re


class GeminiService:
    """Gemini APIを利用した指導計画生成サービス"""

    def __init__(self, api_key_str):
        genai.configure(api_key=api_key_str)
        self.model_instance = genai.GenerativeModel('gemini-2.5-flash')

    def generate_lesson_plan_json(self, grade_str, subject_str, unit_str,
                                   hours_int, teacher_str="", school_str="",
                                   date_str="", school_level_str="elementary"):
        school_type_str = "小学校" if school_level_str == "elementary" else "中学校"
        student_str = "児童" if school_level_str == "elementary" else "生徒"

        prompt_text = f"""あなたは経験豊富な{school_type_str}教員です。
以下の条件で本時の学習指導案をJSON形式のみで作成してください。説明文は不要です。

条件: 学年={grade_str}, 教科={subject_str}, 単元={unit_str}, 総授業時数={hours_int}時間, 学校種別={school_type_str}

以下のJSON形式のみで返してください:
{{
  "title": "{grade_str} {subject_str}科 学習指導案",
  "subject_area": "{unit_str}",
  "grade": "{grade_str}",
  "subject": "{subject_str}",
  "unit": "{unit_str}",
  "total_hours": {hours_int},
  "objectives": {{
    "knowledge_skills": "知識及び技能の目標",
    "thinking_judgment": "思考力・判断力・表現力の目標",
    "attitude": "学びに向かう力・人間性の目標"
  }},
  "evaluation_criteria": {{
    "knowledge_skills": "知識・技能の評価規準",
    "thinking_judgment": "思考・判断・表現の評価規準",
    "attitude": "主体的に学習に取り組む態度の評価規準"
  }},
  "unit_overview": "単元について（2〜3文）",
  "student_situation": "{student_str}の実態（2〜3文）",
  "teaching_plan": [
    {{"hour": 1, "content": "第1時の内容"}},
    {{"hour": 2, "content": "第2時の内容【本時】"}}
  ],
  "current_hour": 1,
  "current_hour_objective": "本時の目標",
  "lesson_flow": [
    {{"phase": "導入", "duration": 5, "student_activities": "学習活動と予想される{student_str}の反応", "teacher_notes": "◇指導上の留意点 ◆評価"}},
    {{"phase": "展開", "duration": 35, "student_activities": "学習活動", "teacher_notes": "◇留意点 ◆評価"}},
    {{"phase": "まとめ", "duration": 5, "student_activities": "まとめ", "teacher_notes": "◇留意点 ◆評価"}}
  ],
  "materials": ["教科書", "ノート"]
}}

学習指導要領に基づき具体的に記述し、JSON以外は出力しないでください。"""

        try:
            response_obj = self.model_instance.generate_content(prompt_text)
            response_text_str = response_obj.text.strip()
            response_text_str = re.sub(r'^```json\s*', '', response_text_str)
            response_text_str = re.sub(r'^```\s*', '', response_text_str)
            response_text_str = re.sub(r'\s*```$', '', response_text_str)
            plan_dict = json.loads(response_text_str)
            return {"success": True, "data": plan_dict}
        except json.JSONDecodeError as error_obj:
            return {"success": False, "error": f"JSON解析エラー: {str(error_obj)}"}
        except Exception as error_obj:
            return {"success": False, "error": str(error_obj)}

    def generate_monthly_plan_json(self, grade_str, subject_str, month_str,
                                    school_level_str="elementary",
                                    weekly_units_list=None):
        school_type_str = "小学校" if school_level_str == "elementary" else "中学校"

        # 先生が入力した週ごとの単元情報をプロンプトに組み込む
        weekly_hint_str = ""
        weeks_template_str = ""
        if weekly_units_list:
            weekly_hint_str = "\n\n【先生が入力した週ごとの単元情報（必ずこれに従ってください）】\n"
            for w in weekly_units_list:
                unit_part = f"単元: {w['unit']}" if w.get('unit') else "単元: AIが適切に決定"
                hours_part = f"時数: {w['hours']}時間" if w.get('hours') else "時数: AIが適切に決定"
                weekly_hint_str += f"第{w['week']}週 - {unit_part}, {hours_part}\n"
            # 週テンプレートに先生の入力を反映
            week_entries = []
            for i in range(1, 5):
                user_week = next((w for w in weekly_units_list if w.get('week') == i), None)
                unit_val = f'"{user_week["unit"]}"' if user_week and user_week.get('unit') else '"（ここに適切な単元名を入れる）"'
                hours_val = user_week['hours'] if user_week and user_week.get('hours') else 2
                week_entries.append(f'    {{"week": {i}, "unit": {unit_val}, "hours": {hours_val}, "content": "学習内容を詳しく記述", "notes": "指導上の留意点"}}')
            weeks_template_str = ",\n".join(week_entries)
        else:
            weekly_hint_str = ""
            weeks_template_str = """    {"week": 1, "unit": "単元名", "hours": 2, "content": "学習内容", "notes": "留意点"},
    {"week": 2, "unit": "単元名", "hours": 2, "content": "学習内容", "notes": "留意点"},
    {"week": 3, "unit": "単元名", "hours": 2, "content": "学習内容", "notes": "留意点"},
    {"week": 4, "unit": "単元名", "hours": 2, "content": "学習内容", "notes": "留意点"}"""

        prompt_text = f"""{school_type_str}{grade_str}の{subject_str}における{month_str}の月間指導計画を作成してください。{weekly_hint_str}
先生が単元を指定した場合は必ずその単元に従い、指定がない週はその教科・学年・時期にふさわしい単元を学習指導要領に基づいて決定してください。
以下のJSON形式のみで返してください。説明文は不要です。

{{
  "grade": "{grade_str}",
  "subject": "{subject_str}",
  "month": "{month_str}",
  "monthly_goal": "この月の指導目標",
  "weeks": [
{weeks_template_str}
  ],
  "total_hours": 8,
  "evaluation_focus": "今月の評価の重点",
  "materials": ["教材・準備物"]
}}

JSON以外は出力しないでください。"""

        try:
            response_obj = self.model_instance.generate_content(prompt_text)
            response_text_str = response_obj.text.strip()
            response_text_str = re.sub(r'^```json\s*', '', response_text_str)
            response_text_str = re.sub(r'^```\s*', '', response_text_str)
            response_text_str = re.sub(r'\s*```$', '', response_text_str)
            plan_dict = json.loads(response_text_str)
            return {"success": True, "data": plan_dict}
        except json.JSONDecodeError as error_obj:
            return {"success": False, "error": f"JSON解析エラー: {str(error_obj)}"}
        except Exception as error_obj:
            return {"success": False, "error": str(error_obj)}

    # 旧メソッド（後方互換性のため残す）
    def generate_plan_text(self, grade_str, subject_str, unit_str, hours_int):
        result_dict = self.generate_lesson_plan_json(grade_str, subject_str, unit_str, hours_int)
        if result_dict["success"]:
            return json.dumps(result_dict["data"], ensure_ascii=False, indent=2)
        return f"エラー: {result_dict['error']}"

    def generate_monthly_plan_text(self, grade_str, subject_str, month_str):
        result_dict = self.generate_monthly_plan_json(grade_str, subject_str, month_str)
        if result_dict["success"]:
            return json.dumps(result_dict["data"], ensure_ascii=False, indent=2)
        return f"エラー: {result_dict['error']}"
