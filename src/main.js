import './styles/tokens.css';
import './styles/app.css';
import { renderShell, afterBoot } from './ui/shell.js';
import { boot } from './core/bootstrap.js';

const root = document.getElementById('app');
renderShell(root);
boot()
  .then(() => afterBoot())
  .catch((e) => console.error('启动失败：', e));
