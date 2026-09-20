/* =====================================================================
   GDprint — «Բիզնեսների գովազդ» համակարգ
   business-data.js — Տվյալների կառավարման շերտ (Data Layer)
   -----------------------------------------------------------------
   Բոլոր տվյալները ներկայումս պահվում են localStorage-ում, որպեսզի
   համակարգն ամբողջությամբ աշխատի առանց backend-ի։ Երբ ապագայում
   միացվի PHP կամ Node.js backend, բավական է փոխարինել ստորև
   նշված ֆունկցիաների ներքին տրամաբանությունը fetch()/AJAX կանչերով՝
   առանց փոխելու վրա կառուցված UI կոդը (նույն ֆունկցիաների անունները
   և վերադարձվող ձևաչափը պահպանված են)։
   ===================================================================== */

(function (window) {
	"use strict";

	const STORAGE_KEY = "gdp_businesses";
	const FAVORITES_KEY = "gdp_favorites";
	const ADMIN_SESSION_KEY = "gdp_admin_session";

	/* -----------------------------------------------------------------
	   Կատեգորիաներ և Պլաններ (կենտրոնացված, որպեսզի բոլոր էջերը
	   օգտագործեն նույն ցուցակը)
	   ----------------------------------------------------------------- */
	const CATEGORIES = [
		{ slug: "printing", label: "Տպագրություն", icon: "bi-printer" },
		{ slug: "food", label: "Սնունդ", icon: "bi-cup-hot" },
		{ slug: "construction", label: "Շինարարություն", icon: "bi-tools" },
		{ slug: "beauty", label: "Գեղեցկության սրահ", icon: "bi-scissors" },
		{ slug: "medicine", label: "Բժշկություն", icon: "bi-heart-pulse" },
		{ slug: "auto", label: "Ավտոսպասարկում", icon: "bi-car-front" },
		{ slug: "it", label: "Ծրագրավորում", icon: "bi-code-slash" },
		{ slug: "retail", label: "Առևտուր", icon: "bi-shop" },
		{ slug: "other", label: "Այլ", icon: "bi-grid" }
	];

	const PLANS = {
		free: { label: "Անվճար", maxImages: 1, days: 30, featured: false, vip: false, price: 0 },
		silver: { label: "Silver", maxImages: 5, days: 90, featured: true, vip: false, price: 5000 },
		gold: { label: "Gold", maxImages: 10, days: 180, featured: true, vip: false, price: 12000 },
		premium: { label: "Premium", maxImages: 999, days: 36500, featured: true, vip: true, price: 25000 }
	};

	/* -----------------------------------------------------------------
	   Օգնական ֆունկցիաներ
	   ----------------------------------------------------------------- */

	// XSS-ից պաշտպանվելու համար՝ ցանկացած օգտատիրոջ ներմուծած տեքստ
	// ցուցադրելուց առաջ պարտադիր անցկացնել escapeHTML-ով
	function escapeHTML(str) {
		if (str === undefined || str === null) return "";
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	function uid() {
		return "b_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
	}

	function slugify(text) {
		const map = { ա: "a", բ: "b", գ: "g", դ: "d", ե: "e", զ: "z", է: "e", ը: "y", թ: "t", ժ: "zh", ի: "i", լ: "l", խ: "kh", ծ: "ts", կ: "k", հ: "h", ձ: "dz", ղ: "gh", ճ: "ch", մ: "m", յ: "y", ն: "n", շ: "sh", ո: "o", չ: "ch", պ: "p", ջ: "j", ռ: "r", ս: "s", վ: "v", տ: "t", ր: "r", ց: "ts", ու: "u", փ: "p", ք: "q", և: "ev", օ: "o", ֆ: "f" };
		let result = text.toLowerCase();
		result = result.replace(/ու/g, "u");
		result = result.split("").map((ch) => map[ch] !== undefined ? map[ch] : ch).join("");
		result = result.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
		return result || uid();
	}

	function readAll() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch (e) {
			console.error("Տվյալների ընթերցման սխալ՝", e);
			return null;
		}
	}

	function writeAll(list) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
			return true;
		} catch (e) {
			console.error("Տվյալների պահպանման սխալ (հնարավոր է localStorage-ի սահմանաչափը լցված է)՝", e);
			return false;
		}
	}

	/* -----------------------------------------------------------------
	   Demo տվյալներ՝ առաջին գործարկման ժամանակ (որպեսզի էջերը դատարկ
	   չլինեն), միայն եթե localStorage-ում դեռ ոչինչ չկա
	   ----------------------------------------------------------------- */
	function seedIfEmpty() {
		const existing = readAll();
		if (existing !== null) return;

		const now = Date.now();
		const demo = [
			{
				id: uid(), slug: "aygi-market", name: "Aygi Market", category: "retail",
				shortDesc: "Թարմ մթերքների սուպերմարկետ՝ մատչելի գներով։",
				fullDesc: "Aygi Market-ը առաջարկում է թարմ մթերքների լայն տեսականի, ամենօրյա ակցիաներ և արագ սպասարկում։",
				address: "Կոմիտաս 12", city: "Երևան", phone: "+374 11 222 333", whatsapp: "", viber: "", telegram: "",
				email: "info@aygimarket.am", website: "https://aygimarket.am", facebook: "", instagram: "", tiktok: "", youtube: "",
				hours: "10:00 - 22:00", logo: "", cover: "", gallery: [], mapLink: "",
				plan: "gold", status: "approved", featured: true, vip: false,
				createdAt: now - 86400000 * 10, expiresAt: now + 86400000 * 170,
				ratings: [{ user: "Անի", stars: 5, comment: "Շատ լավ սպասարկում։", date: now - 86400000 * 2 }]
			},
			{
				id: uid(), slug: "barber-shop", name: "Barber Shop", category: "beauty",
				shortDesc: "Տղամարդկանց վարսավիրանոց՝ պրոֆեսիոնալ վարպետներով։",
				fullDesc: "Ժամանակակից սանրվածքներ, մորուքի ձևավորում և խնամք բարձրակարգ վարպետներից։",
				address: "Մաշտոցի 45", city: "Երևան", phone: "+374 99 111 222", whatsapp: "+37499111222", viber: "", telegram: "",
				email: "", website: "", facebook: "", instagram: "https://instagram.com", tiktok: "", youtube: "",
				hours: "09:00 - 21:00", logo: "", cover: "", gallery: [], mapLink: "",
				plan: "silver", status: "approved", featured: true, vip: false,
				createdAt: now - 86400000 * 25, expiresAt: now + 86400000 * 65,
				ratings: [{ user: "Դավիթ", stars: 4, comment: "Լավ վարպետներ։", date: now - 86400000 * 5 }]
			},
			{
				id: uid(), slug: "med911", name: "Med 911", category: "medicine",
				shortDesc: "24/7 շտապ բժշկական օգնության ծառայություն։",
				fullDesc: "Med 911-ը մատուցում է շուրջօրյա շտապ բժշկական օգնություն ողջ Հայաստանում։",
				address: "Տիգրան Մեծի 5", city: "Երևան", phone: "+374 10 911 911", whatsapp: "", viber: "", telegram: "",
				email: "info@med911.am", website: "https://med911.am", facebook: "", instagram: "", tiktok: "", youtube: "",
				hours: "24/7", logo: "", cover: "", gallery: [], mapLink: "",
				plan: "premium", status: "approved", featured: true, vip: true,
				createdAt: now - 86400000 * 60, expiresAt: now + 86400000 * 3000,
				ratings: []
			},
			{
				id: uid(), slug: "new-printshop", name: "ՆորՊրինտ", category: "printing",
				shortDesc: "Թվային տպագրության նոր կենտրոն։",
				fullDesc: "Տպագրում ենք այցեքարտեր, բուկլետներ և բաններներ։",
				address: "Սայաթ-Նովա 8", city: "Երևան", phone: "+374 55 333 444", whatsapp: "", viber: "", telegram: "",
				email: "", website: "", facebook: "", instagram: "", tiktok: "", youtube: "",
				hours: "10:00 - 19:00", logo: "", cover: "", gallery: [], mapLink: "",
				plan: "free", status: "pending", featured: false, vip: false,
				createdAt: now - 86400000 * 1, expiresAt: now + 86400000 * 29,
				ratings: []
			}
		];
		writeAll(demo);
	}

	/* -----------------------------------------------------------------
	   Հանրային API
	   ----------------------------------------------------------------- */
	const BusinessAPI = {
		CATEGORIES,
		PLANS,
		escapeHTML,

		init() {
			seedIfEmpty();
		},

		getCategoryLabel(slug) {
			const c = CATEGORIES.find((c) => c.slug === slug);
			return c ? c.label : slug;
		},

		getCategoryIcon(slug) {
			const c = CATEGORIES.find((c) => c.slug === slug);
			return c ? c.icon : "bi-grid";
		},

		// Վերադարձնում է բոլոր բիզնեսները (առանց զտման)
		getAll() {
			return readAll() || [];
		},

		// Միայն հաստատված և ոչ ժամկետանց բիզնեսները՝ հանրային ցուցադրության համար
		getPublished({ search = "", category = "", city = "", planFilter = "", sort = "new" } = {}) {
			const now = Date.now();
			let list = this.getAll().filter((b) => b.status === "approved" && b.expiresAt > now);

			if (search) {
				const q = search.trim().toLowerCase();
				list = list.filter((b) =>
					b.name.toLowerCase().includes(q) ||
					b.city.toLowerCase().includes(q) ||
					this.getCategoryLabel(b.category).toLowerCase().includes(q) ||
					(b.shortDesc || "").toLowerCase().includes(q)
				);
			}
			if (category) list = list.filter((b) => b.category === category);
			if (city) list = list.filter((b) => b.city === city);
			if (planFilter === "premium") list = list.filter((b) => b.vip);
			if (planFilter === "free") list = list.filter((b) => b.plan === "free");
			if (planFilter === "new") list = list.filter((b) => now - b.createdAt < 86400000 * 14);

			list.sort((a, b) => {
				// VIP և Featured միշտ վերև
				const score = (x) => (x.vip ? 2 : 0) + (x.featured ? 1 : 0);
				const s = score(b) - score(a);
				if (s !== 0) return s;
				if (sort === "alphabetical") return a.name.localeCompare(b.name, "hy");
				if (sort === "rating") return this.getAvgRating(b) - this.getAvgRating(a);
				return b.createdAt - a.createdAt; // new (default)
			});

			return list;
		},

		getById(id) {
			return this.getAll().find((b) => b.id === id) || null;
		},

		getBySlug(slug) {
			return this.getAll().find((b) => b.slug === slug) || null;
		},

		getCities() {
			const cities = new Set(this.getAll().map((b) => b.city).filter(Boolean));
			return Array.from(cities).sort();
		},

		create(data) {
			const list = this.getAll();
			const plan = PLANS[data.plan] || PLANS.free;
			const now = Date.now();
			const business = {
				id: uid(),
				slug: slugify(data.name || "business") + "-" + Math.random().toString(36).slice(2, 6),
				name: escapeHTML(data.name),
				category: data.category,
				shortDesc: escapeHTML(data.shortDesc),
				fullDesc: escapeHTML(data.fullDesc),
				address: escapeHTML(data.address),
				city: escapeHTML(data.city),
				phone: escapeHTML(data.phone),
				whatsapp: escapeHTML(data.whatsapp),
				viber: escapeHTML(data.viber),
				telegram: escapeHTML(data.telegram),
				email: escapeHTML(data.email),
				website: escapeHTML(data.website),
				facebook: escapeHTML(data.facebook),
				instagram: escapeHTML(data.instagram),
				tiktok: escapeHTML(data.tiktok),
				youtube: escapeHTML(data.youtube),
				hours: escapeHTML(data.hours),
				logo: data.logo || "",
				cover: data.cover || "",
				gallery: (data.gallery || []).slice(0, plan.maxImages),
				mapLink: escapeHTML(data.mapLink),
				plan: data.plan,
				status: "pending", // միշտ սպասում է ադմինի հաստատմանը
				featured: false,
				vip: false,
				createdAt: now,
				expiresAt: now + plan.days * 86400000,
				ratings: []
			};
			list.unshift(business);
			writeAll(list);
			return business;
		},

		update(id, patch) {
			const list = this.getAll();
			const idx = list.findIndex((b) => b.id === id);
			if (idx === -1) return false;
			list[idx] = Object.assign({}, list[idx], patch);
			writeAll(list);
			return list[idx];
		},

		remove(id) {
			const list = this.getAll().filter((b) => b.id !== id);
			writeAll(list);
		},

		setStatus(id, status) {
			return this.update(id, { status });
		},

		toggleFeature(id) {
			const b = this.getById(id);
			if (!b) return false;
			return this.update(id, { featured: !b.featured });
		},

		toggleVip(id) {
			const b = this.getById(id);
			if (!b) return false;
			return this.update(id, { vip: !b.vip, featured: !b.vip ? true : b.featured });
		},

		addRating(id, stars, comment, user) {
			const b = this.getById(id);
			if (!b) return false;
			const ratings = b.ratings || [];
			ratings.push({ user: escapeHTML(user || "Հյուր"), stars: Math.max(1, Math.min(5, Number(stars))), comment: escapeHTML(comment), date: Date.now() });
			return this.update(id, { ratings });
		},

		getAvgRating(business) {
			if (!business.ratings || business.ratings.length === 0) return 0;
			const sum = business.ratings.reduce((acc, r) => acc + r.stars, 0);
			return Math.round((sum / business.ratings.length) * 10) / 10;
		},

		/* --- Սիրվածներ (Favorites) --- */
		getFavorites() {
			try {
				const raw = localStorage.getItem(FAVORITES_KEY);
				return raw ? JSON.parse(raw) : [];
			} catch (e) {
				return [];
			}
		},

		isFavorite(id) {
			return this.getFavorites().includes(id);
		},

		toggleFavorite(id) {
			let favs = this.getFavorites();
			if (favs.includes(id)) {
				favs = favs.filter((f) => f !== id);
			} else {
				favs.push(id);
			}
			localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
			return favs.includes(id);
		},

		/* --- Ադմինի պարզ սեսիա (demo նպատակով, ոչ արտադրական անվտանգություն) --- */
		isAdminLoggedIn() {
			return sessionStorage.getItem(ADMIN_SESSION_KEY) === "1";
		},

		adminLogin(password) {
			// ⚠ Սա միայն frontend demo է։ Իրական արտադրության մեջ
			// authentification-ը պարտադիր պետք է կատարվի backend-ում
			// (օր.՝ hashed password, session/JWT, rate limiting)։
			if (password === "admin123") {
				sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
				return true;
			}
			return false;
		},

		adminLogout() {
			sessionStorage.removeItem(ADMIN_SESSION_KEY);
		}
	};

	window.BusinessAPI = BusinessAPI;
})(window);
