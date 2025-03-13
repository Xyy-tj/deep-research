import express from 'express';
import path from 'path';
import fs from 'fs';
import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';
import { CreditManager } from './user/credit-manager';
import authRoutes from './user/auth-routes';
import paymentRoutes, { notifyRouter } from './payment/payment-routes';
import adminRoutes from './admin/admin-routes';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { DB } from './db/database';
import { setupSwagger } from './swagger';
import { ResearchManager } from './research/research-manager';
import { PaymentService } from './services/payment-service';
import { SystemSettingsService } from './services/system-settings-service';
import { o3MiniModel, trimPrompt } from './ai/providers';
import { generateObject } from 'ai';
import { z } from 'zod';

const app = express();
const port = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Enable detailed logging
const logger = {
    debug: (...args: any[]) => console.debug('[Server]', ...args),
    info: (...args: any[]) => console.info('[Server]', ...args),
    error: (...args: any[]) => console.error('[Server]', ...args)
};

// Parse JSON bodies
app.use(express.json());

// Parse cookies
app.use(cookieParser());

// Authentication middleware
function authenticateToken(req: express.Request, res: express.Response, next: express.NextFunction) {
    // First try to get token from Authorization header
    const authHeader = req.headers['authorization'];
    let token = authHeader && authHeader.split(' ')[1];
    
    // If no token in header, check cookies
    if (!token && req.cookies) {
        token = req.cookies.auth_token;
    }

    if (!token) {
        logger.debug('No token found in request');
        return res.status(401).json({ error: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, async (err: any, user: any) => {
        if (err) {
            logger.debug('Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        
        try {
            // Get full user data from database
            const db = await DB.getInstance();
            const userData = await db.get(
                'SELECT id, username, email, is_admin, credits FROM users WHERE id = ?', 
                [user.id]
            );
            
            if (!userData) {
                logger.debug('User not found in database:', user.id);
                return res.status(401).json({ error: 'User not found' });
            }
            
            // Add isAdmin property for compatibility
            userData.isAdmin = userData.is_admin;
            
            logger.debug('Authenticated user:', userData);
            (req as any).user = userData;
            next();
        } catch (error) {
            logger.error('Error fetching user data:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    });
}

// Mount authentication routes
app.use('/api', authRoutes);

// Mount payment notification endpoint without authentication (with URL-encoded body parser)
app.use('/api/payment/wxnotify', express.urlencoded({ extended: true }), notifyRouter);

// Mount payment routes (protected by authentication)
app.use('/api/payment', authenticateToken, paymentRoutes);

// Mount admin routes (protected by authentication)
// 注意：admin-routes.ts中已经包含了authenticateJWT和isAdmin中间件
app.use('/api/admin', adminRoutes);

// Get credit exchange rate endpoint (public)
app.get('/api/system/exchange-rate', async (req, res) => {
    try {
        const paymentService = await PaymentService.getInstance();
        const exchangeRate = await paymentService.getCreditExchangeRate();
        res.json({ exchangeRate });
    } catch (error) {
        logger.error('Error fetching credit exchange rate:', error);
        res.status(500).json({ error: 'Failed to fetch credit exchange rate' });
    }
});

// Get user balance endpoint
app.get('/api/user/balance', authenticateToken, async (req, res) => {
    try {
        const userId = (req as any).user.id;
        logger.info(`[Balance] Fetching balance for user ID: ${userId}`);
        
        const creditManager = await CreditManager.getInstance();
        const balance = await creditManager.getBalance(userId);
        
        logger.info(`[Balance] User ${userId} balance: ${balance}`);
        res.json({ balance });
    } catch (error) {
        logger.error('[Balance] Error fetching balance:', error);
        res.status(500).json({ error: 'Failed to fetch balance' });
    }
});

// Calculate research cost endpoint
app.post('/api/research/cost', authenticateToken, async (req, res) => {
    try {
        const { depth = 2, breadth = 4 } = req.body;
        const creditManager = await CreditManager.getInstance();
        const cost = creditManager.calculateQueryCost(depth, breadth);
        res.json({ cost });
    } catch (error) {
        logger.error('Error calculating research cost:', error);
        res.status(500).json({ error: 'Failed to calculate research cost' });
    }
});

// Get credit pricing configuration
app.get('/api/config/credits', async (req, res) => {
    try {
        const settingsService = await SystemSettingsService.getInstance();
        const settings = await settingsService.getSettings();
        
        res.json({
            baseCredits: settings.baseCredits,
            depthMultiplier: settings.depthMultiplier,
            breadthMultiplier: settings.breadthMultiplier
        });
    } catch (error) {
        logger.error('Error fetching credit configuration from database:', error);
        res.status(500).json({ error: 'Failed to fetch credit configuration' });
    }
});

// Get credit packages
app.get('/api/payment/packages', async (req, res) => {
    try {
        const paymentService = await PaymentService.getInstance();
        const packages = await paymentService.getCreditPackages();
        res.json({ packages });
    } catch (error) {
        logger.error('Error fetching credit packages:', error);
        res.status(500).json({ error: 'Failed to fetch credit packages' });
    }
});

// Get application configuration including test mode
app.get('/api/config/app', (req, res) => {
    try {
        res.json({
            isTestMode: process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1'
        });
    } catch (error) {
        logger.error('Error fetching application configuration:', error);
        res.status(500).json({ error: 'Failed to fetch application configuration' });
    }
});

// Enable detailed request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        body: req.body,
        query: req.query,
        params: req.params
    });
    next();
});

// Setup Swagger UI
setupSwagger(app);

// Route for panel.html
app.get('/panel', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/panel.html'));
});

// Route for admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.use(express.static('public'));

// Store active research sessions
const activeSessions = new Map<string, {
    output: OutputManager;
    resolve: (answer: string) => void;
    report: string;
    partialResults?: any[];
}>();

// Generate a unique research ID
function generateResearchId() {
    return Math.random().toString(36).substring(2, 15);
}

// Create a promise that can be resolved externally
function createResolvablePromise(): Promise<string> & { resolve: (value: string) => void } {
    let resolve!: (value: string) => void;
    const promise = new Promise<string>((r) => {
        resolve = r;
    });
    (promise as any).resolve = resolve;
    return promise as Promise<string> & { resolve: (value: string) => void };
}

// Custom OutputManager that supports user interaction
class WebOutputManager extends OutputManager {
    private eventClients: Set<express.Response> = new Set();
    private questionResolvers: Map<string, (answer: string) => void> = new Map();
    private currentQuestion: string | null = null;

    constructor() {
        super();
    }

    addEventClient(res: express.Response) {
        this.eventClients.add(res);
    }

    removeEventClient(res: express.Response) {
        this.eventClients.delete(res);
    }

    log(...args: any[]) {
        const message = args.join(' ');
        this.sendEventToAll({
            type: 'log',
            message
        });
    }

    async askQuestion(question: string): Promise<string> {
        // Store the current question
        this.currentQuestion = question;

        return new Promise((resolve) => {
            // Store the resolver function with a unique ID
            const questionId = Date.now().toString();
            this.questionResolvers.set(questionId, resolve);

            // Send the question to all clients
            this.sendEventToAll({
                type: 'question',
                questionId,
                question
            });
        });
    }

    submitAnswer(questionId: string, answer: string) {
        const resolve = this.questionResolvers.get(questionId);
        if (resolve) {
            resolve(answer);
            this.questionResolvers.delete(questionId);
            this.currentQuestion = null;
        }
    }

    getCurrentQuestion(): string | null {
        return this.currentQuestion;
    }

    sendEventToAll(data: any) {
        const eventString = `data: ${JSON.stringify(data)}\n\n`;
        
        for (const client of this.eventClients) {
            try {
                client.write(eventString);
            } catch (error) {
                console.error('Error sending event to client:', error);
                this.eventClients.delete(client);
            }
        }
    }

    closeAllConnections() {
        logger.info(`Closing all connections (${this.eventClients.size} clients)`);
        for (const client of this.eventClients) {
            try {
                client.end();
                logger.debug('Successfully closed one client connection');
            } catch (error) {
                logger.error('Error closing client connection:', error);
            }
        }
        this.eventClients.clear();
        logger.info('All connections closed and cleared');
    }
}

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Event stream endpoint
app.get('/api/events/:researchId', (req, res) => {
    const researchId = req.params.researchId;
    const session = activeSessions.get(researchId);

    if (!session) {
        return res.status(404).json({ error: 'Research session not found' });
    }

    // Set SSE headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
    });
    res.flushHeaders();

    // Write initial message
    res.write('data: {"type":"connected"}\n\n');

    // Add this client to the session's output manager
    (session.output as WebOutputManager).addEventClient(res);

    // Handle client disconnect
    req.on('close', () => {
        logger.info('Client disconnected from event stream');
        (session.output as WebOutputManager).removeEventClient(res);
    });
});

// Answer submission endpoint
app.post('/api/research/:id/answer', (req, res) => {
    const researchId = req.params.id;
    const { answer } = req.body;
    
    const session = activeSessions.get(researchId);
    if (!session) {
        logger.error('Research session not found for answer:', researchId);
        res.status(404).json({ error: 'Research session not found' });
        return;
    }

    logger.info('Submitting answer for research:', researchId);
    (session.output as WebOutputManager).submitAnswer("", answer);
    res.json({ success: true });
});

// Answer endpoint
app.post('/api/answer/:researchId', (req, res) => {
    const researchId = req.params.researchId;
    const { answer, questionId } = req.body;

    const session = activeSessions.get(researchId);
    if (!session) {
        return res.status(404).json({ error: 'Research session not found' });
    }

    try {
        const outputManager = session.output as WebOutputManager;
        
        // Check if there's a current question
        if (!outputManager.getCurrentQuestion()) {
            return res.status(400).json({ error: 'No question waiting for answer' });
        }

        outputManager.submitAnswer(questionId, answer);
        res.json({ success: true });
    } catch (error) {
        logger.error('Error submitting answer:', error);
        res.status(500).json({ error: 'Failed to submit answer' });
    }
});

// 用户管理API
app.get('/api/user/:userId', async (req, res) => {
    console.log('Fetching user details for:', req.params.userId);
    try {
        const creditManager = await CreditManager.getInstance();
        const user = await creditManager.getUser(req.params.userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.json(user);
    } catch (error) {
        console.error('Error getting user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/user/:userId', async (req, res) => {
    try {
        const creditManager = await CreditManager.getInstance();
        const { credits } = req.body;
        if (credits) {
            await creditManager.addCredits(req.params.userId, credits);
        } else {
            await creditManager.addUser(req.params.userId);
        }
        const user = await creditManager.getUser(req.params.userId);
        return res.json(user);
    } catch (error) {
        console.error('Error creating/updating user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// Main research endpoint
app.post('/api/research', authenticateToken, async (req, res) => {
    try {
        const { query, depth = 2, breadth = 4, language = 'zh-CN' } = req.body;
        const userId = (req as any).user.id;
        logger.info('Starting new research:', { userId, query, depth, breadth, language });
        
        // Generate research ID
        const researchId = generateResearchId();
        logger.info('Generated research ID:', researchId);
        
        // Create output manager
        const output = new WebOutputManager();
        
        // Create resolvable promise
        const promise = createResolvablePromise();
        
        // Store session
        activeSessions.set(researchId, {
            output,
            resolve: promise.resolve,
            report: '',
            partialResults: []
        });
        logger.debug('Created new research session:', researchId);

        // Create research record in database
        try {
            const researchManager = await ResearchManager.getInstance();
            const creditManager = await CreditManager.getInstance();
            const creditsUsed = creditManager.calculateQueryCost(depth, breadth);
            
            // Save initial research record
            await researchManager.createResearchRecord({
                user_id: Number(userId),
                research_id: researchId,
                query,
                query_depth: depth,
                query_breadth: breadth,
                language,
                credits_used: creditsUsed,
                status: 'started',
                config_json: JSON.stringify({
                    appVersion: process.env.npm_package_version || '0.0.1',
                    isTestMode: process.env.TEST_MODE === 'true' || process.env.TEST_MODE === '1',
                    concurrencyLimit: Number(process.env.CONCURRENCY_LIMIT ?? 2),
                    questionTimeoutMs: Number(process.env.QUESTION_TIMEOUT_MS ?? 3000)
                })
            });
            logger.info('Created research record in database:', researchId);
        } catch (error) {
            logger.error('Failed to create research record:', error);
            // Continue with research even if recording fails
        }

        // Send initial response
        res.json({ researchId });
        logger.debug('Sent initial response to client');

        try {
            // Start research process
            logger.info('Starting deep research process');
            const results = await deepResearch({
                query,
                depth,
                breadth,
                output,
                userId,
                language,
                onProgress: (progress) => {
                    // Send progress update to clients
                    logger.debug('Sending progress update:', progress);
                    (output as WebOutputManager).sendEventToAll({
                        type: 'progress',
                        progress
                    });
                }
            });
            logger.info('Deep research completed with results:', { 
                learningsCount: results?.length || 0 
            });

            // Send notification that we're generating the final report
            logger.info('Sending report generation notification to clients');
            (output as WebOutputManager).sendEventToAll({
                type: 'progress',
                progress: {
                    currentDepth: depth,
                    totalDepth: depth,
                    currentBreadth: breadth,
                    totalBreadth: breadth,
                    completedQueries: results?.length || breadth * depth,
                    totalQueries: results?.length || breadth * depth,
                    currentQuery: 'Generating final report... Please wait',
                    isGeneratingReport: true
                }
            });

            // Generate final report
            logger.info('Generating final report');
            const report = await writeFinalReport({
                prompt: query,
                learnings: results?.flatMap(r => r.learnings) || [],
                visitedUrls: results?.flatMap(r => r.visitedUrls) || [],
                language: language,
                referenceMapping: results?.[results.length - 1]?.referenceMapping || {}
            });
            logger.debug('Final report generated, length:', report.length);

            // Store report in session
            const session = activeSessions.get(researchId);
            if (session) {
                session.report = report;
                logger.debug('Stored report in session');
                
                // Save report to disk and get filename
                try {
                    const filepath = saveReportToDisk(researchId, report);
                    const filename = path.basename(filepath);
                    logger.info('Report saved successfully to:', filepath);
                    
                    // Update research record with completion details
                    try {
                        const researchManager = await ResearchManager.getInstance();
                        await researchManager.completeResearchRecord(researchId, {
                            output_filename: filename,
                            output_path: filepath,
                            num_references: Object.keys(results?.[results.length - 1]?.referenceMapping || {}).length,
                            num_learnings: results?.flatMap(r => r.learnings).length || 0,
                            visited_urls_count: results?.flatMap(r => r.visitedUrls).length || 0,
                            status: 'completed'
                        });
                        logger.info('Updated research record with completion details');
                    } catch (error) {
                        logger.error('Failed to update research record:', error);
                    }
                    
                    // Send result to all clients with filename
                    logger.info('Sending result event to clients');
                    (output as WebOutputManager).sendEventToAll({
                        type: 'result',
                        result: {
                            content: report,
                            filename: filename
                        }
                    });
                } catch (error) {
                    logger.error('Failed to save report to disk:', error);
                    
                    // Update research record with error
                    try {
                        const researchManager = await ResearchManager.getInstance();
                        await researchManager.completeResearchRecord(researchId, {
                            error_message: `Failed to save report: ${error.message || 'Unknown error'}`,
                            status: 'completed' // Still mark as completed since we have the report
                        });
                    } catch (recordError) {
                        logger.error('Failed to update research record with error:', recordError);
                    }
                    
                    // Still send the result even if saving failed
                    (output as WebOutputManager).sendEventToAll({
                        type: 'result',
                        result: report
                    });
                }
            }

            // Send complete event
            logger.info('Sending complete event to clients');
            (output as WebOutputManager).sendEventToAll({
                type: 'complete'
            });

            // Clean up session after a short delay
            logger.info('Scheduling session cleanup');
            setTimeout(() => {
                const session = activeSessions.get(researchId);
                if (session) {
                    try {
                        logger.info('Cleaning up research session:', researchId);
                        // Close all event streams
                        (session.output as WebOutputManager).closeAllConnections();
                    } catch (error) {
                        logger.error('Error during session cleanup:', error);
                    }
                    // Remove session
                    activeSessions.delete(researchId);
                    logger.info('Research session removed:', researchId);
                }
            }, 1000);

        } catch (error) {
            logger.error('Research process error:', error);
            
            // Update research record with error
            try {
                const researchManager = await ResearchManager.getInstance();
                await researchManager.completeResearchRecord(researchId, {
                    error_message: error.message || 'An error occurred during research',
                    status: 'failed'
                });
                logger.info('Updated research record with error details');
            } catch (recordError) {
                logger.error('Failed to update research record with error:', recordError);
            }
            
            // Send error to all clients
            logger.info('Sending error event to clients');
            (output as WebOutputManager).sendEventToAll({
                type: 'error',
                error: error.message || 'An error occurred during research'
            });

            // Clean up session
            logger.info('Cleaning up session after error');
            activeSessions.delete(researchId);
        }
    } catch (error) {
        logger.error('Error in research request handler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/test', authenticateToken, async (req, res) => {
    try {
        console.log('Test request received:', req.body);
        res.json({ success: true, message: 'Test request received' });
    } catch (error) {
        logger.error('Error in test request handler:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Save research results
app.post('/api/save', async (req, res) => {
    const { researchId } = req.body;
    
    const session = activeSessions.get(researchId);
    if (!session) {
        return res.status(404).json({ error: 'Research session not found' });
    }

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const outputDir = path.join(__dirname, '../output');
        
        // Ensure output directory exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const markdownPath = path.join(outputDir, `output-${timestamp}.md`);
        await fs.promises.writeFile(markdownPath, session.report, 'utf8');

        res.json({ 
            success: true,
            filename: path.basename(markdownPath)
        });
    } catch (error) {
        logger.error('Error saving research results:', error);
        res.status(500).json({ error: 'Failed to save research results' });
    }
});

// Markdown preview endpoint
app.get('/api/markdown/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'File not found' });
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Set content type to application/json
        res.setHeader('Content-Type', 'application/json');
        res.json({ content });
    } catch (error) {
        logger.error('Error reading markdown file:', error);
        res.status(500).json({ error: 'Failed to read markdown file' });
    }
});

// Download markdown endpoint
app.get('/api/download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);

    try {
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            logger.error('File not found:', filePath);
            return res.status(404).json({ error: 'File not found' });
        }

        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');

        // Set headers for file download
        res.setHeader('Content-Type', 'text/markdown');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Send the content directly
        res.send(content);
    } catch (error) {
        logger.error('Error downloading markdown file:', error);
        res.status(500).json({ error: 'Failed to download file' });
    }
});

// Serve output files
app.get('/output/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
        logger.error('Output file not found:', filePath);
        return res.status(404).json({ error: 'File not found' });
    }

    try {
        // For preview, just send the content
        const content = fs.readFileSync(filePath, 'utf-8');
        
        // For download, set the appropriate headers
        if (req.query.download === 'true') {
            res.setHeader('Content-Type', 'text/markdown');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            res.setHeader('Content-Type', 'text/plain');
        }
        
        res.send(content);
    } catch (error) {
        logger.error('Error reading output file:', error);
        res.status(500).json({ error: 'Failed to read file' });
    }
});

// Get list of saved research results
app.get('/api/research-list', (req, res) => {
    try {
        const resultsDir = path.join(__dirname, '../results');
        if (!fs.existsSync(resultsDir)) {
            return res.json({ results: [] });
        }

        const files = fs.readdirSync(resultsDir)
            .filter(file => file.endsWith('.json'))
            .map(file => {
                const filepath = path.join(resultsDir, file);
                const stats = fs.statSync(filepath);
                return {
                    filename: file,
                    created: stats.birthtime,
                    size: stats.size
                };
            })
            .sort((a, b) => b.created.getTime() - a.created.getTime());

        res.json({ results: files });
    } catch (error) {
        console.error('Error getting research list:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get research list'
        });
    }
});

// Get welcome page content
app.get('/api/welcome-content', (req, res) => {
    try {
        const filePath = path.join(__dirname, '../public/welcome-content.html');
        const content = fs.readFileSync(filePath, 'utf8');
        res.json({ content });
    } catch (error) {
        logger.error('Error reading welcome content:', error);
        res.status(500).json({ error: 'Failed to load welcome content' });
    }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database
        await DB.getInstance();
        logger.info('Database initialized successfully');

        const researchManager = await ResearchManager.getInstance();
        logger.info('Research manager initialized successfully');

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });
    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
}

// Save report to disk
function saveReportToDisk(researchId: string, report: string) {
    try {
        const resultsDir = path.join(__dirname, '../output');
        // Create results directory if it doesn't exist
        if (!fs.existsSync(resultsDir)) {
            fs.mkdirSync(resultsDir, { recursive: true });
        }
        
        // Generate filename with timestamp and research ID
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `${timestamp}-${researchId}.md`;
        const filepath = path.join(resultsDir, filename);
        
        // Write report to file
        fs.writeFileSync(filepath, report, 'utf8');
        logger.info('Saved report to file:', filepath);
        
        return filepath;
    } catch (error) {
        logger.error('Error saving report to disk:', error);
        throw error;
    }
}

// Handle partial results request
app.post('/api/research/:id/partial', authenticateToken, async (req, res) => {
    const researchId = req.params.id;
    
    const session = activeSessions.get(researchId);
    if (!session) {
        logger.error('Research session not found for partial results:', researchId);
        res.status(404).json({ error: 'Research session not found' });
        return;
    }

    try {
        logger.info('Generating partial report for research:', researchId);
        
        // Generate partial report from current state
        const partialResults = session.partialResults?.[session.partialResults.length - 1];
        const partialReport = await writeFinalReport({
            prompt: req.body.query || 'Research interrupted',
            learnings: partialResults?.learnings || [],
            visitedUrls: partialResults?.visitedUrls || [], 
            language: req.body.language || 'zh-CN',
            referenceMapping: partialResults?.referenceMapping || {}
        });

        // Save partial report to disk
        let filepath;
        let filename;
        try {
            const resultsDir = path.join(__dirname, '../output');
            // Create results directory if it doesn't exist
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }
            
            // Generate filename with timestamp and research ID (partial)
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            filename = `${timestamp}-${researchId}-partial.md`;
            filepath = path.join(resultsDir, filename);
            
            // Write report to file
            fs.writeFileSync(filepath, partialReport, 'utf8');
            logger.info('Saved partial report to file:', filepath);
            
            // Update research record with partial completion details
            try {
                const researchManager = await ResearchManager.getInstance();
                await researchManager.completeResearchRecord(researchId, {
                    output_filename: filename,
                    output_path: filepath,
                    num_references: Object.keys(partialResults?.referenceMapping || {}).length,
                    num_learnings: partialResults?.learnings?.length || 0,
                    visited_urls_count: partialResults?.visitedUrls?.length || 0,
                    status: 'completed',
                    error_message: 'Research was interrupted and partial results were generated'
                });
                logger.info('Updated research record with partial completion details');
            } catch (error) {
                logger.error('Failed to update research record for partial results:', error);
            }
        } catch (error) {
            logger.error('Error saving partial report to disk:', error);
            // Continue even if saving fails
        }

        // Clean up the session
        activeSessions.delete(researchId);
        
        res.json({ 
            success: true,
            report: partialReport,
            filename: filename
        });
    } catch (error) {
        logger.error('Error generating partial report:', error);
        
        // Update research record with error
        try {
            const researchManager = await ResearchManager.getInstance();
            await researchManager.completeResearchRecord(researchId, {
                error_message: `Error generating partial report: ${error.message || 'Unknown error'}`,
                status: 'failed'
            });
            logger.info('Updated research record with partial report error');
        } catch (recordError) {
            logger.error('Failed to update research record with partial report error:', recordError);
        }
        
        res.status(500).json({ error: 'Failed to generate partial report' });
    }
});

// Prompt optimization endpoint
app.post('/api/optimize-prompt', authenticateToken, async (req, res) => {
    try {
        const { prompt, language = 'zh-CN' } = req.body;
        const userId = (req as any).user.id;
        
        if (!prompt) {
            return res.status(400).json({ error: 'Prompt is required' });
        }
        
        logger.info(`[Optimize Prompt] User ${userId} requested prompt optimization for: ${prompt}`);
        
        const apiResponse = await generateObject({
            model: o3MiniModel,
            system: "You are a professional research assistant. Your task is to understand the user's research purpose and help optimize their research prompt to make it clearer. Use same language as user.",
            prompt: prompt,
            schema: z.object({
                optimizedPrompt: z.string().describe('The optimized research prompt'),
            }),
        });
        logger.info(`[Optimize Prompt] Generated optimization response for user ${userId}`);
        
        // Extract the optimized prompt from the response
        let optimizedPrompt = apiResponse.object.optimizedPrompt;
        
        // If the response is long and likely contains explanation, try to extract just the prompt
        if (optimizedPrompt.length > 200) {
            // Look for patterns that might indicate the actual prompt
            const promptPatterns = [
                /优化后的提示词[：:]\s*["'](.+?)["']/s,
                /优化提示词[：:]\s*["'](.+?)["']/s,
                /建议的提示词[：:]\s*["'](.+?)["']/s,
                /optimized prompt[：:]\s*["'](.+?)["']/s,
                /suggested prompt[：:]\s*["'](.+?)["']/s,
                /final prompt[：:]\s*["'](.+?)["']/s,
                /["'](.+?)["']\s*作为您的研究提示词/s,
                /["'](.+?)["']\s*as your research prompt/s
            ];
            
            for (const pattern of promptPatterns) {
                const match = optimizedPrompt.match(pattern);
                if (match && match[1]) {
                    optimizedPrompt = match[1].trim();
                    break;
                }
            }
        }
        
        res.json({ 
            originalPrompt: prompt,
            optimizedPrompt: optimizedPrompt,
            fullResponse: optimizedPrompt
        });
        
    } catch (error) {
        logger.error('[Optimize Prompt] Error optimizing prompt:', error);
        res.status(500).json({ error: 'Failed to optimize prompt' });
    }
});

// Get user's research history
app.post('/api/research/list', authenticateToken, async (req, res) => {
    logger.info('[Research History] Fetching research history');
    try {
        const userId = (req as any).user.id;
        logger.info(`[Research History] Fetching research history for user ID: ${userId}`);
        
        const researchManager = await ResearchManager.getInstance();
        const researchRecords = await researchManager.getUserResearchRecords(userId);
        
        logger.info(`[Research History] Found ${researchRecords.length} records for user ${userId}`);
        res.json({ records: researchRecords });
    } catch (error) {
        logger.error('[Research History] Error fetching research history:', error);
        res.status(500).json({ error: 'Failed to fetch research history' });
    }
});

// Get specific research record
app.get('/api/research/:id', authenticateToken, async (req, res) => {
    try {
        const researchId = req.params.id;
        const userId = (req as any).user.id;
        logger.info(`[Research Record] Fetching research record: ${researchId} for user ${userId}`);
        
        const researchManager = await ResearchManager.getInstance();
        const record = await researchManager.getResearchRecord(researchId);
        
        if (!record) {
            logger.error(`[Research Record] Record not found: ${researchId}`);
            return res.status(404).json({ error: 'Research record not found' });
        }
        
        // Check if the user owns this research or is an admin
        if (record.user_id !== Number(userId) && !(req as any).user.is_admin) {
            logger.error(`[Research Record] Unauthorized access attempt: User ${userId} tried to access record ${researchId} owned by user ${record.user_id}`);
            return res.status(403).json({ error: 'You do not have permission to access this research' });
        }
        
        logger.info(`[Research Record] Successfully retrieved record: ${researchId}`);
        res.json({ record });
    } catch (error) {
        logger.error('[Research Record] Error fetching research record:', error);
        res.status(500).json({ error: 'Failed to fetch research record' });
    }
});

// Admin endpoint to get all recent research records
app.get('/api/admin/research', authenticateToken, async (req, res) => {
    try {
        // Check if user is admin
        if (!(req as any).user.is_admin) {
            logger.error(`[Admin Research] Unauthorized access attempt by user ${(req as any).user.id}`);
            return res.status(403).json({ error: 'Admin privileges required' });
        }
        
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        logger.info(`[Admin Research] Fetching recent research records, limit: ${limit}`);
        
        const researchManager = await ResearchManager.getInstance();
        const records = await researchManager.getRecentResearchRecords(limit);
        
        logger.info(`[Admin Research] Found ${records.length} recent research records`);
        res.json({ records });
    } catch (error) {
        logger.error('[Admin Research] Error fetching research records:', error);
        res.status(500).json({ error: 'Failed to fetch research records' });
    }
});

startServer();