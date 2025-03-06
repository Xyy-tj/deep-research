/**
 * Construction Page Manager
 * Handles the display of "under construction" pages for tabs that are not yet implemented
 */
class ConstructionPageManager {
    constructor() {
        this.template = null;
        this.loadedTabs = new Set(['research', 'caseLibrary']); // Tabs that already have content
        this.constructionContainer = null;
    }

    /**
     * Initialize the construction page manager
     */
    async init() {
        try {
            // Load the construction template
            const response = await fetch('/templates/construction.html');
            if (!response.ok) {
                console.error('Failed to load construction template:', response.status);
                return;
            }
            this.template = await response.text();
            
            // Create container for construction pages if needed
            if (!document.getElementById('constructionContainer')) {
                this.constructionContainer = document.createElement('div');
                this.constructionContainer.id = 'constructionContainer';
                this.constructionContainer.style.display = 'none';
                document.getElementById('app').appendChild(this.constructionContainer);
            } else {
                this.constructionContainer = document.getElementById('constructionContainer');
            }
            
            console.log('Construction page manager initialized');
        } catch (error) {
            console.error('Error initializing construction page manager:', error);
        }
    }

    /**
     * Show the construction page for a specific tab
     * @param {string} tabName - The name of the tab
     * @returns {boolean} - True if construction page was shown, false if tab has content
     */
    showForTab(tabName) {
        // If tab has content, don't show construction page
        if (this.loadedTabs.has(tabName)) {
            return false;
        }
        
        // If template isn't loaded yet, try to load it
        if (!this.template) {
            this.init().then(() => this.showForTab(tabName));
            return true;
        }
        
        // Show the construction container
        this.constructionContainer.innerHTML = this.template;
        this.constructionContainer.style.display = 'block';
        
        // Customize the message based on tab
        const titleElement = this.constructionContainer.querySelector('.construction-title');
        const messageElement = this.constructionContainer.querySelector('.construction-message');
        
        if (titleElement && messageElement) {
            // Set custom messages based on tab
            switch(tabName) {
                case 'history':
                    titleElement.textContent = '历史记录功能正在建设中...';
                    messageElement.innerHTML = '我们正在开发历史记录功能，让您可以轻松查看和管理过去的研究记录。<br>敬请期待！';
                    break;
                case 'favorites':
                    titleElement.textContent = '收藏夹功能正在建设中...';
                    messageElement.innerHTML = '收藏夹功能将让您能够保存和整理您最重要的研究结果。<br>我们正在努力开发中！';
                    break;
                case 'settings':
                    titleElement.textContent = '设置功能正在建设中...';
                    messageElement.innerHTML = '个性化设置功能将让您能够自定义研究体验。<br>敬请期待这一强大功能！';
                    break;
                case 'help':
                    titleElement.textContent = '帮助中心正在建设中...';
                    messageElement.innerHTML = '我们正在编写详细的使用指南和常见问题解答。<br>感谢您的耐心等待！';
                    break;
                default:
                    titleElement.textContent = '功能正在开发中...';
                    messageElement.innerHTML = '此功能正在积极开发中，敬请期待！<br>感谢您的耐心等待。';
            }
        }
        
        // Add water ink effect to any buttons
        const buttons = this.constructionContainer.querySelectorAll('.construction-button');
        buttons.forEach(button => {
            button.addEventListener('click', function(e) {
                // Create ink effect
                const ink = document.createElement('span');
                ink.className = 'ink-effect';
                this.appendChild(ink);
                
                // Set position and size
                const rect = this.getBoundingClientRect();
                const size = Math.max(rect.width, rect.height) * 2;
                
                ink.style.width = size + 'px';
                ink.style.height = size + 'px';
                ink.style.left = (e.clientX - rect.left - size/2) + 'px';
                ink.style.top = (e.clientY - rect.top - size/2) + 'px';
                
                // Add animation
                ink.style.animation = 'ink-spread 0.6s ease-out forwards';
                
                // Remove after animation
                setTimeout(() => {
                    ink.remove();
                }, 600);
            });
        });
        
        return true;
    }

    /**
     * Hide the construction page
     */
    hide() {
        if (this.constructionContainer) {
            this.constructionContainer.style.display = 'none';
        }
    }
}

// Initialize the construction page manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.constructionManager = new ConstructionPageManager();
    window.constructionManager.init();
});
