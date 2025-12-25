// components/footer.js - Переработанный под dark glassmorphism стиль

class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500&display=swap');

        :host {
          display: block;
          width: 100%;
          margin-top: auto; /* Чтобы футер прилипал к низу при малом контенте */
        }

        footer {
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          padding: 3rem 0 2rem;
          position: relative;
          overflow: hidden;
          margin-top: 4rem;
        }

        footer::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, #8b5cf6, #ec4899, #3b82f6);
          box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .footer-content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
          text-align: center;
        }

        .copyright {
          color: #94a3b8;
          font-size: 0.95rem;
          font-weight: 400;
        }

        .copyright strong {
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          font-weight: 600;
        }

        .footer-links {
          display: flex;
          gap: 2rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .footer-link {
          color: #94a3b8;
          text-decoration: none;
          font-weight: 500;
          font-size: 1rem;
          position: relative;
          transition: all 0.3s ease;
        }

        .footer-link::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 0;
          height: 2px;
          background: linear-gradient(90deg, #8b5cf6, #ec4899);
          border-radius: 1px;
          transition: width 0.4s ease;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.5);
        }

        .footer-link:hover {
          color: #e2e8f0;
          text-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
          transform: translateY(-2px);
        }

        .footer-link:hover::after {
          width: 100%;
        }

        /* Shine-эффект при наведении на весь футер */
        footer::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.08), transparent);
          transition: left 1s ease;
          pointer-events: none;
        }

        footer:hover::after {
          left: 100%;
        }

        @media (max-width: 768px) {
          .footer-links {
            gap: 1.5rem;
            flex-direction: column;
          }
          
          .container {
            padding: 0 1.5rem;
          }
        }
      </style>

      <footer>
        <div class="container">
          <div class="footer-content">
            <div class="copyright">
              &copy; <span id="year"></span> <strong>AdHarmony Agency</strong>. All rights reserved.
            </div>
            
            <div class="footer-links">
              <a href="#" class="footer-link">Privacy Policy</a>
              <a href="#" class="footer-link">Terms of Service</a>
              <a href="#" class="footer-link">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    `;

        // Автоматически обновляем год
        this.shadowRoot.getElementById('year').textContent = new Date().getFullYear();
    }
}

customElements.define('custom-footer', CustomFooter);