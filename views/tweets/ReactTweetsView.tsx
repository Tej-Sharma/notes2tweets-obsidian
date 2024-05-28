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
    A tweet is basically a single message. Based on the content below, create a single twitter thread (chains of tweets) comprising of multiple tweets that explain a concept fully using at least 5 tweets with examples, analogies, and allusions. The thread starts with something attention grabbing and ends with a conclusion that wraps up the idea.
    The twitter thread is directed to a reader and should use an appropriate tone and writing style to connect with the reader and address them.
    The first tweet begins the thread and should be made up of two sentences. The first sentence or phrase introduces the concept in a way that hooks the reader in by triggering anger, curiosity, fear, shock, or awe. This hook should be a complete sentence and directed to a person scrolling by. Then the second sentence should be an introduction to the tweets that are to come with another attention grabbing sentence.
    Then, the rest of the tweets in the thread should lead into the other and make wanting to click to read the next one. They should build on each other in order to convey the information. You can use analogies or examples to further explain better.
    Each of the tweets should use complete sentences yet in a conversational but public facing tone.
    The content may be personal but the tweet should be for an audience of other people viewing it and should not include too many personal details but instead the inner learnings.
    Do not use emojis, instead use your words to convey the emotions. Do not use any hashtags as they are not effective.
    Each tweet should be a maximum of 3 sentences.
    Here is the content to use to generate the tweet:
    ${content}
    Give me back the twitter thread as an arrays of strings (representing the tweets) as a JSON array. Make sure to generate two sentences for the first tweet of the thread. It will be parsed by Python's JSON library.
    ` + '\nReturn in the format: {"twitterThread": ["...", "..."]}';
  };

  const generateTweetsFromFileContent = async (content: string) => {
    const openaiKey = settings.openAIKey;
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
        max_tokens: Math.max(400, Math.min(content.length * 0.5, 800)),
        temperature: 0.8,
      });

      const initialPromptOutput = response.choices[0].message.content;

      if (!initialPromptOutput) {
        return [];
      }
      const initialPromptOutputJson = JSON.parse(initialPromptOutput);
      console.log("Initial prompt output:", initialPromptOutputJson);
      let tweets = initialPromptOutputJson.twitterThread || [];

      // remove any hashtags
      tweets = tweets.map((tweet: string) => tweet.replace(/#[\w]+/g, ''));

      return tweets;
    } catch (error) {
      console.error("Error generating tweets:", error);
      alert("❌ Error generating tweets. Please ensure your OpenAI key is valid.");
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

  const syncFilesAndGenerateTweets = async () =>  {
    setGeneratingTweets(true);
    
    try {
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
      
    } catch (error) {
      console.error("Error syncing files and generating tweets:", error);
    }

    setGeneratingTweets(false);

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

    return nextTweetTimeUTC;
  }

   // TODO: twitter now charges for API, have to figure out a way for user to give their credentials without having to use a backend
   const scheduleTweet = async (tweets: string[], index: number) => {
    alert('Since Elon now charges for the Twi - er, I mean - X API, I have to figure out a workaround. If this would be of great use to you, please email me at trollgenstudios@gmail.com and I\'ll try to set it up for you.');
    return;
    const nextTweetTime = getNextTweetTime();
    try {
      const response = await axios.post(`${BACKEND_URL}notes2tweets/schedule-tweet`, { 
        tweets, 
        userIdentifier: localStorage.getItem(LOCAL_STORAGE_KEYS.USER_IDENTIFIER),
        scheduledTime: nextTweetTime
      });
      alert("✅ Tweet scheduled successfully for " + nextTweetTime.toLocaleString('en-US', { month: 'long', day: 'numeric', hour: 'numeric', minute: 'numeric' }));
      console.log(response.data);

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
      <h1>Generate Tweets</h1>
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