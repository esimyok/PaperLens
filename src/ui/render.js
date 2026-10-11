// 渲染注册表：shell.js 启动时注册真正的 render / updateBadge，
// 其它 ui 模块从这里引用，避免 ui 模块之间的循环依赖
let _render = () => {};
let _updateBadge = () => {};

export function registerRender(fn) { _render = fn; }
export function registerUpdateBadge(fn) { _updateBadge = fn; }
export function render() { _render(); }
export function updateBadge(id) { _updateBadge(id); }
