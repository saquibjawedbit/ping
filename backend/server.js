import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());


// Google Safe Browsing Lookup API endpoint
dotenv.config();
const SAFE_BROWSING_API_URL = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`;

// Route to check domain safety
app.post("/calculate-score", async (req, res) => {
    const { domain } = req.body;

    // Validate input
    if (!domain) {
        return res.status(400).json({ error: "Invalid input. Provide domain." });
    }

    try {
        const headers = {
            'Content-Type': 'application/json'
        };

        const requestBody = {
            client: {
                clientId: "72e3d3d",
                clientVersion: "1.0.0"
            },
            threatInfo: {
                threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                platformTypes: ["ANY_PLATFORM"],
                threatEntryTypes: ["URL"],
                threatEntries: [{ url: domain }]
            }
        };

        const { data } = await axios.post(SAFE_BROWSING_API_URL, requestBody, { headers });
        
        return res.json({
            safe: !data?.matches,
            threats: data?.matches || []
        });
        
    } catch (error) {
        console.error("Error checking domain:", error.message);
        res.status(500).json({ error: "Failed to check domain safety" });
    }
});

// Start the server
app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
