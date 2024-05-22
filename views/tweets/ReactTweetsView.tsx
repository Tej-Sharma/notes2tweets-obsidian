import OpenAI from "openai";
import axios from "axios";
import { useEffect, useState } from "react";
import { useApp } from "utils/hooks/useApp";
import { LOCAL_STORAGE_KEYS } from "utils/localeStorage";

export const ReactTweetsView = () => {
  // get Obsidian app instance using custom hook with context
  const app = useApp();

  const [syncedTweets, setSyncedTweets] = useState<string[][]>([]);
  const [generatingTweets, setGeneratingTweets] = useState<boolean>(false);

  const [showDisabledTooltip, setShowDisabledTooltip] = useState<boolean>(false);

  useEffect(() => {
    const lastGeneratedTweets = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS);
    if (lastGeneratedTweets) {
      setSyncedTweets(JSON.parse(lastGeneratedTweets));
    }
  }, [localStorage]);

  const getTweetPrompt = (content: string) => {
    return `
    Based on the content below, create twitter threads comprising of multiple tweets.
    The first tweet should be very alarming and start off with something that triggers one of the following:
    - Anger
    - Fear
    - Curiosity
    - Awe
    - Surprise
    Each of the tweets should lead into the other and make wanting to click to read the next one.
    Each tweet should be a maximum of 3 sentences.
    Here is the content to use to generate the tweet:
    ${content}
    Give me back a list of twitter threads which are arrays of strings as a JSON array. It will be parsed by Python's JSON library.
    ` + '\nReturn in the format: {"twitterThreads": [["...", "..."], ["...", "..."], ...]}';
  };

  const generateTweetsFromFileContent = async (content: string) => {
    const openaiKey = localStorage.getItem('openai-key');
    if (!openaiKey) {
      console.error("OpenAI key is not set in local storage.");
      alert("OpenAI key is not set");
      return [];
    }

    const openai = new OpenAI({
      apiKey: openaiKey,
      dangerouslyAllowBrowser: true 
    });

    const inputPrompt = getTweetPrompt(content);

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: inputPrompt }],
        max_tokens: Math.max(300, Math.min(content.length * 0.5, 650)),
        temperature: 0.8,
      });

      const initialPromptOutput = response.choices[0].message.content;

      if (!initialPromptOutput) {
        return [];
      }
      const initialPromptOutputJson = JSON.parse(initialPromptOutput);
      const tweets = initialPromptOutputJson.tweets || [];

      return tweets;
    } catch (error) {
      console.error("Error generating tweets:", error);
      return [];
    }
  };

  const generateTweets = async (fileContents: (string | undefined)[]) => {
    const allTweets = [];
    for (const content of fileContents) {
      if (content) {
        const tweets = await generateTweetsFromFileContent(content);
        allTweets.push(tweets);
      }
    }
    // save to local storage using LAST_GENERATED_TWEETS
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS, JSON.stringify(allTweets));

    return allTweets;
  };

  const syncFilesAndGenerateTweets = async () => {
    setGeneratingTweets(true);

    const files = await app?.vault.getMarkdownFiles() ?? [];
    // the user set the last days modified setting
    const LAST_DAYS_MODIFIED = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_DAYS_GENERATED_SETTING) || '1';

    // get files modified in last 24 hours
    const modifiedFiles = files.filter((file) => file.stat.mtime > Date.now() - 1000 * 60 * 60 * 24 * parseInt(LAST_DAYS_MODIFIED));
    // get file contents
    const fileContents = await Promise.all(modifiedFiles.map((file) => app?.vault.read(file)));

    const successfulFileContents = fileContents.filter(content => content !== null && content !== undefined);

    const tweets = await generateTweets(successfulFileContents);
    setSyncedTweets(tweets ?? []);

    setGeneratingTweets(false);

    return modifiedFiles;
  }

  // TODO: schedule tweets
  const scheduleTweet = async (tweet: string) => {}

  return (
    <div>
      <h1>Generate Tweets</h1>
      <p>Using all the changed files in the last N days, generate tweets to post</p>
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
        <label htmlFor="openai-key" style={{ marginRight: "10px" }}>OpenAI Key:</label>
        <input
          id="openai-key"
          type="text"
          placeholder="OpenAI key"
          defaultValue={localStorage.getItem(LOCAL_STORAGE_KEYS.OPENAI_KEY) || ''}
          onChange={(e) => localStorage.setItem(LOCAL_STORAGE_KEYS.OPENAI_KEY, e.target.value)}
          style={{ flex: 1, padding: "5px" }}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
        <label htmlFor="openai-key" style={{ marginRight: "10px" }}>Sync Files Modified In Last N Days:</label>
        <input
          id="lastModifiedDays"
          type="number"
          placeholder="1"
          defaultValue={localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_DAYS_GENERATED_SETTING) || ''}
          onChange={(e) => localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_DAYS_GENERATED_SETTING, e.target.value)}
          style={{ flex: 1, padding: "5px" }}
        />
      </div>
      <button onClick={() => syncFilesAndGenerateTweets()} style={{marginTop: "20px", cursor: "pointer"}} disabled={generatingTweets}>
        {generatingTweets ? "Generating..." : "Generate"}
      </button>
      <hr />
      <div style={{
        marginTop: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}>
        {syncedTweets.map((tweets, index) => (
          <div key={index} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0px 20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
          }}>
            {tweets.map((tweet, index) => (
              <p key={index} style={{ fontStyle: "italic", letterSpacing: "0.1em", fontSize: "1.5rem" }}>{tweet}</p>
            ))}
            <div 
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: "5px",
                marginBottom: "10px",
                alignItems: "center",
                width: "100%",
                gap: "0.5rem"
              }}
            >
              <p 
                style={{
                  cursor: "pointer",
                }}
                onClick={() => navigator.clipboard.writeText(tweets.join(' ')) }
              >
                  Copy 
              </p>
              <div style={{ position: "relative", display: "inline-block" }}>
                <button 
                  onMouseEnter={() => setShowDisabledTooltip(true)} 
                  onMouseLeave={() => setShowDisabledTooltip(false)}
                >
                  Schedule Tweet
                </button>
                <div style={{
                  visibility: showDisabledTooltip ? "visible" : "hidden",
                  backgroundColor: "black",
                  color: "#fff",
                  textAlign: "center",
                  borderRadius: "6px",
                  padding: "5px 0",
                  position: "absolute",
                  zIndex: 1,
                  bottom: "125%",
                  left: "100%",
                  marginLeft: "-60px",
                  width: "120px",
                  opacity: 0,
                  transition: "opacity 0.3s"
                }} className="tooltip">
                  Coming soon
                </div>
              </div>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
};