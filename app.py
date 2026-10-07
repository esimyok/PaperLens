# -*- coding: utf-8 -*-
"""
PaperLens 一键版：本地服务 + Zotero 桥接 + 自动打开页面（三合一）
================================================================
双击 PaperLens.exe 后：
  1. 启动本机服务 http://127.0.0.1:3002 并自动打开工具页面
  2. 页面自动开启「Zotero 联动」——在 Zotero 点选文献即自动分析
关闭控制台窗口即退出。
前置（一次性）：Zotero 设置->高级->勾选「允许其他应用程序与 Zotero 通信」；
安装 Better BibTeX 插件（用于读取"当前选中项"，仅此用途）。
"""
import base64
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 3002
ZOTERO = "http://127.0.0.1:23119"


def http_json(url, payload=None, timeout=10):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(url, data=data,
                                 headers={"Content-Type": "application/json", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    return json.loads(raw.decode("utf-8")) if raw.strip() else {}


def rpc(method, params=None):
    """调用 Better BibTeX JSON-RPC，返回 result 或抛异常"""
    resp = http_json(ZOTERO + "/better-bibtex/json-rpc",
                     {"jsonrpc": "2.0", "method": method, "params": params or [], "id": 1})
    if "error" in resp:
        raise RuntimeError("BBT RPC 错误: %s" % resp["error"])
    return resp.get("result")


def zotero_alive():
    try:
        urllib.request.urlopen(ZOTERO + "/connector/ping", timeout=3)
        return True
    except Exception:
        return False


def local_api_get(path, timeout=15):
    """Zotero 7 官方本地只读 API：/api/users/0/..."""
    req = urllib.request.Request(ZOTERO + "/api/users/0" + path,
                                 headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def attachment_pdf(att_key):
    """附件 key -> (pdf_bytes, 文件名)。302 时从 Location 拿磁盘路径。"""
    req = urllib.request.Request(ZOTERO + "/api/users/0/items/%s/file" % att_key)
    opener = urllib.request.build_opener(NoRedirect)
    try:
        with opener.open(req, timeout=30) as r:
            body = r.read()
            if body[:4] == b"%PDF":
                return body, None
            headers, status = dict(r.headers), r.status
    except urllib.error.HTTPError as e:
        headers, status = dict(e.headers), e.code
    except Exception:
        return None, None
    if status in (301, 302, 303, 307, 308):
        loc = headers.get("Location", "")
        if loc.startswith("file:"):
            path = urllib.parse.unquote(urllib.parse.urlparse(loc).path)
            if re.match(r"^/[A-Za-z]:", path):
                path = path[1:]
            if os.path.exists(path):
                with open(path, "rb") as f:
                    return f.read(), os.path.basename(path)
    return None, None


def csl_authors(csl):
    out = []
    for a in csl.get("author", []) or []:
        if isinstance(a, dict):
            name = (a.get("family") or a.get("literal") or "")
            if a.get("given"):
                name = (name + " " + a["given"]).strip()
            if name.strip():
                out.append(name.strip())
    return out


def get_selected():
    """选中项 -> 元数据(Zotero 本地 API) + PDF(本地 API /file)。
    BBT 仅用于读取'当前选中'的条目 key，citekey 为 null 不影响。"""
    if not zotero_alive():
        return {"error": "zotero_offline"}
    try:
        rpc("api.ready")
    except Exception:
        return {"error": "bbt_missing"}
    try:
        mapping = rpc("item.citationkey", ["selected"]) or {}
    except Exception as e:
        return {"error": "rpc_fail", "detail": str(e)}
    if not mapping:
        return {"error": "no_selection"}
    item_key = list(mapping.keys())[0]          # 键 = Zotero 条目 key
    citekey = list(mapping.values())[0]         # 值可能为 null，仅作参考
    if not re.match(r"^[A-Z0-9]{8}$", str(item_key)):
        return {"error": "bad_key", "detail": str(item_key)}
    # 条目元数据（官方本地 API，不依赖 BBT）
    try:
        item = local_api_get("/items/%s?format=json" % item_key)
    except urllib.error.HTTPError as e:
        if e.code == 403:
            return {"error": "local_api_disabled"}
        return {"error": "api_fail", "detail": str(e)}
    except Exception as e:
        return {"error": "api_fail", "detail": str(e)}
    data = item.get("data", {})
    # 条目类型归一：选中的若是 PDF 附件本身，元数据（标题/年份/作者）一律取父条目
    pdf_key, filename = None, None
    if data.get("itemType") == "attachment":
        if str(data.get("contentType", "")).lower() == "application/pdf" or \
           str(data.get("filename", "")).lower().endswith(".pdf"):
            pdf_key = item_key
            filename = data.get("filename") or (item_key + ".pdf")
        parent = data.get("parentItem")
        if parent:
            try:
                data = local_api_get("/items/%s?format=json" % parent).get("data", {})
            except Exception:
                pass
    title = data.get("title") or data.get("name") or citekey or item_key
    year = ""
    m = re.search(r"\d{4}", str(data.get("date") or ""))
    if m:
        year = m.group(0)
    if not pdf_key:
        # 普通条目：从子附件里找 PDF
        try:
            children = local_api_get("/items/%s/children?format=json" % item_key)
            for ch in children:
                d = ch.get("data", {})
                ct = str(d.get("contentType", "")).lower()
                fn = str(d.get("filename") or d.get("path") or "").lower()
                if ct == "application/pdf" or fn.endswith(".pdf"):
                    pdf_key = ch.get("key")
                    filename = d.get("filename") or (title + ".pdf")
                    break
        except Exception:
            pass
    out = {"key": item_key, "citekey": citekey or item_key,
           "title": title, "authors": csl_authors_from_creators(data.get("creators")),
           "year": year}
    if not pdf_key:
        out["error"] = "no_pdf"
        return out
    pdf, fname = attachment_pdf(pdf_key)
    if not pdf:
        out["error"] = "no_pdf"
        return out
    out["filename"] = filename or fname or (out["citekey"] + ".pdf")
    out["pdf_base64"] = base64.b64encode(pdf).decode("ascii")
    return out


def csl_authors_from_creators(creators):
    """Zotero 条目 creators -> 姓名列表（中文姓名保持原样）"""
    out = []
    for c in creators or []:
        if not isinstance(c, dict):
            continue
        if c.get("name"):
            out.append(c["name"])
        else:
            full = ("%s %s" % (c.get("lastName", ""), c.get("firstName", ""))).strip()
            if full:
                out.append(full)
    return out


def resource_path(name):
    bases = [os.path.dirname(os.path.abspath(sys.argv[0]))]
    if getattr(sys, "_MEIPASS", None):
        bases.append(sys._MEIPASS)
    for b in bases:
        p = os.path.join(b, name)
        if os.path.exists(p):
            return p
    return None


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        try:
            if path in ("/", "/index.html"):
                p = resource_path("index.html")
                if not p:
                    return self._send_json({"error": "index_missing"}, 500)
                with open(p, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(body)
            elif path == "/ping":
                alive = zotero_alive()
                bbt = False
                if alive:
                    try:
                        rpc("api.ready"); bbt = True
                    except Exception:
                        pass
                self._send_json({"ok": True, "zotero": alive, "bbt": bbt})
            elif path == "/selected":
                self._send_json(get_selected())
            else:
                self._send_json({"error": "not_found"}, 404)
        except Exception as e:
            self._send_json({"error": "server_fail", "detail": str(e)}, 500)

    def log_message(self, fmt, *args):
        pass


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
    no_open = os.environ.get("PAPERLENS_NO_BROWSER") == "1" or "--no-open" in sys.argv
    srv = None
    for port in range(PORT, PORT + 10):
        try:
            srv = ThreadingHTTPServer(("127.0.0.1", port), Handler)
            break
        except OSError:
            continue
    if srv is None:
        print("端口均被占用，请关闭旧的 PaperLens 窗口后重试")
        return
    url = "http://127.0.0.1:%d/" % srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    print("=" * 52)
    print("PaperLens 已启动")
    print("  页面: %s   （已自动打开浏览器）" % url)
    print("  Zotero 联动: 页面会自动检测并开启")
    print("  关闭本窗口即退出服务")
    print("=" * 52)
    if not no_open:
        webbrowser.open(url)
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
