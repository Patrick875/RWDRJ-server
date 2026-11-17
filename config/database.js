const mongoose = require("mongoose");

let connectionPromise;

const connectDatabase = async () => {
	if (mongoose.connection.readyState === 1) return mongoose.connection;
	if (connectionPromise) return connectionPromise;

	const connectionString = process.env.ONLINE_DATABASE_URL || process.env.LOCAL_DATABASE_URL;
	if (!connectionString) throw new Error("ONLINE_DATABASE_URL or LOCAL_DATABASE_URL must be configured");

	connectionPromise = mongoose.connect(connectionString, {
		serverSelectionTimeoutMS: 10_000,
		maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE || 10),
	});

	try {
		await connectionPromise;
		return mongoose.connection;
	} catch (error) {
		connectionPromise = undefined;
		throw error;
	}
};

module.exports = { connectDatabase };
