import type { MsLevelScoreBreakdown } from "@engine/msCc1/msCc1Scoring";

export interface MsLevelCompleteDialogOptions {
  showTimeRecordMessage?: boolean;
}

const TIME_RECORD_MESSAGE =
  "You have established a time record for this level!";

function formatScore(value: number): string {
  return String(value);
}

/** MS "Level Complete!" score window (DOM overlay). */
export class MsLevelCompleteDialog {
  private readonly root: HTMLDivElement;
  private readonly victoryEl: HTMLParagraphElement;
  private readonly linesEl: HTMLDivElement;
  private readonly recordEl: HTMLParagraphElement;
  private readonly onwardBtn: HTMLButtonElement;
  private readonly closeBtn: HTMLButtonElement;

  private resolvePending: (() => void) | null = null;

  constructor() {
    this.root = document.createElement("div");
    this.root.className = "ms-level-complete-overlay";
    this.root.hidden = true;
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-modal", "true");
    this.root.setAttribute("aria-labelledby", "ms-level-complete-title");

    const panel = document.createElement("div");
    panel.className = "ms-level-complete-dialog";

    const header = document.createElement("div");
    header.className = "ms-level-complete-dialog__header";

    const title = document.createElement("h2");
    title.id = "ms-level-complete-title";
    title.className = "ms-level-complete-dialog__title";
    title.textContent = "Level Complete!";

    this.closeBtn = document.createElement("button");
    this.closeBtn.type = "button";
    this.closeBtn.className = "ms-level-complete-dialog__close";
    this.closeBtn.setAttribute("aria-label", "Close");
    this.closeBtn.textContent = "\u00d7";

    header.append(title, this.closeBtn);

    const body = document.createElement("div");
    body.className = "ms-level-complete-dialog__body";

    this.victoryEl = document.createElement("p");
    this.victoryEl.className = "ms-level-complete-dialog__victory";

    this.linesEl = document.createElement("div");
    this.linesEl.className = "ms-level-complete-dialog__scores";

    this.recordEl = document.createElement("p");
    this.recordEl.className = "ms-level-complete-dialog__record";
    this.recordEl.hidden = true;

    this.onwardBtn = document.createElement("button");
    this.onwardBtn.type = "button";
    this.onwardBtn.className = "ms-level-complete-dialog__onward";
    this.onwardBtn.textContent = "Onward!";

    body.append(this.victoryEl, this.linesEl, this.recordEl, this.onwardBtn);
    panel.append(header, body);
    this.root.append(panel);
    document.body.append(this.root);

    this.onwardBtn.addEventListener("click", () => this.dismiss());
    this.closeBtn.addEventListener("click", () => this.dismiss());
    this.root.addEventListener("click", (event) => {
      if (event.target === this.root) {
        this.dismiss();
      }
    });
  }

  show(
    breakdown: MsLevelScoreBreakdown,
    options: MsLevelCompleteDialogOptions = {},
  ): Promise<void> {
    this.victoryEl.textContent = breakdown.victoryMessage;
    this.linesEl.replaceChildren(
      this.scoreLine("Time Bonus:", breakdown.timeBonus),
      this.scoreLine("Level Bonus:", breakdown.levelBonus),
      this.scoreLine("Level Score:", breakdown.levelScore),
      this.scoreLine("Total Score:", breakdown.totalScore),
    );

    const showRecord = options.showTimeRecordMessage !== false;
    this.recordEl.hidden = !showRecord;
    if (showRecord) {
      this.recordEl.textContent = TIME_RECORD_MESSAGE;
    }

    this.root.hidden = false;
    return new Promise((resolve) => {
      this.resolvePending = () => {
        this.root.hidden = true;
        this.resolvePending = null;
        resolve();
      };
    });
  }

  private scoreLine(label: string, value: number): HTMLParagraphElement {
    const line = document.createElement("p");
    line.className = "ms-level-complete-dialog__line";
    line.textContent = `${label} ${formatScore(value)}`;
    return line;
  }

  private dismiss(): void {
    this.resolvePending?.();
  }

  destroy(): void {
    this.root.remove();
  }
}
