// CORS 兜底代理：浏览器直连 AI 服务商失败时使用
// 启动方式：先 npm install express，再 node proxy.js
const express = require("express");
const app = express();
app.use(express.json({ limit: "8mb" }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-api-key, anthropic-version, anthropic-dangerous-direct-browser-access");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 智谱专用路径（旧版兼容）
app.all("/api/paas/v4/*path", async (req, res) => {
  await forward(res, "https://open.bigmodel.cn/api/paas/v4/" + req.params.path, req);
});

// 通用转发：/pass/<host>/<path...> -> https://<host>/<path...>
// 支持 glm / deepseek / qwen / openai / gemini / claude 等所有服务商
app.all("/pass/:host/*path", async (req, res) => {
  const headers = {};
  for (const h of ["authorization", "x-api-key", "anthropic-version",
    "anthropic-dangerous-direct-browser-access", "content-type"]) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }
  await forward(res, "https://" + req.params.host + "/" + req.params.path, { body: req.body, headers });
});

async function forward(res, url, req) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body),
    });
    res.status(r.status).set({
      "Content-Type": r.headers.get("content-type") || "application/json",
    }).send(await r.text());
  } catch (e) {
    res.status(502).json({ error: { message: "代理转发失败: " + e.message } });
  }
}

app.listen(3001, () => console.log("代理已启动: http://localhost:3001 (支持各 AI 服务商 CORS 兜底转发)"));
