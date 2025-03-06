document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    const toggleIcon = document.querySelector('.sidebar-toggle i');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const sidebarHeader = document.querySelector('.sidebar-header');
    
    // 已实现的标签页
    const implementedTabs = ['research', 'caseLibrary', 'history'];

    // 添加水墨效果
    function createInkEffect(e, element) {
        // 创建水墨效果元素
        const ink = document.createElement('span');
        ink.className = 'ink-effect';
        element.appendChild(ink);
        
        // 设置水墨效果的位置和大小
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 2;
        
        ink.style.width = size + 'px';
        ink.style.height = size + 'px';
        ink.style.left = (e.clientX - rect.left - size/2) + 'px';
        ink.style.top = (e.clientY - rect.top - size/2) + 'px';
        
        // 添加动画
        ink.style.animation = 'ink-spread 0.6s ease-out forwards';
        
        // 动画结束后移除元素
        setTimeout(() => {
            ink.remove();
        }, 600);
    }

    // 侧边栏展开/收起
    sidebarToggle.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        createInkEffect(e, this);
        
        sidebar.classList.toggle('expanded');
        mainContent.classList.toggle('sidebar-expanded');

        // 更新切换按钮图标
        if (sidebar.classList.contains('expanded')) {
            toggleIcon.classList.remove('fa-chevron-right');
            toggleIcon.classList.add('fa-chevron-left');
        } else {
            toggleIcon.classList.remove('fa-chevron-left');
            toggleIcon.classList.add('fa-chevron-right');
        }
        
        // 添加弹性动画效果
        if (sidebar.classList.contains('expanded')) {
            sidebarItems.forEach((item, index) => {
                item.style.opacity = '0';
                item.style.transform = 'translateX(-20px)';
                setTimeout(() => {
                    item.style.transition = 'all 0.3s ease ' + (index * 0.05) + 's';
                    item.style.opacity = '1';
                    item.style.transform = 'translateX(0)';
                }, 100);
            });
        }
        
        // 保存侧边栏状态
        localStorage.setItem('sidebarExpanded', sidebar.classList.contains('expanded'));
    });

    // 处理侧边栏项目点击
    sidebarItems.forEach(item => {
        item.addEventListener('click', function (e) {
            createInkEffect(e, this);
            
            // 移除其他项目的active类
            sidebarItems.forEach(i => i.classList.remove('active'));
            // 添加当前项目的active类
            this.classList.add('active');

            // 获取对应的tab
            const tab = this.getAttribute('data-tab');
            
            // 触发自定义事件通知相关模块
            const event = new CustomEvent('tabActivated', { 
                detail: { tabId: tab } 
            });
            document.dispatchEvent(event);
            console.log(`Tab activated: ${tab}, event dispatched`);
            
            // 获取所有内容区域
            const contentAreas = [
                document.querySelector('#researchForm')?.closest('.max-w-4xl'),
                document.querySelector('#caseLibraryTab'),
                document.querySelector('#historyTab'),
                document.querySelector('#constructionContainer')
            ];
            
            // 隐藏所有内容区域
            contentAreas.filter(el => el).forEach(el => {
                // 添加淡出效果
                el.style.opacity = '0';
                el.style.transition = 'opacity 0.3s ease';
                
                setTimeout(() => {
                    el.style.display = 'none';
                    
                    // 显示当前选中的内容区域
                    if (tab === 'research' && el === document.querySelector('#researchForm')?.closest('.max-w-4xl')) {
                        el.style.display = 'block';
                        // 添加淡入效果
                        setTimeout(() => {
                            el.style.opacity = '1';
                        }, 50);
                    } else if (tab === 'caseLibrary' && el === document.querySelector('#caseLibraryTab')) {
                        el.classList.remove('hidden');
                        el.style.display = 'block';
                        // 添加淡入效果
                        setTimeout(() => {
                            el.style.opacity = '1';
                        }, 50);
                    } else if (tab === 'history' && el === document.querySelector('#historyTab')) {
                        el.classList.remove('hidden');
                        el.style.display = 'block';
                        // 添加淡入效果
                        setTimeout(() => {
                            el.style.opacity = '1';
                        }, 50); 
                    } else if (tab === 'construction' && el === document.querySelector('#constructionContainer')) {
                        el.classList.remove('hidden');
                        el.style.display = 'block';
                        // 添加淡入效果
                        setTimeout(() => {
                            el.style.opacity = '1';
                        }, 50);
                    }
                }, 300);
            });
            
            // 如果是未实现的标签页，显示施工页面
            if (!implementedTabs.includes(tab) && window.constructionManager) {
                setTimeout(() => {
                    window.constructionManager.showForTab(tab);
                    const constructionContainer = document.querySelector('#constructionContainer');
                    if (constructionContainer) {
                        constructionContainer.style.display = 'block';
                        setTimeout(() => {
                            constructionContainer.style.opacity = '1';
                        }, 50);
                    }
                }, 350);
            }
        });
    });

    // 添加水墨风格的悬停效果
    sidebarItems.forEach(item => {
        item.addEventListener('mouseover', function () {
            this.style.transition = 'all 0.3s ease';
        });

        item.addEventListener('mouseout', function () {
            this.style.transition = 'all 0.3s ease';
        });
        
        // 添加点击波纹效果
        item.addEventListener('mousedown', function(e) {
            createInkEffect(e, this);
        });
    });
    
    // 为侧边栏标题添加动画效果
    if (sidebarHeader) {
        sidebarHeader.addEventListener('mouseenter', function() {
            const title = this.querySelector('h2');
            if (title) {
                title.style.transform = 'translateY(-2px)';
            }
        });
        
        sidebarHeader.addEventListener('mouseleave', function() {
            const title = this.querySelector('h2');
            if (title) {
                title.style.transform = 'translateY(0)';
            }
        });
    }
    
    // 初始化时检查是否应该显示侧边栏
    const savedSidebarState = localStorage.getItem('sidebarExpanded');
    if (savedSidebarState === 'true') {
        sidebar.classList.add('expanded');
        mainContent.classList.add('sidebar-expanded');
        toggleIcon.classList.remove('fa-chevron-right');
        toggleIcon.classList.add('fa-chevron-left');
    }
});
