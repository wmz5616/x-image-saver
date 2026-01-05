let lastClickedElement = null;

document.addEventListener(
  "contextmenu",
  (event) => {
    lastClickedElement = event.target;
  },
  true
);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getTweetInfo") {
    const info = extractTweetInfo(lastClickedElement);
    sendResponse(info);
  }
});

function extractTweetInfo(element) {
  let userId = "unknown_user";
  let dateStr = "unknown_date";

  if (!element) return { userId, dateStr };
  const tweetArticle = element.closest("article");

  if (tweetArticle) {
    const timeElement = tweetArticle.querySelector("time");

    if (timeElement) {
      const isoDate = timeElement.getAttribute("datetime");

      if (isoDate) {
        dateStr = isoDate.split("T")[0];
      }
    }

    const userElement = tweetArticle.querySelector(
      'div[data-testid="User-Name"]'
    );

    if (userElement) {
      const textContent = userElement.innerText;
      const match = textContent.match(/@(\w+)/);

      if (match && match[1]) {
        userId = match[1];
      }
    }
  } else {
    const pathParts = window.location.pathname.split("/");
    
    if (pathParts.length >= 2 && pathParts[1] !== "home") {
      userId = pathParts[1];
    }
  }

  return { userId, dateStr };
}
