#!/bin/bash

# Скрипт для деплоя WebSocket чата на сервер
# Использование: ./deploy.sh

set -e  # Остановка при ошибке

echo "🚀 Начинаем деплой WebSocket чата..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функции для логирования
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Проверяем, что мы в корневой директории проекта
if [ ! -f "package.json" ]; then
    log_error "package.json не найден. Убедитесь, что вы находитесь в корневой директории проекта."
    exit 1
fi

# Создаем директорию для логов
log_info "Создаем директорию для логов..."
mkdir -p logs

# Устанавливаем зависимости
log_info "Устанавливаем зависимости..."
npm install

# Проверяем, установлен ли PM2
if ! command -v pm2 &> /dev/null; then
    log_warning "PM2 не установлен. Устанавливаем..."
    npm install -g pm2
fi

# Останавливаем предыдущий процесс, если он запущен
log_info "Останавливаем предыдущий процесс..."
pm2 stop websocket-chat 2>/dev/null || true
pm2 delete websocket-chat 2>/dev/null || true

# Запускаем приложение через PM2
log_info "Запускаем приложение через PM2..."
pm2 start ecosystem.config.js --env production

# Сохраняем конфигурацию PM2
log_info "Сохраняем конфигурацию PM2..."
pm2 save

# Настраиваем автозапуск PM2 при перезагрузке системы
log_info "Настраиваем автозапуск PM2..."
pm2 startup 2>/dev/null || {
    log_warning "Не удалось настроить автозапуск. Выполните команду вручную:"
    echo "pm2 startup"
}

# Проверяем статус
log_info "Проверяем статус приложения..."
pm2 status

# Показываем логи
log_info "Показываем последние логи..."
pm2 logs websocket-chat --lines 10

log_success "Деплой завершен успешно!"
log_info "Приложение доступно на порту 3000"
log_info "Для просмотра логов: pm2 logs websocket-chat"
log_info "Для перезапуска: pm2 restart websocket-chat"
log_info "Для остановки: pm2 stop websocket-chat" 