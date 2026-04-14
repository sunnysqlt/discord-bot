import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config.js';
import { command as ticketCommand } from './bot.js';
import { command as helpCommand } from './help.js';
import { handleTicketInteractions } from './interactionHandler.js';

// Création du client Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Stockage des commandes
const commands = new Map();
commands.set(ticketCommand.name, ticketCommand);
commands.set(helpCommand.name, helpCommand);

// Événement: Bot prêt
client.once('ready', () => {
    console.log(`🎙️ Bot connecté en tant que ${client.user.tag}`);
    console.log(`📋 Prêt à gérer les interviews de stars !`);
});

// Événement: Message reçu
client.on('messageCreate', async (message) => {
    // Ignorer les messages des bots
    if (message.author.bot) return;

    // Vérifier si le message commence par le préfixe
    if (!message.content.startsWith(config.prefix)) return;

    // Extraire la commande et les arguments
    const args = message.content.slice(config.prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    // Vérifier si la commande existe
    const command = commands.get(commandName);
    if (!command) return;

    try {
        // Exécuter la commande
        await command.run(client, message, args, config);
    } catch (error) {
        console.error(`Erreur lors de l'exécution de la commande ${commandName}:`, error);
        
        const errorEmbed = {
            color: 0xFF0000,
            title: '❌ Erreur',
            description: 'Une erreur est survenue lors de l\'exécution de cette commande.',
            timestamp: new Date().toISOString()
        };
        
        await message.reply({ embeds: [errorEmbed] }).catch(() => {});
    }
});

// Événement: Interaction (menus déroulants, boutons, modals)
client.on('interactionCreate', async (interaction) => {
    await handleTicketInteractions(interaction, client);
});

// Gestion des erreurs
client.on('error', (error) => {
    console.error('Erreur du client Discord:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('Erreur non gérée:', error);
});

// Connexion du bot
client.login(config.token).catch(error => {
    console.error('Erreur de connexion:', error);
    console.log('❌ Vérifiez que votre token est correct dans config.js');
});
