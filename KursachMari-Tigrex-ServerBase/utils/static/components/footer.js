class CustomFooter extends HTMLElement {
    connectedCallback() {
        this.attachShadow({ mode: 'open' });
        this.shadowRoot.innerHTML = `
            <style>
                footer {
                    background-color: #f9fafb;
                    padding-top: 2rem;
                    padding-bottom: 2rem;
                    border-top: 1px solid #e5e7eb;
                }
                
                .container {
                    width: 100%;
                    margin-left: auto;
                    margin-right: auto;
                    padding-left: 1rem;
                    padding-right: 1rem;
                }
                
                .flex {
                    display: flex;
                }
                
                .flex-col {
                    flex-direction: column;
                }
                
                @media (min-width: 768px) {
                    .md\:flex-row {
                        flex-direction: row;
                    }
                }
                
                .justify-between {
                    justify-content: space-between;
                }
                
                .items-center {
                    align-items: center;
                }
                
                .mb-4 {
                    margin-bottom: 1rem;
                }
                
                @media (min-width: 768px) {
                    .md\:mb-0 {
                        margin-bottom: 0;
                    }
                }
                
                .text-gray-500 {
                    color: #6b7280;
                }
                
                .text-sm {
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                
                .space-x-6 > * + * {
                    margin-left: 1.5rem;
                }
                
                .footer-link {
                    color: #6b7280;
                    text-decoration: none;
                    transition: all 0.2s ease;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                }
                
                .footer-link:hover {
                    color: #3b82f6;
                }
            </style>
<footer class="py-8 border-t">
                <div class="container mx-auto px-4">
                    <div class="flex flex-col md:flex-row justify-between items-center">
                        <div class="mb-4 md:mb-0">
                            <p class="text-gray-500 text-sm">&copy; ${new Date().getFullYear()} HR Harmony Hub. All rights reserved.</p>
                        </div>
                        
                        <div class="flex space-x-6">
                            <a href="#" class="footer-link text-gray-500 hover:text-blue-500 text-sm">Privacy Policy</a>
                            <a href="#" class="footer-link text-gray-500 hover:text-blue-500 text-sm">Terms of Service</a>
                            <a href="#" class="footer-link text-gray-500 hover:text-blue-500 text-sm">Contact Us</a>
                        </div>
                    </div>
                </div>
            </footer>
        `;
    }
}

customElements.define('custom-footer', CustomFooter);