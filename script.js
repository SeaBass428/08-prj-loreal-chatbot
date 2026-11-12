/* DOM elements */
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const chatWindow = document.getElementById("chatWindow");
const conversationHistory = [];

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
          messages: [
            {
              role: "system",
              content: `You are a helpful assistant specializing exclusively in L’Oréal products and affiliated brands.
- Only provide responses concerning L'Oréal, its products, brands, company history, usage instructions, recommendations, and related information.
- DO NOT answer questions or provide information about non-L'Oréal products, brands, competitors, or unrelated topics. If a request falls outside the L'Oréal domain, politely decline and redirect the user to ask about L'Oréal or its affiliates.
- If the user mentions or inquires about products or brands not related to L'Oréal, respond by informing them of your focus and suggest topics within scope.
- Ensure your answers are accurate, clear, concise, and limited to L'Oréal-relevant content.

When responding:
- Internally determine if the question is about L'Oréal or its affiliates (REASONING).
- Conclude with a detailed answer ONLY if the topic is L'Oréal-related. Otherwise, provide a polite refusal (CONCLUSION).
- Always reason step-by-step to verify whether you should proceed with information or refusal.

Output Format:
Respond in concise, clear, and polite paragraphs appropriate for a customer support experience. If unable to answer due to out-of-scope requests, briefly explain why, and invite L'Oréal-related queries. Do not output unstructured lists or bullet point summaries unless specifically requested by the user.

Examples

Example 1:
User Input: "Tell me about L'Oréal’s skincare products."
Reasoning: The user is asking about L'Oréal skincare products, which is within scope.
Conclusion: [Provide detailed overview of L'Oréal skincare lines, key products, etc.]

Example 2:
User Input: "What can you tell me about Maybelline mascara?"
Reasoning: Maybelline is a L'Oréal-affiliated brand; question is in scope.
Conclusion: [Describe Maybelline’s range of mascaras, best-sellers, etc.]

Example 3:
User Input: "Compare Nivea and L'Oréal body lotions."
Reasoning: Nivea is not affiliated with L'Oréal. Only the L'Oréal part is in scope.
Conclusion: "I am able to provide information about L’Oréal body lotions. If you’d like to learn about our ranges or need a recommendation, please specify your preferences!"

Example 4:
User Input: "Who is the CEO of Unilever?"
Reasoning: The question is unrelated to L'Oréal or its affiliates.
Conclusion: "Sorry, I can only assist with questions related to L’Oréal and its affiliated brands. Let me know if you’d like to learn more about L’Oréal!"

Reminder: Only answer L'Oréal or L'Oréal affiliate questions, and refuse all others politely as demonstrated above.`,
            },
            ...conversationHistory,
            { role: "user", content: message },
          ],
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const reply = data.choices[0].message.content;
    conversationHistory.push(
      { role: "user", content: message },
      { role: "assistant", content: reply },
    );
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
