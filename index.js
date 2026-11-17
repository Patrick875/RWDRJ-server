const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });

const cloudinary = require("cloudinary").v2;
const app = require("./app");
const { connectDatabase } = require("./config/database");

cloudinary.config({
	api_key: process.env.CLOUDINARY_API_KEY,
	api_secret: process.env.CLOUDINARY_API_SECRET,
	cloud_name: process.env.CLOUDINARY_API_CLIENT_NAME,
});

const PORT = Number(process.env.PORT || 8080);

connectDatabase()
	.then(() => {
		console.log("DB connection successful");
		app.listen(PORT, "0.0.0.0", () => console.log(`App running on port ${PORT}`));
	})
	.catch((error) => {
		console.error("Database connection failed", { message: error.message });
		process.exitCode = 1;
	});
