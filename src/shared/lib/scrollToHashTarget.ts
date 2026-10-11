// Native anchors can run before React mounts the destination after a route change.
export function scrollToHashTarget(node: HTMLElement | null) {
  if (!node) return;
  requestAnimationFrame(() => {
    if (node.isConnected && window.location.hash === `#${node.id}`) {
      node.scrollIntoView({ behavior: 'instant' });
    }
  });
}
