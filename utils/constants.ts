export const BACKEND_URL = "https://tutils-9ad81be56d35.herokuapp.com/";
// export const BACKEND_URL = "http://localhost:8000/";

export const DEFAULT_TWEETS_PROMPT = `A tweet is basically a single message. Based on the content below, create a single twitter thread (chains of tweets) comprising of multiple tweets that explain a concept fully using at least 5 tweets with examples, analogies, and allusions. The thread starts with something attention grabbing and ends with a conclusion that wraps up the idea.
The twitter thread is directed to a reader and should use an appropriate tone and writing style to connect with the reader and address them.
The first tweet begins the thread and should be made up of two sentences. The first sentence or phrase introduces the concept in a way that hooks the reader in by triggering anger, curiosity, fear, shock, or awe. This hook should be a complete sentence and directed to a person scrolling by. Then the second sentence should be an introduction to the tweets that are to come with another attention grabbing sentence.
Then, the rest of the tweets in the thread should lead into the other and make wanting to click to read the next one. They should build on each other in order to convey the information. You can use analogies or examples to further explain better.
Each of the tweets should use complete sentences yet in a conversational but public facing tone.
The content may be personal but the tweet should be for an audience of other people viewing it and should not include too many personal details but instead the inner learnings.
Do not use emojis, instead use your words to convey the emotions. Do not use any hashtags as they are not effective.
Each tweet should be a maximum of 3 sentences.
`