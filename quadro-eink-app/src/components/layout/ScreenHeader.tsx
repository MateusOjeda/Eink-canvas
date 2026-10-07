import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import {
	Animated,
	Easing,
	Pressable,
	StyleSheet,
	Text,
	View,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { router } from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/theme";

type ScreenHeaderProps = {
	title: string;
	subtitle?: string;
	showBackButton?: boolean;
	onBackPress?: () => void;
	rightAction?: ReactNode;
	processing?: boolean;
	style?: StyleProp<ViewStyle>;
};

export function ScreenHeader({
	title,
	subtitle,
	showBackButton = false,
	onBackPress,
	rightAction,
	processing = false,
	style,
}: ScreenHeaderProps) {
	const rotation = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		if (!processing) {
			rotation.stopAnimation();
			rotation.setValue(0);
			return;
		}

		const animation = Animated.loop(
			Animated.timing(rotation, {
				toValue: 1,
				duration: 900,
				easing: Easing.linear,
				useNativeDriver: true,
			}),
		);

		animation.start();

		return () => {
			animation.stop();
		};
	}, [processing, rotation]);

	const spinnerRotation = rotation.interpolate({
		inputRange: [0, 1],
		outputRange: ["0deg", "360deg"],
	});

	const handleBackPress = () => {
		if (onBackPress) {
			onBackPress();
			return;
		}

		router.back();
	};

	return (
		<View style={[styles.container, style]}>
			{showBackButton && (
				<View style={styles.topRow}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel="Voltar"
						hitSlop={8}
						onPress={handleBackPress}
						style={({ pressed }) => [
							styles.backButton,
							pressed && styles.pressed,
						]}
					>
						<Ionicons
							name="chevron-back"
							size={26}
							color={colors.text}
						/>
					</Pressable>

					{rightAction ? (
						<View style={styles.topRightAction}>{rightAction}</View>
					) : null}
				</View>
			)}

			<View style={styles.titleRow}>
				<View style={styles.titleBlock}>
					<Text style={styles.title}>{title}</Text>

					{subtitle ? (
						<Text style={styles.subtitle}>{subtitle}</Text>
					) : null}
				</View>

				{processing ? (
					<Animated.View
						style={[
							styles.processingIndicator,
							{
								transform: [{ rotate: spinnerRotation }],
							},
						]}
					>
						<Ionicons
							name="sync"
							size={22}
							color={colors.textSecondary}
						/>
					</Animated.View>
				) : null}

				{!showBackButton && rightAction ? (
					<View style={styles.titleRightAction}>{rightAction}</View>
				) : null}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		marginBottom: spacing.xxl,
	},

	topRow: {
		marginTop: -spacing.lg,
		minHeight: 44,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: spacing.md,
	},

	backButton: {
		width: 44,
		height: 44,
		borderRadius: radius.pill,
		backgroundColor: colors.surfaceMuted,
		alignItems: "center",
		justifyContent: "center",
	},

	pressed: {
		opacity: 0.7,
	},

	topRightAction: {
		alignItems: "center",
		justifyContent: "center",
	},

	titleRow: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.lg,
	},

	titleBlock: {
		flex: 1,
		minWidth: 0,
	},

	title: {
		...typography.screenTitle,
		color: colors.text,
	},

	subtitle: {
		marginTop: spacing.xs,
		...typography.body,
		color: colors.textSecondary,
	},

	processingIndicator: {
		alignItems: "center",
		justifyContent: "center",
	},

	titleRightAction: {
		alignItems: "center",
		justifyContent: "center",
	},
});

export default ScreenHeader;
