const serverless = require("serverless-http");
const app = require("../../app");
const connectDB = require("../../db");

const DB = process.env.ONLINE_DATABASE_URL;

module.exports.handler = async (event, context) => {
  await connectDB(DB); // 🔥 ENSURE DB CONNECTED
  return serverless(app)(event, context);
};
