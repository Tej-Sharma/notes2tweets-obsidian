import { LOCAL_STORAGE_KEYS } from 'utils/localeStorage';
import { ExampleView, VIEW_IDENTIFIER } from './views/tweets/TweetsView';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}


export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		// register ExampleView
		this.registerView(
      VIEW_IDENTIFIER,
      (leaf) => new ExampleView(leaf)
    );


		// This creates an icon in the left ribbon.
		this.addRibbonIcon('twitter', 'Open Notes2Tweets', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.activateView();
		});

		// Add command to open notes2tweets view
		this.addCommand({
			id: 'open-tweets-view',
			name: 'Open Notes2Tweets View)',
			callback: () => {
				this.activateView();
			}
		})

	}

	// on disabled
	onunload() {

	}

	async activateView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(VIEW_IDENTIFIER);

    if (leaves.length > 0) {
      // A leaf with our view already exists, use that
      leaf = leaves[0];
    } else {
      // Our view could not be found in the workspace, create a new leaf
      // in the right sidebar for it
      leaf = workspace.getRightLeaf(false);
			if (!leaf) {
				leaf = workspace.createLeafBySplit(workspace.getLeaf(), 'vertical');
			}
      await leaf.setViewState({ type: VIEW_IDENTIFIER, active: true });
    }

    // "Reveal" the leaf in case it is in a collapsed sidebar
    workspace.revealLeaf(leaf);
  }
}
