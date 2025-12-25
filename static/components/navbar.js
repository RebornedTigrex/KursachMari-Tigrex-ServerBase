class CustomNavbar extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
      <style>
        .logo-icon { color: #8b5cf6; }
      </style>
      
      <div class="navbar-container">
        <a href="/" class="logo-link">
          <svg class="logo-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
            <path d="M2 17l10 5 10-5"></path>
            <path d="M2 12l10 5 10-5"></path>
          </svg>
          <span>AdHarmony Agency</span>
        </a>
        <div class="nav-buttons">
          <a href="/" class="nav-button"><span>Dashboard</span></a>
          <a href="/clients" class="nav-button"><span>Clients</span></a>
          <a href="/campaigns" class="nav-button"><span>Campaigns</span></a>
          <a href="/budgets" class="nav-button"><span>Budgets</span></a>
        </div>
      </div>
    `;
    }
}
customElements.define('custom-navbar', CustomNavbar);