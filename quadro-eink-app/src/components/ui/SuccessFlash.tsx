import { useEffect, useRef } from "react";

import { Animated, StyleSheet, Text, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { colors, radius, spacing, typography } from "@/theme";

type SuccessFlashProps = {
	message?: string;
	onFinished: () => void;
};

export function SuccessFlash({
	message = "Foto adicionada",
	onFinished,
}: SuccessFlashProps) {
	const opacity = useRef(new Animated.Value(0)).current;
	const scale = useRef(new Animated.Value(0.85)).current;

	useEffect(() => {
		Animated.parallel([
			Animated.timing(opacity, {
				toValue: 1,
				duration: 160,
				useNativeDriver: true,
			}),
			Animated.spring(scale, {
				toValue: 1,
				speed: 24,
				bounciness: 6,
				useNativeDriver: true,
			}),
		]).start();

		const timeout = setTimeout(() => {
			onFinished();
		}, 1250);

		return () => clearTimeout(timeout);
	}, [onFinished, opacity, scale]);

	return (
		<View style={styles.container}>
			<Animated.View
				style={[
					styles.content,
					{
						opacity,
						transform: [{ scale }],
					},
				]}
			>
				<View style={styles.icon}>
					<Feather
						name="check"
						size={36}
						color={colors.primaryPressed}
					/>
				</View>

				<Text style={styles.text}>{message}</Text>
			</Animated.View>
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		...StyleSheet.absoluteFill,

		backgroundColor: colors.background,

		alignItems: "center",
		justifyContent: "center",

		zIndex: 999,
	},

	content: {
		alignItems: "center",
		gap: spacing.lg,
	},

	icon: {
		width: 76,
		height: 76,

		borderRadius: radius.pill,

		backgroundColor: colors.primarySoft,

		alignItems: "center",
		justifyContent: "center",
	},

	text: {
		...typography.sectionTitle,

		color: colors.text,
		textAlign: "center",
	},
});
