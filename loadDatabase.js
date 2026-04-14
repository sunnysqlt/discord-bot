import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

// Création et configuration de la base de données
let db;

export const initDatabase = async () => {
    try {
        db = await open({
            filename: './tickets.db',
            driver: sqlite3.Database
        });

        // Créer la table tickets si elle n'existe pas
        await db.exec(`
            CREATE TABLE IF NOT EXISTS tickets (
                guild TEXT PRIMARY KEY,
                channel TEXT,
                category TEXT,
                role TEXT,
                logs TEXT,
                ping_message TEXT DEFAULT 'Nouvelle interview de star !',
                welcome_message TEXT DEFAULT 'Bienvenue star !',
                embed_image TEXT
            )
        `);

        // Créer les autres tables nécessaires pour le système de permissions
        await db.exec(`
            CREATE TABLE IF NOT EXISTS whitelist (
                id TEXT PRIMARY KEY
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS owner (
                id TEXT PRIMARY KEY
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS permissions (
                id TEXT,
                perm TEXT,
                guild TEXT,
                PRIMARY KEY (id, perm, guild)
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS cmdperm (
                perm TEXT,
                command TEXT,
                guild TEXT,
                PRIMARY KEY (perm, command, guild)
            )
        `);

        await db.exec(`
            CREATE TABLE IF NOT EXISTS public (
                guild TEXT PRIMARY KEY,
                statut TEXT DEFAULT 'off'
            )
        `);

        console.log('📊 Base de données initialisée avec succès');
        return db;

    } catch (error) {
        console.error('❌ Erreur lors de l\'initialisation de la base de données:', error);
        throw error;
    }
};

export const getDatabase = () => {
    if (!db) {
        throw new Error('La base de données n\'a pas été initialisée. Appelez initDatabase() d\'abord.');
    }
    return db;
};

// Export par défaut pour compatibilité avec le code existant
const database = await initDatabase();
export default database;
