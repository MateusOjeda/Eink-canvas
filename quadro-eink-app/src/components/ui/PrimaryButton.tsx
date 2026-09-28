import type { ReactNode } from "react";

import {
	ActivityIndicator,
	Pressable,
	StyleSheet,
	Text,
	View,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { colors, radius, spacing, typography } from "@/theme";

type PrimaryButtonProps = Omit<PressableProps, "style" | "children"> & {
	title: string;
	leftIcon?: ReactNode;
	rightIcon?: ReactNode;
	loading?: boolean;
	style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
	title,
	leftIcon,
	rightIcon,
	loading = false,
	disabled = false,
	style,
	...pressableProps
}: PrimaryButtonProps) {
	const isDisabled = disabled || loading;

	return (
		<Pressable
			{...pressableProps}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityState={{
				disabled: isDisabled,
				busy: loading,
			}}
			style={({ pressed }) => [
				styles.button,
				pressed && !isDisabled && styles.pressed,
				isDisabled && styles.disabled,
				style,
			]}
		>
			{loading ? (
				<ActivityIndicator color={colors.white} />
			) : (
				<>
					<View style={styles.side}>{leftIcon}</View>

					<Text numberOfLines={1} style={styles.text}>
						{title}
					</Text>

					<View style={styles.side}>{rightIcon}</View>
				</>
			)}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		minHeight: 48,
		paddingHorizontal: spacing.lg,
		paddingVertical: 12,

		borderRadius: radius.lg,

		backgroundColor: colors.primary,

		flexDirection: "row",
		alignItems: "center",
		justifyContent: "center",
		gap: spacing.sm,
	},

	pressed: {
		backgroundColor: colors.primaryPressed,
	},

	disabled: {
		opacity: 0.5,
	},

	text: {
		flexShrink: 1,

		...typography.button,

		color: colors.white,
		textAlign: "center",
	},

	side: {
		minWidth: 24,
		alignItems: "center",
		justifyContent: "center",
	},
});

export default PrimaryButton;
