import React, { useState, useRef, useEffect } from "react";
import {
  Box,
  Container,
  Paper,
  TextField,
  IconButton,
  Typography,
  List,
  ListItem,
  Chip,
  CircularProgress,
  Divider,
  Avatar,
  Card,
  CardContent,
} from "@mui/material";
import { Send as SendIcon, Person as PersonIcon } from "@mui/icons-material";
import { useStyles } from "./styles";
interface Message {
  id: string;
  text: string;
  sender: "user" | "assistant";
  timestamp: Date;
}

const Chat: React.FC = () => {
  const classes = useStyles();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputValue,
      sender: "user",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const endpoint = threadId ? `/chat/${threadId}` : "/chat";
      const body = { message: inputValue };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      const data = await response.json();

      if (!threadId && data.threadId) {
        setThreadId(data.threadId);
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: data.response,
        sender: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: "Sorry, I encountered an error. Please try again.",
        sender: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={classes.container}>
      <Container
        maxWidth={false}
        sx={{
          maxWidth: "90%",
          height: "calc(100vh - 100px)",
          marginTop: "50px",
          marginBottom: "50px",
        }}
      >
        <Paper
          elevation={20}
          sx={{
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
            {messages.length === 0 ? (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  textAlign: "center",
                  p: 4,
                }}
              >
                <Typography variant="h5" gutterBottom>
                  Welcome to AI HR Assistant
                </Typography>
                <Typography
                  variant="body1"
                  color="text.secondary"
                  sx={{ mb: 3 }}
                >
                  Ask me about employees, departments, skills, or team building!
                </Typography>
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    justifyContent: "center",
                  }}
                >
                  <Chip label="Who works in Engineering?" variant="outlined" />
                  <Chip label="Find Python developers" variant="outlined" />
                  <Chip label="Build a mobile team" variant="outlined" />
                </Box>
              </Box>
            ) : (
              <List sx={{ py: 0 }}>
                {messages.map((message) => (
                  <ListItem key={message.id} sx={{ px: 1, py: 0.5 }}>
                    <Card
                      sx={{
                        width: "100%",
                        maxWidth: "80%",
                        ml: message.sender === "user" ? "auto" : 0,
                        mr: message.sender === "assistant" ? "auto" : 0,
                        bgcolor:
                          message.sender === "user"
                            ? "primary.main"
                            : "grey.100",
                        color:
                          message.sender === "user"
                            ? "primary.contrastText"
                            : "text.primary",
                      }}
                      elevation={1}
                    >
                      <CardContent
                        sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 1,
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 32,
                              height: 32,
                              bgcolor:
                                message.sender === "user"
                                  ? "primary.dark"
                                  : "secondary.main",
                            }}
                          >
                            {message.sender === "user" ? <PersonIcon /> : "🤖"}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography
                              variant="body1"
                              sx={{ whiteSpace: "pre-wrap" }}
                            >
                              {message.text}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                opacity: 0.7,
                                display: "block",
                                mt: 0.5,
                              }}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  </ListItem>
                ))}
              </List>
            )}

            {isLoading && (
              <Box sx={{ display: "flex", justifyContent: "center", p: 2 }}>
                <CircularProgress size={24} />
                <Typography
                  variant="body2"
                  sx={{ ml: 1, color: "text.secondary" }}
                >
                  AI is thinking...
                </Typography>
              </Box>
            )}

            <div ref={messagesEndRef} />
          </Box>

          <Divider />

          <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                fullWidth
                multiline
                maxRows={4}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about employees, skills, or team building..."
                disabled={isLoading}
                variant="outlined"
                size="small"
              />
              <IconButton
                color="primary"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                sx={{
                  bgcolor: "primary.main",
                  color: "white",
                  "&:hover": {
                    bgcolor: "primary.dark",
                  },
                  "&:disabled": {
                    bgcolor: "grey.300",
                  },
                }}
              >
                <SendIcon />
              </IconButton>
            </Box>
          </Box>
        </Paper>
      </Container>
    </div>
  );
};

export default Chat;
