import express from 'express';
import path from 'path';
import fs from 'fs';
import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';
import { CreditManager } from './user/credit-manager';
import authRoutes from './user/auth-routes';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import { DB } from './db/database';
import { setupSwagger } from './swagger';

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

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) {
            logger.debug('Token verification failed:', err.message);
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        logger.debug('Authenticated user:', user);
        (req as any).user = user;
        next();
    });
}

// Mount authentication routes
app.use('/api', authRoutes);

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
app.get('/api/config/credits', (req, res) => {
    try {
        res.json({
            baseCredits: process.env.CREDITS_BASE_PRICE ? Number(process.env.CREDITS_BASE_PRICE) : 2,
            depthMultiplier: process.env.CREDITS_DEPTH_MULTIPLIER ? Number(process.env.CREDITS_DEPTH_MULTIPLIER) : 1,
            breadthMultiplier: process.env.CREDITS_BREADTH_MULTIPLIER ? Number(process.env.CREDITS_BREADTH_MULTIPLIER) : 0.5
        });
    } catch (error) {
        logger.error('Error fetching credit configuration:', error);
        res.status(500).json({ error: 'Failed to fetch credit configuration' });
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

        // Clean up the session
        activeSessions.delete(researchId);
        
        res.json({ 
            success: true,
            report: partialReport
        });
    } catch (error) {
        logger.error('Error generating partial report:', error);
        res.status(500).json({ error: 'Failed to generate partial report' });
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
        const outputDir = path.join(__dirname, '..', 'output');
        
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
    const filePath = path.join(__dirname, '..', 'output', filename);

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
    const filePath = path.join(__dirname, '..', 'output', filename);

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

        const port = process.env.PORT || 3000;
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });
    } catch (err) {
        logger.error('Failed to start server:', err);
        process.exit(1);
    }
}

startServer();
