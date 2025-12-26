// modules/notifications.js - Расширенная версия с типом warning (жёлтое уведомление)

window.notifications = (function () {
    const container = document.getElementById('notification-container');

    if (!container) {
        console.warn('notification-container не найден на странице');
        return { showSuccess: () => {}, showError: () => {}, showWarning: () => {} };
    }

    function createNotificationElement(message, type) {
        const div = document.createElement('div');
        let bgClass = '';
        switch (type) {
            case 'success':
                bgClass = 'bg-gradient-to-r from-emerald-600 to-green-600 border-emerald-400/30';
                break;
            case 'error':
                bgClass = 'bg-gradient-to-r from-rose-600 to-red-600 border-rose-400/30';
                break;
            case 'warning':
                bgClass = 'bg-gradient-to-r from-amber-500 to-orange-600 border-amber-400/30';
                break;
        }

        div.className = `
            px-6 py-4 rounded-2xl shadow-2xl backdrop-blur-xl border
            text-white font-medium text-center mb-3 pointer-events-auto
            transform translate-y-[-20px] opacity-0 transition-all duration-500
            ${bgClass}
        `;
        div.innerHTML = message;

        // Анимация появления
        setTimeout(() => {
            div.style.transform = 'translateY(0)';
            div.style.opacity = '1';
        }, 10);

        return div;
    }

    function showNotification(message, type = 'success', duration = 4000) {
        container.innerHTML = '';
        const notification = createNotificationElement(message, type);
        container.appendChild(notification);

        // Авто-скрытие
        setTimeout(() => {
            notification.style.transform = 'translateY(-20px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) container.removeChild(notification);
            }, 500);
        }, duration);
    }

    function showSuccess(message, duration) {
        showNotification(message, 'success', duration);
    }

    function showError(error, duration = 6000) {
        let errorMessage = 'Ошибка операции';
        if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
        } else if (error && error.status) {
            errorMessage += ` (Код: ${error.status})`;
        }

        if (error && error.body) {
            try {
                const errorData = JSON.parse(error.body);
                Object.entries(errorData).forEach(([key, value]) => {
                    errorMessage += `<br>${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
                });
            } catch (parseError) {
                errorMessage += `<br>Детали: ${error.body}`;
            }
        }

        showNotification(errorMessage, 'error', duration);
    }

    function showWarning(message, duration = 8000) {
        showNotification(message, 'warning', duration);
    }

    return {
        showSuccess,
        showError,
        showWarning
    };
})();