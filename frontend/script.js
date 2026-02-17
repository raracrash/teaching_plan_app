// ローカル開発とRender本番を自動で切り替え
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

// 現在表示中の計画データを保持
let current_plan_data = null;
let current_plan_type_str = 'unit';

// ===== タブ切り替え =====
function switchTab(tab_type_str) {
  document.querySelectorAll('.tab-button').forEach((btn, idx) => {
    btn.classList.remove('active');
    if ((tab_type_str === 'unit' && idx === 0) ||
        (tab_type_str === 'monthly' && idx === 1) ||
        (tab_type_str === 'history' && idx === 2)) {
      btn.classList.add('active');
    }
  });
  document.getElementById('unit-form').style.display = tab_type_str === 'unit' ? 'block' : 'none';
  document.getElementById('monthly-form').style.display = tab_type_str === 'monthly' ? 'block' : 'none';
  document.getElementById('history-view').style.display = tab_type_str === 'history' ? 'block' : 'none';
  if (tab_type_str === 'history') loadPlans();
  clearResult();
}

// ===== 本時指導案フォーム =====
document.getElementById('planForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const grade_str = document.getElementById('grade').value;
  const subject_str = document.getElementById('subject').value;
  const unit_str = document.getElementById('unit').value;
  const hours_str = document.getElementById('hours').value;
  if (!grade_str || !subject_str || !unit_str || !hours_str) {
    alert('必須項目（*）をすべて入力してください');
    return;
  }
  const button_el = e.target.querySelector('.generate-button');
  setLoading(button_el, true);
  try {
    const res = await fetch(`${API_BASE_URL}/generate_plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade: grade_str, subject: subject_str, unit: unit_str,
        hours: parseInt(hours_str),
        current_hour: parseInt(document.getElementById('current-hour').value) || 1,
        teacher: document.getElementById('teacher').value,
        school: document.getElementById('school').value,
        date: document.getElementById('date').value,
        school_level: document.getElementById('school-level').value,
        save: document.getElementById('save-unit-plan').checked
      })
    });
    const data = await res.json();
    if (data.success) {
      current_plan_data = data.plan;
      current_plan_type_str = 'unit';
      renderUnitPlan(data.plan);
      if (data.saved) showToast('✅ 指導案を保存しました');
    } else {
      alert('エラー: ' + (data.error || '生成に失敗しました'));
    }
  } catch (err) {
    alert('通信エラー: ' + err.message);
  } finally {
    setLoading(button_el, false);
  }
});

// ===== 月間計画フォーム =====
document.getElementById('monthlyPlanForm').addEventListener('submit', async function(e) {
  e.preventDefault();
  const grade_str = document.getElementById('monthly-grade').value;
  const subject_str = document.getElementById('monthly-subject').value;
  const month_str = document.getElementById('month').value;
  if (!grade_str || !subject_str || !month_str) {
    alert('必須項目（*）をすべて入力してください');
    return;
  }
  const button_el = e.target.querySelector('.generate-button');
  setLoading(button_el, true);
  try {
    // 週ごとの単元入力を収集
    const weekly_units_list = [1,2,3,4].map(w => ({
      week: w,
      unit: document.getElementById(`week${w}-unit`).value.trim(),
      hours: parseInt(document.getElementById(`week${w}-hours`).value) || null
    })).filter(w => w.unit || w.hours);

    const res = await fetch(`${API_BASE_URL}/generate_monthly_plan`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grade: grade_str, subject: subject_str, month: month_str,
        school_level: document.getElementById('monthly-school-level').value,
        weekly_units: weekly_units_list,
        save: document.getElementById('save-monthly-plan').checked
      })
    });
    const data = await res.json();
    if (data.success) {
      current_plan_data = data.plan;
      current_plan_type_str = 'monthly';
      renderMonthlyPlan(data.plan);
      if (data.saved) showToast('✅ 月間計画を保存しました');
    } else {
      alert('エラー: ' + (data.error || '生成に失敗しました'));
    }
  } catch (err) {
    alert('通信エラー: ' + err.message);
  } finally {
    setLoading(button_el, false);
  }
});

// ===== 指導案プレビュー描画（本時） =====
function renderUnitPlan(plan) {
  const p = plan;
  const obj = p.objectives || {};
  const eval_c = p.evaluation_criteria || {};
  const flow_list = p.lesson_flow || [];
  const teaching_plan_list = p.teaching_plan || [];

  let html = `
    <div class="plan-title">${escHtml(p.title || `${p.grade} ${p.subject}科 学習指導案`)}</div>
    <table class="info-table">
      <tr><td class="label-cell">日　時</td><td>${escHtml(p.date || '　　年　月　日（　）第　校時')}</td></tr>
      <tr><td class="label-cell">場　所</td><td>${escHtml(p.school ? p.school + '　' + p.grade + '教室' : '　　　　　　教室')}</td></tr>
      <tr><td class="label-cell">対象児童</td><td>${escHtml(p.grade)}　　名</td></tr>
      <tr><td class="label-cell">指 導 者</td><td>${escHtml(p.teacher || '　　　　　　　　')}</td></tr>
    </table>

    <div class="section-title">１．題材名</div>
    <p>　「${escHtml(p.subject_area || p.unit)}」</p>

    <div class="section-title">２．題材の目標</div>
    ${obj.knowledge_skills ? `<div class="objective-block"><p>○${escHtml(obj.knowledge_skills)}</p><span class="objective-label">【知識及び技能】</span></div>` : ''}
    ${obj.thinking_judgment ? `<div class="objective-block"><p>○${escHtml(obj.thinking_judgment)}</p><span class="objective-label">【思考力・判断力・表現力等】</span></div>` : ''}
    ${obj.attitude ? `<div class="objective-block"><p>○${escHtml(obj.attitude)}</p><span class="objective-label">【学びに向かう力・人間性等】</span></div>` : ''}

    <div class="section-title">３．評価規準</div>
    <table class="eval-table">
      <tr>
        <th>知識・技能</th>
        <th>思考・判断・表現</th>
        <th>主体的に学習に取り組む態度</th>
      </tr>
      <tr>
        <td>${escHtml(eval_c.knowledge_skills || '')}</td>
        <td>${escHtml(eval_c.thinking_judgment || '')}</td>
        <td>${escHtml(eval_c.attitude || '')}</td>
      </tr>
    </table>

    <div class="section-title">４．単元について</div>
    <p>　${escHtml(p.unit_overview || '')}</p>

    <div class="section-title">５．児童の実態</div>
    <p>　${escHtml(p.student_situation || '')}</p>

    <div class="section-title">６．指導計画</div>
    ${teaching_plan_list.map(h => {
      const is_current = h.hour === p.current_hour;
      return `<p ${is_current ? 'style="font-weight:bold"' : ''}>第${h.hour}時　${escHtml(h.content || '')}</p>`;
    }).join('')}

    <div class="section-title">７．本時の指導（${p.current_hour || 1}／${p.total_hours || '　'}）</div>
    <p>（１）本時の目標</p>
    <p>　・${escHtml(p.current_hour_objective || '')}</p>
    <p style="margin-top:8px">（２）本時の展開</p>
    <table class="flow-table">
      <tr>
        <th class="phase-cell">段階・時間</th>
        <th style="width:52%">○学習活動　・予想される児童の反応</th>
        <th style="width:30%">◇指導上の留意点　◆評価</th>
      </tr>
      ${flow_list.map(f => `
        <tr>
          <td class="phase-cell">${escHtml(f.phase || '')}<br>${f.duration || ''}分</td>
          <td>${escHtml(f.student_activities || '').replace(/\n/g, '<br>')}</td>
          <td>${escHtml(f.teacher_notes || '').replace(/\n/g, '<br>')}</td>
        </tr>`).join('')}
    </table>

    ${p.materials && p.materials.length > 0 ? `
    <div class="section-title">８．準備物</div>
    <p>　${p.materials.map(m => escHtml(m)).join('、')}</p>` : ''}
  `;

  showResult(html);
}

// ===== 月間計画プレビュー描画 =====
function renderMonthlyPlan(plan) {
  const p = plan;
  const weeks_list = p.weeks || [];

  let html = `
    <div class="plan-title">${escHtml(p.grade)} ${escHtml(p.subject)}　${escHtml(p.month)}月間指導計画</div>

    <div class="section-title">■ 月間目標</div>
    <p>　${escHtml(p.monthly_goal || '')}</p>

    <div class="section-title">■ 週別指導計画</div>
    <table class="week-table">
      <tr>
        <th class="week-cell">週</th>
        <th style="width:20%">単元名</th>
        <th class="hours-cell">時数</th>
        <th style="width:35%">学習内容</th>
        <th style="width:28%">指導上の留意点</th>
      </tr>
      ${weeks_list.map(w => `
        <tr>
          <td class="week-cell">第${w.week}週</td>
          <td>${escHtml(w.unit || '')}</td>
          <td class="hours-cell">${w.hours || ''}時</td>
          <td>${escHtml(w.content || '')}</td>
          <td>${escHtml(w.notes || '')}</td>
        </tr>`).join('')}
    </table>
    <p>合計時数：${p.total_hours || ''}時間</p>

    <div class="section-title">■ 評価の重点</div>
    <p>　${escHtml(p.evaluation_focus || '')}</p>

    ${p.materials && p.materials.length > 0 ? `
    <div class="section-title">■ 準備物</div>
    <p>　${p.materials.map(m => escHtml(m)).join('、')}</p>` : ''}
  `;

  showResult(html);
}

// ===== 結果表示 =====
function showResult(html_str) {
  document.getElementById('plan-preview').innerHTML = html_str;
  const result_el = document.getElementById('result-container');
  result_el.style.display = 'block';
  result_el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function clearResult() {
  document.getElementById('result-container').style.display = 'none';
  current_plan_data = null;
}

// ===== Wordダウンロード =====
async function downloadDocx() {
  if (!current_plan_data) { alert('先に指導案を生成してください'); return; }
  try {
    showToast('⏳ Wordファイルを生成中...');
    const res = await fetch(`${API_BASE_URL}/export_docx`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: current_plan_data, plan_type: current_plan_type_str })
    });
    if (!res.ok) {
      const err = await res.json();
      alert('エラー: ' + (err.error || 'Word生成に失敗しました'));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `指導案_${current_plan_data.grade || ''}_${current_plan_data.subject || ''}.docx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Wordファイルをダウンロードしました');
  } catch (err) {
    alert('通信エラー: ' + err.message);
  }
}

// ===== 保存した計画の表示 =====
async function loadPlans() {
  const list_el = document.getElementById('plans-list');
  list_el.innerHTML = '<p style="text-align:center;color:#999">読み込み中...</p>';
  try {
    const grade_str = document.getElementById('filter-grade').value;
    const type_str = document.getElementById('filter-type').value;
    let url = `${API_BASE_URL}/plans?`;
    if (grade_str) url += `grade=${encodeURIComponent(grade_str)}&`;
    if (type_str) url += `plan_type=${encodeURIComponent(type_str)}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.plans.length > 0) {
      list_el.innerHTML = data.plans.map(plan => {
        const label_str = plan.plan_type === 'unit' ? '本時指導案' : '月間計画';
        const detail_str = plan.unit || plan.month || '';
        const date_str = new Date(plan.created_at).toLocaleDateString('ja-JP');
        return `<div class="plan-card">
          <div class="plan-card-header">
            <div><span class="plan-type-badge">${label_str}</span>
            <strong>${plan.grade} ${plan.subject}</strong>
            ${detail_str ? `<span style="margin-left:6px;color:#666">| ${detail_str}</span>` : ''}</div>
            <div style="font-size:0.85em;color:#999">${date_str}</div>
          </div>
          <div class="plan-card-actions">
            <button onclick="viewSavedPlan(${plan.id})" class="action-button">👁️ 表示</button>
            <button onclick="deletePlan(${plan.id})" class="action-button" style="border-color:#e53e3e;color:#e53e3e">🗑️ 削除</button>
          </div>
        </div>`;
      }).join('');
    } else {
      list_el.innerHTML = '<p style="text-align:center;color:#999">保存された計画はありません</p>';
    }
  } catch (err) {
    list_el.innerHTML = '<p style="text-align:center;color:#e53e3e">読み込みエラーが発生しました</p>';
  }
}

async function viewSavedPlan(plan_id_int) {
  try {
    const res = await fetch(`${API_BASE_URL}/plans/${plan_id_int}`);
    const data = await res.json();
    if (data.success) {
      const plan_obj = data.plan;
      const content = typeof plan_obj.content === 'string'
        ? JSON.parse(plan_obj.content) : plan_obj.content;
      current_plan_data = content;
      current_plan_type_str = plan_obj.plan_type;
      if (plan_obj.plan_type === 'monthly') {
        renderMonthlyPlan(content);
      } else {
        renderUnitPlan(content);
      }
    }
  } catch (err) {
    alert('読み込みエラー: ' + err.message);
  }
}

async function deletePlan(plan_id_int) {
  if (!confirm('この計画を削除しますか？')) return;
  try {
    const res = await fetch(`${API_BASE_URL}/plans/${plan_id_int}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) { showToast('🗑️ 削除しました'); loadPlans(); }
    else alert('削除に失敗しました');
  } catch (err) {
    alert('エラー: ' + err.message);
  }
}

// ===== ユーティリティ =====
function setLoading(button_el, is_loading) {
  button_el.disabled = is_loading;
  button_el.querySelector('.button-text').style.display = is_loading ? 'none' : 'inline';
  button_el.querySelector('.loading-text').style.display = is_loading ? 'inline' : 'none';
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function showToast(msg_str) {
  const toast_el = document.createElement('div');
  toast_el.textContent = msg_str;
  toast_el.style.cssText = `
    position:fixed;bottom:24px;right:24px;background:#333;color:white;
    padding:12px 20px;border-radius:8px;font-size:0.9em;z-index:1000;
    animation:fadeIn 0.3s;
  `;
  document.body.appendChild(toast_el);
  setTimeout(() => toast_el.remove(), 3000);
}
