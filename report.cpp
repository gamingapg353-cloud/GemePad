// GamePad savdo hisoboti (C++17)
// data/orders.csv faylini o'qib, buyurtmalar bo'yicha hisobot chiqaradi.
//
// Kompilyatsiya:  g++ -std=c++17 -O2 report.cpp -o report
// Ishga tushirish: ./report            (yoki Windows'da: report.exe)
//                  ./report boshqa/fayl.csv

#include <algorithm>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <map>
#include <set>
#include <sstream>
#include <string>
#include <vector>

struct OrderRow {
    int orderId;
    std::string date;     // "2026-11-06 10:15"
    std::string product;
    std::string color;
    int qty;
    long long price;
    long long total;
};

struct Stats {
    int qty = 0;
    long long revenue = 0;
};

std::vector<std::string> split(const std::string& line, char sep) {
    std::vector<std::string> parts;
    std::stringstream ss(line);
    std::string part;
    while (std::getline(ss, part, sep)) parts.push_back(part);
    return parts;
}

// 1234567 -> "1 234 567 so'm"
std::string formatMoney(long long sum) {
    std::string digits = std::to_string(sum);
    std::string out;
    int count = 0;
    for (int i = static_cast<int>(digits.size()) - 1; i >= 0; --i) {
        out.insert(out.begin(), digits[i]);
        if (++count % 3 == 0 && i > 0) out.insert(out.begin(), ' ');
    }
    return out + " so'm";
}

std::vector<OrderRow> readOrders(const std::string& path, bool& ok) {
    std::vector<OrderRow> rows;
    std::ifstream file(path);
    ok = static_cast<bool>(file);
    if (!ok) return rows;

    std::string line;
    std::getline(file, line);  // sarlavha qatorini o'tkazib yuborish
    while (std::getline(file, line)) {
        if (!line.empty() && line.back() == '\r') line.pop_back();  // Windows qator oxiri
        if (line.empty()) continue;
        std::vector<std::string> c = split(line, ',');
        if (c.size() < 7) continue;
        try {
            rows.push_back({std::stoi(c[0]), c[1], c[2], c[3], std::stoi(c[4]), std::stoll(c[5]), std::stoll(c[6])});
        } catch (...) {
            // buzilgan qatorni tashlab ketamiz
        }
    }
    return rows;
}

void printLine() { std::cout << std::string(46, '-') << '\n'; }

void printTable(const std::string& title, const std::map<std::string, Stats>& data) {
    std::cout << '\n' << title << '\n';
    printLine();
    std::cout << std::left << std::setw(18) << "Nomi" << std::right << std::setw(8) << "Soni"
              << std::setw(20) << "Tushum" << '\n';
    printLine();
    for (const auto& [name, s] : data) {
        std::cout << std::left << std::setw(18) << name << std::right << std::setw(8) << s.qty
                  << std::setw(20) << formatMoney(s.revenue) << '\n';
    }
}

int main(int argc, char* argv[]) {
    const std::string path = argc > 1 ? argv[1] : "data/orders.csv";

    bool ok = false;
    std::vector<OrderRow> rows = readOrders(path, ok);
    if (!ok) {
        std::cerr << "Fayl topilmadi: " << path << '\n'
                  << "Avval `python server.py` ni ishga tushirib, saytdan buyurtma bering.\n";
        return 1;
    }
    if (rows.empty()) {
        std::cout << "Hozircha buyurtmalar yo'q.\n";
        return 0;
    }

    std::set<int> orderIds;
    std::map<std::string, Stats> byColor;
    std::map<std::string, Stats> byDay;
    int totalQty = 0;
    long long totalRevenue = 0;

    for (const OrderRow& r : rows) {
        orderIds.insert(r.orderId);
        totalQty += r.qty;
        totalRevenue += r.total;

        byColor[r.color].qty += r.qty;
        byColor[r.color].revenue += r.total;

        const std::string day = r.date.substr(0, 10);  // faqat sana qismi
        byDay[day].qty += r.qty;
        byDay[day].revenue += r.total;
    }

    auto best = std::max_element(byColor.begin(), byColor.end(),
                                 [](const auto& a, const auto& b) { return a.second.qty < b.second.qty; });

    std::cout << "\n===== GAMEPAD SAVDO HISOBOTI =====\n";
    std::cout << "Buyurtmalar soni : " << orderIds.size() << " ta\n";
    std::cout << "Sotilgan mahsulot: " << totalQty << " dona\n";
    std::cout << "Umumiy tushum    : " << formatMoney(totalRevenue) << '\n';
    std::cout << "O'rtacha buyurtma: " << formatMoney(totalRevenue / static_cast<long long>(orderIds.size())) << '\n';
    std::cout << "Eng ko'p sotilgan: " << best->first << " rang (" << best->second.qty << " dona)\n";

    printTable("Ranglar bo'yicha:", byColor);
    printTable("Kunlar bo'yicha:", byDay);
    std::cout << '\n';
    return 0;
}
