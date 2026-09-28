import type { PropsWithChildren } from "react";

import {
	StyleSheet,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { colors, radius, shadows, spacing } from "@/theme";

type CardProps = PropsWithChildren<{
	style?: StyleProp<ViewStyle>;
	padding?: "none" | "sm" | "md" | "lg";
	shadow?: boolean;
}>;

const paddingBySize = {
	none: 0,
	sm: spacing.md,
	md: spacing.lg,
	lg: spacing.xl,
} as const;

export function Card({
	children,
	style,
	padding = "md",
	shadow = false,
}: CardProps) {
	return (
		<View
			style={[
				styles.card,
				{ padding: paddingBySize[padding] },
				shadow && shadows.card,
				style,
			]}
		>
			{children}
		</View>
	);
}

const styles = StyleSheet.create({
	card: {
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.borderSoft,
		borderRadius: radius.lg,
	},
});

export default Card;
