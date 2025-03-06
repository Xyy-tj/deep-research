document.addEventListener('DOMContentLoaded', function () {
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const mainContent = document.querySelector('.main-content');
    const toggleIcon = sidebarToggle.querySelector('i');
    const sidebarItems = document.querySelectorAll('.sidebar-item');

    // 侧边栏展开/收起
    sidebarToggle.addEventListener('click', function () {
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
        item.addEventListener('click', function () {
            // 移除其他项目的active类
            sidebarItems.forEach(i => i.classList.remove('active'));
            // 添加当前项目的active类
            this.classList.add('active');

            // 获取对应的tab
            const tab = this.getAttribute('data-tab');

            // 隐藏所有内容区域
            const allContentAreas = [
                document.querySelector('#researchForm').closest('.max-w-4xl'),
                document.querySelector('#caseLibraryTab')
            ];
            
            // 过滤掉不存在的元素
            allContentAreas.filter(el => el).forEach(el => {
                el.style.display = 'none';
            });
            
            // 显示当前选中的内容区域
            if (tab === 'research') {
                document.querySelector('#researchForm').closest('.max-w-4xl').style.display = 'block';
            } else if (tab === 'caseLibrary') {
                const caseLibraryTab = document.querySelector('#caseLibraryTab');
                if (caseLibraryTab) {
                    caseLibraryTab.classList.remove('hidden');
                    caseLibraryTab.style.display = 'block';
                }
            }
            // 可以在这里添加更多的标签页处理逻辑
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
    });
});
