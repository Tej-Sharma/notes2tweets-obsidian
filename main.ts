import { LOCAL_STORAGE_KEYS } from 'utils/localeStorage';
import { TweetsView, VIEW_IDENTIFIER } from './views/tweets/TweetsView';
import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { DEFAULT_TWEETS_PROMPT } from 'utils/constants';

export interface Notes2TweetsSettings {
	openAIKey: string;
	twitterAPIKey: string;
	twitterAPISecret: string;
	tweetsGenPrompt: string;
	licenseKey: string;
}

const DEFAULT_NOTES2TWEETS_SETTINGS: Notes2TweetsSettings = {
	openAIKey: '',
	twitterAPIKey: '',
	twitterAPISecret: '',
	tweetsGenPrompt: DEFAULT_TWEETS_PROMPT,
	licenseKey: ''
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

		containerEl.createEl('h2', {text: 'Notes2Tweets Settings'});

		containerEl.createEl('h5', {text: 'Method 1: Manual Approach'});

		containerEl.createEl('p', {text: 'If you want to use your OpenAI and X (Twitter) API credentials, please fill the following fields.'});

		// link to get twitter api key
		containerEl.createEl('a', {href: 'https://developer.twitter.com/en/apps', text: 'Get X Keys'});
		containerEl.createEl('p', {text: ''});

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
		
		new Setting(containerEl)
			.setName('X (Twitter) API KEY')
			.setDesc('If you want to handle Twitter API through your credentials')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.twitterAPIKey)
				.onChange(async (value) => {
					this.plugin.settings.twitterAPIKey = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('X (Twitter) API SECRET')
			.setDesc('If you want to handle Twitter API through your credentials')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.twitterAPISecret)
				.onChange(async (value) => {
					this.plugin.settings.twitterAPISecret = value;
					await this.plugin.saveSettings();
				}));
		
		// not use your own keys and support development
		containerEl.createEl('h5', {text: 'Method 2: Lazy Approach'});
		containerEl.createEl('p', {text: 'If you want the plugin to handle everything and also to support development, you can purchase a subscription below and the plugin will handle all the keys for you :)'});

		// link to purchase subscription
		containerEl.createEl('a', {href: 'https://beemohive.gumroad.com/l/zfoyg', text: 'Purchase Subscription'});
		containerEl.createEl('p', {text: ''});
		

		new Setting(containerEl)
		.setName('License Key')
		.setDesc('If you want the plugin to handle everything and cover the costs of OpenAI and Twitter API')
		.addText(text => text
			.setPlaceholder('Enter key obtained after purchase')
			.setValue(this.plugin.settings.licenseKey)
			.onChange(async (value) => {
				this.plugin.settings.licenseKey = value;
				await this.plugin.saveSettings();
			}));
			

		containerEl.createEl('h5', {text: 'Other Customizations'});

		containerEl.createEl('p', {text: 'You can adjust the prompt here. You must not include the file content to the prompt or the output format (this will be suffixed to your prompt'});

		// do a large text box
		new Setting(containerEl).setName('Tweets Gen Prompt').addTextArea(text => {
			text.inputEl.style.width = '100%';
			text.setPlaceholder(DEFAULT_TWEETS_PROMPT)
				.setValue(this.plugin.settings.tweetsGenPrompt)
				.onChange(async (value) => {
					this.plugin.settings.tweetsGenPrompt = value;
					await this.plugin.saveSettings();
				});
		});


	}
}
