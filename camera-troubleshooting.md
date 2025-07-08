# 🔧 Устранение проблем с камерой и микрофоном

## ❌ Ошибка: "Cannot read properties of undefined (reading 'getUserMedia')"

### Причины:
1. **Старый браузер** - не поддерживает WebRTC
2. **Отсутствует HTTPS** - getUserMedia требует безопасное соединение
3. **Блокировка браузером** - расширения или настройки безопасности

### Решения:

## 🌐 **1. Проверьте браузер**

### ✅ Поддерживаемые браузеры:
- **Chrome** 53+ (рекомендуется)
- **Firefox** 36+
- **Safari** 11+
- **Edge** 79+

### ❌ Не поддерживаются:
- Internet Explorer
- Старые версии браузеров

## 🔒 **2. HTTPS соединение**

### Для локальной разработки:
```bash
# Запуск с HTTPS (локально)
npm install -g http-server
http-server --ssl --cert ~/.localhost-ssl/localhost.crt --key ~/.localhost-ssl/localhost.key
```

### Для продакшена:
```bash
# Настройка SSL на сервере
sudo certbot --nginx -d your-domain.com
```

## 🛠️ **3. Настройки браузера**

### Chrome:
1. Откройте `chrome://settings/content/camera`
2. Разрешите доступ к камере для вашего сайта
3. Откройте `chrome://settings/content/microphone`
4. Разрешите доступ к микрофону

### Firefox:
1. Откройте `about:preferences#privacy`
2. Прокрутите до "Разрешения"
3. Нажмите "Настройки" рядом с "Камера" и "Микрофон"
4. Разрешите доступ для вашего сайта

### Safari:
1. Safari → Настройки → Веб-сайты
2. Выберите "Камера" и "Микрофон"
3. Разрешите доступ для вашего сайта

## 🔧 **4. Проверка устройств**

### Windows:
```cmd
# Проверка камеры
start ms-settings:camera

# Проверка микрофона
start ms-settings:sound
```

### macOS:
```bash
# Проверка камеры
open /System/Library/PreferencePanes/Security.prefPane
```

### Linux:
```bash
# Проверка устройств
ls /dev/video*
ls /dev/audio*
```

## 🚫 **5. Блокировка расширениями**

### Отключите расширения:
1. Откройте браузер в режиме инкогнито
2. Или временно отключите все расширения
3. Проверьте работу звонков

### Популярные блокировщики:
- uBlock Origin
- AdBlock Plus
- Privacy Badger
- Ghostery

## 📱 **6. Мобильные устройства**

### Android:
1. Настройки → Приложения → Ваш браузер
2. Разрешения → Камера и Микрофон

### iOS:
1. Настройки → Safari → Камера и Микрофон
2. Разрешите доступ для вашего сайта

## 🔍 **7. Диагностика**

### Проверьте консоль браузера:
```javascript
// Проверка поддержки
console.log('mediaDevices:', !!navigator.mediaDevices);
console.log('getUserMedia:', !!navigator.mediaDevices?.getUserMedia);

// Тест доступа
navigator.mediaDevices.getUserMedia({video: true, audio: true})
  .then(stream => console.log('Успех:', stream))
  .catch(error => console.error('Ошибка:', error));
```

### Проверьте устройства:
```javascript
// Список устройств
navigator.mediaDevices.enumerateDevices()
  .then(devices => {
    devices.forEach(device => {
      console.log(device.kind, device.label);
    });
  });
```

## 🆘 **8. Альтернативные решения**

### Если камера не работает:
1. **Только аудио звонки** - отключите видео
2. **Эмуляция камеры** - для тестирования
3. **Другой браузер** - попробуйте Chrome

### Код для только аудио:
```javascript
// Только аудио звонок
this.localStream = await getUserMedia({
    video: false,
    audio: {
        echoCancellation: true,
        noiseSuppression: true
    }
});
```

## 📞 **9. Тестирование**

### Простой тест:
1. Откройте `https://webrtc.github.io/samples/src/content/getusermedia/gum/`
2. Нажмите "Start"
3. Если работает - проблема в вашем коде
4. Если не работает - проблема в браузере/устройствах

## 🎯 **10. Быстрые решения**

### Для разработки:
```bash
# Запуск с флагами Chrome
chrome --unsafely-treat-insecure-origin-as-secure="http://localhost:3000"
```

### Для продакшена:
```bash
# Обязательно HTTPS
# Настройте SSL сертификат
# Используйте современный браузер
```

## 📋 **Чек-лист:**

- [ ] Современный браузер (Chrome/Firefox/Safari)
- [ ] HTTPS соединение (или localhost)
- [ ] Разрешен доступ к камере/микрофону
- [ ] Устройства подключены и работают
- [ ] Нет блокировки расширениями
- [ ] Проверен в режиме инкогнито 