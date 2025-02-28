document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    const toggleIcon = sidebarToggle.querySelector('i');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    // 侧边栏展开/收起
    sidebarToggle.addEventListener('click', function() {
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
    });

    // 处理侧边栏项目点击
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            // 移除其他项目的active类
            sidebarItems.forEach(i => i.classList.remove('active'));
            // 添加当前项目的active类
            this.classList.add('active');
            
            // 获取对应的tab
            const tab = this.getAttribute('data-tab');
            
            // 这里可以添加切换内容的逻辑
            if (tab === 'research') {
                // 显示研究内容
                document.querySelector('#researchForm').closest('.max-w-4xl').style.display = 'block';
                // 隐藏其他内容
                if (document.querySelector('#caseLibraryTab')) {
                    document.querySelector('#caseLibraryTab').style.display = 'none';
                }
            } else if (tab === 'caseLibrary') {
                // 显示案例库内容
                if (document.querySelector('#caseLibraryTab')) {
                    document.querySelector('#caseLibraryTab').classList.remove('hidden');
                    document.querySelector('#caseLibraryTab').style.display = 'block';
                }
                // 隐藏研究内容
                document.querySelector('#researchForm').closest('.max-w-4xl').style.display = 'none';
            } else {
                // 隐藏研究内容和案例库内容
                document.querySelector('#researchForm').closest('.max-w-4xl').style.display = 'none';
                if (document.querySelector('#caseLibraryTab')) {
                    document.querySelector('#caseLibraryTab').style.display = 'none';
                }
            }
        });
    });

    // 添加水墨风格的悬停效果
    sidebarItems.forEach(item => {
        item.addEventListener('mouseover', function() {
            this.style.transition = 'all 0.3s ease';
        });
        
        item.addEventListener('mouseout', function() {
            this.style.transition = 'all 0.3s ease';
        });
    });
});
