import { generateVAPIDKeys } from 'web-push';
import { writeFileSync } from 'node:fs';

const keys = generateVAPIDKeys();
// Never print private keys or commit this file. Do not rotate deployed keys
// casually: devices must re-subscribe when the application server key changes.
writeFileSync('.env.push', `VAPID_PUBLIC_KEY=${keys.publicKey}\nVAPID_PRIVATE_KEY=${keys.privateKey}\nVAPID_SUBJECT=https://i-tutor-alpha.vercel.app\nPUSH_APP_ORIGIN=https://i-tutor-alpha.vercel.app\n`, { flag: 'wx', mode: 0o600 });
console.log('Created .env.push (git-ignored). Store its values securely in the deployment environment.');
