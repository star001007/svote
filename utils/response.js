class Response {
    static success(data = null) {
        return {
            errno: 0,
            errmsg: 'Success',
            data
        };
    }

    static error(error) {
        return {
            errno: error.code || 10001,
            errmsg: error.message || 'System error',
            data: null
        };
    }
}

module.exports = Response; 