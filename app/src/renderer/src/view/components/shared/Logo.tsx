import { Box, type SxProps, type Theme } from "@mui/material";
import logo from "@/assets/logo.svg";

/**
 * Application logo: a vault dial with a keyhole
 */
export function Logo({ size, sx = [] }: Readonly<{ size: number; sx?: SxProps<Theme> }>) {
	return (
		<Box component="img" src={logo} alt="" draggable={false} sx={[{ width: size, height: size, display: "block", userSelect: "none" }, ...(Array.isArray(sx) ? sx : [sx])]} />
	);
}
