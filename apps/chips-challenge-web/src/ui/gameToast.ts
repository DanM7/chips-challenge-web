/** Short-lived HTML toast above the playfield (visible outside Phaser cameras). */
export function showGameToast(message: string, durationMs = 3000): void {
  const existing = document.getElementById("game-toast");
  existing?.remove();

  const toast = document.createElement("div");
  toast.id = "game-toast";
  toast.className = "game-toast";
  toast.setAttribute("role", "status");
  toast.textContent = message;
  document.body.append(toast);

  window.setTimeout(() => {
    toast.remove();
  }, durationMs);
}
