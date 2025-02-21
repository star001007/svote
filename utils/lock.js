class Lock {
    constructor() {
        this.locks = new Map();
    }

    async acquire(key, timeout = 5000) {
        if (this.locks.has(key)) {
            throw new Error('Lock is already held');
        }

        const lockInfo = {
            timestamp: Date.now(),
            timeout
        };
        this.locks.set(key, lockInfo);

        // 设置自动释放
        setTimeout(() => {
            if (this.locks.get(key) === lockInfo) {
                this.release(key);
            }
        }, timeout);
    }

    release(key) {
        this.locks.delete(key);
    }

    isLocked(key) {
        if (!this.locks.has(key)) {
            return false;
        }

        const lockInfo = this.locks.get(key);
        if (Date.now() - lockInfo.timestamp >= lockInfo.timeout) {
            this.release(key);
            return false;
        }
        return true;
    }
}

module.exports = new Lock(); // 单例模式 