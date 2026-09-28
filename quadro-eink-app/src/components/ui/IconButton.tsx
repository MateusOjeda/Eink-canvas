import type { ReactNode } from "react";

import {
	Pressable,
	StyleSheet,
	type PressableProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { colors, radius } from "@/theme";

type IconButtonProps = Omit<PressableProps, "style" | "children"> & {
	icon: ReactNode;
	accessibilityLabel: string;
	style?: StyleProp<ViewStyle>;
};

export function IconButton({
	icon,
	accessibilityLabel,
	disabled = false,
	style,
	...pressableProps
}: IconButtonProps) {
	const isDisabled = Boolean(disabled);

	return (
		<Pressable
			{...pressableProps}
			disabled={isDisabled}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			accessibilityState={{ disabled: isDisabled }}
			style={({ pressed }) => [
				styles.button,
				pressed && !isDisabled && styles.pressed,
				isDisabled && styles.disabled,
				style,
			]}
		>
			{icon}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		width: 40,
		height: 40,

		borderRadius: radius.md,

		backgroundColor: colors.surfaceMuted,

		alignItems: "center",
		justifyContent: "center",
	},

	pressed: {
		opacity: 0.7,
	},

	disabled: {
		opacity: 0.4,
	},
});

export default IconButton;
