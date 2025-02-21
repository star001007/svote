const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const config = require('./config.json');
const ErrorCodes = require('./constants/errorCodes');
const Response = require('./utils/response');
const Lock = require('./utils/lock');

const app = express();
app.use(cors());
app.use(express.json());

// Read MySQL connection configuration from config.json
const pool = mysql.createPool(config.database);

// Read Solana configuration from config.json
const connection = new Connection(config.solana.network);
const STONKS_TOKEN_ADDRESS = config.solana.stonksTokenAddress;

// Add new error code
const LOCK_TIMEOUT = 5000; // 5 seconds lock timeout

// Get STONKS balance
async function getSTONKSBalance(walletAddress) {
    try {
        const wallet = new PublicKey(walletAddress);
        const token = new PublicKey(STONKS_TOKEN_ADDRESS);
        
        const accounts = await connection.getParsedTokenAccountsByOwner(wallet, {
            programId: TOKEN_PROGRAM_ID,
        });
        
        const stonksAccount = accounts.value.find(
            account => account.account.data.parsed.info.mint === token.toString()
        );
        
        return stonksAccount ? BigInt(stonksAccount.account.data.parsed.info.tokenAmount.amount) : BigInt(0);
    } catch (error) {
        console.error('Failed to get STONKS balance:', error);
        throw ErrorCodes.WALLET_ERROR;
    }
}

// Get topic list
app.get('/api/topics', async (req, res) => {
    try {
        const { status } = req.query;
        const now = new Date();
        
        let whereClause = 'WHERE is_active = 1';
        if (status === 'upcoming') {
            whereClause += ' AND start_time > ?';
        } else if (status === 'active') {
            whereClause += ' AND start_time <= ? AND end_time >= ?';
        } else if (status === 'ended') {
            whereClause += ' AND end_time < ?';
        }
        
        const [topics] = await pool.execute(
            `SELECT * FROM vote_topics ${whereClause} ORDER BY created_at DESC LIMIT 100`,
            status ? [now, now] : []
        );
        
        res.json(Response.success(topics));
    } catch (error) {
        console.error('Failed to get topics:', error);
        res.status(500).json(Response.error(ErrorCodes.DB_ERROR));
    }
});

// Get topic details
app.get('/api/topics/:id', async (req, res) => {
    try {
        // Query topic basic information
        const [[topic]] = await pool.execute(
            'SELECT * FROM vote_topics WHERE id = ?',
            [req.params.id]
        );

        if (!topic) {
            throw ErrorCodes.TOPIC_NOT_FOUND;
        }

        // Query options information
        const [options] = await pool.execute(
            'SELECT id, topic_id, option_text, vote_count FROM vote_options WHERE topic_id = ?',
            [req.params.id]
        );

        res.json(Response.success({ topic, options }));
    } catch (error) {
        console.error('Failed to get topic details:', error);
        res.status(400).json(Response.error(error.code ? error : ErrorCodes.SYSTEM_ERROR));
    }
});

// Submit vote
app.post('/api/vote', async (req, res) => {
    const conn = await pool.getConnection();
    const lockKey = `vote:${req.body.topicId}:${req.body.walletAddress}`;
    
    try {
        // Try to acquire lock
        if (Lock.isLocked(lockKey)) {
            throw ErrorCodes.CONCURRENT_OPERATION;
        }
        
        try {
            await Lock.acquire(lockKey, LOCK_TIMEOUT);
        } catch (error) {
            throw ErrorCodes.CONCURRENT_OPERATION;
        }
                
        const { topicId, optionId, walletAddress } = req.body;
        
        // Check topic status
        const [[topic]] = await conn.execute(
            'SELECT * FROM vote_topics WHERE id = ? AND is_active = 1',
            [topicId]
        );
        
        if (!topic) {
            throw ErrorCodes.TOPIC_NOT_FOUND;
        }
        
        const now = new Date();
        if (now < topic.start_time || now > topic.end_time) {
            throw ErrorCodes.TOPIC_NOT_IN_TIME;
        }
        
        // Check if already voted
        const [[existingVote]] = await conn.execute(
            'SELECT id FROM vote_records WHERE topic_id = ? AND wallet_address = ?',
            [topicId, walletAddress]
        );
        
        if (existingVote) {
            throw ErrorCodes.ALREADY_VOTED;
        }
        
        // Get STONKS balance
        const balance = await getSTONKSBalance(walletAddress);
        if (balance < BigInt(100)) {
            throw ErrorCodes.INSUFFICIENT_BALANCE;
        }

        // Start transaction
        await conn.beginTransaction();
        
        // Record vote
        await conn.execute(
            'INSERT INTO vote_records (topic_id, option_id, wallet_address, vote_amount) VALUES (?, ?, ?, ?)',
            [topicId, optionId, walletAddress, balance.toString()]
        );
        
        // Update option vote count
        await conn.execute(
            'UPDATE vote_options SET vote_count = vote_count + ? WHERE id = ?',
            [balance.toString(), optionId]
        );
        
        await conn.commit();
        res.json(Response.success({ message: 'Vote submitted successfully' }));
    } catch (error) {
        await conn.rollback();
        console.error('Failed to submit vote:', error);
        res.status(400).json(Response.error(error.code ? error : ErrorCodes.SYSTEM_ERROR));
    } finally {
        Lock.release(lockKey);
        conn.release();
    }
});

// Get voting records
app.get('/api/topics/:id/records', async (req, res) => {
    try {
        const sort = req.query.sort || 'amount';
        const orderBy = sort === 'time' ? 'created_at' : 'vote_amount';

        // Get voting records
        const [records] = await pool.execute(
            `SELECT * FROM vote_records WHERE topic_id = ? ORDER BY ${orderBy} DESC`,
            [req.params.id]
        );

        if (records.length === 0) {
            return res.json(Response.success([]));
        }

        // Query all options information
        const [options] = await pool.execute(
            'SELECT id, option_text FROM vote_options WHERE topic_id = ?',
            [req.params.id]
        );

        // Create option lookup map
        const optionMap = options.reduce((map, option) => {
            map[option.id] = option.option_text;
            return map;
        }, {});

        // Combine data
        const enrichedRecords = records.map(record => ({
            ...record,
            option_text: optionMap[record.option_id]
        }));

        res.json(Response.success(enrichedRecords));
    } catch (error) {
        console.error('Failed to get vote records:', error);
        res.status(400).json(Response.error(error.code ? error : ErrorCodes.SYSTEM_ERROR));
    }
});

// Get wallet voting record
app.get('/api/topics/:id/wallet/:address', async (req, res) => {
    try {
        // Query voting record
        const [[record]] = await pool.execute(
            'SELECT * FROM vote_records WHERE topic_id = ? AND wallet_address = ?',
            [req.params.id, req.params.address]
        );

        if (!record) {
            return res.json(Response.success(null));
        }

        // Query option information
        const [[option]] = await pool.execute(
            'SELECT option_text FROM vote_options WHERE id = ?',
            [record.option_id]
        );

        res.json(Response.success({
            ...record,
            option_text: option.option_text
        }));
    } catch (error) {
        console.error('Failed to get wallet vote record:', error);
        res.status(400).json(Response.error(error.code ? error : ErrorCodes.SYSTEM_ERROR));
    }
});

const PORT = process.env.PORT || config.server.port;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 