export const isMac = /mac|iPhone|iPad|iPod/i.test(window.navigator.platform);

// On macOS it’s more natural to use the Command key for shortcuts.
export function isCtrlKey(event) {
  return isMac ? event.metaKey : event.ctrlKey;
}
