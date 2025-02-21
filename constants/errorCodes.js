module.exports = {
    SUCCESS: { code: 0, message: 'Success' },
    SYSTEM_ERROR: { code: 10001, message: 'System error' },
    INVALID_PARAMS: { code: 10002, message: 'Invalid parameters' },
    DB_ERROR: { code: 10003, message: 'Database error' },
    CONCURRENT_OPERATION: { code: 10004, message: 'Operation is in progress, please try again later' },
    
    // Wallet related
    WALLET_ERROR: { code: 20001, message: 'Failed to get wallet balance' },
    INSUFFICIENT_BALANCE: { code: 20002, message: 'Insufficient STONKS balance' },
    
    // Vote related
    TOPIC_NOT_FOUND: { code: 30001, message: 'Vote topic not found' },
    TOPIC_NOT_ACTIVE: { code: 30002, message: 'Vote topic is not active' },
    TOPIC_NOT_IN_TIME: { code: 30003, message: 'Vote is not in valid time range' },
    ALREADY_VOTED: { code: 30004, message: 'Address has already voted' },
    INVALID_OPTION: { code: 30005, message: 'Invalid vote option' }
}; 