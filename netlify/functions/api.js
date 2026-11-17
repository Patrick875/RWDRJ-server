const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "../../.env") });

const serverless = require("serverless-http");
const cloudinary = require("cloudinary").v2;
const app = require("../../app");
const { connectDatabase } = require("../../config/database");

cloudinary.config({
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	cloud_name: process.env.CLOUDINARY_API_CLIENT_NAME,
});

let handler;

exports.handler = async (event, context) => {
	await connectDatabase();
	if (!handler) handler = serverless(app);
	return handler(event, context);
};
