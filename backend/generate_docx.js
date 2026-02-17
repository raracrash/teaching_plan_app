// Windowsのnpmグローバルパスからdocxを読み込む
const path = require('path');
const os = require('os');

function find_docx_module() {
  // 環境変数NODE_PATHから探す
  const node_path = process.env.NODE_PATH;
  if (node_path) {
    for (const dir of node_path.split(path.delimiter)) {
      const candidate = path.join(dir, 'docx');
      try {
        return require(candidate);
      } catch(e) {}
    }
  }
  // Windowsのデフォルトパス
  const appdata = process.env.APPDATA || '';
  const win_paths = [
    path.join(appdata, 'npm', 'node_modules', 'docx'),
    path.join('C:\\Program Files\\nodejs\\node_modules', 'docx'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'docx'),
  ];
  for (const p of win_paths) {
    try { return require(p); } catch(e) {}
  }
  // 最後にそのまま試す
  return require('docx');
}

const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, BorderStyle, WidthType, ShadingType, VerticalAlign,
  HeadingLevel, PageOrientation
} = find_docx_module();
const fs = require('fs');

const json_path = process.argv[2];
const output_path = process.argv[3];

const input_data = JSON.parse(fs.readFileSync(json_path, 'utf8'));
const plan = input_data.plan;
const plan_type = input_data.plan_type || 'unit';

// 共通ボーダー設定
const cell_border = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" }
};

// ヘッダーセルのシェーディング
const header_shading = { fill: "DDEEFF", type: ShadingType.CLEAR };

// セルマージン
const cell_margins = { top: 100, bottom: 100, left: 120, right: 120 };

// テキスト段落生成ヘルパー
function make_para(text_str, options_obj = {}) {
  return new Paragraph({
    children: [new TextRun({
      text: text_str || "",
      size: options_obj.size || 22,
      bold: options_obj.bold || false,
      font: "MS Mincho"
    })],
    alignment: options_obj.align || AlignmentType.LEFT,
    spacing: { before: options_obj.before || 40, after: options_obj.after || 40 }
  });
}

// セクションタイトル段落
function make_section_title(text_str) {
  return new Paragraph({
    children: [new TextRun({ text: text_str, size: 22, bold: true, font: "MS Mincho" })],
    spacing: { before: 120, after: 60 }
  });
}

// 本時指導案のdocx生成
function build_unit_plan_doc(plan_obj) {
  const children_list = [];

  // ===== タイトル =====
  children_list.push(new Paragraph({
    children: [new TextRun({
      text: plan_obj.title || `${plan_obj.grade} ${plan_obj.subject}科 学習指導案`,
      size: 28, bold: true, font: "MS Mincho"
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 }
  }));

  // ===== 基本情報テーブル =====
  const info_rows = [];
  const info_items = [
    ["日　時", plan_obj.date || "　　年　月　日（　）第　校時"],
    ["場　所", plan_obj.school ? `${plan_obj.school}　${plan_obj.grade}教室` : "　　　　　　教室"],
    ["対象児童", `${plan_obj.grade}　　名`],
    ["指導者", plan_obj.teacher || "　　　　　　　　"]
  ];
  info_items.forEach(([label_str, value_str]) => {
    info_rows.push(new TableRow({
      children: [
        new TableCell({
          borders: cell_border, width: { size: 2000, type: WidthType.DXA },
          margins: cell_margins, shading: header_shading,
          children: [make_para(label_str, { bold: true })]
        }),
        new TableCell({
          borders: cell_border, width: { size: 7026, type: WidthType.DXA },
          margins: cell_margins,
          children: [make_para(value_str)]
        })
      ]
    }));
  });

  children_list.push(new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [2000, 7026],
    rows: info_rows
  }));

  children_list.push(make_para(""));

  // ===== 1. 題材名 =====
  children_list.push(make_section_title("１．題材名"));
  children_list.push(make_para(`　「${plan_obj.subject_area || plan_obj.unit}」`));
  children_list.push(make_para(""));

  // ===== 2. 題材の目標 =====
  children_list.push(make_section_title("２．題材の目標"));
  const obj = plan_obj.objectives || {};
  if (obj.knowledge_skills) {
    children_list.push(make_para(`○${obj.knowledge_skills}`));
    children_list.push(new Paragraph({
      children: [new TextRun({ text: "【知識及び技能】", size: 20, bold: true, font: "MS Mincho" })],
      alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 40 }
    }));
  }
  if (obj.thinking_judgment) {
    children_list.push(make_para(`○${obj.thinking_judgment}`));
    children_list.push(new Paragraph({
      children: [new TextRun({ text: "【思考力・判断力・表現力等】", size: 20, bold: true, font: "MS Mincho" })],
      alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 40 }
    }));
  }
  if (obj.attitude) {
    children_list.push(make_para(`○${obj.attitude}`));
    children_list.push(new Paragraph({
      children: [new TextRun({ text: "【学びに向かう力・人間性等】", size: 20, bold: true, font: "MS Mincho" })],
      alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 40 }
    }));
  }
  children_list.push(make_para(""));

  // ===== 3. 評価規準 =====
  children_list.push(make_section_title("３．評価規準"));
  const eval_c = plan_obj.evaluation_criteria || {};
  children_list.push(new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [3008, 3009, 3009],
    rows: [
      new TableRow({
        children: [
          new TableCell({ borders: cell_border, width: { size: 3008, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
            children: [make_para("知識・技能", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ borders: cell_border, width: { size: 3009, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
            children: [make_para("思考・判断・表現", { bold: true, align: AlignmentType.CENTER })] }),
          new TableCell({ borders: cell_border, width: { size: 3009, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
            children: [make_para("主体的に学習に取り組む態度", { bold: true, align: AlignmentType.CENTER })] })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ borders: cell_border, width: { size: 3008, type: WidthType.DXA }, margins: cell_margins,
            children: [make_para(eval_c.knowledge_skills || "")] }),
          new TableCell({ borders: cell_border, width: { size: 3009, type: WidthType.DXA }, margins: cell_margins,
            children: [make_para(eval_c.thinking_judgment || "")] }),
          new TableCell({ borders: cell_border, width: { size: 3009, type: WidthType.DXA }, margins: cell_margins,
            children: [make_para(eval_c.attitude || "")] })
        ]
      })
    ]
  }));
  children_list.push(make_para(""));

  // ===== 4. 単元について =====
  children_list.push(make_section_title("４．単元について"));
  children_list.push(make_para(`　${plan_obj.unit_overview || ""}`));
  children_list.push(make_para(""));

  // ===== 5. 児童の実態 =====
  children_list.push(make_section_title("５．児童の実態"));
  children_list.push(make_para(`　${plan_obj.student_situation || ""}`));
  children_list.push(make_para(""));

  // ===== 6. 指導計画 =====
  children_list.push(make_section_title("６．指導計画"));
  const teaching_plan_list = plan_obj.teaching_plan || [];
  teaching_plan_list.forEach(hour_obj => {
    const is_current = hour_obj.hour === plan_obj.current_hour;
    children_list.push(new Paragraph({
      children: [
        new TextRun({ text: `第${hour_obj.hour}時　`, size: 22, bold: is_current, font: "MS Mincho" }),
        new TextRun({ text: hour_obj.content || "", size: 22, bold: is_current, font: "MS Mincho" })
      ],
      spacing: { before: 40, after: 40 }
    }));
  });
  children_list.push(make_para(""));

  // ===== 7. 本時の指導 =====
  children_list.push(make_section_title(`７．本時の指導（${plan_obj.current_hour || 1}／${plan_obj.total_hours || "　"}）`));
  children_list.push(make_para(`（１）本時の目標`));
  children_list.push(make_para(`　・${plan_obj.current_hour_objective || ""}`));
  children_list.push(make_para(`（２）本時の展開`));

  // 展開テーブル
  const flow_header_row = new TableRow({
    children: [
      new TableCell({ borders: cell_border, width: { size: 1200, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("段階・時間", { bold: true, align: AlignmentType.CENTER })] }),
      new TableCell({ borders: cell_border, width: { size: 4913, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("○学習活動　・予想される児童の反応", { bold: true })] }),
      new TableCell({ borders: cell_border, width: { size: 2913, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("◇指導上の留意点　◆評価", { bold: true })] })
    ]
  });

  const flow_rows_list = [flow_header_row];
  const lesson_flow_list = plan_obj.lesson_flow || [];
  lesson_flow_list.forEach(flow_obj => {
    flow_rows_list.push(new TableRow({
      children: [
        new TableCell({
          borders: cell_border, width: { size: 1200, type: WidthType.DXA },
          margins: cell_margins, verticalAlign: VerticalAlign.CENTER,
          children: [
            make_para(flow_obj.phase || "", { bold: true, align: AlignmentType.CENTER }),
            make_para(`${flow_obj.duration || ""}分`, { align: AlignmentType.CENTER })
          ]
        }),
        new TableCell({
          borders: cell_border, width: { size: 4913, type: WidthType.DXA }, margins: cell_margins,
          children: (flow_obj.student_activities || "").split('\n').map(line_str =>
            make_para(line_str, { before: 30, after: 30 }))
        }),
        new TableCell({
          borders: cell_border, width: { size: 2913, type: WidthType.DXA }, margins: cell_margins,
          children: (flow_obj.teacher_notes || "").split('\n').map(line_str =>
            make_para(line_str, { before: 30, after: 30 }))
        })
      ]
    }));
  });

  children_list.push(new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [1200, 4913, 2913],
    rows: flow_rows_list
  }));
  children_list.push(make_para(""));

  // ===== 8. 準備物 =====
  if (plan_obj.materials && plan_obj.materials.length > 0) {
    children_list.push(make_section_title("８．準備物"));
    children_list.push(make_para(`　${plan_obj.materials.join('、')}`));
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1200 }
        }
      },
      children: children_list
    }]
  });
}

// 月間指導計画のdocx生成
function build_monthly_plan_doc(plan_obj) {
  const children_list = [];

  children_list.push(new Paragraph({
    children: [new TextRun({
      text: `${plan_obj.grade} ${plan_obj.subject}　${plan_obj.month}月間指導計画`,
      size: 28, bold: true, font: "MS Mincho"
    })],
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 }
  }));

  // 月間目標
  children_list.push(make_section_title("■ 月間目標"));
  children_list.push(make_para(`　${plan_obj.monthly_goal || ""}`));
  children_list.push(make_para(""));

  // 週別計画テーブル
  children_list.push(make_section_title("■ 週別指導計画"));
  const week_header_row = new TableRow({
    children: [
      new TableCell({ borders: cell_border, width: { size: 800, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("週", { bold: true, align: AlignmentType.CENTER })] }),
      new TableCell({ borders: cell_border, width: { size: 2000, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("単元名", { bold: true, align: AlignmentType.CENTER })] }),
      new TableCell({ borders: cell_border, width: { size: 600, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("時数", { bold: true, align: AlignmentType.CENTER })] }),
      new TableCell({ borders: cell_border, width: { size: 3113, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("学習内容", { bold: true, align: AlignmentType.CENTER })] }),
      new TableCell({ borders: cell_border, width: { size: 2513, type: WidthType.DXA }, margins: cell_margins, shading: header_shading,
        children: [make_para("指導上の留意点", { bold: true, align: AlignmentType.CENTER })] })
    ]
  });

  const week_rows_list = [week_header_row];
  (plan_obj.weeks || []).forEach(week_obj => {
    week_rows_list.push(new TableRow({
      children: [
        new TableCell({ borders: cell_border, width: { size: 800, type: WidthType.DXA }, margins: cell_margins, verticalAlign: VerticalAlign.CENTER,
          children: [make_para(`第${week_obj.week}週`, { align: AlignmentType.CENTER })] }),
        new TableCell({ borders: cell_border, width: { size: 2000, type: WidthType.DXA }, margins: cell_margins,
          children: [make_para(week_obj.unit || "")] }),
        new TableCell({ borders: cell_border, width: { size: 600, type: WidthType.DXA }, margins: cell_margins, verticalAlign: VerticalAlign.CENTER,
          children: [make_para(`${week_obj.hours || ""}時`, { align: AlignmentType.CENTER })] }),
        new TableCell({ borders: cell_border, width: { size: 3113, type: WidthType.DXA }, margins: cell_margins,
          children: [make_para(week_obj.content || "")] }),
        new TableCell({ borders: cell_border, width: { size: 2513, type: WidthType.DXA }, margins: cell_margins,
          children: [make_para(week_obj.notes || "")] })
      ]
    }));
  });

  children_list.push(new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [800, 2000, 600, 3113, 2513],
    rows: week_rows_list
  }));
  children_list.push(make_para(""));

  // 合計時数・評価
  children_list.push(make_para(`合計時数：${plan_obj.total_hours || ""}時間`));
  children_list.push(make_para(""));
  children_list.push(make_section_title("■ 評価の重点"));
  children_list.push(make_para(`　${plan_obj.evaluation_focus || ""}`));

  if (plan_obj.materials && plan_obj.materials.length > 0) {
    children_list.push(make_para(""));
    children_list.push(make_section_title("■ 準備物"));
    children_list.push(make_para(`　${plan_obj.materials.join('、')}`));
  }

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1000, right: 1000, bottom: 1000, left: 1200 }
        }
      },
      children: children_list
    }]
  });
}

// メイン処理
try {
  let doc;
  if (plan_type === 'monthly') {
    doc = build_monthly_plan_doc(plan);
  } else {
    doc = build_unit_plan_doc(plan);
  }

  Packer.toBuffer(doc).then(buffer => {
    fs.writeFileSync(output_path, buffer);
    console.log('SUCCESS');
    process.exit(0);
  }).catch(err => {
    console.error('ERROR:', err.message);
    process.exit(1);
  });
} catch (err) {
  console.error('ERROR:', err.message);
  process.exit(1);
}
