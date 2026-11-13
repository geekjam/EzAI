#!/usr/bin/env python3
"""
构思脑图 - 本地预览服务器（支持热更新）

用法（在项目根目录执行）:
  python server.py              # 默认 http://127.0.0.1:8787，监视 think*.json
  python server.py --port 3000  # 指定端口
  python server.py --host 0.0.0.0   # 允许局域网访问（默认仅本机）
  python server.py --no-watch   # 关闭热更新

热更新原理:
  服务器轮询 think*.json 的修改时间，变化时通过 SSE 推送完整数据，
  浏览器收到后自动重新渲染导图，无需手动刷新页面。

依赖: 仅 Python 3 标准库（无第三方依赖）。
"""

import http.server
import json
import sys
import time
import threading
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
JSON_FILE = ROOT / "think.json"
JSON_GLOB = "think*.json"        # 监视所有构思脑图 JSON
HTML_FILE = ROOT / "index.html"
JS_FILE = ROOT / "mindmap.js"

# Windows 控制台默认可能是 GBK，无法输出 emoji / 中文提示；
# 统一切到 UTF-8 并对无法编码的字符降级，避免启动即崩溃。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass

# ============================================================
# SSE 管理
# ============================================================
sse_clients: list = []       # 已连接的 SSE 客户端列表
sse_lock = threading.Lock()
should_stop = threading.Event()


def notify_clients(message: str) -> None:
    """向所有 SSE 客户端推送消息"""
    with sse_lock:
        dead = []
        for q in sse_clients:
            try:
                q.put(message)
            except Exception:
                dead.append(q)
        for q in dead:
            sse_clients.remove(q)


# ============================================================
# 文件监视线程（轮询 mtime）
# ============================================================
def watch_json_files(interval: float = 1.0) -> None:
    """监视所有 think*.json 文件的修改时间"""
    last_mtimes = {}
    print(f"  🔍 监视文件: {JSON_GLOB}（轮询间隔 {interval}s）")

    # 第一遍：记录现有文件 mtime
    for f in sorted(ROOT.glob(JSON_GLOB)):
        last_mtimes[f] = f.stat().st_mtime

    while not should_stop.is_set():
        try:
            current_files = sorted(ROOT.glob(JSON_GLOB))
            for f in current_files:
                mtime = f.stat().st_mtime
                prev = last_mtimes.get(f)
                if prev is not None and mtime != prev:
                    # 文件变化，推送此文件的数据
                    try:
                        data = json.loads(f.read_text(encoding="utf-8"))
                        payload = json.dumps({"type": "data-changed", "data": data, "file": f.name})
                        notify_clients(payload)
                        print(f"  ♻️  {f.name} 变更 @ {time.strftime('%H:%M:%S')}，已推送")
                    except json.JSONDecodeError as e:
                        print(f"  ⚠️  JSON 解析错误 ({f.name}): {e}")
                last_mtimes[f] = mtime

            # 清理已删除的文件
            current_names = {f for f in current_files}
            for f in list(last_mtimes.keys()):
                if f not in current_names:
                    del last_mtimes[f]
        except Exception as e:
            print(f"  ⚠️  文件监视异常: {e}")

        should_stop.wait(interval)


# ============================================================
# HTTP 请求处理器
# ============================================================
class ThinkMapHandler(http.server.BaseHTTPRequestHandler):
    """自定义处理器：静态文件白名单 + SSE 端点 + API 端点"""

    # 只允许访问这些文件，避免把整个工具目录暴露出去
    ALLOWED_FILES = {
        "/": str(HTML_FILE),
        "/index.html": str(HTML_FILE),
        "/mindmap.js": str(JS_FILE),
        "/think.json": str(JSON_FILE),
    }

    def do_GET(self):
        path = self.path.split("?")[0]

        # SSE 端点 — 热更新推送
        if path == "/sse":
            self._handle_sse()
            return

        # API — 手动获取最新数据
        if path == "/api/data":
            self._handle_api_data()
            return

        # 静态文件
        file_path = self.ALLOWED_FILES.get(path)
        if file_path:
            self._serve_file(file_path)
            return

        self.send_error(404)

    def _serve_file(self, file_path: str):
        """发送静态文件"""
        try:
            with open(file_path, "rb") as f:
                content = f.read()

            # MIME 类型
            ext_map = {
                ".html": "text/html; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".css":  "text/css; charset=utf-8",
                ".js":   "application/javascript; charset=utf-8",
                ".svg":  "image/svg+xml",
                ".png":  "image/png",
                ".ico":  "image/x-icon",
            }
            ext = Path(file_path).suffix
            content_type = ext_map.get(ext, "application/octet-stream")

            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)

    def _handle_sse(self):
        """SSE 端点"""
        import queue

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

        q: queue.Queue = queue.Queue()

        with sse_lock:
            sse_clients.append(q)

        try:
            # 发送初始连接确认
            self.wfile.write("data: {\"type\":\"connected\"}\n\n".encode())
            self.wfile.flush()

            while not should_stop.is_set():
                try:
                    msg = q.get(timeout=5)
                    self.wfile.write(f"data: {msg}\n\n".encode())
                    self.wfile.flush()
                except queue.Empty:
                    # 心跳
                    self.wfile.write(": heartbeat\n\n".encode())
                    self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            with sse_lock:
                if q in sse_clients:
                    sse_clients.remove(q)

    def _handle_api_data(self):
        """API — 返回当前脑图 JSON"""
        try:
            content = JSON_FILE.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
        except FileNotFoundError:
            self.send_error(404)

    def log_message(self, format, *args):
        """精简日志输出"""
        # args 可能包含 int/HTTPStatus 状态码，安全转字符串
        path = str(args[0]) if args else ""
        if "/sse" in path:
            return
        print(f"  [{self.command}] {path}")


# ============================================================
# 启动
# ============================================================
def main():
    parser = argparse.ArgumentParser(description="构思脑图本地预览服务器")
    parser.add_argument("--host", default="127.0.0.1", help="监听地址 (默认 127.0.0.1，仅本机)")
    parser.add_argument("--port", type=int, default=8787, help="监听端口 (默认 8787)")
    parser.add_argument("--no-watch", action="store_true", help="关闭热更新监视")
    parser.add_argument("--interval", type=float, default=1.0, help="文件轮询间隔秒数 (默认 1.0)")
    args = parser.parse_args()

    # 检查必要文件
    if not HTML_FILE.exists():
        print(f"❌ 缺少文件: {HTML_FILE.name}")
        sys.exit(1)
    if not JSON_FILE.exists():
        print(f"❌ 缺少文件: {JSON_FILE.name}")
        sys.exit(1)

    # 启动文件监视
    if not args.no_watch:
        watcher = threading.Thread(
            target=watch_json_files,
            args=(args.interval,),
            daemon=True,
        )
        watcher.start()

    # 启动 HTTP 服务（多线程模式，SSE 长连接不阻塞普通请求）
    server = http.server.ThreadingHTTPServer((args.host, args.port), ThinkMapHandler)

    print()
    print("  💭  构思脑图 · 本地预览服务器")
    print("  ─────────────────────────────")
    print(f"  📂 根目录: {ROOT}")
    print(f"  🌐 地址:   http://{'localhost' if args.host == '127.0.0.1' else args.host}:{args.port}")
    print(f"  🔥 热更新: {'开启' if not args.no_watch else '关闭'}")
    print(f"  📡 SSE:    http://localhost:{args.port}/sse")
    print(f"  📦 API:    http://localhost:{args.port}/api/data")
    print()
    print("  提示：修改 think.json 后浏览器自动重绘脑图")
    print("  按 Ctrl+C 停止服务器")
    print()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  正在关闭...")
    finally:
        should_stop.set()
        notify_clients(json.dumps({"type": "shutdown"}))
        server.shutdown()

    print("  已停止。\n")


if __name__ == "__main__":
    main()
