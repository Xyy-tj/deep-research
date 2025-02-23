import express from 'express';
import path from 'path';
import fs from 'fs';
import { deepResearch, writeFinalReport } from './deep-research';
import { generateFeedback } from './feedback';
import { OutputManager } from './output-manager';

const app = express();
const port = process.env.PORT || 3000;

// Enable detailed logging
const logger = {
    debug: (...args: any[]) => console.debug('[Server]', ...args),
    info: (...args: any[]) => console.info('[Server]', ...args),
    error: (...args: any[]) => console.error('[Server]', ...args)
};

// Enable detailed request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`, {
        body: req.body,
        query: req.query,
        params: req.params
    });
    next();
});

app.use(express.json());
app.use(express.static('public'));

// Store active research sessions
const activeSessions = new Map<string, {
    output: OutputManager;
    resolve: (answer: string) => void;
    report: string;
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

// Main research endpoint
app.post('/api/research', async (req, res) => {
    const { query, breadth, depth } = req.body;
    
    if (!query || !breadth || !depth) {
        logger.error('Missing required parameters:', { query, breadth, depth });
        return res.status(400).json({ error: 'Missing required parameters' });
    }

    const researchId = generateResearchId();
    logger.info('Starting new research:', { researchId, query, breadth, depth });
    
    const output = new WebOutputManager();
    
    // Store the research session
    activeSessions.set(researchId, {
        output,
        resolve: () => {},
        report: ''
    });

    // Send the research ID immediately
    res.json({ researchId });

    try {
        // Generate feedback and research
        logger.info('Generating feedback for query:', query);
        const followUpQuestions = await generateFeedback({
            query,
            output,
        });

        logger.info('Starting deep research');
        const results = await deepResearch({
            query,
            breadth,
            depth,
            output,
            onProgress: (progress) => {
                // Send progress updates to client
                (output as WebOutputManager).sendEventToAll({
                    type: 'progress',
                    progress
                });

                // If there's a question, send it to the client
                if (progress.currentQuery) {
                    (output as WebOutputManager).sendEventToAll({
                        type: 'question',
                        question: `Would you like to research more about: ${progress.currentQuery}?`
                    });
                }
            }
        });

        // Generate markdown report
        logger.info('Generating final report');
        const markdownContent = await writeFinalReport({
            prompt: query,
            learnings: results.learnings,
            visitedUrls: results.visitedUrls
        });

        // Save markdown content to session
        activeSessions.get(researchId)!.report = markdownContent;

        // Create output directory if it doesn't exist
        const outputDir = path.join(__dirname, '../output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }

        // Save markdown file
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const markdownPath = path.join(outputDir, `output-${timestamp}.md`);
        fs.writeFileSync(markdownPath, markdownContent);
        logger.info('Markdown file saved:', markdownPath);

        // Send the final results
        logger.info('Research completed successfully');
        (output as WebOutputManager).sendEventToAll({
            type: 'result',
            result: {
                ...results,
                filename: path.basename(markdownPath)
            }
        });

        // Signal completion
        (output as WebOutputManager).sendEventToAll({
            type: 'complete'
        });
    } catch (error) {
        logger.error('Research error:', error);
        (output as WebOutputManager).sendEventToAll({
            type: 'error',
            error: 'An error occurred during research'
        });
    } finally {
        // Clean up the session
        logger.info('Cleaning up research session:', researchId);
        activeSessions.delete(researchId);
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

// Serve index.html for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(port, () => {
    logger.info(`Server is running on http://localhost:${port}`);
});
