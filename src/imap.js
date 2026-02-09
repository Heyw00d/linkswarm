/**
 * LinkSwarm IMAP Module
 * Handles email verification for directory signups
 */

const Imap = require('imap');
const { simpleParser } = require('mailparser');

/**
 * Connect to IMAP and fetch verification emails
 */
async function connectImap(credentials) {
  return new Promise((resolve, reject) => {
    const imap = new Imap({
      user: credentials.user,
      password: credentials.password,
      host: credentials.host,
      port: credentials.port || 993,
      tls: credentials.tls !== false,
      tlsOptions: { rejectUnauthorized: false }
    });

    imap.once('ready', () => resolve(imap));
    imap.once('error', reject);
    imap.connect();
  });
}

/**
 * Search for verification emails from a specific sender/subject
 */
async function findVerificationEmail(imap, options = {}) {
  const { 
    since = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24h
    from,
    subject,
    maxWait = 120000, // 2 minutes
    pollInterval = 5000 // 5 seconds
  } = options;

  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) return reject(err);

        const searchCriteria = [['SINCE', since]];
        if (from) searchCriteria.push(['FROM', from]);
        if (subject) searchCriteria.push(['SUBJECT', subject]);

        imap.search(searchCriteria, (err, results) => {
          if (err) return reject(err);

          if (results.length === 0) {
            if (Date.now() - startTime < maxWait) {
              setTimeout(poll, pollInterval);
            } else {
              resolve(null); // Timeout, no email found
            }
            return;
          }

          // Fetch the most recent matching email
          const fetch = imap.fetch([results[results.length - 1]], { bodies: '' });
          
          fetch.on('message', (msg) => {
            msg.on('body', (stream) => {
              simpleParser(stream, (err, parsed) => {
                if (err) return reject(err);
                resolve(parsed);
              });
            });
          });

          fetch.once('error', reject);
        });
      });
    };

    poll();
  });
}

/**
 * Extract verification link from email
 */
function extractVerificationLink(email) {
  if (!email) return null;

  const html = email.html || '';
  const text = email.text || '';
  const content = html + ' ' + text;

  // Common verification link patterns
  const patterns = [
    /href=["']?(https?:\/\/[^\s"'<>]*(?:verify|confirm|activate|validate)[^\s"'<>]*)["']?/gi,
    /https?:\/\/[^\s"'<>]*(?:token|code|key)=[^\s"'<>]+/gi,
    /https?:\/\/[^\s"'<>]*\/(?:verify|confirm|activate|validate)\/[^\s"'<>]+/gi
  ];

  for (const pattern of patterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the URL
      let url = matches[0].replace(/^href=["']?/, '').replace(/["']$/, '');
      return url;
    }
  }

  // Fallback: find any link that looks like verification
  const allLinks = content.match(/https?:\/\/[^\s"'<>]+/g) || [];
  for (const link of allLinks) {
    if (/verify|confirm|activate|token|validate/i.test(link)) {
      return link;
    }
  }

  return null;
}

/**
 * Extract verification code from email
 */
function extractVerificationCode(email) {
  if (!email) return null;

  const text = email.text || '';
  const html = email.html || '';
  const content = text + ' ' + html;

  // Look for 6-digit codes
  const sixDigit = content.match(/\b(\d{6})\b/);
  if (sixDigit) return sixDigit[1];

  // Look for codes after common phrases
  const phrases = [
    /verification code[:\s]+([A-Z0-9]{4,8})/i,
    /confirm(?:ation)? code[:\s]+([A-Z0-9]{4,8})/i,
    /your code[:\s]+([A-Z0-9]{4,8})/i,
    /code[:\s]+([A-Z0-9]{4,8})/i
  ];

  for (const pattern of phrases) {
    const match = content.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * Wait for and process verification email
 */
async function waitForVerification(credentials, searchOptions) {
  let imap;
  try {
    imap = await connectImap(credentials);
    const email = await findVerificationEmail(imap, searchOptions);
    
    if (!email) {
      return { success: false, error: 'No verification email found within timeout' };
    }

    const link = extractVerificationLink(email);
    const code = extractVerificationCode(email);

    return {
      success: true,
      email: {
        from: email.from?.text,
        subject: email.subject,
        date: email.date
      },
      verificationLink: link,
      verificationCode: code
    };
  } finally {
    if (imap) {
      imap.end();
    }
  }
}

/**
 * Test IMAP connection
 */
async function testConnection(credentials) {
  let imap;
  try {
    imap = await connectImap(credentials);
    return { success: true, message: 'IMAP connection successful' };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    if (imap) {
      imap.end();
    }
  }
}

module.exports = {
  connectImap,
  findVerificationEmail,
  extractVerificationLink,
  extractVerificationCode,
  waitForVerification,
  testConnection
};
