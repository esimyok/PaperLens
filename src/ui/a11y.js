// 无障碍：Esc 分级关闭（原版 1823–1833 行）
import { menuEl } from './dom.js';

export function initA11y() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = menuEl();
    if (!m.hidden) { m.hidden = true; return; }
    for (const id of ['settings-mask', 'stats-mask']) {
      const el = document.getElementById(id);
      if (el.classList.contains('show')) { el.classList.remove('show'); return; }
    }
    if (document.body.classList.contains('chat-open')) {
      document.body.classList.remove('chat-open');
      const lbl = document.getElementById('btn-chat-label');
      if (lbl) lbl.textContent = '问答';
      const btn = document.getElementById('btn-chat');
      if (btn) btn.classList.remove('active');
    }
  });
}
