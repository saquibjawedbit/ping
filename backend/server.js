import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import https from 'https';

const app = express();
const port = 3000;

// Middleware to parse JSON bodies
app.use(express.json());


// Google Safe Browsing Lookup API endpoint
dotenv.config();
const SAFE_BROWSING_API_URL = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${process.env.GOOGLE_API_KEY}`;

function cleanDomain(url) {
    try {
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`);
        return domain.hostname;
    } catch {
        return url.replace(/^(https?:\/\/)?(www\.)?/, '');
    }
}

async function checkSSLCertificate(domain) {
    return new Promise((resolve, reject) => {
        const cleanedDomain = cleanDomain(domain);
        
        const options = {
            host: cleanedDomain,
            port: 443,
            method: 'GET',
            rejectUnauthorized: false,
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            try {
                const cert = res.socket.getPeerCertificate();
                const protocol = res.socket.getProtocol();
                
                if (Object.keys(cert).length === 0) {
                    return resolve({ valid: false, score: 0 });
                }

                // Calculate SSL score out of 50
                let sslScore = 0;
                
                // Basic SSL presence and validity (20 points)
                if (res.socket.authorized) sslScore += 20;
                
                // Protocol security (10 points)
                if (protocol === 'TLSv1.3') sslScore += 10;
                else if (protocol === 'TLSv1.2') sslScore += 5;
                
                // Certificate validity period (10 points)
                const now = new Date();
                const validTo = new Date(cert.valid_to);
                const monthsUntilExpiry = (validTo - now) / (1000 * 60 * 60 * 24 * 30);
                if (monthsUntilExpiry > 6) sslScore += 10;
                else if (monthsUntilExpiry > 3) sslScore += 5;
                
                // Additional security features (10 points)
                if (cert.subject?.O) sslScore += 5;  // Organization validation
                if (cert.issuer?.O) sslScore += 5;   // Known issuer

                resolve({
                    valid: res.socket.authorized,
                    score: sslScore,
                    issuer: cert.issuer,
                    subject: cert.subject,
                    validFrom: cert.valid_from,
                    validTo: cert.valid_to,
                    protocol: protocol,
                    fingerprint: cert.fingerprint
                });
            } catch (error) {
                resolve({ valid: false, score: 0 });
            }
        });

        req.on('error', () => {
            resolve({ valid: false, score: 0 });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({ valid: false, score: 0 });
        });

        req.end();
    });
}

async function checkDNSRecords(domain) {
    const records = ['A', 'AAAA', 'MX', 'TXT'];
    const baseUrl = 'https://dns.google/resolve';
    
    try {
        const dnsChecks = await Promise.all(records.map(type => 
            axios.get(`${baseUrl}?name=${domain}&type=${type}`)
        ));

        const sanitizedRecords = {
            A: dnsChecks[0].data.Answer?.map(r => ({ data: r.data })) || [],
            AAAA: dnsChecks[1].data.Answer?.map(r => ({ data: r.data })) || [],
            MX: dnsChecks[2].data.Answer?.map(r => ({ data: r.data })) || [],
            TXT: dnsChecks[3].data.Answer?.map(r => ({ data: r.data })) || []
        };

        const dnsScore = {
            hasIPv4: sanitizedRecords.A.length > 0 ? 15 : 0,
            hasIPv6: sanitizedRecords.AAAA.length > 0 ? 10 : 0,
            hasMX: sanitizedRecords.MX.length > 0 ? 15 : 0,
            hasSPF: sanitizedRecords.TXT.some(r => r.data?.includes('v=spf1')) ? 10 : 0
        };

        return {
            score: Object.values(dnsScore).reduce((a, b) => a + b, 0),
            details: dnsScore,
            records: sanitizedRecords
        };
    } catch (error) {
        console.error('DNS check error:', error.message);
        return {
            score: 0,
            details: {
                hasIPv4: 0,
                hasIPv6: 0,
                hasMX: 0,
                hasSPF: 0
            },
            records: {},
            error: error.message
        };
    }
}


const calculateSSLScore = async (domain) => {
    if (!domain) {
        throw new Error("Domain required");
    }

    try {
        const [sslInfo, dnsInfo] = await Promise.all([
            checkSSLCertificate(domain),
            checkDNSRecords(domain)
        ]);

        // Calculate combined score
        const finalScore = sslInfo.score + dnsInfo.score; // Now naturally out of 100

        return {
            domain,
            totalScore: finalScore,
            ssl: { ...sslInfo, maxScore: 50 },
            dns: { ...dnsInfo, maxScore: 50 },
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        throw error;
    }
};

// Route to check domain safety
app.post("/calculate-score", async (req, res) => {
    const { domain } = req.body;

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

        const [safetyData, sslScore] = await Promise.all([
            axios.post(SAFE_BROWSING_API_URL, requestBody, { headers }),
            calculateSSLScore(domain)
        ]);

        // Calculate weighted scores
        const isSafe = !safetyData.data?.matches;
        const safetyScore = isSafe ? 100 : 0;  // 100 if safe, 0 if unsafe
        const sslNormalizedScore = (sslScore.ssl.score / 50) * 100;  // Convert to percentage
        const dnsNormalizedScore = (sslScore.dns.score / 50) * 100;  // Convert to percentage

        const totalScore = Math.round(
            (safetyScore * 0.8) +      // 80% weight for safety
            (sslNormalizedScore * 0.1) + // 10% weight for SSL
            (dnsNormalizedScore * 0.1)   // 10% weight for DNS
        );
        
        return res.json({
            safe: isSafe,
            totalScore,
            details: {
                safetyScore: {
                    score: safetyScore,
                    weight: "80%",
                    threats: safetyData.data?.matches || []
                },
                ssl: {
                    score: sslNormalizedScore,
                    weight: "10%",
                    ...sslScore.ssl
                },
                dns: {
                    score: dnsNormalizedScore,
                    weight: "10%",
                    ...sslScore.dns
                }
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error("Error checking domain:", error.message);
        res.status(500).json({ error: "Failed to check domain safety" });
    }
});

// Start the server
app.listen(port, () => console.log(`Server is running on http://localhost:${port}`));
