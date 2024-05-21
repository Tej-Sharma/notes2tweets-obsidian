import OpenAI from "openai";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState } from "react";
import { useApp } from "utils/hooks/useApp";
import { LOCAL_STORAGE_KEYS } from "utils/localeStorage";
import { BACKEND_URL } from "utils/constants";



export const ReactView = () => {
  // get Obsidian app instance using custom hook with context
  const app = useApp();

  // actual generated tweets
  const [syncedTweets, setSyncedTweets] = useState<string[]>([]);
  // whether is connected to twitter
  const [needsTwitterConnection, setNeedsTwitterConnection] = useState<boolean>(false);

  // twitter connection flow 
  const [startTwitterConnect, setStartTwitterConnect] = useState<boolean>(false);
  const [twitterPin, setTwitterPin] = useState<string>("");

  // show tooltip for disabled schedule tweet button
  const [showDisabledTooltip, setShowDisabledTooltip] = useState<boolean>(false);

  // set user identifier to identify this user from now forth
  // TODO: improve to better identify to allow for use
  useEffect(() => {
    if (!localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER)) {
      localStorage.setItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER, uuidv4());
    }
  })

  // set generated tweets from local storage
  useEffect(() => {
    const lastGeneratedTweets = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS);
    if (lastGeneratedTweets) {
      setSyncedTweets(JSON.parse(lastGeneratedTweets));
    }
  }, [localStorage]);

  // check if needs twitter connection if AUTH_TOKEN and AUTH_SECRET are not set
  useEffect(() => {
    const authToken = localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.AUTH_TOKEN);
    const authSecret = localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.AUTH_SECRET);

    if (!authToken || !authSecret) {
      setNeedsTwitterConnection(true);
    }
  }, [localStorage]);

  const getTweetPrompt = (content: string) => {
    return `
    Based on the content below, think about what are tweets that have a high chance of going viral.
    And I only want to generate tweets related to deep philosophical points that are very curiosity arising.
    Only generate tweets for content that would have an alarming hook that taps into a strong human emotion.
    Otherwise, ignore the content and do not generate tweets.
    The tweet should be a maximum of 30 words and should be short, concise, and revealing great information after building on the hook
    in a way that it is very profound and makes the reader feel they have learnt something meaningful that can help them a lot.
    Here is the content:
    ${content}
    Give me back a list of tweet strings as a JSON array. It will be parsed by Python's JSON library.
    ` + '\nReturn in the format: {"tweets": ["tweet1", "tweet2", "tweet3", ...]}';
  };

  const generateTweetsFromFileContent = async (content: string) => {
    const openaiKey = localStorage.getItem('openai-key');
    if (!openaiKey) {
      console.error("OpenAI key is not set in local storage.");
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
        max_tokens: 300,
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
        allTweets.push(...tweets);
      }
    }
    // save to local storage using LAST_GENERATED_TWEETS
    localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS, JSON.stringify(allTweets));

    return allTweets;
  };

  const syncFilesAndGenerateTweets = async () => {
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

    return modifiedFiles;
  }

  const deleteAllTweets = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS);
    setSyncedTweets([]);
  }

  const startTwitterConnection = async () => {
    setStartTwitterConnect(true);
    const response = await axios.post(`${BACKEND_URL}notes2tweets/get-auth-login-url`);
    const authUrl = response.data.url;
    const tempAuthToken = response.data.tempAuthToken;
    const tempAuthTokenSecret = response.data.tempAuthTokenSecret;

    // store in local storage
    localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_TOKEN, tempAuthToken);
    localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_SECRET, tempAuthTokenSecret);

    // open authUrl in browser
    window.open(authUrl, "_blank");
  }

  const verifyUserPin = async (pin: string) => {
    try {
     
      const response = await axios.post(`${BACKEND_URL}notes2tweets/verify-pin`, { 
        pin: pin, 
        tempAuthToken: localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_TOKEN),
        tempAuthTokenSecret: localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_SECRET),
        userIdentifier: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER),
      });
      const { access_token: accessToken, access_token_secret: accessSecret } = response.data;

      if (!accessToken || !accessSecret) {
        throw new Error("Access token or secret not found in response");
        return;
      }

      console.log("Logged in successfully", accessToken, accessSecret);

      // store the access token and secret in local storage
      localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.AUTH_TOKEN, accessToken);
      localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.AUTH_SECRET, accessSecret);

      setStartTwitterConnect(false);
      setNeedsTwitterConnection(false);

      alert("✅ Successfully connected to Twitter. You can now schedule tweets!")
    } catch (error) {
      console.error("Error verifying user pin:", error);
      alert("❌ Error verifying user pin. Please try the flow again.");
    }
  }

  const getNextTweetTime = () => {
    const lastTweetTime = localStorage.getItem(LOCAL_STORAGE_KEYS.SCHEDULED_TWEETS.LAST_TWEET_TIME);
    let nextTweetTime = new Date();
    if (!lastTweetTime) {
      const now = new Date();
      const next8am = new Date(now);
      next8am.setHours(8, 0, 0, 0);

      if (now >= next8am) {
        next8am.setDate(next8am.getDate() + 1);
      }
    

      nextTweetTime = next8am;
    } else {
      // otherwise get the last tweet time + 12 hours
      const lastTweetDate = new Date(lastTweetTime);
      lastTweetDate.setHours(lastTweetDate.getHours() + 12);
      nextTweetTime = lastTweetDate;
    }

    // store in local storage
    localStorage.setItem(LOCAL_STORAGE_KEYS.SCHEDULED_TWEETS.LAST_TWEET_TIME, nextTweetTime.toISOString());

    // now convert to UTC for backend before sending
    const nextTweetTimeUTC = new Date(nextTweetTime.getTime() + nextTweetTime.getTimezoneOffset() * 60000);

        // return UTC may 19th 2022 8:00am
        return new Date(Date.UTC(2024, 4, 19, 8, 0, 0));

    return nextTweetTimeUTC;
  }

   // TODO: schedule tweets
   const scheduleTweet = async (tweet: string) => {
    const nextTweetTime = getNextTweetTime();
    try {
      const response = await axios.post(`${BACKEND_URL}notes2tweets/schedule-tweet`, { 
        tweet: tweet, 
        userIdentifier: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER),
        scheduledTime: nextTweetTime
      });
      alert("✅ Tweet scheduled successfully for " + nextTweetTime.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }));
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
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px", gap: "10px" }}>
        <button onClick={() => syncFilesAndGenerateTweets()} style={{marginTop: "20px", cursor: "pointer"}}>Start Syncing</button>
        {needsTwitterConnection && <button onClick={() => startTwitterConnection()} style={{marginTop: "20px", cursor: "pointer"}}>
          Connect Twitter (X)
        </button>}
      </div>
      {startTwitterConnect && (
        <div style={{ display: "flex", alignItems: "center", marginTop: "20px" }}>
          <input
            id="twitter-pin"
            type="text"
            placeholder="Twitter Pin"
            value={twitterPin}
            onChange={(e) => setTwitterPin(e.target.value)}
            style={{ flex: 1, padding: "5px" }}
          />
          <button onClick={() => verifyUserPin(twitterPin)} style={{cursor: "pointer"}}>Verify Pin</button>
        </div>
      )}
      <hr />
      {syncedTweets.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
          <button 
            onClick={() => deleteAllTweets()} 
            style={{ cursor: "pointer", color: "red", padding: "10px", borderRadius: "5px" }}
          >
            Delete All Tweets
          </button>
        </div>
      )}
      <div style={{
        marginTop: "20px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
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
              <button 
                onMouseEnter={() => setShowDisabledTooltip(true)} 
                onMouseLeave={() => setShowDisabledTooltip(false)}
                onClick={() => scheduleTweet(tweet)}
                style={{"cursor": "pointer"}}
              >
                Schedule Tweet
              </button>
              </div>
          </div>
        ))}
      </div>
    </div>
  );
};