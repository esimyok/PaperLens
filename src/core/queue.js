// 串行处理队列：用 promise 链替代旧 index.html 的 busy + waitTurn 轮询锁
// 彻底消除「检查-设置」跨 await 的竞态：同一时刻只有一个任务在跑，且可 abort
export function createQueue() {
  let chain = Promise.resolve();
  let abortedAll = false;
  const tasks = new Map(); // id -> { aborted }

  function add(id, taskFn) {
    const entry = { aborted: false };
    tasks.set(id, entry);
    const p = chain.then(async () => {
      if (abortedAll || entry.aborted) { tasks.delete(id); return; }
      try {
        // taskFn 接收 shouldAbort() 用于中途退出
        await taskFn(() => entry.aborted || abortedAll);
      } catch (e) {
        // 任务自身负责错误呈现；这里仅避免整条链 rejected
        console.error('[queue] task failed:', id, e);
      } finally {
        tasks.delete(id);
      }
    });
    // 吞掉链上的 rejection，避免 unhandledRejection
    chain = p.catch(() => {});
    return p;
  }

  function abort(id) {
    const e = tasks.get(id);
    if (e) e.aborted = true;
  }

  function abortAll() {
    abortedAll = true;
    for (const e of tasks.values()) e.aborted = true;
  }

  function clear() {
    chain = Promise.resolve();
    tasks.clear();
  }

  return {
    add,
    abort,
    abortAll,
    clear,
    get size() { return tasks.size; },
    get active() { return tasks.size > 0; },
  };
}

// 全局单例队列：文件导入与 Zotero 自动分析共用，保证同一时刻只跑一个 AI 任务
export const appQueue = createQueue();
