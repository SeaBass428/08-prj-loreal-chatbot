/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");

// Turn **bold** text into bold text without interpreting HTML from the reply.
function addFormattedText(parent, text) {
  const boldPattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match;

  while ((match = boldPattern.exec(text)) !== null) {
    parent.appendChild(
      document.createTextNode(text.slice(lastIndex, match.index)),
    );

    const boldText = document.createElement("strong");
    boldText.textContent = match[1];
    parent.appendChild(boldText);
    lastIndex = boldPattern.lastIndex;
  }

  parent.appendChild(document.createTextNode(text.slice(lastIndex)));
}

// Format headings, bold text, and simple bullet lists inside a message.
function formatMessageContent(content, text) {
  let paragraphLines = [];
  let bulletList;

  function addParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    const paragraph = document.createElement("p");
    addFormattedText(paragraph, paragraphLines.join(" "));
    content.appendChild(paragraph);
    paragraphLines = [];
  }

  for (const line of text.split("\n")) {
    const trimmedLine = line.trim();
    const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    const bulletMatch = trimmedLine.match(/^[-*]\s+(.+)$/);

    if (!trimmedLine) {
      addParagraph();
      bulletList = null;
    } else if (headingMatch) {
      addParagraph();
      bulletList = null;
      const heading = document.createElement(`h${headingMatch[1].length}`);
      addFormattedText(heading, headingMatch[2]);
      content.appendChild(heading);
    } else if (bulletMatch) {
      addParagraph();
      if (!bulletList) {
        bulletList = document.createElement("ul");
        content.appendChild(bulletList);
      }

      const listItem = document.createElement("li");
      addFormattedText(listItem, bulletMatch[1]);
      bulletList.appendChild(listItem);
    } else {
      bulletList = null;
      paragraphLines.push(trimmedLine);
    }
  }

  addParagraph();
}

// Add a message and return its content so it can be updated later.
function addMessage(label, text, messageType) {
  const message = document.createElement("div");
  message.classList.add("msg", messageType);

  if (label) {
    const messageLabel = document.createElement("strong");
    messageLabel.textContent = `${label} `;
    message.appendChild(messageLabel);
  }

  const content = document.createElement("div");
  content.classList.add("msg-content");
  message.appendChild(content);
  formatMessageContent(content, text);
  chatWindow.appendChild(message);

  return content;
}

// Show a friendly greeting when the chat first opens.
addMessage("", "👋 Hello! How can I help you today?", "ai");

/* Send the user's message to the Cloudflare Worker */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const message = userInput.value.trim();

  if (!message) {
    return;
  }

  userInput.value = "";
  addMessage("You:", message, "user");
  const thinkingContent = addMessage("L’Oréal:", "Thinking…", "ai");
  thinkingContent.classList.add("thinking");
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const response = await fetch(
      "https://loreal-chatbot.srorduno.workers.dev/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    thinkingContent.textContent = "";
    thinkingContent.classList.remove("thinking");
    formatMessageContent(thinkingContent, reply);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  } catch (error) {
    console.error("Could not get a reply from the Cloudflare Worker:", error);
    thinkingContent.textContent = "";
    thinkingContent.classList.remove("thinking");
    formatMessageContent(
      thinkingContent,
      "Sorry, I couldn't get a response. Please try again.",
    );
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
});
