import type { PropsWithChildren } from "react";

import {
	RefreshControl,
	ScrollView,
	StyleSheet,
	View,
	type ScrollViewProps,
	type StyleProp,
	type ViewStyle,
} from "react-native";

import { SafeAreaView, type Edge } from "react-native-safe-area-context";

import { colors, spacing } from "@/theme";

type ScreenProps = PropsWithChildren<{
	scroll?: boolean;
	style?: StyleProp<ViewStyle>;
	contentContainerStyle?: StyleProp<ViewStyle>;
	edges?: Edge[];
	keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
	refreshing?: boolean;
	onRefresh?: () => void;
}>;

const DEFAULT_EDGES: Edge[] = ["top", "left", "right", "bottom"];

export function Screen({
	children,
	scroll = false,
	style,
	contentContainerStyle,
	edges = DEFAULT_EDGES,
	keyboardShouldPersistTaps = "handled",
	refreshing = false,
	onRefresh,
}: ScreenProps) {
	if (scroll) {
		return (
			<SafeAreaView edges={edges} style={[styles.safeArea, style]}>
				<ScrollView
					style={styles.scroll}
					contentContainerStyle={[
						styles.content,
						styles.scrollContent,
						contentContainerStyle,
					]}
					keyboardShouldPersistTaps={keyboardShouldPersistTaps}
					showsVerticalScrollIndicator={true}
					refreshControl={
						onRefresh ? (
							<RefreshControl
								refreshing={refreshing}
								onRefresh={onRefresh}
								tintColor={colors.primary}
							/>
						) : undefined
					}
				>
					{children}
				</ScrollView>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView edges={edges} style={[styles.safeArea, style]}>
			<View
				style={[
					styles.content,
					styles.contentFill,
					contentContainerStyle,
				]}
			>
				{children}
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	safeArea: {
		flex: 1,
		backgroundColor: colors.background,
	},

	scroll: {
		flex: 1,
	},

	content: {
		paddingHorizontal: spacing.xxl,
		paddingTop: spacing.lg,
		paddingBottom: spacing.xxl,
	},

	scrollContent: {
		flexGrow: 1,
	},

	contentFill: {
		flex: 1,
	},
});

export default Screen;
