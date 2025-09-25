import { createStyles, makeStyles } from "@mui/styles";
import { createTheme } from "@mui/material/styles";

const defaultTheme = createTheme();
export const useStyles = makeStyles(
  (theme) =>
    createStyles({
      container: {
        height: "100vh",
        overflow: "hidden",
      },
    }),
  { defaultTheme }
);
