// Dify Chatbot Configuration
document.addEventListener('DOMContentLoaded', () => {
    // Configure Dify chatbot
    window.difyChatbotConfig = {
        token: 'O0yL43ld1ZFReTVH',
        baseUrl: 'https://dify.zyfan.zone'
    };
    
    // Load the chatbot script if it's not already loaded
    if (!document.getElementById('dify-chatbot-script')) {
        const script = document.createElement('script');
        script.id = 'dify-chatbot-script';
        script.src = 'https://dify.zyfan.zone/embed.min.js';
        script.setAttribute('defer', '');
        document.body.appendChild(script);
    }
});
