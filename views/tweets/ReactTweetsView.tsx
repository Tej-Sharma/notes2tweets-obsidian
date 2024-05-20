import axios from "axios";
import { useState } from "react";
import { useApp } from "utils/hooks/useApp";

export const ReactView = () => {
  // get Obsidian app instance using custom hook with context
  const app = useApp();

  const [syncedTweets, setSyncedTweets] = useState<string[]>(["bob"]);

  const [showDisabledTooltip, setShowDisabledTooltip] = useState<boolean>(false);

  const generateTweets = async (fileContents: (string | undefined)[]) => {
    try {
      const response = await axios.post("http://127.0.0.1:8000/notes2tweets/generate-tweets", { file_contents: fileContents });
      return response.data?.tweets;
    } catch (error) {
      console.error("Error generating tweets:", error);
      return null;
    }
  };

  const syncFilesAndGenerateTweets = async () => {
    const files = await app?.vault.getMarkdownFiles() ?? [];
    // get files modified in last 24 hours
    const modifiedFiles = files.filter((file) => file.stat.mtime > Date.now() - 1000 * 60 * 60 * 24);
    // get file contents
    const fileContents = await Promise.all(modifiedFiles.map((file) => app?.vault.read(file)));

    const successfulFileContents = fileContents.filter(content => content !== null && content !== undefined);

    const tweets = await generateTweets(successfulFileContents);
    setSyncedTweets(tweets ?? []);

    return modifiedFiles;
  }

  // TODO: schedule tweets
  const scheduleTweet = async (tweet: string) => {
    try {
      const response = await axios.post("http://127.0.0.1:8000/notes2tweets/schedule-tweet", { tweet: tweet });
      console.log(response.data);
    } catch (error) {
      console.error("Error generating tweets:", error);
      return null;
    }
  }

  return (
    <div>
      <h1>Generate Tweets</h1>
      <p>Generate tweets using all your changed files since the last time you generated</p>
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
        <label htmlFor="openai-key" style={{ marginRight: "10px" }}>OpenAI Key:</label>
        <input
          id="openai-key"
          type="text"
          placeholder="OpenAI key"
          defaultValue={localStorage.getItem('openai-key') || ''}
          onChange={(e) => localStorage.setItem('openai-key', e.target.value)}
          style={{ flex: 1, padding: "5px" }}
        />
      </div>
      <button onClick={() => syncFilesAndGenerateTweets()} style={{marginTop: "20px", cursor: "pointer"}}>Start Syncing</button>
      <hr />
      <div style={{
        marginTop: "20px",
      }}>
        {syncedTweets.map((tweet, index) => (
          <div key={index} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0px 20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
          }}>
            <p style={{ fontStyle: "italic", letterSpacing: "0.1em", fontSize: "1.5rem" }}>{tweet}</p>
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
                onClick={() => navigator.clipboard.writeText(tweet) }
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