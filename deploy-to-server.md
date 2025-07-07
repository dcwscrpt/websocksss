# 🚀 Деплой на сервер 87.249.54.192

## Шаг 1: Подключение к серверу

```bash
ssh username@87.249.54.192
```

## Шаг 2: Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установка Git
sudo apt-get install git

# Проверка версий
node --version
npm --version
```

## Шаг 3: Клонирование проекта

```bash
# Переход в директорию
cd /var/www

# Создание директории (если не существует)
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www

# Клонирование репозитория
git clone https://github.com/your-username/your-repo.git websocket-chat
cd websocket-chat

# Или если у вас локальные файлы, загрузите их через SCP:
# scp -r /path/to/local/project username@87.249.54.192:/var/www/websocket-chat
```

## Шаг 4: Настройка проекта

```bash
# Переход в директорию проекта
cd /var/www/websocket-chat

# Установка зависимостей
npm install

# Создание директории для логов
mkdir -p logs

# Проверка конфигурации
cat config.js
```

## Шаг 5: Настройка файрвола

```bash
# Открытие порта 3000
sudo ufw allow 3000

# Проверка статуса файрвола
sudo ufw status
```

## Шаг 6: Запуск приложения

### Вариант A: Автоматический деплой
```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запустить деплой
./deploy.sh
```

### Вариант B: Ручной запуск
```bash
# Установка PM2
npm install -g pm2

# Запуск через PM2
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации
pm2 save

# Настройка автозапуска
pm2 startup
```

## Шаг 7: Проверка работы

```bash
# Проверка статуса
pm2 status

# Просмотр логов
pm2 logs websocket-chat

# Проверка порта
sudo netstat -tlnp | grep :3000
```

## Шаг 8: Доступ к приложению

Откройте в браузере:
```
http://87.249.54.192:3000/public/client.html
```

## 🔧 Управление приложением

```bash
# Перезапуск
pm2 restart websocket-chat

# Остановка
pm2 stop websocket-chat

# Просмотр логов в реальном времени
pm2 logs websocket-chat --lines 100

# Мониторинг
pm2 monit
```

## 🛠️ Устранение неполадок

### Если порт занят:
```bash
# Поиск процесса
sudo lsof -ti:3000

# Остановка процесса
sudo kill -9 $(sudo lsof -ti:3000)
```

### Если PM2 не работает:
```bash
# Перезапуск PM2
pm2 kill
pm2 start ecosystem.config.js
```

### Проверка подключения:
```bash
# Тест WebSocket
curl -I http://87.249.54.192:3000
```

## 📝 Логи

```bash
# Просмотр логов приложения
tail -f logs/out.log

# Просмотр ошибок
tail -f logs/err.log
```

## 🔄 Обновление

```bash
# Переход в директорию
cd /var/www/websocket-chat

# Получение обновлений
git pull

# Установка зависимостей
npm install

# Перезапуск
pm2 restart websocket-chat
```

## ✅ Проверка готовности

1. ✅ Сервер доступен по SSH
2. ✅ Node.js установлен
3. ✅ Проект загружен
4. ✅ Зависимости установлены
5. ✅ Порт 3000 открыт
6. ✅ Приложение запущено через PM2
7. ✅ Клиент подключается к `ws://87.249.54.192:3000` 