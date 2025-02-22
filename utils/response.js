class Response {
    static success(data = null) {
        return {
            code: 0,
            message: 'Success',
            data
        };
    }

    static error(error) {
        return {
            code: error.code || 1006,  // Default to SYSTEM_ERROR
            message: error.message || 'System error',
            data: null
        };
    }
}

module.exports = Response; 