// Netlify'dagi server: server.py bilan bir xil API, lekin terminalsiz, avtomatik ishlaydi.
//   GET  /api/reviews, POST /api/reviews, POST /api/orders, GET /api/report
// Ma'lumotlar Netlify Blobs'da saqlanadi (fayl o'rniga).
import { getStore } from "@netlify/blobs";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";

const PRODUCT_NAME = "GamePad Pro";
const PRICE = 459_000; // narx serverda hisoblanadi
const COLORS = new Set(["Oq", "Qora", "Binafsha"]);

const DEFAULT_REVIEWS = [
    { name: "Jasur", text: "Zo'r pristavka, bolalarim juda xursand. Ekrani yorqin!", stars: 5, date: "02.11.2026" },
    { name: "Malika", text: "Yetkazib berish tez bo'ldi, batareya uzoq ishlaydi.", stars: 4, date: "28.10.2026" },
];

interface OrderRow {
    order_id: number;
    date: string;
    product: string;
    color: string;
    qty: number;
    price: number;
    total: number;
}

const json = (status: number, data: unknown) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });

function cleanText(value: unknown, maxLen: number): string {
    if (typeof value !== "string") throw new Error("bad");
    const v = value.trim();
    if (!v || v.length > maxLen) throw new Error("bad");
    return v;
}

function cleanInt(value: unknown, low: number, high: number): number {
    if (typeof value !== "number" || !Number.isInteger(value) || value < low || value > high) throw new Error("bad");
    return value;
}

const pad = (n: number) => String(n).padStart(2, "0");
// O'zbekiston vaqti (UTC+5)
function nowTashkent(): Date {
    return new Date(Date.now() + 5 * 3600 * 1000);
}

const store = () => getStore({ name: "gamepad", consistency: "strong" });

async function readReviews() {
    return ((await store().get("reviews", { type: "json" })) as typeof DEFAULT_REVIEWS | null) ?? [...DEFAULT_REVIEWS];
}

async function readOrders(): Promise<OrderRow[]> {
    return ((await store().get("orders", { type: "json" })) as OrderRow[] | null) ?? [];
}

function stats(rows: OrderRow[]) {
    const ids = new Set<number>();
    const byColor = new Map<string, { color: string; qty: number; revenue: number }>();
    let qty = 0;
    let revenue = 0;
    for (const r of rows) {
        ids.add(r.order_id);
        qty += r.qty;
        revenue += r.total;
        const c = byColor.get(r.color) ?? { color: r.color, qty: 0, revenue: 0 };
        c.qty += r.qty;
        c.revenue += r.total;
        byColor.set(r.color, c);
    }
    return {
        orders: ids.size,
        qty,
        revenue,
        average: ids.size ? Math.floor(revenue / ids.size) : 0,
        by_color: [...byColor.values()].sort((a, b) => b.qty - a.qty),
    };
}

// Build paytida kompilyatsiya qilingan C++ dasturini (bin/report) ishga tushiradi
function runCppReport(rows: OrderRow[]) {
    const candidates = [path.resolve("bin/report"), path.join(process.cwd(), "bin", "report"), "/var/task/bin/report"];
    const src = candidates.find((p) => existsSync(p));
    if (!src) return { available: false, output: null };
    try {
        const exe = "/tmp/report";
        if (!existsSync(exe)) {
            copyFileSync(src, exe);
            chmodSync(exe, 0o755);
        }
        const csvPath = "/tmp/orders.csv";
        const header = "order_id,date,product,color,qty,price,total";
        const lines = rows.map((r) => [r.order_id, r.date, r.product, r.color, r.qty, r.price, r.total].join(","));
        writeFileSync(csvPath, [header, ...lines].join("\n") + "\n", "utf-8");
        const output = execFileSync(exe, [csvPath], { encoding: "utf-8", timeout: 5000 });
        return { available: true, output: output.trim() };
    } catch (err) {
        return { available: false, output: `Ishga tushmadi: ${(err as Error).message}` };
    }
}

export default async (req: Request) => {
    const route = new URL(req.url).pathname.replace(/\/+$/, "");

    try {
        if (req.method === "GET" && route === "/api/reviews") {
            return json(200, await readReviews());
        }

        if (req.method === "GET" && route === "/api/report") {
            const rows = await readOrders();
            return json(200, { python: "", server: "Netlify", cpp: runCppReport(rows), stats: stats(rows) });
        }

        if (req.method === "POST" && route === "/api/reviews") {
            const body = await req.json();
            const d = nowTashkent();
            const review = {
                name: cleanText(body.name, 40),
                text: cleanText(body.text, 300),
                stars: cleanInt(body.stars, 1, 5),
                date: `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`,
            };
            const reviews = await readReviews();
            reviews.unshift(review);
            await store().setJSON("reviews", reviews.slice(0, 500));
            return json(201, review);
        }

        if (req.method === "POST" && route === "/api/orders") {
            const body = await req.json();
            const items = body.items;
            if (!Array.isArray(items) || items.length < 1 || items.length > 20) throw new Error("bad");
            const parsed = items.map((item: { color: unknown; qty: unknown }) => {
                const color = cleanText(item.color, 20);
                if (!COLORS.has(color)) throw new Error("bad");
                return { color, qty: cleanInt(item.qty, 1, 100) };
            });

            const rows = await readOrders();
            const orderId = rows.reduce((m, r) => Math.max(m, r.order_id), 0) + 1;
            const d = nowTashkent();
            const date = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
            for (const { color, qty } of parsed) {
                rows.push({ order_id: orderId, date, product: PRODUCT_NAME, color, qty, price: PRICE, total: qty * PRICE });
            }
            await store().setJSON("orders", rows);
            const total = parsed.reduce((s: number, p: { qty: number }) => s + p.qty * PRICE, 0);
            return json(201, { ok: true, order_id: orderId, total });
        }

        return json(404, { ok: false, error: "Topilmadi" });
    } catch {
        return json(400, { ok: false, error: "Ma'lumot noto'g'ri" });
    }
};

export const config = { path: "/api/*" };
