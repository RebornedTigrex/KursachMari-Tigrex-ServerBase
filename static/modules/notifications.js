// modules/notifications.js - Module for handling dynamic notifications

window.notifications = (function () {
    const container = document.getElementById('notification-container');

    function createNotificationElement(message, type) {
        const div = document.createElement('div');
        div.className = `
        px-6 py-4 rounded-xl shadow-2xl backdrop-blur-lg border border-white/10
        text-white font-medium min-w-80 transform transition-all duration-300
        ${type === 'success'
                ? 'bg-gradient-to-r from-green-600 to-emerald-600'
                : 'bg-gradient-to-r from-red-600 to-rose-600'}
    `;
        div.innerHTML = message;
        return div;
    }

    function showNotification(message, type = 'success', duration = 3000) {
        container.innerHTML = ''; // Clear previous notifications
        const notification = createNotificationElement(message, type);
        container.appendChild(notification);
        container.classList.remove('hidden');

        setTimeout(() => {
            container.classList.add('hidden');
            container.innerHTML = '';
        }, duration);
    }

    function showSuccess(message) {
        showNotification(message, 'success');
    }

    function showError(error) {
        let errorMessage = 'Ошибка операции';
        if (error instanceof Error) {
            errorMessage += `: ${error.message}`;
        } else if (error.status) {
            errorMessage += ` (Код: ${error.status})`;
        }

        // Dynamic JSON parsing if response body exists
        if (error.body) {
            try {
                const errorData = JSON.parse(error.body);
                Object.entries(errorData).forEach(([key, value]) => {
                    errorMessage += `<br>${key.charAt(0).toUpperCase() + key.slice(1)}: ${value}`;
                });
            } catch (parseError) {
                errorMessage += `<br>Детали: ${error.body}`;
            }
        }

        showNotification(errorMessage, 'error', 5000); // Longer duration for errors
    }

    return {
        showSuccess,
        showError
    };
})();