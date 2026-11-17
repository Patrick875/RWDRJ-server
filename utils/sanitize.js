/*
 * Server-side HTML/URL sanitising (seed script, imports, tests). Mirrors the client
 * DOMPurify allowlist in client/src/cms/sanitize.ts. Anchor handling follows the
 * ir-frontend `afterSanitizeAttributes` hook: unsafe hrefs dropped, external links get rel/target.
 */
const sanitizeHtmlLib = require("sanitize-html");

const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "s", "a", "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "img", "hr", "span"];
const SAFE_PROTOCOL = /^(https?:|mailto:|tel:)/i;

const safeUrl = (value, { allowRelative = true } = {}) => {
	const url = String(value || "").trim();
	if (!url) return "";
	// strip control chars/whitespace that browsers ignore inside schemes ("java\tscript:")
	const compact = url.replace(/[\u0000-\u001F\u007F\s]+/g, "");
	if (SAFE_PROTOCOL.test(compact)) return url;
	if (allowRelative && /^(\/(?!\/)|#|\.\.?\/)/.test(compact)) return url;
	return "";
};

const sanitizeHtml = (html) =>
	sanitizeHtmlLib(String(html || ""), {
		allowedTags: ALLOWED_TAGS,
		allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "width", "height"], "*": [] },
		allowedSchemes: ["http", "https", "mailto", "tel"],
		allowedSchemesByTag: { img: ["https", "http"] },
		allowProtocolRelative: false,
		disallowedTagsMode: "discard",
		transformTags: {
			a: (tagName, attribs) => {
				const href = safeUrl(attribs.href);
				const out = {};
				if (href) out.href = href;
				if (/^https?:/i.test(href)) {
					out.target = "_blank";
					out.rel = "noopener noreferrer";
				}
				return { tagName, attribs: out };
			},
		},
	});

const isYouTubeHost = (host) => /^(www\.|m\.)?(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(host);

/** Accepts youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID. Returns the 11-char id or "". */
const parseYouTubeId = (value) => {
	try {
		const url = new URL(String(value || "").trim());
		if (!/^https?:$/.test(url.protocol) || !isYouTubeHost(url.hostname)) return "";
		let id = "";
		if (/youtu\.be$/i.test(url.hostname)) id = url.pathname.slice(1);
		else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
		else id = (url.pathname.match(/^\/(embed|shorts|live)\/([^/?#]+)/) || [])[2] || "";
		return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : "";
	} catch {
		return "";
	}
};

/** Google Maps embeds only: https://www.google.com/maps/embed?... or maps.google.com/maps?...&output=embed */
const isGoogleMapsEmbedUrl = (value) => {
	try {
		const url = new URL(String(value || "").trim());
		if (url.protocol !== "https:") return false;
		if (/^(www\.)?google\.[a-z.]{2,6}$/i.test(url.hostname) && url.pathname.startsWith("/maps/embed")) return true;
		return /^maps\.google\.[a-z.]{2,6}$/i.test(url.hostname) && url.searchParams.get("output") === "embed";
	} catch {
		return false;
	}
};

module.exports = { sanitizeHtml, safeUrl, parseYouTubeId, isGoogleMapsEmbedUrl, ALLOWED_TAGS };
