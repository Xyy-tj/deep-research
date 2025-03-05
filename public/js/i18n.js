export const translations = {
    en: {
        appTitle: 'Deep Research Assistant',
        appSubtitle: 'Discover deeper insights with AI-powered research',
        welcomeTitle: 'Your Intelligent Research Companion',
        login: 'Login',
        logout: 'Logout',
        register: 'Register',
        username: 'Username',
        password: 'Password',
        sendVerificationCode: 'Send Code',
        emailVerification: 'Email Verification',
        email: 'Email',
        verificationCode: 'Verification Code',
        researchTopic: 'Research Topic',
        breadth: 'Research Breadth',
        depth: 'Research Depth',
        reportLanguage: 'Report Language',
        chineseSimplified: 'Chinese (Simplified)',
        english: 'English',
        reportLanguageExplanation: 'Choose the language for your final research report.',
        startResearch: 'Start Research',
        howItWorks: 'How It Works',
        poweredBy: 'Powered by SSTech@DeepResearch',
        copied: 'Copied!',
        downloadMarkdown: 'Download Markdown',
        saveResults: 'Save Results',
        addNote: 'Add Note',
        saveNote: 'Save Note',
        yes: 'Yes',
        no: 'No',
        submitAnswer: 'Submit Answer',
        researching: 'Researching...',
        loadingPreview: 'Loading preview',
        noActiveResearchSession: 'No active research session',
        researchResultsSavedSuccessfully: 'Research results saved successfully!',
        failedToSaveResults: 'Failed to save results',
        failedToCopyToClipboard: 'Failed to copy to clipboard',
        pleaseEnterResearchTopic: 'Please enter a research topic',
        pleaseLogInFirst: 'Please log in first',
        researchProgress: 'Research Progress',
        startingResearch: 'Starting research',
        currentlyResearching: 'Currently researching',
        queries: 'Queries',
        generatingReport: 'Generating final report... Please wait',
        aiResearch: 'AI-Powered Research',
        aiResearchDescription: 'Leverage advanced AI technology to conduct comprehensive research on any topic. Our system explores multiple perspectives and digs deep into the subject matter.',
        interactiveResearch: 'Interactive Research Process',
        interactiveResearchDescription: 'Engage in an interactive research journey where you can guide the AI through your specific interests and requirements.',
        customizableDepthBreadth: 'Customizable Depth & Breadth',
        customizableDepthBreadthDescription: 'Adjust the depth and breadth of your research to get exactly the level of detail you need.',
        balance: 'Balance',
        credits: 'credits',
        insufficientCredits: 'You don\'t have enough credits for this operation. Please add more credits to continue.',
        thisResearchWillCost: 'This research will cost',
        doYouWantToProceed: 'Do you want to proceed',
        navigation: 'Navigation',
        research: 'Research',
        history: 'History',
        settings: 'Settings',
        caseLibrary: 'Case Library',
        about: 'About',
        researchHistory: 'Research History',
        noHistoryYet: 'No research history yet',
        defaultLanguage: 'Default Language',
        defaultBreadth: 'Default Research Breadth',
        defaultDepth: 'Default Research Depth',
        narrow: 'Narrow',
        wide: 'Wide',
        shallow: 'Shallow',
        deep: 'Deep',
        saveSettings: 'Save Settings',
        
        // Depth level labels
        depthLevel1: 'Light Analysis',
        depthLevel2: 'Basic',
        depthLevel3: 'Deep',
        
        aboutDescription: 'Deep Research Assistant is an advanced AI-powered research tool designed to help you explore topics in depth. Our platform combines state-of-the-art language models with specialized research methodologies to provide comprehensive insights on any subject.',
        keyFeatures: 'Key Features',
        featureAI: 'AI-Powered Research',
        featureInteractive: 'Interactive Research Process',
        featureCustomizable: 'Customizable Depth & Breadth',
        featureComprehensive: 'Comprehensive Results',
        contactUs: 'Contact Us',
        contactDescription: 'For support or inquiries, please reach out to our team at support@deepresearch.ai',
        welcome: 'Welcome',
        breadthExplanation: 'Controls how wide your research scope is. Higher values explore more diverse sources and perspectives.',
        depthExplanation: 'Controls how deep your research goes. Higher values explore more in-depth information and insights.',
        
        // New translations for sidebar and tabs
        signUpLogin: 'Sign Up & Login',
        signUpLoginDescription: 'Create your account to get started with AI-powered research',
        enterTopic: 'Enter Your Topic',
        enterTopicDescription: 'Input your research topic and customize the research parameters',
        guideResearch: 'Guide the Research',
        guideResearchDescription: 'Interact with the AI to refine and direct the research process',
        reviewResults: 'Review Results',
        reviewResultsDescription: 'Get comprehensive research results and export them in your preferred format',
        learnMore: 'Learn More',
        
        // Billing related translations
        billingRules: 'Billing Rules',
        baseCreditsRule: 'Base cost: 2 credits per research',
        depthRule: 'Depth cost: 0.5 credits per depth level',
        breadthRule: 'Breadth cost: 1 credit per breadth level',
        currentCost: 'Current Cost:',
        costFormula: `Expected cost = Base(${window.creditConfig?.baseCredits || 2}) + Depth × ${window.creditConfig?.depthMultiplier || 1} + Breadth × ${window.creditConfig?.breadthMultiplier || 0.5}`,
    },
    zh: {
        // Title and introduction
        appTitle: '砚 · 海',
        appSubtitle: '墨海数舟，千卷瞬祈',
        welcomeTitle: '墨海数舟，千卷瞬祈',

        // Login and registration
        login: '登录',
        logout: '退出',
        register: '注册',
        username: '用户名',
        password: '密码',
        sendVerificationCode: '发送验证码',
        emailVerification: '邮箱验证',
        email: '邮箱',
        verificationCode: '验证码',
        researchTopic: '研究主题',
        breadth: '研究广度',
        depth: '研究深度',
        reportLanguage: '报告语言',
        chineseSimplified: '简体中文(zh-CN)',
        english: '英文(English)',
        reportLanguageExplanation: '选择您最终研究报告的语言。',
        startResearch: '开始研究',
        howItWorks: '使用方法',
        poweredBy: '由 SSTech@DeepResearch 提供技术服务支持',
        copied: '已复制！',
        downloadMarkdown: '下载Markdown',
        saveResults: '保存结果',
        addNote: '添加笔记',
        saveNote: '保存笔记',
        yes: '是',
        no: '否',
        submitAnswer: '提交答案',
        researching: '正在研究...',
        loadingPreview: '加载预览',
        noActiveResearchSession: '没有活动的研究会话',
        researchResultsSavedSuccessfully: '研究结果保存成功！',
        failedToSaveResults: '保存结果失败，请注意及时保存至本地！',
        failedToCopyToClipboard: '复制到剪贴板失败',
        pleaseEnterResearchTopic: '请输入研究主题',
        pleaseLogInFirst: '请先登录',
        researchProgress: '研究进度',
        startingResearch: '开始研究',
        currentlyResearching: '正在研究',
        queries: '查询',
        generatingReport: '正在生成报告... 请稍候',
        aiResearch: 'AI驱动的研究',
        aiResearchDescription: '利用先进的AI技术对任何主题进行全面研究。我们的系统探索多个视角，深入研究主题内容。',
        interactiveResearch: '交互式研究过程',
        interactiveResearchDescription: '参与交互式研究旅程，您可以根据具体兴趣和要求指导AI的研究方向。',
        customizableDepthBreadth: '可定制的深度和广度',
        customizableDepthBreadthDescription: '通过可调节的深度和广度参数控制研究范围，确保获得所需的详细程度。',
        comprehensiveResults: '全面的结果',
        comprehensiveResultsDescription: '获取结构良好的研究结果，包含引用、摘要，并可以以多种格式导出您的发现。',
        signUpLogin: '注册和登录',
        signUpLoginDescription: '创建账户以开始使用AI驱动的研究',
        enterTopic: '输入主题',
        enterTopicDescription: '输入您的研究主题并自定义研究参数',
        guideResearch: '指导研究',
        guideResearchDescription: '与AI互动以完善和指导研究过程',
        reviewResults: '查看结果',
        reviewResultsDescription: '获取全面的研究结果，并以您喜欢的格式导出',
        learnMore: '了解更多',
        welcome: '欢迎',
        login: '登录',
        register: '注册',
        logout: '退出',
        username: '用户名',
        password: '密码',
        email: '邮箱',
        verificationCode: '验证码',
        sendVerificationCode: '发送验证码',
        invitationCode: '邀请码',
        researchTopic: '研究主题',
        researchBreadth: '研究广度',
        researchDepth: '研究深度',
        start: '开始',
        cancel: '取消',
        continue: '继续',
        yes: '是',
        no: '否',
        loading: '加载中...',
        processing: '处理中...',
        completed: '已完成',
        error: '错误',
        success: '成功',
        warning: '警告',
        info: '信息',
        close: '关闭',
        save: '保存',
        delete: '删除',
        edit: '编辑',
        view: '查看',
        download: '下载',
        copy: '复制',
        paste: '粘贴',
        cut: '剪切',
        undo: '撤销',
        redo: '重做',
        search: '搜索',
        filter: '筛选',
        sort: '排序',
        asc: '升序',
        desc: '降序',
        next: '下一步',
        previous: '上一步',
        first: '第一页',
        last: '最后一页',
        page: '页',
        of: '/',
        items: '项',
        selected: '已选择',
        all: '全部',
        none: '无',
        selectAll: '全选',
        deselectAll: '取消全选',
        pleaseWait: '请稍候...',
        confirmDelete: '确认删除？',
        confirmCancel: '确认取消？',
        confirmExit: '确认退出？',
        confirmSave: '确认保存？',
        confirmDiscard: '确认丢弃？',
        confirmReset: '确认重置？',
        confirmSubmit: '确认提交？',
        confirmAction: '确认操作？',
        invalidInput: '无效输入',
        requiredField: '必填字段',
        invalidEmail: '无效的邮箱地址',
        invalidPassword: '无效的密码',
        invalidUsername: '无效的用户名',
        invalidVerificationCode: '无效的验证码',
        invalidInvitationCode: '无效的邀请码',
        passwordMismatch: '密码不匹配',
        usernameTaken: '用户名已被占用',
        emailTaken: '邮箱已被占用',
        accountCreated: '账号已创建',
        accountUpdated: '账号已更新',
        accountDeleted: '账号已删除',
        sessionExpired: '会话已过期',
        loginRequired: '需要登录',
        accessDenied: '访问被拒绝',
        permissionDenied: '权限被拒绝',
        notFound: '未找到',
        serverError: '服务器错误',
        connectionError: '连接错误',
        timeoutError: '超时错误',
        unknownError: '未知错误',
        tryAgain: '请重试',
        refresh: '刷新',
        reload: '重新加载',
        restart: '重新启动',
        reset: '重置',
        clear: '清除',
        clearAll: '清除全部',
        clearHistory: '清除历史',
        clearCache: '清除缓存',
        clearCookies: '清除 Cookies',
        clearData: '清除数据',
        clearFilters: '清除筛选',
        clearSelection: '清除选择',
        clearSearch: '清除搜索',
        clearForm: '清除表单',
        resetForm: '重置表单',
        submitForm: '提交表单',
        formSubmitted: '表单已提交',
        formReset: '表单已重置',
        formCleared: '表单已清除',
        formSaved: '表单已保存',
        formCancelled: '表单已取消',
        formDeleted: '表单已删除',
        formError: '表单错误',
        formInvalid: '表单无效',
        formValid: '表单有效',
        formComplete: '表单完整',
        formIncomplete: '表单不完整',
        formRequired: '表单必填',
        formOptional: '表单可选',
        formDisabled: '表单已禁用',
        formEnabled: '表单已启用',
        formReadOnly: '表单只读',
        formEditable: '表单可编辑',
        formLocked: '表单已锁定',
        formUnlocked: '表单已解锁',
        credits: '积分',
        balance: '余额',
        remainingCredits: '剩余积分',
        insufficientCredits: '积分不足',
        addCredits: '添加积分',
        buyCredits: '购买积分',
        freeCredits: '免费积分',
        creditHistory: '积分历史',
        creditUsage: '积分使用情况',
        creditBalance: '积分余额',
        creditExpiry: '积分过期',
        creditRefund: '积分退款',
        creditTransfer: '积分转账',
        creditPurchase: '积分购买',
        creditSale: '积分销售',
        creditTransaction: '积分交易',
        creditStatement: '积分对账单',
        creditLimit: '积分限额',
        loadingPreview: '加载预览',
        noActiveResearchSession: '没有活动的研究会话',
        researchResultsSavedSuccessfully: '研究结果保存成功！',
        failedToSaveResults: '保存结果失败，请注意及时保存至本地！',
        failedToCopyToClipboard: '复制到剪贴板失败',
        pleaseEnterResearchTopic: '请输入研究主题',
        pleaseLogInFirst: '请先登录',
        recharge: '充值',
        rechargeCredits: '充值积分',
        customAmount: '自定义金额',
        wechatPay: '微信支付',
        selectPackage: '选择套餐',
        payNow: '立即支付',
        scanToPay: '扫码支付',
        willReceive: '将获得',
        caseLibraryTitle: '案例库',
        
        // Depth level labels
        depthLevel1: '浅析',
        depthLevel2: '基础',
        depthLevel3: '深度',
        
        aboutDescription: '深度报告助手是一款先进的AI驱动研究工具，旨在帮助您深入探索各种主题。我们的平台结合了最先进的语言模型和专业的研究方法，为任何主题提供全面的见解。',
        keyFeatures: '主要特点',
        featureAI: 'AI驱动研究',
        featureInteractive: '交互式研究过程',
        featureCustomizable: '可定制的广度和深度',
        featureComprehensive: '全面的结果',
        contactUs: '联系我们',
        contactDescription: '如需支持或咨询，请联系我们的团队：support@deepresearch.ai',
        navigation: '导航',
        research: '开始研究',
        history: '研究记录',
        favorites: '收藏',
        settings: '设置',
        help: '帮助',
        caseLibrary: '案例库',
        about: '关于',
        researchHistory: '研究历史',
        noHistoryYet: '暂无研究历史',
        defaultLanguage: '默认语言',
        defaultBreadth: '默认研究广度',
        defaultDepth: '默认研究深度',
        narrow: '窄',
        wide: '宽',
        shallow: '浅',
        deep: '深',
        saveSettings: '保存设置',
        breadthExplanation: '控制研究范围的广度。高值探索多种来源和观点。',
        depthExplanation: '控制研究深度的深度。高值探索更多的详细信息和见解。',
        
        // Billing related translations
        billingRules: '计费规则',
        baseCreditsRule: '基础费用: 每次研究2积分',
        depthRule: '深度费用: 每级深度0.5积分',
        breadthRule: '广度费用: 每级广度1积分',
        currentCost: '当前费用:',
        costFormula: `预期消耗 = 基础(${window.creditConfig?.baseCredits || 2}) + 深度 × ${window.creditConfig?.depthMultiplier || 1} + 广度 × ${window.creditConfig?.breadthMultiplier || 0.5}`,
    }
};

// Function to update cost formula translations with current credit configuration
export function updateCostFormulas() {
    if (window.creditConfig) {
        const baseCredits = window.creditConfig.baseCredits || 2;
        const depthMultiplier = window.creditConfig.depthMultiplier || 1;
        const breadthMultiplier = window.creditConfig.breadthMultiplier || 0.5;
        
        translations.en.costFormula = `Expected cost = Base(${baseCredits}) + Depth × ${depthMultiplier} + Breadth × ${breadthMultiplier}`;
        translations.zh.costFormula = `预期消耗 = 基础(${baseCredits}) + 深度 × ${depthMultiplier} + 广度 × ${breadthMultiplier}`;
        
        // Also update the rule descriptions
        translations.en.baseCreditsRule = `Base cost: ${baseCredits} credits per research`;
        translations.en.depthRule = `Depth cost: ${depthMultiplier} credits per depth level`;
        translations.en.breadthRule = `Breadth cost: ${breadthMultiplier} credits per breadth level`;
        
        translations.zh.baseCreditsRule = `基础费用: 每次研究${baseCredits}积分`;
        translations.zh.depthRule = `深度费用: 每级深度${depthMultiplier}积分`;
        translations.zh.breadthRule = `广度费用: 每级广度${breadthMultiplier}积分`;
    }
}
