chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-finder") return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id == null) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: "finder-toggle" });
  } catch (error) {
    // Ignore tabs where content scripts are not available (e.g. chrome:// pages or not injected yet).
    const message = error && typeof error.message === "string" ? error.message : "";
    if (!message.includes("Receiving end does not exist")) {
      console.warn("finder: sendMessage failed", error);
    }
  }
});
