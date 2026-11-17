const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const { connectDatabase } = require("../config/database");
const Page = require("../models/page");
const SiteSettings = require("../models/siteSettings");

const legacyApiUrl = (process.env.LEGACY_API_URL || "http://127.0.0.1:8080/api").replace(/\/$/, "");
const status = process.env.SEED_STATUS || "published";

const videos = [
	{ url: "https://youtu.be/ZFMCR_MVrfg", title: "International Women's Day - Women Doctors", thumb: "https://res.cloudinary.com/didikwl4i/image/upload/v1714253046/thumb2_o7syci.jpg" },
	{ url: "https://www.youtube.com/watch?v=79VyUWkdh88", title: "16 Days of Activism against Gender-Based Violence #EndGBV", thumb: "https://res.cloudinary.com/didikwl4i/image/upload/v1714253046/thumb2_o7syci.jpg" },
];

async function getJson(endpoint) {
	const response = await fetch(`${legacyApiUrl}${endpoint}`);
	if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
	return response.json();
}

function normalizeAbout(data) {
	const about = data?.data?.[0];
	if (!about) throw new Error("The legacy /aboutus endpoint returned no page data");
	return {
		...about,
		whoWeAreSection: { ...about.whoWeAreSection, content: about.whoWeAreSection?.content || "" },
		whatWeDoSection: {
			...about.whatWeDoSection,
			sections: (about.whatWeDoSection?.sections || []).map((section) => ({ ...section, content: section.content || "" })),
		},
	};
}

async function main() {
	await connectDatabase();
	const [aboutResponse, newsResponse, partnersResponse] = await Promise.all([getJson("/aboutus"), getJson("/news"), getJson("/partners")]);
	const aboutContent = normalizeAbout(aboutResponse);
	const news = newsResponse.data || [];
	const partners = (partnersResponse.data || aboutResponse.partners || []).filter((partner) => partner.visible !== false);

	const page = await Page.findOneAndUpdate(
		{ slug: "about" },
		{
			$set: {
				title: "About us",
				template: "legacy-about",
				excerpt: "Rwanda Women Doctors for Reproductive Justice",
				status,
				seo: { title: "Rwanda Women Doctors For Reproductive Justice", description: "Rwanda Women Doctors For Reproductive Justice" },
				sections: [{ id: "about-legacy", type: "legacy_about", version: 1, label: "About us", order: 0, visible: true, data: { aboutContent: [aboutContent], news, partners, videos }, style: {}, responsive: {} }],
				routeAliases: ["", "home"],
				themeOverrides: {},
			},
			$setOnInsert: { revision: 0, publishedRevision: 0 },
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	);

	await SiteSettings.findOneAndUpdate(
		{ key: "default" },
		{
			$set: {
				organizationName: "RWDRJ",
				tagline: "Rwanda Women Doctors For Reproductive Justice",
				contacts: { address: "NR5, Nyamata, Near BPR Bank Nyamata", emails: ["eb@womenrepro.org", "womenreproductivejustice@gmail.com"], phoneNumbers: ["+250 782 864 790 / +250 794 418 097"] },
				socialLinks: [{ platform: "twitter", url: "https://twitter.com/doctors_women" }, { platform: "linkedin", url: "https://www.linkedin.com/company/doctors_women/" }],
				designTokens: { colors: { brand: "#C29F1D", brandMuted: "rgba(194, 159, 45, 0.85)", navy: "#0A142F", blue: "#233876", heading: "#0C4A6E", surface: "#F9FAFB" }, fonts: { body: "DM Sans", heading: "Lora" }, containerWidth: "80rem" },
			},
		},
		{ upsert: true, new: true, setDefaultsOnInsert: true }
	);

	console.log(JSON.stringify({ pageId: page._id, slug: page.slug, status: page.status, sections: page.sections.length, news: news.length, partners: partners.length }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
