import { StrictMode } from "react";
import { ItemView, WorkspaceLeaf } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import { ReactTweetsView } from "./ReactTweetsView";
import { AppContext } from "utils/contexts/AppContext";
import Notes2TweetsPlugin from "main";

// alias that identifies this view
export const VIEW_IDENTIFIER = "tweets-view";

export class TweetsView extends ItemView {
  root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, private _plugin: Notes2TweetsPlugin) {
    super(leaf);
  }

  getViewType() {
    return VIEW_IDENTIFIER;
  }

  getDisplayText() {
    return "Tweets";
  }

  async onOpen() {
    this.root = createRoot(this.containerEl.children[1]);
    this.root.render(
      <AppContext.Provider value={this.app}>
        <ReactTweetsView settings={this._plugin.settings} />
      </AppContext.Provider>
    );
	}

	async onClose() {
		this.root?.unmount();
	}
}