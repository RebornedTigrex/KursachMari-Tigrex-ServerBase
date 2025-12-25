// components/navbar.js - Финальная версия: sticky без jitter + кнопки выровнены идеально
class CustomNavbar extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap');
        
        :host {
          display: block;
          width: 100%;
        }
        
        .navbar-wrapper {
          height: 40px; /* Фиксированная высота navbar */
          position: relative;
        }
        
        .navbar-container {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 2rem;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          height: 40px;
          z-index: 40;
        }
        
        /* Sticky состояние */
        .navbar-container.sticky {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          background: rgba(15, 23, 42, 0.7);
          box-shadow: 0 12px 40px rgba(139, 92, 246, 0.3);
          border-bottom: none;
          z-index: 50;
        }
        
        .navbar-container.sticky:hover {
          background: rgba(15, 23, 42, 0.8);
        }
        
        /* Логотип */
        .logo-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          text-decoration: none;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 1.5rem;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          transition: all 0.3s ease;
        }
        
        .logo-link:hover {
          transform: scale(1.05);
          filter: drop-shadow(0 0 15px rgba(139, 92, 246, 0.6));
        }
        
        .logo-icon {
          width: 32px;
          height: 32px;
          color: #8b5cf6;
          filter: drop-shadow(0 0 8px rgba(139, 92, 246, 0.5));
          transition: transform 0.4s ease;
        }
        
        .logo-link:hover .logo-icon {
          transform: rotate(360deg);
        }
        
        /* Кнопки навигации */
        .nav-buttons {
          display: flex;
          gap: 2rem;
          align-items: center;
        }
        
        .nav-button {
          position: relative;
          text-decoration: none;
          color: #94a3b8;
          font-weight: 500;
          font-size: 1.1rem;
          padding: 0.5rem 0;
          transition: all 0.3s ease;
          overflow: hidden;
        }
        
        .nav-button::before {
          content: '';
          position: absolute;
          bottom: 0;
          left: -100%;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 2px;
          transition: left 0.5s ease;
          box-shadow: 0 0 15px rgba(139, 92, 246, 0.6);
        }
        
        .nav-button:hover,
        .nav-button.active {
          color: #e2e8f0;
          text-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
        }
        
        .nav-button:hover::before,
        .nav-button.active::before {
          left: 0;
        }
        
        /* Shine-эффект */
        .navbar-container::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent);
          transition: left 0.8s ease;
          pointer-events: none;
        }
        
        .navbar-container:hover::after {
          left: 100%;
        }
        
        @media (max-width: 768px) {
          .nav-buttons { gap: 1rem; }
          .nav-button { font-size: 1rem; }
          .navbar-container { padding: 1rem; }
        }
      </style>
      
      <div class="navbar-wrapper">
        <div class="navbar-container" id="navbar">
          <a href="/" class="logo-link">
            <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
              <path d="M2 17l10 5 10-5"></path>
              <path d="M2 12l10 5 10-5"></path>
            </svg>
            <span>AdHarmony</span>
          </a>
          <div class="nav-buttons">
            <a href="/" class="nav-button ${location.pathname === '/' ? 'active' : ''}">Главное меню</a>
            <a href="/clients" class="nav-button ${location.pathname.startsWith('/clients') ? 'active' : ''}">Клиенты</a>
            <a href="/campaigns" class="nav-button ${location.pathname.startsWith('/campaigns') ? 'active' : ''}">Кампании</a>
            <a href="/team" class="nav-button ${location.pathname.startsWith('/team') ? 'active' : ''}">Команда</a>
          </div>
        </div>
      </div>
    `;

        const navbar = this.shadowRoot.getElementById('navbar');
        const wrapper = this.shadowRoot.querySelector('.navbar-wrapper');
        let placeholder = null;
        let isSticky = false;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach(entry => {
                    if (!entry.isIntersecting && !isSticky) {
                        // Становится sticky
                        navbar.classList.add('sticky');
                        placeholder = document.createElement('div');
                        placeholder.className = 'placeholder';
                        this.parentNode.insertBefore(placeholder, this);
                        isSticky = true;
                    } else if (entry.isIntersecting && isSticky) {
                        // Возвращается в обычное положение
                        navbar.classList.remove('sticky');
                        if (placeholder && placeholder.parentNode) {
                            placeholder.parentNode.removeChild(placeholder);
                        }
                        placeholder = null;
                        isSticky = false;
                    }
                });
            },
            { rootMargin: '-1px 0px 0px 0px', threshold: 0 }
        );

        observer.observe(wrapper);
    }
}

customElements.define('custom-navbar', CustomNavbar);