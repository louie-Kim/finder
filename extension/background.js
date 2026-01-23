chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-finder") return;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab || tab.id == null) return;
  chrome.tabs.sendMessage(tab.id, { type: "finder-toggle" });
});







