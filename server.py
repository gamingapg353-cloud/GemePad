"""
GamePad sayti uchun Python server (faqat standart kutubxona, hech narsa o'rnatish shart emas).

Ishga tushirish:   python server.py
Keyin brauzerda:   http://127.0.0.1:8000

API:
    GET  /api/reviews  -> barcha sharhlar (data/reviews.json)
    POST /api/reviews  -> yangi sharh qo'shish
    POST /api/orders   -> buyurtmani saqlash (data/orders.csv)
    GET  /api/report   -> savdo hisoboti (Python hisoblaydi + C++ report.exe natijasi)
"""

import csv
import json
import platform
import shutil
import subprocess
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock

HOST = "127.0.0.1"
PORT = 8000

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
REVIEWS_FILE = DATA_DIR / "reviews.json"
ORDERS_FILE = DATA_DIR / "orders.csv"

PRODUCT_NAME = "GamePad Pro"
PRICE = 459_000  # narx serverda hisoblanadi, brauzerdan kelgan narxga ishonilmaydi
COLORS = {"Oq", "Qora", "Binafsha"}
MAX_BODY = 10_000  # so'rov hajmi chegarasi (baytda)

DEFAULT_REVIEWS = [
    {"name": "Jasur", "text": "Zo'r pristavka, bolalarim juda xursand. Ekrani yorqin!", "stars": 5, "date": "02.11.2026"},
    {"name": "Malika", "text": "Yetkazib berish tez bo'ldi, batareya uzoq ishlaydi.", "stars": 4, "date": "28.10.2026"},
]

ORDER_HEADER = ["order_id", "date", "product", "color", "qty", "price", "total"]

lock = Lock()  # bir vaqtda ikki so'rov faylni buzmasligi uchun


# ===== Fayl bilan ishlash =====
def read_reviews() -> list[dict]:
    if not REVIEWS_FILE.exists():
        return list(DEFAULT_REVIEWS)
    try:
        return json.loads(REVIEWS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return list(DEFAULT_REVIEWS)


def write_reviews(reviews: list[dict]) -> None:
    DATA_DIR.mkdir(exist_ok=True)
    REVIEWS_FILE.write_text(json.dumps(reviews, ensure_ascii=False, indent=2), encoding="utf-8")


def next_order_id() -> int:
    if not ORDERS_FILE.exists():
        return 1
    with ORDERS_FILE.open(encoding="utf-8", newline="") as f:
        ids = [int(row["order_id"]) for row in csv.DictReader(f) if row.get("order_id", "").isdigit()]
    return max(ids, default=0) + 1


# ===== Savdo hisoboti =====
def python_stats() -> dict:
    """orders.csv dan statistikani Python'da hisoblaydi."""
    order_ids: set[str] = set()
    by_color: dict[str, dict] = {}
    qty_total = revenue_total = 0
    if ORDERS_FILE.exists():
        with ORDERS_FILE.open(encoding="utf-8", newline="") as f:
            for row in csv.DictReader(f):
                try:
                    qty, total = int(row["qty"]), int(row["total"])
                except (KeyError, ValueError):
                    continue
                order_ids.add(row["order_id"])
                qty_total += qty
                revenue_total += total
                color = by_color.setdefault(row["color"], {"color": row["color"], "qty": 0, "revenue": 0})
                color["qty"] += qty
                color["revenue"] += total
    return {
        "orders": len(order_ids),
        "qty": qty_total,
        "revenue": revenue_total,
        "average": revenue_total // len(order_ids) if order_ids else 0,
        "by_color": sorted(by_color.values(), key=lambda c: c["qty"], reverse=True),
    }


def build_cpp_report() -> None:
    """report.cpp yangiroq bo'lsa (yoki .exe yo'q bo'lsa), g++ bilan qayta kompilyatsiya qiladi."""
    src = ROOT / "report.cpp"
    exe = ROOT / ("report.exe" if platform.system() == "Windows" else "report")
    gpp = shutil.which("g++")
    if not src.is_file() or gpp is None:
        return
    if exe.is_file() and exe.stat().st_mtime >= src.stat().st_mtime:
        return
    print("[c++] report.cpp kompilyatsiya qilinmoqda...")
    result = subprocess.run(
        [gpp, "-std=c++17", "-O2", "-static", str(src), "-o", str(exe)],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    print("[c++] tayyor" if result.returncode == 0 else f"[c++] xato:\n{result.stderr}")


def run_cpp_report() -> dict:
    """Kompilyatsiya qilingan report.exe (yoki report) bo'lsa, ishga tushiradi."""
    build_cpp_report()
    exe = next((p for p in (ROOT / "report.exe", ROOT / "report") if p.is_file()), None)
    if exe is None:
        return {"available": False, "output": None}
    try:
        result = subprocess.run(
            [str(exe), str(ORDERS_FILE)],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=5,
        )
        return {"available": True, "output": (result.stdout or result.stderr).strip()}
    except (OSError, subprocess.TimeoutExpired) as err:
        return {"available": False, "output": f"Ishga tushmadi: {err}"}


# ===== Tekshirish =====
def clean_text(value, max_len: int) -> str:
    if not isinstance(value, str):
        raise ValueError
    value = value.strip()
    if not value or len(value) > max_len:
        raise ValueError
    return value


def clean_int(value, low: int, high: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ValueError
    return value


# ===== So'rovlarni qayta ishlash =====
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_json(self, status: int, data) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if length <= 0 or length > MAX_BODY:
            raise ValueError
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def do_GET(self):
        if self.path == "/api/reviews":
            with lock:
                return self.send_json(200, read_reviews())
        if self.path == "/api/report":
            with lock:
                stats = python_stats()
            return self.send_json(200, {
                "python": platform.python_version(),
                "cpp": run_cpp_report(),
                "stats": stats,
            })
        # data/ papkasidagi fayllarni brauzer orqali ochib bo'lmaydi
        if Path(self.translate_path(self.path)).resolve().is_relative_to(DATA_DIR):
            return self.send_json(403, {"ok": False, "error": "Ruxsat yo'q"})
        super().do_GET()

    def do_POST(self):
        routes = {"/api/reviews": self.add_review, "/api/orders": self.add_order}
        handler = routes.get(self.path)
        if handler is None:
            return self.send_json(404, {"ok": False, "error": "Topilmadi"})
        try:
            handler(self.read_json())
        except (ValueError, KeyError, TypeError, json.JSONDecodeError):
            self.send_json(400, {"ok": False, "error": "Ma'lumot noto'g'ri"})

    def add_review(self, body: dict) -> None:
        review = {
            "name": clean_text(body["name"], 40),
            "text": clean_text(body["text"], 300),
            "stars": clean_int(body["stars"], 1, 5),
            "date": datetime.now().strftime("%d.%m.%Y"),
        }
        with lock:
            reviews = read_reviews()
            reviews.insert(0, review)
            write_reviews(reviews)
        print(f"[sharh] {review['name']}: {review['stars']}/5")
        self.send_json(201, review)

    def add_order(self, body: dict) -> None:
        items = body["items"]
        if not isinstance(items, list) or not 1 <= len(items) <= 20:
            raise ValueError
        rows = []
        for item in items:
            color = clean_text(item["color"], 20)
            if color not in COLORS:
                raise ValueError
            qty = clean_int(item["qty"], 1, 100)
            rows.append((color, qty))

        now = datetime.now().strftime("%Y-%m-%d %H:%M")
        with lock:
            DATA_DIR.mkdir(exist_ok=True)
            order_id = next_order_id()
            is_new = not ORDERS_FILE.exists()
            with ORDERS_FILE.open("a", encoding="utf-8", newline="") as f:
                writer = csv.writer(f)
                if is_new:
                    writer.writerow(ORDER_HEADER)
                for color, qty in rows:
                    writer.writerow([order_id, now, PRODUCT_NAME, color, qty, PRICE, qty * PRICE])

        total = sum(qty * PRICE for _, qty in rows)
        total_text = f"{total:,}".replace(",", " ")
        print(f"[buyurtma] #{order_id}: {sum(q for _, q in rows)} ta, {total_text} so'm")
        self.send_json(201, {"ok": True, "order_id": order_id, "total": total})

    def log_message(self, format, *args):
        pass  # har bir fayl so'rovini konsolga chiqarmaslik uchun


if __name__ == "__main__":
    url = f"http://{HOST}:{PORT}"
    import socket
    with socket.socket() as probe:
        already_running = probe.connect_ex((HOST, PORT)) == 0
    if already_running:
        # server allaqachon ishlayapti, faqat brauzerni ochamiz
        print(f"Server allaqachon ishlayapti: {url}")
        webbrowser.open(url)
        raise SystemExit(0)
    build_cpp_report()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"Server ishga tushdi: {url}")
    print("To'xtatish uchun: Ctrl + C")
    webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer to'xtatildi.")
