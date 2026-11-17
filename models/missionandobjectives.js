const mongoose = require("mongoose");

const missionAndObjectivesSchema = mongoose.Schema({
	title: String,
	mission: {
		type: String,
		trim: true,
	},
	vision: {
		type: String,
		trim: true,
	},
	objectives: [{ type: String, trim: true }],
});

const MissionAndObjectives = mongoose.model(
	"MissionAndObjectives",
	missionAndObjectivesSchema
);

module.exports = MissionAndObjectives;
