import { DB } from '../db/database';

export interface ResearchRecord {
    id?: number;
    user_id: number;
    research_id: string;
    query: string;
    query_depth: number;
    query_breadth: number;
    language: string;
    credits_used: number;
    output_filename?: string;
    output_path?: string;
    num_references?: number;
    num_learnings?: number;
    visited_urls_count?: number;
    config_json?: string;
    status: 'started' | 'completed' | 'failed';
    error_message?: string;
    start_time?: string;
    end_time?: string;
    execution_time_ms?: number;
}

export class ResearchManager {
    private static instance: ResearchManager;
    private db?: DB;

    private constructor() {}

    static async getInstance(): Promise<ResearchManager> {
        if (!ResearchManager.instance) {
            ResearchManager.instance = new ResearchManager();
            ResearchManager.instance.db = await DB.getInstance();
        }
        return ResearchManager.instance;
    }

    async createResearchRecord(record: Omit<ResearchRecord, 'id' | 'start_time'>): Promise<number> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Creating research record:', record);
        
        // Format current date in MySQL compatible format (YYYY-MM-DD HH:MM:SS)
        const startTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
        
        const { lastID } = await this.db.run(
            `INSERT INTO research_records (
                user_id, research_id, query, query_depth, query_breadth, 
                language, credits_used, status, start_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record.user_id, 
                record.research_id, 
                record.query, 
                record.query_depth, 
                record.query_breadth,
                record.language, 
                record.credits_used, 
                record.status,
                startTime
            ]
        );

        return lastID as number;
    }

    async updateResearchRecord(researchId: string, updates: Partial<ResearchRecord>): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Updating research record:', { researchId, updates });
        
        // Build the SET clause dynamically based on the provided updates
        const setClause: string[] = [];
        const params: any[] = [];

        for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
                setClause.push(`${key} = ?`);
                params.push(value);
            }
        }

        if (setClause.length === 0) {
            console.log('No updates provided, skipping');
            return;
        }

        // Add researchId to params
        params.push(researchId);

        await this.db.run(
            `UPDATE research_records SET ${setClause.join(', ')} WHERE research_id = ?`,
            params
        );
    }

    async completeResearchRecord(
        researchId: string, 
        data: {
            output_filename?: string;
            output_path?: string;
            num_references?: number;
            num_learnings?: number;
            visited_urls_count?: number;
            error_message?: string;
            status?: 'completed' | 'failed';
        }
    ): Promise<void> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Completing research record:', { researchId, data });
        
        // Format date in MySQL compatible format (YYYY-MM-DD HH:MM:SS)
        const now = new Date();
        const endTime = now.toISOString().slice(0, 19).replace('T', ' ');
        
        // Get the start time to calculate execution time
        const record = await this.getResearchRecord(researchId);
        if (!record) {
            throw new Error(`Research record not found: ${researchId}`);
        }
        
        // Calculate execution time in milliseconds
        let executionTimeMs = 0;
        if (record.start_time) {
            const startTime = new Date(record.start_time);
            executionTimeMs = now.getTime() - startTime.getTime();
        }
        
        await this.updateResearchRecord(researchId, {
            ...data,
            end_time: endTime,
            execution_time_ms: executionTimeMs,
            status: data.status || 'completed'
        });
    }

    async getResearchRecord(researchId: string): Promise<ResearchRecord | undefined> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Getting research record:', researchId);
        
        return this.db.get<ResearchRecord>(
            'SELECT * FROM research_records WHERE research_id = ?',
            [researchId]
        );
    }

    async getUserResearchRecords(userId: number): Promise<ResearchRecord[]> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Getting research records for user:', userId);
        
        return this.db.all<ResearchRecord>(
            'SELECT * FROM research_records WHERE user_id = ? ORDER BY start_time DESC',
            [userId]
        );
    }

    async getRecentResearchRecords(limit: number = 50): Promise<ResearchRecord[]> {
        if (!this.db) throw new Error('Database not initialized');

        console.log('Getting recent research records, limit:', limit);
        
        return this.db.all<ResearchRecord>(
            'SELECT * FROM research_records ORDER BY start_time DESC LIMIT ?',
            [limit]
        );
    }
}
