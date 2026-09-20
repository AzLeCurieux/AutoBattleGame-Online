/**
 * Grant or revoke the admin role. Replaces the old shared ADMIN_PASSWORD
 * (default "admin123") — admins are normal accounts with a role.
 *
 *   npm run admin:promote -w @autobattle/server -- <username> [--revoke]
 */
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { UserService } from '../src/services/users.js';

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.error('Usage: admin:promote <username> [--revoke]');
  process.exit(1);
}
const db = openDatabase(loadConfig().DATABASE_PATH);
const ok = new UserService(db).setRole(username, flag === '--revoke' ? 'player' : 'admin');
console.warn(ok ? `${username}: role updated` : `${username}: user not found`);
db.close();
process.exit(ok ? 0 : 1);
