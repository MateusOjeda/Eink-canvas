import {
	Switch,
	type SwitchProps,
} from "react-native";

import { colors } from "@/theme";

type AppSwitchProps = SwitchProps;

export function AppSwitch(props: AppSwitchProps) {
	return (
		<Switch
			trackColor={{
				false: colors.border,
				true: colors.primary,
			}}
			thumbColor={colors.white}
			ios_backgroundColor={colors.border}
			{...props}
		/>
	);
}

export default AppSwitch;
