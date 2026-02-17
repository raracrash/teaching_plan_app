"""
データベースモデルの定義
"""
from datetime import datetime
import sqlite3
import os


class DatabaseManager:
    """データベース管理クラス"""
    
    def __init__(self, db_path_str="data/teaching_plan.db"):
        """
        初期化
        
        Args:
            db_path_str: データベースファイルのパス
        """
        # データベースディレクトリが存在しない場合は作成
        db_dir_str = os.path.dirname(db_path_str)
        if db_dir_str and not os.path.exists(db_dir_str):
            os.makedirs(db_dir_str)
        
        self.db_path_str = db_path_str
        self._initialize_database()
    
    def _initialize_database(self):
        """データベースとテーブルを初期化"""
        connection_obj = sqlite3.connect(self.db_path_str)
        cursor_obj = connection_obj.cursor()
        
        # 指導計画テーブル
        cursor_obj.execute("""
            CREATE TABLE IF NOT EXISTS teaching_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                plan_type TEXT NOT NULL,
                grade TEXT NOT NULL,
                subject TEXT NOT NULL,
                unit TEXT,
                month TEXT,
                hours INTEGER,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        
        connection_obj.commit()
        connection_obj.close()
    
    def save_plan(self, plan_type_str, grade_str, subject_str, content_str, 
                  unit_str=None, month_str=None, hours_int=None):
        """
        指導計画を保存
        
        Args:
            plan_type_str: 計画の種類（'unit' or 'monthly'）
            grade_str: 学年
            subject_str: 教科
            content_str: 計画の内容
            unit_str: 単元名（単元別計画の場合）
            month_str: 月（月間計画の場合）
            hours_int: 授業時数（単元別計画の場合）
            
        Returns:
            int: 保存されたレコードのID
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        cursor_obj = connection_obj.cursor()
        
        current_time_str = datetime.now().isoformat()
        
        cursor_obj.execute("""
            INSERT INTO teaching_plans 
            (plan_type, grade, subject, unit, month, hours, content, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (plan_type_str, grade_str, subject_str, unit_str, month_str, 
              hours_int, content_str, current_time_str, current_time_str))
        
        plan_id_int = cursor_obj.lastrowid
        connection_obj.commit()
        connection_obj.close()
        
        return plan_id_int
    
    def get_all_plans(self, limit_int=50):
        """
        すべての指導計画を取得
        
        Args:
            limit_int: 取得する最大件数
            
        Returns:
            list: 指導計画のリスト
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        connection_obj.row_factory = sqlite3.Row
        cursor_obj = connection_obj.cursor()
        
        cursor_obj.execute("""
            SELECT * FROM teaching_plans 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (limit_int,))
        
        rows_list = cursor_obj.fetchall()
        connection_obj.close()
        
        # 辞書形式に変換
        plans_list = []
        for row_obj in rows_list:
            plans_list.append({
                'id': row_obj['id'],
                'plan_type': row_obj['plan_type'],
                'grade': row_obj['grade'],
                'subject': row_obj['subject'],
                'unit': row_obj['unit'],
                'month': row_obj['month'],
                'hours': row_obj['hours'],
                'content': row_obj['content'],
                'created_at': row_obj['created_at'],
                'updated_at': row_obj['updated_at']
            })
        
        return plans_list
    
    def get_plan_by_id(self, plan_id_int):
        """
        IDで指導計画を取得
        
        Args:
            plan_id_int: 計画のID
            
        Returns:
            dict or None: 指導計画の辞書、見つからない場合はNone
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        connection_obj.row_factory = sqlite3.Row
        cursor_obj = connection_obj.cursor()
        
        cursor_obj.execute("""
            SELECT * FROM teaching_plans WHERE id = ?
        """, (plan_id_int,))
        
        row_obj = cursor_obj.fetchone()
        connection_obj.close()
        
        if row_obj:
            return {
                'id': row_obj['id'],
                'plan_type': row_obj['plan_type'],
                'grade': row_obj['grade'],
                'subject': row_obj['subject'],
                'unit': row_obj['unit'],
                'month': row_obj['month'],
                'hours': row_obj['hours'],
                'content': row_obj['content'],
                'created_at': row_obj['created_at'],
                'updated_at': row_obj['updated_at']
            }
        return None
    
    def search_plans(self, grade_str=None, subject_str=None, plan_type_str=None):
        """
        条件で指導計画を検索
        
        Args:
            grade_str: 学年（省略可）
            subject_str: 教科（省略可）
            plan_type_str: 計画の種類（省略可）
            
        Returns:
            list: 検索結果のリスト
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        connection_obj.row_factory = sqlite3.Row
        cursor_obj = connection_obj.cursor()
        
        query_str = "SELECT * FROM teaching_plans WHERE 1=1"
        params_list = []
        
        if grade_str:
            query_str += " AND grade = ?"
            params_list.append(grade_str)
        
        if subject_str:
            query_str += " AND subject = ?"
            params_list.append(subject_str)
        
        if plan_type_str:
            query_str += " AND plan_type = ?"
            params_list.append(plan_type_str)
        
        query_str += " ORDER BY created_at DESC"
        
        cursor_obj.execute(query_str, params_list)
        rows_list = cursor_obj.fetchall()
        connection_obj.close()
        
        plans_list = []
        for row_obj in rows_list:
            plans_list.append({
                'id': row_obj['id'],
                'plan_type': row_obj['plan_type'],
                'grade': row_obj['grade'],
                'subject': row_obj['subject'],
                'unit': row_obj['unit'],
                'month': row_obj['month'],
                'hours': row_obj['hours'],
                'content': row_obj['content'],
                'created_at': row_obj['created_at'],
                'updated_at': row_obj['updated_at']
            })
        
        return plans_list
    
    def delete_plan(self, plan_id_int):
        """
        指導計画を削除
        
        Args:
            plan_id_int: 計画のID
            
        Returns:
            bool: 削除成功時True
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        cursor_obj = connection_obj.cursor()
        
        cursor_obj.execute("""
            DELETE FROM teaching_plans WHERE id = ?
        """, (plan_id_int,))
        
        deleted_count_int = cursor_obj.rowcount
        connection_obj.commit()
        connection_obj.close()
        
        return deleted_count_int > 0
    
    def update_plan(self, plan_id_int, content_str):
        """
        指導計画の内容を更新
        
        Args:
            plan_id_int: 計画のID
            content_str: 新しい内容
            
        Returns:
            bool: 更新成功時True
        """
        connection_obj = sqlite3.connect(self.db_path_str)
        cursor_obj = connection_obj.cursor()
        
        current_time_str = datetime.now().isoformat()
        
        cursor_obj.execute("""
            UPDATE teaching_plans 
            SET content = ?, updated_at = ?
            WHERE id = ?
        """, (content_str, current_time_str, plan_id_int))
        
        updated_count_int = cursor_obj.rowcount
        connection_obj.commit()
        connection_obj.close()
        
        return updated_count_int > 0
