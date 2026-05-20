/** MS-style modal for fatal mistakes (e.g. drowning without flippers). */
export class MsOopsDialog {
  private readonly root: HTMLDivElement;
  private readonly messageEl: HTMLParagraphElement;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "ms-oops-overlay";
    this.root.hidden = true;
    this.root.setAttribute("role", "alertdialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "ms-oops-title");

    const panel = document.createElement("div");
    panel.className = "ms-oops-dialog";

    const title = document.createElement("h2");
    title.id = "ms-oops-title";
    title.className = "ms-oops-dialog__title";
    title.textContent = "Chip's Challenge";

    this.messageEl = document.createElement("p");
    this.messageEl.className = "ms-oops-dialog__message";

    const ok = document.createElement("button");
    ok.type = "button";
    ok.className = "ms-oops-dialog__ok";
    ok.textContent = "OK";

    panel.append(title, this.messageEl, ok);
    this.root.append(panel);
    document.body.append(this.root);

    ok.addEventListener("click", () => this.resolvePending());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.resolvePending();
      }
    });
  }

  private resolvePending: (() => void) | null = null;

  /** Show message; resolves when the player dismisses the dialog. */
  show(message: string): Promise<void> {
    this.messageEl.textContent = message;
    this.root.hidden = false;
    return new Promise((resolve) => {
      this.resolvePending = () => {
        this.root.hidden = true;
        this.resolvePending = null;
        resolve();
      };
    });
  }

  destroy(): void {
    this.root.remove();
  }
}
