import { LOCAL_STORAGE_KEYS } from 'utils/localeStorage';
import { TweetsView, VIEW_IDENTIFIER } from './views/tweets/TweetsView';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';

export interface Notes2TweetsSettings {
	openAIKey: string;
}

const DEFAULT_NOTES2TWEETS_SETTINGS: Notes2TweetsSettings = {
	openAIKey: ''
}

export default class Notes2TweetsPlugin extends Plugin {
	settings: Notes2TweetsSettings;

	async onload() {
		await this.loadSettings();

		// register ExampleView
		this.registerView(
      VIEW_IDENTIFIER,
      (leaf) => new TweetsView(leaf, this)
    );


		// This creates an icon in the left ribbon.
		this.addRibbonIcon('twitter', 'Open Notes2Tweets', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			this.activateView();
		});

		// Add command to open notes2tweets view
		this.addCommand({
			id: 'open-tweets-view',
			name: 'Open Notes2Tweets',
			callback: () => {
				this.activateView();
			}
		});
	}

	// on disabled
	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_NOTES2TWEETS_SETTINGS, await this.loadData());
		this.addSettingTab(new Notes2TweetsSettingsTab(this.app, this));
	}

	async saveSettings() {
		await this.saveData(this.settings);
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

class Notes2TweetsSettingsTab extends PluginSettingTab {
	plugin: Notes2TweetsPlugin;

	constructor(app: App, plugin: Notes2TweetsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('OpenAI API Key')
			.setDesc('This can be obtained from OpenAI playground')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.openAIKey)
				.onChange(async (value) => {
					this.plugin.settings.openAIKey = value;
					await this.plugin.saveSettings();
				}));
	}
}
