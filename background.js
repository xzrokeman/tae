chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-table") { // 修改命令名称
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) {
        chrome.tabs.sendMessage(tab.id, { action: "copyTable" });
      }
    });
  }
});
