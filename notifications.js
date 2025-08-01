// Notification system for R6 Market Helper

class R6Notifications {
    constructor() {
        this.container = null;
        this.createContainer();
    }
    
    createContainer() {
        // Создаем контейнер для уведомлений только один раз
        if (this.container) return;
        
        this.container = document.createElement('div');
        this.container.id = 'r6-notifications-container';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
            font-family: "Ubisoft Sans", Arial, sans-serif;
        `;
        
        // Добавляем в body или html если body недоступен
        const target = document.body || document.documentElement;
        target.appendChild(this.container);
    }
    
    show(message, type = 'info', duration = 4000) {
        const notification = document.createElement('div');
        notification.className = `r6-notification r6-notification-${type}`;
        
        // Стили для уведомлений
        const baseStyle = `
            background: rgba(0, 0, 0, 0.9);
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            margin-bottom: 10px;
            max-width: 300px;
            font-size: 13px;
            line-height: 1.4;
            pointer-events: auto;
            backdrop-filter: blur(4px);
            border-left: 4px solid;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
        `;
        
        let borderColor = '#3498db'; // info
        let icon = 'ℹ️';
        
        switch (type) {
            case 'success':
                borderColor = '#27ae60';
                icon = '✅';
                break;
            case 'error':
                borderColor = '#e74c3c';
                icon = '❌';
                break;
            case 'warning':
                borderColor = '#f39c12';
                icon = '⚠️';
                break;
        }
        
        notification.style.cssText = baseStyle + `border-left-color: ${borderColor};`;
        notification.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="flex-shrink: 0;">${icon}</span>
                <span>${message}</span>
            </div>
        `;
        
        // Добавляем анимацию
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        
        if (!document.getElementById('r6-notification-styles')) {
            style.id = 'r6-notification-styles';
            document.head.appendChild(style);
        }
        
        // Добавляем уведомление
        this.container.appendChild(notification);
        
        // Автоматическое удаление
        setTimeout(() => {
            this.hide(notification);
        }, duration);
        
        // Клик для закрытия
        notification.addEventListener('click', () => {
            this.hide(notification);
        });
        
        return notification;
    }
    
    hide(notification) {
        if (!notification || !notification.parentNode) return;
        
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }
    
    success(message, duration) {
        return this.show(message, 'success', duration);
    }
    
    error(message, duration) {
        return this.show(message, 'error', duration || 6000); // Ошибки показываем дольше
    }
    
    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
    
    info(message, duration) {
        return this.show(message, 'info', duration);
    }
    
    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}

// Глобальный экземпляр для использования в расширении
window.R6Notify = new R6Notifications();