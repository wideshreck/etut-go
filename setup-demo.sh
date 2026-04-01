#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  ETUT PRO — Otomatik Demo Kurulum Scripti
#  Gereksinimler: brew, docker, python3.12, uv, node, pnpm
# ═══════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

print_header() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  ETUT PRO — Demo Kurulum${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BLUE}[${1}]${NC} ${BOLD}${2}${NC}"
}

print_ok() {
    echo -e "  ${GREEN}✓${NC} ${1}"
}

print_warn() {
    echo -e "  ${YELLOW}⚠${NC} ${1}"
}

print_error() {
    echo -e "  ${RED}✗${NC} ${1}"
}

# ─── Proje dizinini tespit et ──────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

print_header

# ─── Gereksinim kontrolu ──────────────────────────────────────
print_step "1/8" "Gereksinimler kontrol ediliyor..."

MISSING=()

if ! command -v docker &> /dev/null; then
    MISSING+=("docker")
fi

if ! command -v python3.12 &> /dev/null && ! command -v python3 &> /dev/null; then
    MISSING+=("python3.12")
fi

if ! command -v uv &> /dev/null; then
    MISSING+=("uv")
fi

if ! command -v node &> /dev/null; then
    MISSING+=("node")
fi

if ! command -v pnpm &> /dev/null; then
    MISSING+=("pnpm")
fi

if [ ${#MISSING[@]} -ne 0 ]; then
    print_error "Eksik uygulamalar: ${MISSING[*]}"
    echo ""
    echo "  Lutfen once KURULUM_REHBERI.txt dosyasindaki"
    echo "  Adim 1-5'i takip ederek gerekli araclari yukleyin."
    echo ""
    echo "  Hizli kurulum (tum gereksinimler icin):"
    echo ""

    for tool in "${MISSING[@]}"; do
        case $tool in
            docker)
                echo "    brew install --cask docker"
                echo "    (Sonra Applications'tan Docker'i acin)"
                ;;
            python3.12)
                echo "    brew install python@3.12"
                ;;
            uv)
                echo "    brew install uv"
                ;;
            node)
                echo "    brew install node@22"
                ;;
            pnpm)
                echo "    npm install -g pnpm"
                ;;
        esac
    done
    echo ""
    exit 1
fi

# Docker daemon kontrolu
if ! docker info &> /dev/null 2>&1; then
    print_error "Docker Desktop calisiyor degil!"
    echo "  Lutfen Applications klasorunden Docker'i acin"
    echo "  ve ust menude balina ikonunu bekleyin."
    exit 1
fi

print_ok "docker $(docker --version | grep -oP '\d+\.\d+\.\d+' | head -1)"
print_ok "python3 $(python3 --version 2>&1 | grep -oP '\d+\.\d+\.\d+' || echo 'OK')"
print_ok "uv $(uv --version 2>&1 | grep -oP '\d+\.\d+\.\d+' || echo 'OK')"
print_ok "node $(node --version)"
print_ok "pnpm $(pnpm --version)"

# ─── PostgreSQL'i baslat ───────────────────────────────────────
print_step "2/8" "PostgreSQL veritabani baslatiliyor..."

cd "$SCRIPT_DIR/backend"

# Mevcut container varsa dur ve kaldir
docker compose down 2>/dev/null || true
docker compose up -d

# Veritabaninin hazir olmasini bekle
echo -n "  Veritabani hazirlaniyor"
for i in {1..15}; do
    if docker compose exec -T db pg_isready -U etut &>/dev/null 2>&1; then
        echo ""
        print_ok "PostgreSQL hazir (localhost:5432)"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 15 ]; then
        echo ""
        print_error "PostgreSQL baslatılamadi. Docker Desktop'in calistigini kontrol edin."
        exit 1
    fi
done

# ─── Backend ortamini hazirla ──────────────────────────────────
print_step "3/8" "Backend ortam degiskenleri ayarlaniyor..."

if [ ! -f .env ]; then
    cp .env.example .env
    print_ok ".env dosyasi olusturuldu"
else
    print_ok ".env dosyasi zaten mevcut"
fi

# ─── Backend bagimlilikları yukle ──────────────────────────────
print_step "4/8" "Python bagimliliklari yukleniyor..."

uv sync 2>&1 | tail -1
print_ok "Python paketleri yuklendi"

# ─── Veritabani migration ─────────────────────────────────────
print_step "5/8" "Veritabani tablolari olusturuluyor..."

uv run alembic upgrade head 2>&1 | tail -3
print_ok "22 tablo olusturuldu"

# ─── Demo verilerini yukle ─────────────────────────────────────
print_step "6/8" "Demo verileri yukleniyor..."

uv run python -m scripts.seed_demo_data 2>&1
print_ok "Demo verileri yuklendi"

# ─── Frontend ortamini hazirla ─────────────────────────────────
print_step "7/8" "Frontend bagimliliklari yukleniyor..."

cd "$SCRIPT_DIR/frontend"

if [ ! -f .env.local ]; then
    cp .env.example .env.local
    print_ok ".env.local dosyasi olusturuldu"
else
    print_ok ".env.local dosyasi zaten mevcut"
fi

pnpm install --frozen-lockfile 2>&1 | tail -1
print_ok "Node.js paketleri yuklendi"

# ─── Servisleri baslat ─────────────────────────────────────────
print_step "8/8" "Servisler baslatiliyor..."

# Backend'i arkaplanda baslat
cd "$SCRIPT_DIR/backend"
uv run uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID"

# Backend'in hazir olmasini bekle
echo -n "  Backend hazirlaniyor"
for i in {1..20}; do
    if curl -s http://localhost:8000/health &>/dev/null; then
        echo ""
        print_ok "Backend hazir (http://localhost:8000)"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 20 ]; then
        echo ""
        print_warn "Backend yavas basladi, birkac saniye daha bekleyin"
    fi
done

# Frontend'i arkaplanda baslat
cd "$SCRIPT_DIR/frontend"
pnpm dev --port 3000 &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID"
sleep 3
print_ok "Frontend hazir (http://localhost:3000)"

# ─── Sonuc ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  KURULUM TAMAMLANDI!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Tarayicinizda acin:${NC}  ${CYAN}http://localhost:3000${NC}"
echo ""
echo -e "  ${BOLD}Giris Bilgileri (tum sifreler: demo123):${NC}"
echo ""
echo -e "  Superadmin:  ${YELLOW}super@etutpro.com${NC}         (/superadmin-login)"
echo -e "  Admin:       ${YELLOW}admin@yildizegitim.com${NC}    (/login)"
echo -e "  Ogretmen:    ${YELLOW}mehmet@yildizegitim.com${NC}   (/login)"
echo -e "  Ogrenci:     ${YELLOW}ece@ogrenci.com${NC}           (/login)"
echo -e "  Veli:        ${YELLOW}ayse.yilmaz@veli.com${NC}      (/login)"
echo ""
echo -e "  ${BOLD}Servisler:${NC}"
echo -e "  Frontend:    http://localhost:3000"
echo -e "  Backend:     http://localhost:8000"
echo -e "  API Docs:    http://localhost:8000/docs"
echo -e "  PostgreSQL:  localhost:5432"
echo ""
echo -e "  Durdurmak icin: ${RED}Ctrl+C${NC}"
echo ""

# Ctrl+C ile temiz kapatma
cleanup() {
    echo ""
    echo -e "\n${YELLOW}Servisler durduruluyor...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}Servisler durduruldu. Veritabani Docker'da calismaya devam eder.${NC}"
    echo -e "Veritabanini da durdurmak icin: cd backend && docker compose down"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Her iki process bitene kadar bekle
wait
