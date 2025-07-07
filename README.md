# 🌐 WebSocket Чат

Современный веб-чат с темным дизайном, поддерживающий отправку медиафайлов, звонки и уведомления.

## ✨ Особенности

- 🎨 **Темный современный дизайн** с градиентами и анимациями
- 💬 **Реальные сообщения** с историей и индикатором печати
- 📱 **Адаптивный интерфейс** для мобильных устройств
- 📎 **Отправка медиафайлов** (изображения, видео, аудио, документы)
- 📞 **Звонки** с WebRTC (подготовлена структура)
- 🔔 **Уведомления** о новых сообщениях
- 👥 **Список пользователей** с возможностью звонков
- 🔄 **Автопереподключение** при разрыве соединения
- 📊 **Логирование** и мониторинг

## 🚀 Быстрый старт

### Локальная разработка

```bash
# Установка зависимостей
npm install

# Запуск сервера
npm start
```

Откройте `http://localhost:3000/public/client.html` в браузере.

## 🌍 Деплой на сервер

### 1. Подготовка сервера

```bash
# Подключение к серверу
ssh username@your-server-ip

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

### 2. Клонирование проекта

```bash
# Переход в директорию
cd /var/www

# Клонирование репозитория
git clone https://github.com/your-username/your-repo.git websocket-chat
cd websocket-chat

# Установка зависимостей
npm install
```

### 3. Автоматический деплой

```bash
# Сделать скрипт исполняемым
chmod +x deploy.sh

# Запустить деплой
./deploy.sh
```

### 4. Ручной деплой

```bash
# Установка PM2
npm install -g pm2

# Создание директории для логов
mkdir -p logs

# Запуск через PM2
pm2 start ecosystem.config.js --env production

# Сохранение конфигурации
pm2 save

# Настройка автозапуска
pm2 startup
```

### 5. Настройка файрвола

```bash
# Открытие порта 3000
sudo ufw allow 3000

# Проверка статуса
sudo ufw status
```

## 📁 Структура проекта

```
websocket-chat/
├── server.js              # Основной сервер
├── package.json           # Зависимости
├── ecosystem.config.js    # Конфигурация PM2
├── deploy.sh             # Скрипт деплоя
├── public/
│   ├── client.html       # HTML интерфейс
│   └── client.js         # JavaScript клиент
└── logs/                 # Логи приложения
```

## ⚙️ Конфигурация

### Переменные окружения

```bash
# В файле ecosystem.config.js или .env
NODE_ENV=production    # Режим работы
PORT=3000             # Порт сервера
```

### PM2 команды

```bash
# Просмотр статуса
pm2 status

# Просмотр логов
pm2 logs websocket-chat

# Перезапуск
pm2 restart websocket-chat

# Остановка
pm2 stop websocket-chat

# Удаление
pm2 delete websocket-chat

# Мониторинг
pm2 monit
```

## 🔧 Настройка домена и SSL

### 1. Настройка Nginx (опционально)

```bash
# Установка Nginx
sudo apt install nginx

# Создание конфигурации
sudo nano /etc/nginx/sites-available/websocket-chat
```

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Активация сайта
sudo ln -s /etc/nginx/sites-available/websocket-chat /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 2. SSL сертификат (Let's Encrypt)

```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d your-domain.com

# Автообновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

## 📊 Мониторинг

### Логи

```bash
# Просмотр логов в реальном времени
pm2 logs websocket-chat --lines 100

# Просмотр ошибок
pm2 logs websocket-chat --err

# Просмотр вывода
pm2 logs websocket-chat --out
```

### Статистика

```bash
# Мониторинг процессов
pm2 monit

# Статистика использования ресурсов
pm2 show websocket-chat
```

## 🔄 Обновление

```bash
# Переход в директорию проекта
cd /var/www/websocket-chat

# Получение обновлений
git pull

# Установка новых зависимостей
npm install

# Перезапуск приложения
pm2 restart websocket-chat
```

## 🛠️ Устранение неполадок

### Проблемы с подключением

1. **Проверьте порт:**
   ```bash
   sudo netstat -tlnp | grep :3000
   ```

2. **Проверьте файрвол:**
   ```bash
   sudo ufw status
   ```

3. **Проверьте логи:**
   ```bash
   pm2 logs websocket-chat
   ```

### Проблемы с PM2

1. **Перезапуск PM2:**
   ```bash
   pm2 kill
   pm2 start ecosystem.config.js
   ```

2. **Сброс конфигурации:**
   ```bash
   pm2 unstartup
   pm2 startup
   ```

## 📝 Лицензия

MIT License

## 🤝 Поддержка

Если у вас возникли проблемы или вопросы, создайте Issue в репозитории. 