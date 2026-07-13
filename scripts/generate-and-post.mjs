import fs from 'node:fs';
import path from 'node:path';
import { makeBanner } from './lib/make-banner.mjs';
import { uploadImageToLinkedIn } from './lib/linkedin-image.mjs';

function parseTopicLine(line) {
  const parts = line.split('::');
  const headline = parts[0].trim();
  const steering = parts[1] ? parts[1].trim() : '';
  return { headline, steering, fullLine: line };
}

function getTopicAndContext() {
  // 1. Check CLI arguments for --topic
  const topicArgIdx = process.argv.indexOf('--topic');
  if (topicArgIdx !== -1 && process.argv[topicArgIdx + 1]) {
    const rawTopic = process.argv[topicArgIdx + 1];
    return parseTopicLine(rawTopic);
  }

  // 2. Check env variable
  if (process.env.POST_TOPICS) {
    const topicsList = process.env.POST_TOPICS.split(',').map(t => t.trim()).filter(Boolean);
    if (topicsList.length > 0) {
      const randomTopic = topicsList[Math.floor(Math.random() * topicsList.length)];
      return parseTopicLine(randomTopic);
    }
  }

  // 3. Read from topics.txt
  const topicsPath = path.resolve('topics.txt');
  if (!fs.existsSync(topicsPath)) {
    throw new Error(`topics.txt not found at ${topicsPath}`);
  }
  const fileContent = fs.readFileSync(topicsPath, 'utf8');
  const lines = fileContent.split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));

  if (lines.length === 0) {
    throw new Error('No topics found in topics.txt');
  }

  const randomLine = lines[Math.floor(Math.random() * lines.length)];
  return parseTopicLine(randomLine);
}

async function fetchWithBackoff(url, options, retries = [3000, 6000, 12000, 24000]) {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, options);
    if (res.ok) return res;

    const shouldRetry = res.status === 429 || res.status === 500 || res.status === 503;
    if (shouldRetry && attempt < retries.length) {
      const delay = retries[attempt];
      console.warn(`Gemini API returned ${res.status} ${res.statusText}. Retrying in ${delay}ms (attempt ${attempt + 1}/${retries.length})...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      attempt++;
    } else {
      return res;
    }
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
  const apiKey = process.env.GEMINI_API_KEY;
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const orgId = process.env.LINKEDIN_ORGANIZATION_ID;
  let model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  if (model === 'gemini-2.5-flash' || model === 'gemini-1.5-flash') {
    console.log(`Model ${model} is not supported. Auto-routing to gemini-2.0-flash.`);
    model = 'gemini-2.0-flash';
  }
  const includeBanner = process.env.INCLUDE_BANNER !== 'false';

  console.log(`Running in ${isDryRun ? 'DRY-RUN (preview)' : 'PRODUCTION'} mode.`);

  if (!apiKey) {
    console.error('Error: GEMINI_API_KEY is required.');
    process.exit(1);
  }

  if (!isDryRun && !token) {
    console.error('Error: LINKEDIN_ACCESS_TOKEN is required for production posting.');
    process.exit(1);
  }

  // 1. Get Topic
  let topicInfo;
  try {
    topicInfo = getTopicAndContext();
  } catch (err) {
    console.error(`Error resolving topic: ${err.message}`);
    process.exit(1);
  }

  const { headline, steering } = topicInfo;
  console.log(`Selected Topic: "${headline}"`);
  if (steering) {
    console.log(`Steering Context: "${steering}"`);
  }

  // 2. Generate content using Gemini API
  const angles = [
    'contrarian hot take',
    'first-person story',
    'surprising stat / "Did you know"',
    'scannable 3–5 item list',
    'provocative question',
    'practical mini-framework',
    'lesson learned the hard way',
    'future prediction with reasoning'
  ];
  const chosenAngle = angles[Math.floor(Math.random() * angles.length)];
  console.log(`Selected Angle: "${chosenAngle}"`);

  const systemInstruction = `You are Karishma, a Doctor of Pharmacy (Pharm.D) who has worked in multiple roles in healthcare (clinical pharmacist in a plastic surgery clinic, founder of a premium sunscreen brand sold at a 5x valuation, pharma product manager training 1,000+ doctors, regression therapist, and now AI-driven digital marketing and brand consultant for dermatologists and plastic surgeons).

Your LinkedIn writing voice is distinct. You must write the LinkedIn post EXACTLY according to these style guidelines:
1. Tone: Warm-first, truth-second. Earn trust before challenging. Grounded, professional, scientific credibility, hopeful realism ("whatever happens, happens for good").
2. Formatting: Short lines, short paragraphs, one thought/idea per line.
3. NO emojis.
4. NO hashtags.
5. Structure:
   - Pain first: Open by naming a specific pain point your target audience (dermatologists, plastic surgeons, or brand builders) faces. Let the pain sit.
   - Reframe: Reframe the common misunderstanding around it (e.g. "Instagram Reels are for ego, but they don't bring patient inflow").
   - Truth: Reveal what actually works (e.g., SEO, local Google ranking, brand positioning).
   - Lingering thought: Close with a thought to ponder on, rather than a hard call to action (NO "DM me", NO hard question).
6. Banned items:
   - Never use cliché openers like "In today's rapidly evolving landscape", "In the world of", "Let's dive in", "Imagine a world", "Once upon a time".
   - Never use jargon.
   - Never fabricate urgency, deadlines, or fake waitlists.
   - Never promise 100% / total resolution. In your framework, a 60-70% functional improvement is success.
   - Never discuss politics or name competitors.
7. Connective phrases: Use "That's exactly why" when connecting ideas.

Write an original, highly compelling LinkedIn post for the following topic and steering context:
Topic: "${headline}"
Steering Context: "${steering}"
Chosen Angle: "${chosenAngle}"

Output ONLY the final LinkedIn post text. Do not include any tags, preambles, explanations, or quotes.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [
      {
        parts: [
          {
            text: systemInstruction
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 1.1,
      topP: 0.95
    }
  };

  console.log('Generating content via Google Gemini API...');
  let postText = '';
  try {
    const geminiRes = await fetchWithBackoff(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      throw new Error(`Gemini API call failed: ${geminiRes.status} ${geminiRes.statusText} - ${errText}`);
    }

    const geminiData = await geminiRes.json();
    postText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!postText) {
      throw new Error(`Invalid response structure from Gemini API: ${JSON.stringify(geminiData)}`);
    }
    
    // Trim extra spaces and format
    postText = postText.trim();
  } catch (err) {
    console.error(`Gemini Generation Failed: ${err.message}`);
    process.exit(1);
  }

  // 3. Resolve Author
  let authorUrn = '';
  let brandName = process.env.BANNER_BRAND || 'Karishma';

  if (orgId) {
    authorUrn = `urn:li:organization:${orgId}`;
  } else if (token) {
    try {
      console.log('Resolving LinkedIn author profile...');
      const userinfoRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (userinfoRes.ok) {
        const userInfo = await userinfoRes.json();
        authorUrn = `urn:li:person:${userInfo.sub}`;
        if (!process.env.BANNER_BRAND && userInfo.name) {
          brandName = userInfo.name;
        }
        console.log(`Resolved Author URN: ${authorUrn} (Name: ${brandName})`);
      } else {
        console.warn(`Warning: Could not fetch user profile info: ${userinfoRes.status} ${userinfoRes.statusText}. Using fallback details.`);
      }
    } catch (err) {
      console.warn(`Warning: Failed to fetch LinkedIn profile: ${err.message}. Using fallback details.`);
    }
  }

  if (!authorUrn && !isDryRun) {
    console.error('Error: Could not resolve LinkedIn author URN. Make sure token is valid.');
    process.exit(1);
  }

  // 4. Generate Banner (if enabled)
  let bannerBuffer = null;
  if (includeBanner) {
    try {
      console.log(`Generating banner with headline "${headline}" and brand "${brandName}"...`);
      bannerBuffer = makeBanner(headline, brandName);
      console.log('Banner generated successfully.');
    } catch (err) {
      console.warn(`Warning: Banner generation failed: ${err.message}. Proceeding to post without banner.`);
    }
  }

  // 5. Dry Run execution
  if (isDryRun) {
    console.log('\n=================== DRY RUN PREVIEW ===================');
    console.log(`Target Author URN: ${authorUrn || 'urn:li:person:mock-id'}`);
    console.log(`Banner Brand:      ${brandName}`);
    console.log(`Banner Enabled:    ${includeBanner}`);
    console.log('--------------------------------------------------------');
    console.log('GENERATED POST:');
    console.log(postText);
    console.log('========================================================\n');

    if (bannerBuffer) {
      const previewPath = path.resolve('preview-banner.png');
      fs.writeFileSync(previewPath, bannerBuffer);
      console.log(`Dry run complete. Banner preview saved to: ${previewPath}`);
    }
    return;
  }

  // 6. Production Publish
  let assetUrn = null;
  if (bannerBuffer) {
    try {
      console.log('Uploading banner image to LinkedIn...');
      assetUrn = await uploadImageToLinkedIn({
        token,
        ownerUrn: authorUrn,
        imageBuffer: bannerBuffer
      });
      console.log(`Banner uploaded successfully. Asset URN: ${assetUrn}`);
    } catch (err) {
      console.warn(`Warning: Failed to upload banner: ${err.message}. Falling back to text-only post.`);
    }
  }

  // Prepare publish payload
  const publishUrl = 'https://api.linkedin.com/v2/ugcPosts';
  const publishPayload = {
    author: authorUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: postText
        },
        shareMediaCategory: assetUrn ? 'IMAGE' : 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  if (assetUrn) {
    publishPayload.specificContent['com.linkedin.ugc.ShareContent'].media = [
      {
        status: 'READY',
        description: {
          text: headline
        },
        media: assetUrn,
        title: {
          text: headline
        }
      }
    ];
  }

  try {
    console.log('Publishing post to LinkedIn...');
    const publishRes = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Restli-Protocol-Version': '2.0.0',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(publishPayload)
    });

    if (!publishRes.ok) {
      const errText = await publishRes.text();
      throw new Error(`LinkedIn publish failed: ${publishRes.status} ${publishRes.statusText} - ${errText}`);
    }

    const postId = publishRes.headers.get('x-restli-id') || publishRes.headers.get('X-RestLi-Id');
    console.log('========================================================');
    console.log('POST SUCCESSFULLY PUBLISHED!');
    console.log(`LinkedIn Post ID: ${postId}`);
    console.log('========================================================');
  } catch (err) {
    console.error(`Post publication failed: ${err.message}`);
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`Unhandled system error: ${err.message}`);
  process.exit(1);
});
