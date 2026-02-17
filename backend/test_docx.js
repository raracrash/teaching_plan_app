// generate_docx.jsが正しく動作するかテストするスクリプト
const path = require('path');
const os = require('os');
const fs = require('fs');

console.log('===== Node.js / docx 動作テスト =====');
console.log('Node.jsバージョン:', process.version);
console.log('APPDATA:', process.env.APPDATA || '未設定');
console.log('NODE_PATH:', process.env.NODE_PATH || '未設定');

// docxモジュールを探す
function find_docx_module() {
  const node_path = process.env.NODE_PATH;
  if (node_path) {
    for (const dir of node_path.split(path.delimiter)) {
      const candidate = path.join(dir, 'docx');
      try {
        const m = require(candidate);
        console.log('✅ docxモジュール発見（NODE_PATH）:', candidate);
        return m;
      } catch(e) {}
    }
  }
  const appdata = process.env.APPDATA || '';
  const win_paths = [
    path.join(appdata, 'npm', 'node_modules', 'docx'),
    path.join('C:\\Program Files\\nodejs\\node_modules', 'docx'),
    path.join(os.homedir(), 'AppData', 'Roaming', 'npm', 'node_modules', 'docx'),
  ];
  for (const p of win_paths) {
    try {
      const m = require(p);
      console.log('✅ docxモジュール発見（固定パス）:', p);
      return m;
    } catch(e) {}
  }
  try {
    const m = require('docx');
    console.log('✅ docxモジュール発見（通常require）');
    return m;
  } catch(e) {
    console.error('❌ docxモジュールが見つかりません');
    console.error('  → npm install -g docx を実行してください');
    process.exit(1);
  }
}

const docx_module = find_docx_module();
const { Document, Packer, Paragraph, TextRun } = docx_module;

// 簡単なdocxを生成してテスト
const test_output = path.join(os.tmpdir(), 'test_output.docx');
const doc = new Document({
  sections: [{
    children: [
      new Paragraph({
        children: [new TextRun({ text: '動作テスト成功！', size: 24, font: 'MS Mincho' })]
      })
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(test_output, buffer);
  console.log('✅ テスト用docxファイル生成成功:', test_output);
  console.log('');
  console.log('===== テスト完了：Word出力は正常に動作します ✅ =====');
  process.exit(0);
}).catch(err => {
  console.error('❌ docx生成エラー:', err.message);
  process.exit(1);
});
