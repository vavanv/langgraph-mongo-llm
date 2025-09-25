import React from "react";
import { AppBar, Toolbar, Typography, IconButton } from "@mui/material";
import { SmartToy as BotIcon, Clear as ClearIcon } from "@mui/icons-material";

interface HeaderProps {
  onClearChat: () => void;
}

const Header: React.FC<HeaderProps> = ({ onClearChat }) => {
  return (
    <AppBar position="static" elevation={1}>
      <Toolbar>
        <BotIcon sx={{ mr: 2 }} />
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          AI HR Assistant
        </Typography>
        <IconButton color="inherit" onClick={onClearChat} title="Clear Chat">
          <ClearIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default Header;
