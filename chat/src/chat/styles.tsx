import { createStyles, makeStyles } from "@mui/styles";
import { createTheme } from "@mui/material/styles";

const defaultTheme = createTheme();
export const useStyles = makeStyles(
  (theme) =>
    createStyles({
      mainDiv: {
        height: "100vh",
        overflow: "hidden",
      },
      chatContainer: {
        maxWidth: "90%",
        height: "calc(100vh - 100px)",
        marginTop: "50px",
        marginBottom: "50px",
      },
      chatPaper: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      },
      stickyHeader: {
        position: "sticky",
        top: 0,
        zIndex: 1,
        bgcolor: "background.paper",
        p: 1,
        display: "flex",
        justifyContent: "flex-end",
      },
    }),
  { defaultTheme }
);
