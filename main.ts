// ===== Turlar (TypeScript) =====
interface Product {
    name: string;
    price: number;
    images: string[];
}

interface CartItem {
    name: string;
    color: string;
    qty: number;
}

interface Review {
    name: string;
    text: string;
    stars: number;
    date: string;
}

type TabName = "desc" | "specs" | "reviews";

// ===== Ma'lumotlar =====
const product: Product = {
    name: "GamePad Pro",
    price: 459000,
    images: [
        "./images/image1.png",
        "./images/image2.png",
        "./images/image3.png",
        "./images/image4.png",
    ],
};

const defaultReviews: Review[] = [
    { name: "Jasur", text: "Zo'r pristavka, bolalarim juda xursand. Ekrani yorqin!", stars: 5, date: "02.11.2026" },
    { name: "Malika", text: "Yetkazib berish tez bo'ldi, batareya uzoq ishlaydi.", stars: 4, date: "28.10.2026" },
];

let currentIndex: number = 0;
let qty: number = 1;
let selectedColor: string = "Oq";
let selectedStars: number = 5;
let cart: CartItem[] = load<CartItem[]>("cart", []);
let reviews: Review[] = load<Review[]>("reviews", defaultReviews);

// ===== Yordamchi funksiyalar =====
function $<T extends HTMLElement>(id: string): T {
    const el = document.getElementById(id);
    if (!el) throw new Error(`#${id} topilmadi`);
    return el as T;
}

function formatPrice(sum: number): string {
    return sum.toLocaleString("ru-RU").replace(/,/g, " ") + " so'm";
}

function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

function load<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function save(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        /* localStorage ishlamasa ham sahifa ishlayveradi */
    }
}

let toastTimer: number | undefined;

function showToast(text: string): void {
    const toast = $("toast");
    toast.textContent = text;
    toast.classList.remove("translate-y-24", "opacity-0");
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
        toast.classList.add("translate-y-24", "opacity-0");
    }, 2500);
}

// ===== Galereya =====
const mainImage = $<HTMLImageElement>("main-image");
const thumbs = $<HTMLUListElement>("thumbs");
const counter = $<HTMLSpanElement>("image-counter");
const lightbox = $<HTMLDivElement>("lightbox");
const lightboxImage = $<HTMLImageElement>("lightbox-image");

function renderThumbs(): void {
    thumbs.innerHTML = product.images
        .map(
            (src: string, i: number) => `
        <li>
            <button type="button" data-index="${i}"
                class="block rounded-[18px] overflow-hidden border-4 transition cursor-pointer
                ${i === currentIndex ? "border-fuchsia-400" : "border-transparent opacity-60 hover:opacity-100"}">
                <img class="w-[70px] sm:w-[80px]" src="${src}" alt="Rasm ${i + 1}">
            </button>
        </li>`
        )
        .join("");
}

function restartAnimation(img: HTMLImageElement): void {
    img.classList.remove("fade-in");
    void img.offsetWidth;
    img.classList.add("fade-in");
}

function showImage(index: number): void {
    const total = product.images.length;
    currentIndex = (index + total) % total; // oxiridan boshiga aylanadi
    mainImage.src = product.images[currentIndex];
    lightboxImage.src = product.images[currentIndex];
    restartAnimation(mainImage);
    restartAnimation(lightboxImage);
    counter.textContent = `${currentIndex + 1} / ${total}`;
    renderThumbs();
}

thumbs.addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-index]");
    if (btn) showImage(Number(btn.dataset.index));
});

$("prev-btn").addEventListener("click", () => showImage(currentIndex - 1));
$("next-btn").addEventListener("click", () => showImage(currentIndex + 1));

// ===== Rasmni kattalashtirish (lightbox) =====
function openLightbox(): void {
    lightbox.classList.remove("hidden");
    lightbox.classList.add("flex");
}

function closeLightbox(): void {
    lightbox.classList.add("hidden");
    lightbox.classList.remove("flex");
}

mainImage.addEventListener("click", openLightbox);
$("lightbox-close").addEventListener("click", closeLightbox);
lightbox.addEventListener("click", (e: MouseEvent) => {
    if (e.target === lightbox) closeLightbox(); // fonni bossa yopiladi
});

// Klaviatura: ← → rasm almashtiradi, Esc oynalarni yopadi
document.addEventListener("keydown", (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (e.key === "ArrowLeft") showImage(currentIndex - 1);
    if (e.key === "ArrowRight") showImage(currentIndex + 1);
    if (e.key === "Escape") {
        closeLightbox();
        closeCart();
    }
});

// ===== Chegirma taymeri (bugun yarim tungacha) =====
function updateTimer(): void {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, Math.floor((midnight.getTime() - now.getTime()) / 1000));
    const pad = (n: number): string => String(n).padStart(2, "0");
    $("t-hours").textContent = pad(Math.floor(diff / 3600));
    $("t-minutes").textContent = pad(Math.floor((diff % 3600) / 60));
    $("t-seconds").textContent = pad(diff % 60);
}

// ===== Rang tanlash =====
const colors = $<HTMLDivElement>("colors");
const activeRing: string[] = ["ring-2", "ring-offset-2", "ring-offset-transparent", "ring-fuchsia-400"];

colors.addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-color]");
    if (!btn) return;
    colors.querySelectorAll("button").forEach((b) => b.classList.remove(...activeRing));
    btn.classList.add(...activeRing);
    selectedColor = btn.dataset.color ?? "Oq";
    $("color-name").textContent = selectedColor;
});

// ===== Miqdor =====
function updateQty(newQty: number): void {
    qty = Math.min(10, Math.max(1, newQty)); // 1 dan 10 gacha
    $("qty").textContent = String(qty);
    $("total").textContent = formatPrice(qty * product.price);
}

$("minus-btn").addEventListener("click", () => updateQty(qty - 1));
$("plus-btn").addEventListener("click", () => updateQty(qty + 1));

// ===== Savat =====
const cartPanel = $<HTMLElement>("cart-panel");
const cartOverlay = $<HTMLDivElement>("cart-overlay");

function renderCart(): void {
    const count = cart.reduce((sum: number, item: CartItem) => sum + item.qty, 0);
    const total = cart.reduce((sum: number, item: CartItem) => sum + item.qty * product.price, 0);
    $("cart-count").textContent = String(count);
    $("cart-total").textContent = formatPrice(total);
    $<HTMLButtonElement>("checkout-btn").disabled = cart.length === 0;

    const list = $<HTMLUListElement>("cart-items");
    if (cart.length === 0) {
        list.innerHTML = `<li class="text-center text-gray-400 py-10">Savat hozircha bo'sh 🛒</li>`;
        return;
    }
    list.innerHTML = cart
        .map(
            (item: CartItem, i: number) => `
        <li class="flex items-center gap-3 rounded-2xl bg-white/5 p-3">
            <img src="${product.images[0]}" alt="" class="w-14 h-14 rounded-xl object-cover">
            <div class="flex-1">
                <p class="font-semibold">${escapeHtml(item.name)}</p>
                <p class="text-xs text-gray-400">Rang: ${escapeHtml(item.color)} · ${item.qty} ta</p>
                <p class="text-sm text-fuchsia-300">${formatPrice(item.qty * product.price)}</p>
            </div>
            <button type="button" data-remove="${i}" aria-label="O'chirish"
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-red-500 cursor-pointer">🗑</button>
        </li>`
        )
        .join("");
}

function openCart(): void {
    cartPanel.classList.remove("translate-x-full");
    cartOverlay.classList.remove("hidden");
}

function closeCart(): void {
    cartPanel.classList.add("translate-x-full");
    cartOverlay.classList.add("hidden");
}

$("add-btn").addEventListener("click", () => {
    const existing = cart.find((item) => item.name === product.name && item.color === selectedColor);
    if (existing) {
        existing.qty += qty;
    } else {
        cart.push({ name: product.name, color: selectedColor, qty });
    }
    save("cart", cart);
    renderCart();
    bumpCartCount();
    showToast(`✅ ${qty} ta ${product.name} (${selectedColor}) savatga qo'shildi`);
    updateQty(1);
});

$("cart-items").addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-remove]");
    if (!btn) return;
    cart.splice(Number(btn.dataset.remove), 1);
    save("cart", cart);
    renderCart();
});

// ===== Python server bilan aloqa (server.py) =====
// Sayt `python server.py` orqali ochilsa ishlaydi. Server bo'lmasa null qaytadi
// va sayt avvalgidek brauzer xotirasi (localStorage) bilan ishlayveradi.
interface OrderResponse {
    ok: boolean;
    order_id: number;
    total: number;
}

async function api<T>(path: string, body?: unknown): Promise<T | null> {
    if (location.protocol === "file:") return null;
    try {
        const res = await fetch(path, body === undefined ? undefined : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
        const isJson = (res.headers.get("Content-Type") ?? "").includes("application/json");
        if (!res.ok || !isJson) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}

$<HTMLButtonElement>("checkout-btn").addEventListener("click", async () => {
    const btn = $<HTMLButtonElement>("checkout-btn");
    btn.disabled = true;
    const order = await api<OrderResponse>("/api/orders", {
        items: cart.map((item: CartItem) => ({ color: item.color, qty: item.qty })),
    });
    cart = [];
    save("cart", cart);
    renderCart();
    closeCart();
    showToast(
        order
            ? `🎉 Buyurtma #${order.order_id} qabul qilindi! Jami: ${formatPrice(order.total)}`
            : "🎉 Buyurtmangiz qabul qilindi! Tez orada bog'lanamiz."
    );
    if (order) loadReport(); // hisobotni yangilash
});

$("cart-btn").addEventListener("click", openCart);
$("cart-close").addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);

// ===== Tavsif / Xususiyatlar / Sharhlar tablari =====
function showTab(name: TabName): void {
    document.querySelectorAll<HTMLButtonElement>(".info-tab").forEach((btn) => {
        const active = btn.dataset.tab === name;
        btn.classList.toggle("bg-fuchsia-500", active);
        btn.classList.toggle("bg-white/10", !active);
    });
    document.querySelectorAll<HTMLDivElement>(".info-panel").forEach((panel) => {
        panel.classList.toggle("hidden", panel.dataset.panel !== name);
    });
}

$("info-tabs").addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
    if (btn) showTab(btn.dataset.tab as TabName);
});

// ===== Sharhlar =====
function stars(n: number): string {
    return "★".repeat(n) + "☆".repeat(5 - n);
}

function renderReviews(): void {
    $("review-count").textContent = String(reviews.length);
    $("review-list").innerHTML = reviews
        .map(
            (r: Review) => `
        <li class="rounded-2xl bg-white/5 p-4">
            <div class="flex items-center justify-between mb-1">
                <p class="font-semibold">${escapeHtml(r.name)}</p>
                <span class="text-xs text-gray-400">${r.date}</span>
            </div>
            <p class="text-yellow-400 text-sm mb-1">${stars(r.stars)}</p>
            <p class="text-gray-300">${escapeHtml(r.text)}</p>
        </li>`
        )
        .join("");
}

function paintStars(n: number): void {
    document.querySelectorAll<HTMLButtonElement>("#star-input button").forEach((btn) => {
        const on = Number(btn.dataset.star) <= n;
        btn.classList.toggle("text-yellow-400", on);
    });
}

$("star-input").addEventListener("click", (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-star]");
    if (!btn) return;
    selectedStars = Number(btn.dataset.star);
    paintStars(selectedStars);
});

// Web3Forms: sharh emailga xat bo'lib keladi
const WEB3FORMS_KEY: string = "c50085d6-e0e1-4b33-89c2-34c95e8dcb42";

interface Web3FormsResponse {
    success: boolean;
    message: string;
}

async function sendReviewToEmail(name: string, email: string, text: string, starCount: number): Promise<boolean> {
    try {
        const res = await fetch("https://api.web3forms.com/submit", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
                access_key: WEB3FORMS_KEY,
                subject: `Yangi sharh: ${stars(starCount)} — ${name}`,
                from_name: "GamePad sayti",
                name,
                email,
                message: text,
                baho: `${starCount} / 5`,
            }),
        });
        const data = (await res.json()) as Web3FormsResponse;
        return data.success;
    } catch {
        return false; // internet yo'q yoki xizmat ishlamayapti
    }
}

$<HTMLFormElement>("review-form").addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    const nameInput = $<HTMLInputElement>("review-name");
    const emailInput = $<HTMLInputElement>("review-email");
    const textInput = $<HTMLTextAreaElement>("review-text");
    const submitBtn = $<HTMLButtonElement>("review-submit");
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const text = textInput.value.trim();
    if (!name || !email || !text) {
        showToast("⚠️ Ism, email va fikrni yozing");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Yuborilmoqda...";
    // Emailga (Web3Forms) va Python serverga bir vaqtda yuboriladi
    const [emailOk, saved] = await Promise.all([
        sendReviewToEmail(name, email, text, selectedStars),
        api<Review>("/api/reviews", { name, text, stars: selectedStars }),
    ]);
    submitBtn.disabled = false;
    submitBtn.textContent = "Yuborish";

    if (!emailOk && !saved) {
        showToast("❌ Yuborilmadi. Internetni tekshirib, qayta urinib ko'ring");
        return;
    }

    reviews.unshift(
        saved ?? {
            name,
            text,
            stars: selectedStars,
            date: new Date().toLocaleDateString("ru-RU"),
        }
    );
    save("reviews", reviews);
    renderReviews();
    nameInput.value = "";
    emailInput.value = "";
    textInput.value = "";
    showToast("💬 Sharhingiz yuborildi, rahmat!");
});

// ===== FAQ qidiruv =====
$<HTMLInputElement>("faq-search").addEventListener("input", (e: Event) => {
    const query = (e.target as HTMLInputElement).value.trim().toLowerCase();
    let visible = 0;
    document.querySelectorAll<HTMLDivElement>(".faq-item").forEach((item) => {
        const match = (item.textContent ?? "").toLowerCase().includes(query);
        item.classList.toggle("hidden", !match);
        if (match) visible++;
    });
    $("faq-empty").classList.toggle("hidden", visible > 0);
});

// ===== Savat sanog'i "sakraydi" (style.scss dagi .bump) =====
function bumpCartCount(): void {
    const el = $("cart-count");
    el.classList.remove("bump");
    void el.offsetWidth;
    el.classList.add("bump");
}

// ===== Skrollda bo'limlar paydo bo'lishi (style.scss dagi .reveal) =====
const revealObserver = new IntersectionObserver(
    (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("is-visible");
                revealObserver.unobserve(entry.target);
            }
        });
    },
    { threshold: 0.15 }
);

document.querySelectorAll<HTMLElement>("main > section").forEach((section) => {
    section.classList.add("reveal");
    revealObserver.observe(section);
});

// ===== Loading ekrani =====
// Rasmlar yuklanguncha VA kamida 30 soniya turadi
const MIN_LOADING_MS: number = 30000;

function preloadImage(src: string): Promise<void> {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // rasm topilmasa ham loading to'xtab qolmaydi
        img.src = src;
    });
}

function startLoader(): void {
    const fill = $("loader-fill");
    const percentEl = $("loader-percent");
    const textEl = $("loader-text");
    const start = Date.now();
    const total = product.images.length;
    let loaded = 0;
    let imagesDone = false;

    product.images.forEach((src: string) => {
        preloadImage(src).then(() => {
            loaded++;
            if (loaded === total) imagesDone = true;
        });
    });

    const tick = window.setInterval(() => {
        const elapsed = Date.now() - start;
        const timePart = Math.min(1, elapsed / MIN_LOADING_MS);
        // Rasmlar yuklanmaguncha 99% dan oshmaydi
        const percent = imagesDone ? Math.floor(timePart * 100) : Math.min(99, Math.floor(timePart * 100));
        fill.style.width = `${percent}%`;
        percentEl.textContent = `${percent}%`;

        const secondsLeft = Math.ceil((MIN_LOADING_MS - elapsed) / 1000);
        textEl.textContent = imagesDone
            ? `Tayyorlanmoqda... ${Math.max(0, secondsLeft)} s`
            : `Rasmlar yuklanmoqda... ${loaded}/${total}`;

        if (imagesDone && elapsed >= MIN_LOADING_MS) {
            clearInterval(tick);
            fill.style.width = "100%";
            percentEl.textContent = "100%";
            $("loader").classList.add("is-hidden");
            document.body.classList.remove("is-loading");
        }
    }, 200);
}

startLoader();

// ===== Savdo hisoboti (server.py -> /api/report, ichida C++ report.exe) =====
interface ColorStats {
    color: string;
    qty: number;
    revenue: number;
}

interface ReportResponse {
    python: string;
    server?: string;
    cpp: { available: boolean; output: string | null };
    stats: {
        orders: number;
        qty: number;
        revenue: number;
        average: number;
        by_color: ColorStats[];
    };
}

type BadgeKind = "ok" | "warn" | "off";

const badgeColors: Record<BadgeKind, string> = {
    ok: "bg-green-500/20 text-green-300",
    warn: "bg-yellow-500/20 text-yellow-300",
    off: "bg-red-500/20 text-red-300",
};

function setBadge(id: string, text: string, kind: BadgeKind): void {
    const el = $(id);
    el.className = `rounded-full px-3 py-1 ${badgeColors[kind]}`;
    el.textContent = text;
}

async function loadReport(): Promise<void> {
    const report = await api<ReportResponse>("/api/report");
    $("report-offline").classList.toggle("hidden", report !== null);
    $("report-body").classList.toggle("hidden", report === null);

    if (!report) {
        setBadge("py-status", "🐍 Python: ulanmagan", "off");
        setBadge("cpp-status", "⚙️ C++: ulanmagan", "off");
        return;
    }

    setBadge(
        "py-status",
        report.server ? `☁️ Server (${report.server}): ulangan` : `🐍 Python ${report.python}: ulangan`,
        "ok"
    );
    setBadge(
        "cpp-status",
        report.cpp.available ? "⚙️ C++: ishlayapti" : "⚙️ C++: ulanmagan",
        report.cpp.available ? "ok" : "warn"
    );

    const s = report.stats;
    $("r-orders").textContent = String(s.orders);
    $("r-qty").textContent = String(s.qty);
    $("r-revenue").textContent = formatPrice(s.revenue);
    $("r-average").textContent = formatPrice(s.average);

    const maxQty = Math.max(1, ...s.by_color.map((c: ColorStats) => c.qty));
    $("r-colors").innerHTML = s.by_color.length
        ? s.by_color
              .map(
                  (c: ColorStats) => `
            <div>
                <div class="flex justify-between text-sm mb-1">
                    <span>${escapeHtml(c.color)}</span>
                    <span class="text-gray-300">${c.qty} dona · ${formatPrice(c.revenue)}</span>
                </div>
                <div class="h-3 rounded-full bg-white/10 overflow-hidden">
                    <div class="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-purple-600"
                        style="width: ${Math.round((c.qty / maxQty) * 100)}%"></div>
                </div>
            </div>`
              )
              .join("")
        : `<p class="text-gray-400 text-sm">Hozircha buyurtmalar yo'q. Savatdan buyurtma bering.</p>`;

    const cppBox = $("cpp-box");
    cppBox.classList.toggle("hidden", !report.cpp.output);
    $("cpp-output").textContent = report.cpp.output ?? "";
}

$("report-refresh").addEventListener("click", loadReport);

// ===== Boshlash =====
loadReport();
renderThumbs();
updateQty(1);
renderCart();
renderReviews();
// Server ishlayotgan bo'lsa, hamma qoldirgan sharhlarni serverdan olamiz
api<Review[]>("/api/reviews").then((list) => {
    if (list) {
        reviews = list;
        renderReviews();
    }
});
paintStars(selectedStars);
updateTimer();
setInterval(updateTimer, 1000);
$("year").textContent = String(new Date().getFullYear());
