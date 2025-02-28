// Tab and Sidebar Navigation System
document.addEventListener('DOMContentLoaded', () => {
    // Initialize tabs
    initTabs();
    
    // Initialize sidebar if user is logged in
    const auth = Auth.getInstance();
    auth.onAuthStateChanged((user) => {
        if (user) {
            initSidebar();
            document.getElementById('sidebar').classList.remove('hidden');
        } else {
            document.getElementById('sidebar').classList.add('hidden');
        }
    });
});

// Initialize tab functionality
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');
            
            // Deactivate all tabs
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Activate the selected tab
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');
            
            // Save the active tab to localStorage
            localStorage.setItem('activeTab', targetTab);
        });
    });
    
    // Restore active tab from localStorage if available
    const activeTab = localStorage.getItem('activeTab');
    if (activeTab) {
        const tabToActivate = document.querySelector(`.tab-button[data-tab="${activeTab}"]`);
        if (tabToActivate) {
            tabToActivate.click();
        }
    }
}

// Initialize sidebar functionality
function initSidebar() {
    const sidebarItems = document.querySelectorAll('.sidebar-nav-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            
            // Deactivate all sidebar items
            sidebarItems.forEach(sidebarItem => sidebarItem.classList.remove('active'));
            
            // Activate the selected sidebar item
            item.classList.add('active');
            
            // Activate the corresponding tab
            const tabButton = document.querySelector(`.tab-button[data-tab="${targetTab}"]`);
            if (tabButton) {
                tabButton.click();
            }
            
            // Save the active sidebar item to localStorage
            localStorage.setItem('activeSidebarItem', targetTab);
        });
    });
    
    // Restore active sidebar item from localStorage if available
    const activeSidebarItem = localStorage.getItem('activeSidebarItem');
    if (activeSidebarItem) {
        const itemToActivate = document.querySelector(`.sidebar-nav-item[data-tab="${activeSidebarItem}"]`);
        if (itemToActivate) {
            itemToActivate.click();
        }
    } else {
        // Set the first item as active by default
        const firstItem = document.querySelector('.sidebar-nav-item');
        if (firstItem) {
            firstItem.click();
        }
    }
}

// Toggle sidebar visibility (for mobile)
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
}

// Make functions available globally
window.toggleSidebar = toggleSidebar;
