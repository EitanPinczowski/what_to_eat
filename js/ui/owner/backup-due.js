// Tiny on purpose: the owner home needs this at start-up, the heavy settings screen loads only when opened.
export const BACKUP_EVERY = 30 * 864e5;

export const backupDue = (settings, now = Date.now()) => !settings.lastBackup || now - new Date(settings.lastBackup) >= BACKUP_EVERY;
