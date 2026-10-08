import { useState } from 'react';
const keys = ['pcsel-training-demo-notes-v1', 'pcsel-optical-pump-case-draft-v1', 'pcsel-optical-playground-v1', 'pcsel-optics-designer-draft-v2', 'pcsel-optics-designer-library-v2', 'pcsel-folded-optics-draft-v1', 'pcsel-folded-optics-library-v1'];
export function StorageTransfer({ mode }: { mode: 'export' }) {
  const [message, setMessage] = useState('');
  function download() {
    try {
      const entries = Object.fromEntries(keys.flatMap(key => { const value = localStorage.getItem(key); return value === null ? [] : [[key, value]]; }));
      if (!Object.keys(entries).length) { setMessage('当前浏览器没有旧实验室记录。请在原来使用的浏览器与设备打开此页。'); return; }
      const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 'optical-lab-browser-migration-v1', entries }, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'optical-lab-browser-records.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage(`已导出 ${Object.keys(entries).length} 类实验室记录。在独立实验室首页底部选择“迁移旧工程与记录”并导入此文件。`);
    } catch { setMessage('无法读取浏览器记录。请检查浏览器存储设置后重试。'); }
  }
  return <main style={{ maxWidth: 720, margin: '60px auto', padding: 24, lineHeight: 1.8 }} data-mode={mode}><h1>将旧实验室记录带到新网址</h1><p>实验室已独立发布。两个域名的浏览器存储互不共享；此页仅导出实验室草稿、工程库和实训记录。</p><button type="button" onClick={download}>导出当前浏览器的旧记录</button><p role="status">{message}</p><p><a href="https://optical-lab-feiyang.pages.dev/#ob-migration">打开独立光学实验室并导入</a></p><a href="/">返回 PCSELbook</a></main>;
}
