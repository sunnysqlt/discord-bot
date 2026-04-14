-- Migration pour ajouter la colonne embed_image à la table tickets
ALTER TABLE tickets ADD COLUMN embed_image TEXT;

-- Mise à jour de la structure pour supporter les messages personnalisés
-- La table tickets devrait déjà avoir les colonnes:
-- - guild (TEXT)
-- - channel (TEXT) 
-- - category (TEXT)
-- - role (TEXT)
-- - logs (TEXT)
-- - ping_message (TEXT)
-- - welcome_message (TEXT)
-- - embed_image (TEXT) -- nouvelle colonne
