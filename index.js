const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  cloud_name: process.env.CLOUDINARY_API_CLIENT_NAME,
});

const app = require("./app");
const PORT = process.env.PORT || 5000;
const DB = process.env.ONLINE_DATABASE_URL;

// Only listen locally, not on Netlify
if (process.env.NODE_ENV !== "production") {
  mongoose.connect(DB).then(() => {
    app.listen(PORT, () => {
      console.log(`App running on port ${PORT}`);
    });
  });
}

module.exports = app;
