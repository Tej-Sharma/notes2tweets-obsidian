import { StrictMode } from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { ReactView } from "./ReactTweetsView";
import { AppContext } from "utils/contexts/AppContext";

// alias that identifies this view
export const VIEW_IDENTIFIER = "tweets-view";

export class ExampleView extends ItemView {
  root: Root | null = null;

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_IDENTIFIER;
  }

  getDisplayText() {
    return "Tweets View";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.root.render(
      <AppContext.Provider value={this.app}>
        <ReactView />
      </AppContext.Provider>
    );
	}

	async onClose() {
		this.root?.unmount();
	}
}