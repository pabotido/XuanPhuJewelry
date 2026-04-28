function createDbPoolManager(mssql, config) {
    let poolPromise = null;

    function isConnectionError(error) {
        const code = String(error?.code || '').toUpperCase();
        const name = String(error?.name || '').toUpperCase();
        const message = String(error?.message || '');

        if (['ECONNCLOSED', 'ECONNRESET', 'ENOTOPEN', 'ESOCKET', 'ETIMEOUT'].includes(code)) {
            return true;
        }

        if (name.includes('CONNECTION')) {
            return true;
        }

        return /failed to connect|connection|socket|timed out|closed/i.test(message);
    }

    async function closePool() {
        if (!poolPromise) return;

        try {
            const pool = await poolPromise;
            await pool.close();
        } catch {
            // Ignore pool close failures while resetting the connection state.
        } finally {
            poolPromise = null;
        }
    }

    async function createPool() {
        const pool = new mssql.ConnectionPool(config);
        pool.on('error', () => {
            closePool().catch(() => {});
        });
        await pool.connect();
        return pool;
    }

    async function connect(forceRefresh) {
        if (forceRefresh) {
            await closePool();
        }

        if (!poolPromise) {
            poolPromise = createPool().catch((error) => {
                poolPromise = null;
                throw error;
            });
        }

        const pool = await poolPromise;
        if (pool.connected === false || pool.healthy === false) {
            await closePool();
            return connect();
        }

        return pool;
    }

    async function request(handler) {
        try {
            const pool = await connect();
            return await handler(pool);
        } catch (error) {
            if (!isConnectionError(error)) {
                throw error;
            }

            const pool = await connect(true);
            return handler(pool);
        }
    }

    async function transaction(handler) {
        return request(async (pool) => {
            const transaction = new mssql.Transaction(pool);
            await transaction.begin();

            try {
                const result = await handler(transaction);
                await transaction.commit();
                return result;
            } catch (error) {
                try {
                    await transaction.rollback();
                } catch {
                    // Ignore rollback failures while bubbling up the original error.
                }
                throw error;
            }
        });
    }

    return {
        close: closePool,
        connect,
        request,
        transaction
    };
}

module.exports = {
    createDbPoolManager
};
