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
		const ribbonIconEl = this.addRibbonIcon('twitter', 'Open Notes2Tweets', (evt: MouseEvent) => {
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

		this.listenForFileChanges();
	}

	/**
	 * Track modified files in local storage for last sync handling
	 */
	listenForFileChanges() {
		this.app.vault.on('modify', (file) => {
			const FILES_CHANGED_SINCE_LAST_SYNC_KEY = LOCAL_STORAGE_KEYS.FILES_CHANGED_SINCE_LAST_SYNC_KEY;
			let filesChangedSinceLastSync = JSON.parse(localStorage.getItem(FILES_CHANGED_SINCE_LAST_SYNC_KEY) || '[]');
			this.app.vault.on('modify', (file) => {
					filesChangedSinceLastSync.push(file?.name);
					// update in local storage
					localStorage.setItem(FILES_CHANGED_SINCE_LAST_SYNC_KEY, JSON.stringify(filesChangedSinceLastSync));
			});
		});
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
