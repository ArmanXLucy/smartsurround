import { useState } from "react";
import "./AIChat.css";

const API_URL = "/ai-api";

export default function AIChat() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm SmartSurround AI. How can I help you?",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function send() {
    const message = text.trim();

    if (!message || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: message,
      },
    ]);

    setText("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: message,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      const answer = String(
        data.response || "I couldn't generate a response."
      ).trim();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: answer,
        },
      ]);
    } catch (error) {
      console.error("SmartSurround AI error:", error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't connect to SmartSurround AI right now.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {open && (
        <div className="ai-chat-window">
          <div className="ai-chat-header">
            <div>
              <strong>SmartSurround AI</strong>
              <span>AI Assistant</span>
            </div>

            <button
              className="ai-chat-close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div className="ai-chat-messages">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`ai-message ${message.role}`}
              >
                {message.content}
              </div>
            ))}

            {loading && (
              <div className="ai-message assistant">
                Thinking...
              </div>
            )}
          </div>

          <div className="ai-chat-input-area">
            <input
              type="text"
              value={text}
              placeholder="Ask SmartSurround AI..."
              disabled={loading}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  send();
                }
              }}
            />

            <button
              onClick={send}
              disabled={loading || !text.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        className="ai-chat-button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open SmartSurround AI"
      >
        <img src="/favicon.svg" alt="SmartSurround logo" />
      </button>
    </>
  );
}
