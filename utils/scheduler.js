const schedule = require('node-schedule');
const mysql = require('mysql2/promise');
const { Connection, PublicKey } = require('@solana/web3.js');
const { TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const config = require('../config.json');
const ErrorCodes = require('../constants/errorCodes');

// 创建数据库连接池
const pool = mysql.createPool(config.database);

// 创建Solana连接
const connection = new Connection(config.solana.network);
const STONKS_TOKEN_ADDRESS = config.solana.stonksTokenAddress;

// 获取STONKS余额
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
        return BigInt(0);
    }
}

// 获取所有持有STONKS的钱包地址
async function getAllSTONKSHolders() {
    try {
        const token = new PublicKey(STONKS_TOKEN_ADDRESS);
        
        // 获取所有账户
        const accounts = await connection.getParsedProgramAccounts(TOKEN_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 165, // Token account size
                },
                {
                    memcmp: {
                        offset: 0,
                        bytes: token.toBase58(),
                    },
                },
            ],
        });
        
        // 提取钱包地址
        return accounts.map(account => {
            const data = account.account.data;
            const parsed = data.parsed.info;
            return parsed.owner;
        });
    } catch (error) {
        console.error('Failed to get STONKS holders:', error);
        return [];
    }
}

// 为即将开始的投票主题创建余额快照
async function createBalanceSnapshots() {
    console.log('Starting balance snapshot task...');
    const conn = await pool.getConnection();
    
    try {
        // 查找即将在30分钟内开始或已开始但未快照的投票主题
        const now = new Date();
        const tenMinutesLater = new Date(now.getTime() + 30 * 60 * 1000);
        
        const [upcomingTopics] = await conn.execute(
            `SELECT id, title, start_time FROM vote_topics 
             WHERE is_snapshot = 0
             AND start_time > ? `,
            [tenMinutesLater]
        );
        
        if (upcomingTopics.length === 0) {
            console.log('No topics found for snapshot');
            return;
        }
        
        console.log(`Found ${upcomingTopics.length} topics for snapshot`);
        upcomingTopics.forEach(topic => {
            console.log(`- Topic ID: ${topic.id}, Title: ${topic.title}, Start Time: ${topic.start_time}`);
        });
        
        // 获取所有STONKS持有者
        const holders = await getAllSTONKSHolders();
        console.log(`Found ${holders.length} STONKS holders`);
        
        // 为每个主题创建快照
        for (const topic of upcomingTopics) {
            const topicId = topic.id;
            
            console.log(`Creating snapshots for topic ${topicId}...`);
            
            // 分批处理持有者，每批100个
            const batchSize = 100;
            let snapshotSuccess = true;
            
            for (let i = 0; i < holders.length; i += batchSize) {
                const batch = holders.slice(i, i + batchSize);
                console.log(`Processing batch ${i/batchSize + 1}/${Math.ceil(holders.length/batchSize)}`);
                
                try {
                    // 收集所有余额大于0的地址和余额
                    const batchPromises = batch.map(async (walletAddress) => {
                        try {
                            const balance = await getSTONKSBalance(walletAddress);
                            if (balance > BigInt(0)) {
                                return {
                                    walletAddress,
                                    balance: balance.toString()
                                };
                            }
                            return null;
                        } catch (balanceError) {
                            console.error(`Failed to get balance for ${walletAddress}:`, balanceError);
                            return null;
                        }
                    });
                    
                    // 等待所有余额查询完成
                    const results = await Promise.all(batchPromises);
                    
                    // 过滤出有效的结果
                    const validResults = results.filter(result => result !== null);
                    
                    if (validResults.length > 0) {
                        // 构建批量插入的SQL语句
                        const placeholders = validResults.map(() => '(?, ?, ?)').join(', ');
                        const sql = `INSERT INTO balance_snapshots (topic_id, wallet_address, balance) VALUES ${placeholders}`;
                        
                        // 构建参数数组
                        const params = [];
                        validResults.forEach(result => {
                            params.push(topicId, result.walletAddress, result.balance);
                        });
                        
                        // 执行批量插入
                        await conn.execute(sql, params);
                        console.log(`Inserted ${validResults.length} snapshot records in batch ${i/batchSize + 1}`);
                    } else {
                        console.log(`No valid balances found in batch ${i/batchSize + 1}`);
                    }
                  
                    console.log(`Successfully created snapshots for batch ${i/batchSize + 1}`);
                } catch (error) {
                    console.error(`Failed to create snapshots for batch ${i/batchSize + 1}:`, error);
                    snapshotSuccess = false;
                    break;
                }
                
                // 添加延迟以避免请求过于频繁
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            // 如果快照创建成功，更新主题的is_snapshot状态
            if (snapshotSuccess) {
                try {
                    await conn.execute(
                        'UPDATE vote_topics SET is_snapshot = 1 WHERE id = ?',
                        [topicId]
                    );
                    console.log(`Updated is_snapshot status for topic ${topicId}`);
                } catch (updateError) {
                    console.error(`Failed to update is_snapshot status for topic ${topicId}:`, updateError);
                }
            }
            
            console.log(`Completed snapshot creation for topic ${topicId}`);
        }
    } catch (error) {
        console.error('Balance snapshot task failed:', error);
    } finally {
        conn.release();
    }
}

// 初始化定时任务
function initScheduler() {
    // 每10秒执行一次
    schedule.scheduleJob('*/10 * * * * *', createBalanceSnapshots);
}

module.exports = {
    initScheduler
};
