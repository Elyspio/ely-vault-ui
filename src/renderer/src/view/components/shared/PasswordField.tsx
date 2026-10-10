import { useState } from "react";
import { IconButton, InputAdornment, TextField, type TextFieldProps } from "@mui/material";
import VisibilityRounded from "@mui/icons-material/VisibilityRounded";
import VisibilityOffRounded from "@mui/icons-material/VisibilityOffRounded";

export function PasswordField(props: Readonly<TextFieldProps>) {
	const [visible, setVisible] = useState(false);

	return (
		<TextField
			{...props}
			type={visible ? "text" : "password"}
			slotProps={{
				htmlInput: { spellCheck: false, autoComplete: "off", className: visible ? "mono" : undefined },
				input: {
					endAdornment: (
						<InputAdornment position="end">
							<IconButton size="small" edge="end" tabIndex={-1} onClick={() => setVisible((v) => !v)}>
								{visible ? <VisibilityOffRounded fontSize="small" /> : <VisibilityRounded fontSize="small" />}
							</IconButton>
						</InputAdornment>
					),
				},
			}}
		/>
	);
}
