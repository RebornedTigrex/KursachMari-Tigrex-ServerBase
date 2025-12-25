class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <footer class="py-8 border-t">
                <div class="container mx-auto px-4">
                    <div class="flex flex-col md:flex-row justify-between items-center">
                        <div class="mb-4 md:mb-0">
                            <p class="text-gray-500 text-sm">&copy; ${new Date().getFullYear()} AdHarmony Agency. All rights reserved.</p>
                        </div>
                        <div class="flex space-x-6">
                            <a href="#" class="footer-link">Privacy Policy</a>
                            <a href="#" class="footer-link">Terms of Service</a>
                            <a href="#" class="footer-link">Contact Us</a>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }
}
customElements.define('custom-footer', CustomFooter);