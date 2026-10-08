import { useState } from 'react';
import { parseDesignFile } from '../design/design-projects';
import { parseFoldedEngineeringFile } from '../design/folded-export';
import { parseFoldedScene } from '../design/core/folded-engine';
import { parseScene } from '../training/bench-engine';
const keys = ['pcsel-training-demo-notes-v1', 'pcsel-optical-pump-case-draft-v1', 'pcsel-optical-playground-v1', 'pcsel-optics-designer-draft-v2', 'pcsel-optics-designer-library-v2', 'pcsel-folded-optics-draft-v1', 'pcsel-folded-optics-library-v1'];
export function StorageMigration() {
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState<Record<string, string> | null>(null);
  async function load(file?: File) {
    setReady(null);
    if (!file) return;
    try {
      if (file.size > 5 * 1024 ** 2) throw new Error('文件超过 5 MiB，请分别导出单个工程。');
      const data = JSON.parse(await file.text());
      if (data?.schema !== 'optical-lab-browser-migration-v1' || !data.entries || Array.isArray(data.entries) || typeof data.entries !== 'object') throw new Error('请选择旧教材站导出的浏览器记录 JSON。');
      const checked: Record<string, string> = {};
      for (const [key, value] of Object.entries(data.entries)) {
        if (!keys.includes(key) || typeof value !== 'string') throw new Error('文件包含无法识别的存储条目。');
        const parsed = JSON.parse(value);
        if (key.includes('library')) {
          if (!Array.isArray(parsed) || parsed.length > 20) throw new Error('工程库必须是最多 20 项的列表。');
          for (const item of parsed) {
            if (typeof item?.id !== 'string' || typeof item?.savedAt !== 'string') throw new Error('工程库记录信息不完整。');
            if (key.includes('folded')) parseFoldedScene(item.scene); else parseDesignFile(item.file);
          }
        } else if (key.includes('folded')) parseFoldedEngineeringFile(parsed, parseFoldedScene);
        else if (key.includes('designer')) parseDesignFile(parsed);
        else if (key.includes('playground')) parseScene(parsed);
        else if (parsed?.version !== 1 || typeof (parsed.records ?? parsed.parameters) !== 'object' || !(parsed.records ?? parsed.parameters)) throw new Error('实训记录格式不完整。');
        checked[key] = value;
      }
      if (!Object.keys(checked).length) throw new Error('文件中没有实验室记录。');
      setReady(checked); setMessage(`已校验 ${Object.keys(checked).length} 类记录。导入会替换新网址中的同类记录，请先保存当前工程。`);
    } catch (error) { setMessage(error instanceof SyntaxError ? 'JSON 内容损坏，请在旧站重新导出。' : error instanceof Error ? error.message : '读取失败，请重新选择文件。'); }
  }
  function apply() {
    if (!ready) return;
    const backup = Object.fromEntries(Object.keys(ready).map(key => [key, localStorage.getItem(key)]));
    try { for (const [key, value] of Object.entries(ready)) localStorage.setItem(key, value); window.location.reload(); }
    catch { for (const [key, value] of Object.entries(backup)) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* Report storage failure below. */ } } setMessage('存储空间不足或不可用，未完成迁移。请导出当前工程、检查浏览器存储后重试。'); }
  }
  return <section className="ob-container lj-section" id="ob-migration"><details className="lj-more"><summary>迁移旧工程与记录</summary><p>旧网址的记录仍在原浏览器。先到 <a href="https://pcsel-knowledge-site.pages.dev/optics/migrate/">教材站导出旧记录</a>，然后导入下载的 JSON。单个工程也可以继续使用工作台内的导入、导出功能。</p><label>选择旧记录 JSON <input type="file" accept=".json,application/json" onChange={event => load(event.target.files?.[0])} /></label><p role="status">{message}</p>{ready && <button type="button" onClick={apply}>替换同类记录并重新加载</button>}</details></section>;
}
