export const colors = {
	background: "#FAF9F7",
	surface: "#FFFFFF",
	surfaceMuted: "#F4F5F4",

	text: "#1A1A1A",
	textSecondary: "#666666",
	textMuted: "#888888",

	primary: "#668882",
	primaryPressed: "#4e6863",
	primarySoft: "#EDF2F1",

	border: "#DDDDDD",
	borderSoft: "#EEEEEE",

	danger: "#B42318",
	dangerSoft: "#FDECEC",

	disabled: "#F5F5F5",
	disabledText: "#AAAAAA",

	white: "#FFFFFF",
	black: "#000000",

	overlay: "rgba(0, 0, 0, 0.25)",
} as const;

export const spacing = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 20,
	xxl: 24,
	xxxl: 32,
} as const;

export const radius = {
	sm: 8,
	md: 10,
	lg: 12,
	xl: 14,
	pill: 999,
} as const;

export const typography = {
	caption: {
		fontSize: 12,
		lineHeight: 16,
	},

	metadata: {
		fontSize: 13,
		lineHeight: 18,
	},

	body: {
		fontSize: 15,
		lineHeight: 21,
	},

	input: {
		fontSize: 16,
		lineHeight: 22,
	},

	button: {
		fontSize: 16,
		lineHeight: 22,
		fontWeight: "600" as const,
	},

	cardTitle: {
		fontSize: 17,
		lineHeight: 22,
		fontWeight: "600" as const,
	},

	emptyTitle: {
		fontSize: 18,
		lineHeight: 24,
		fontWeight: "600" as const,
	},

	sectionTitle: {
		fontSize: 22,
		lineHeight: 28,
		fontWeight: "700" as const,
	},

	screenTitle: {
		fontSize: 24,
		lineHeight: 30,
		fontWeight: "700" as const,
	},
} as const;

export const shadows = {
	card: {
		shadowColor: colors.black,
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.06,
		shadowRadius: 8,
		elevation: 2,
	},

	popup: {
		shadowColor: colors.black,
		shadowOffset: {
			width: 0,
			height: 2,
		},
		shadowOpacity: 0.12,
		shadowRadius: 6,
		elevation: 5,
	},
} as const;

export const theme = {
	colors,
	spacing,
	radius,
	typography,
	shadows,
} as const;

export type Theme = typeof theme;
