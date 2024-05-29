import OpenAI from "openai";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import { useEffect, useState } from "react";
import { useApp } from "utils/hooks/useApp";
import { LOCAL_STORAGE_KEYS } from "utils/localeStorage";
import { BACKEND_URL } from "utils/constants";
import { Notes2TweetsSettings } from "main";

interface ReactTweetsViewProps {
  settings: Notes2TweetsSettings;
}


export const ReactTweetsView = ({
  settings
}: ReactTweetsViewProps) => {
  // get Obsidian app instance using custom hook with context
  const app = useApp();

  const [syncedTweets, setSyncedTweets] = useState<string[][]>([]);
  const [generatingTweets, setGeneratingTweets] = useState<boolean>(false);

  // whether is connected to twitter
  const [needsTwitterConnection, setNeedsTwitterConnection] = useState<boolean>(false);

  // twitter connection flow 
  const [startTwitterConnect, setStartTwitterConnect] = useState<boolean>(false);
  const [twitterPin, setTwitterPin] = useState<string>("");

  // set user identifier to identify this user from now forth
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

  const isSubscribedUser = () => {
    return settings.licenseKey !== '';
  }

  const getTweetPrompt = (content: string) => {
    return `
    ${settings.tweetsGenPrompt}
    ${content}
    Give me back the twitter thread as an arrays of strings (representing the tweets) as a JSON array. Make sure to generate two sentences for the first tweet of the thread. It will be parsed by Python's JSON library.
    ` + '\nReturn in the format: {"twitterThread": ["...", "..."]}';
  };

  const generateTweetsFromFileContent = async (content: string) => {
    const openaiKey = settings.openAIKey;
    if (!openaiKey && !isSubscribedUser()) {
      console.error("OpenAI key is not set in local storage.");
      alert("OpenAI key is not set in settings. Please go to settings and set it.");
      return [];
    }

    const inputPrompt = getTweetPrompt(content);
    let tweets = []

    // for non-subscribed users, generate using their OpenAI Key locally
    if (openaiKey && !isSubscribedUser()) {
      const openai = new OpenAI({
        apiKey: openaiKey,
        dangerouslyAllowBrowser: true 
      });


      try {
        const response = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [{ role: "user", content: inputPrompt }],
          max_tokens: Math.max(400, Math.min(content.length * 0.5, 800)),
          temperature: 0.8,
        });

        const initialPromptOutput = response.choices[0].message.content;

        if (!initialPromptOutput) {
          return [];
        }
        const initialPromptOutputJson = JSON.parse(initialPromptOutput);
        tweets = initialPromptOutputJson.twitterThread || [];
      } catch (error) {
        console.error("Error generating tweets:", error);
        alert("❌ Error generating tweets. Please ensure your OpenAI key is valid.");
        return [];
      }
    } else if (isSubscribedUser()) {
      // for subscribed users, generate using backend
      try {
        const response = await axios.post(`${BACKEND_URL}notes2tweets/generate-tweets`, { 
          prompt: inputPrompt,
          licenseKey: settings.licenseKey,
        });
        if (response.data.error) {
          throw new Error(response.data.error);
        }
        tweets = response.data.twitterThread || [];
      } catch (error) {
        console.error("Error generating tweets:", error);
        alert(error);
        return [];
      }
    }

    // now clean the tweets
    
    // remove any hashtags
    tweets = tweets.map((tweet: string) => tweet.replace(/#[\w]+/g, ''));

    return tweets;
  };

  const generateTweetsLocally = async (fileContents: (string | undefined)[]) => {
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

  const syncFilesAndGenerateTweets = async () =>  {
    setGeneratingTweets(true);
    
    try {
      const files = await app?.vault.getMarkdownFiles() ?? [];
      // the user set the last days modified setting
      const LAST_DAYS_MODIFIED = localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_DAYS_GENERATED_SETTING) || '1';

      // get files modified in last 24 hours
      const modifiedFiles = files.filter((file) => file.stat.mtime > Date.now() - 1000 * 60 * 60 * 24 * parseInt(LAST_DAYS_MODIFIED));

      // if no files modified in last 24 hours, return
      if (modifiedFiles.length === 0) {
        setGeneratingTweets(false);
        alert("No files modified in the last " + LAST_DAYS_MODIFIED + " days. Make some changes to some files to generate tweets.");
        return;
      }

      // get file contents
      const fileContents = await Promise.all(modifiedFiles.map((file) => app?.vault.read(file)));

      const successfulFileContents = fileContents.filter(content => content !== null && content !== undefined);

      const tweets = await generateTweets(successfulFileContents);
      setSyncedTweets(tweets ?? []);
      
    } catch (error) {
      console.error("Error syncing files and generating tweets:", error);
    }

    setGeneratingTweets(false);

  }

  const deleteAllTweets = () => {
    localStorage.removeItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS);
    setSyncedTweets([]);
  }

  /**
   * Starts the X (Twitter) connection flow by generating a auth url to login
   * The user will be redirected to this url and will then get a pin back that they will paste in
   * @returns 
   */
  const startTwitterConnection = async () => {
    if (!isSubscribedUser() && (!settings.twitterAPIKey || !settings.twitterAPISecret)) {
      alert("Please set your Twitter API key and secret in the settings or purchase a subscription for the plugin to handle it for you.");
      return;
    }
    setStartTwitterConnect(true);

    const response = await axios.post(`${BACKEND_URL}notes2tweets/get-auth-login-url`, {
      twitterAPIKey: settings.twitterAPIKey,
      twitterAPISecret: settings.twitterAPISecret,
      licenseKey: settings.licenseKey,    
    });
    // if response.data.error
    if (response.data.error) {
      alert(response.data.error);
      setStartTwitterConnect(false);
      return;
    }

    const authUrl = response.data.url;
    const tempAuthToken = response.data.tempAuthToken;
    const tempAuthTokenSecret = response.data.tempAuthTokenSecret;

    // store in local storage
    localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_TOKEN, tempAuthToken);
    localStorage.setItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_SECRET, tempAuthTokenSecret);

    // open authUrl in browser
    window.open(authUrl, "_blank");
  }

  /**
   * After logging in from the auth url, they will paste the link and this will verify it
   * @param pin - string user pastes that they got from X
   * @returns 
   */
  const verifyUserPin = async (pin: string) => {
    try {
     
      const response = await axios.post(`${BACKEND_URL}notes2tweets/verify-pin`, { 
        pin: pin, 
        tempAuthToken: localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_TOKEN),
        tempAuthTokenSecret: localStorage.getItem(LOCAL_STORAGE_KEYS.TWITTER.TEMP_AUTH_SECRET),
        userIdentifier: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER),
        twitterAPIKey: settings.twitterAPIKey,
        twitterAPISecret: settings.twitterAPISecret,
        licenseKey: settings.licenseKey,
      });
      const { access_token: accessToken, access_token_secret: accessSecret } = response.data;

      if (!accessToken || !accessSecret) {
        throw new Error("Access token or secret not found in response");
        return;
      }
      
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
    if (!lastTweetTime || new Date(lastTweetTime) < new Date()) {
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

    return nextTweetTimeUTC;
  }

   const scheduleTweet = async (tweets: string[], index: number) => {
    if (needsTwitterConnection) {
      alert("Please connect to X (Twitter) first to schedule tweets using the button above.");
      return;
    }
    
    const nextTweetTime = getNextTweetTime();
    try {
      const response = await axios.post(`${BACKEND_URL}notes2tweets/schedule-tweet`, { 
        tweets, 
        userIdentifier: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER),
        scheduledTime: nextTweetTime
      });
      
      // Convert nextTweetTime to local time from UTC
      const nextTweetTimeLocal = new Date(nextTweetTime.getTime() - nextTweetTime.getTimezoneOffset() * 60000);

      alert("✅ Tweet scheduled successfully for " + nextTweetTimeLocal.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }));

      // delete this tweet
      const newSyncedTweets = [...syncedTweets];
      newSyncedTweets.splice(index, 1);
      setSyncedTweets(newSyncedTweets);
      localStorage.setItem(LOCAL_STORAGE_KEYS.LAST_GENERATED_TWEETS, JSON.stringify(newSyncedTweets));
    } catch (error) {
      console.error("Error generating tweets:", error);
      return null;
    }
  }


  return (
    <div>
      <h1>Generate & Schedule Tweets</h1>
      <p>Using all the changed files in the last N days, generate tweets to post</p>
      <div style={{ display: "flex", alignItems: "center", marginTop: "10px" }}>
        <label htmlFor="openai-key" style={{ marginRight: "10px" }}>Sync files modified in last N days:</label>
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
        <button 
          onClick={() => syncFilesAndGenerateTweets()} 
          style={{marginTop: "20px", cursor: "pointer"}}
          disabled={generatingTweets}
        >
          {generatingTweets ? "Generating..." : "Generate Tweets"}
        </button>
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
        {syncedTweets.map((tweets, index) => (
          <div key={index} style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            padding: "0px 20px",
            border: "1px solid #ccc",
            borderRadius: "5px",
          }}>
            {tweets && Array.isArray(tweets) && typeof tweets.map === 'function' && tweets.length > 0 && tweets.map((tweet, index) => (
              <p key={index} style={{ fontStyle: "italic", letterSpacing: "0.1em", fontSize: "1.5rem" }}>• {tweet}</p>
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
              <button 
                onClick={() => scheduleTweet(tweets, index)}
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