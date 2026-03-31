import Database from "better-sqlite3";

// This module now serves as a singleton wrapper for the main DATABASE.db
// The database is initialized by the data_base plugin in plugins/data_base.ts
let dbInstance: Database.Database | null = null;

/**
 * Set the database instance from the Fastify plugin
 * This should be called once during application startup
 */
export function setDatabase(db: Database.Database): void {
	dbInstance = db;
}

/**
 * Get the current database instance
 * @throws Error if database hasn't been set yet
 */
export function getDatabase(): Database.Database {
	if (!dbInstance) {
		throw new Error("Database has not been initialized yet. Ensure the data_base plugin is registered.");
	}
	return dbInstance;
}
