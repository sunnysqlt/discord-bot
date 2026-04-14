import { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } from 'discord.js';
import db from './loadDatabase.js';

// Stockage temporaire des sélections par message
const ticketSelections = new Map();

export const handleTicketInteractions = async (interaction, bot) => {
    try {
        if (interaction.isStringSelectMenu()) {
            const customId = interaction.customId;
            const messageId = interaction.message.id;
            
            if (customId === 'ticket_category' || customId === 'ticket_role' || customId === 'ticket_logs') {
                // Initialiser les sélections pour ce message si nécessaire
                if (!ticketSelections.has(messageId)) {
                    ticketSelections.set(messageId, {});
                }
                
                // Stocker la sélection
                const selections = ticketSelections.get(messageId);
                selections[customId] = interaction.values[0];
                
                // Mettre à jour le message avec les sélections actuelles
                await updateSelectionMessage(interaction, selections);
            }
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;
            
            if (customId === 'ticket_confirm') {
                await handleTicketConfirm(interaction);
            } else if (customId === 'ticket_cancel') {
                await handleTicketCancel(interaction);
            } else if (customId === 'ticket_messages') {
                await showMessagesModal(interaction);
            } else if (customId === 'create_ticket') {
                await handleCreateTicket(interaction);
            } else if (customId === 'close_ticket') {
                await handleCloseTicket(interaction);
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'ticket_messages_modal') {
                await handleMessagesSubmit(interaction);
            }
        }
    } catch (error) {
        console.error('Erreur lors de la gestion de l\'interaction:', error);
        await interaction.reply({ 
            content: 'Une erreur est survenue lors du traitement de votre demande.', 
            flags: [64] // Ephemeral flag
        });
    }
};

const updateSelectionMessage = async (interaction, selections) => {
    const originalMessage = interaction.message;
    const components = originalMessage.components;
    
    // Mettre à jour les composants avec les sélections actuelles
    const updatedComponents = components.map(row => {
        const updatedRow = new ActionRowBuilder();
        row.components.forEach(component => {
            if (component.customId && selections[component.customId]) {
                // Recréer le menu déroulant avec la sélection actuelle
                const newSelectMenu = new StringSelectMenuBuilder()
                    .setCustomId(component.customId)
                    .setPlaceholder(component.placeholder)
                    .setOptions(component.options.map(option => ({
                        ...option,
                        default: option.value === selections[component.customId]
                    })));
                
                updatedRow.addComponents(newSelectMenu);
            } else {
                updatedRow.addComponents(component);
            }
        });
        return updatedRow;
    });

    await interaction.update({
        content: `Sélections enregistrées: ${Object.keys(selections).map(key => 
            key === 'ticket_category' ? 'Catégorie' : 
            key === 'ticket_role' ? 'Rôle' : 'Salon de logs'
        ).join(', ')}`,
        components: updatedComponents,
        flags: [64] // Ephemeral flag
    });
};

const handleTicketConfirm = async (interaction) => {
    try {
        const messageId = interaction.message.id;
        let selections = ticketSelections.get(messageId);
        
        // Initialiser les sélections si elles n'existent pas
        if (!selections) {
            selections = {};
            ticketSelections.set(messageId, selections);
        }
        
        // Récupérer l'image personnalisée depuis la variable globale
        if (global.tempTicketImages && global.tempTicketImages.has(messageId)) {
            selections.customImage = global.tempTicketImages.get(messageId);
            console.log('Image personnalisée récupérée depuis le stockage temporaire:', selections.customImage);
            // Nettoyer le stockage temporaire
            global.tempTicketImages.delete(messageId);
        }
        
        if (!selections.ticket_category || !selections.ticket_role) {
            await interaction.reply({ 
                content: 'Veuillez sélectionner une catégorie et un rôle du staff avant de confirmer.', 
                flags: [64] // Ephemeral flag
            });
            return;
        }

        const categoryId = selections.ticket_category;
        const roleId = selections.ticket_role;
        const logsId = selections.ticket_logs;

        if (!categoryId || !roleId) {
            await interaction.reply({ 
                content: '❌ Veuillez sélectionner une catégorie et un rôle du staff avant de confirmer.', 
                flags: [64] 
            });
            return;
        }

        // Vérifier si la catégorie et le rôle existent
        const category = interaction.guild.channels.cache.get(categoryId);
        const role = interaction.guild.roles.cache.get(roleId);
        const logsChannel = logsId && logsId !== 'none' ? interaction.guild.channels.cache.get(logsId) : null;

        if (!category || category.type !== 4) {
            await interaction.reply({ 
                content: '❌ Catégorie invalide.', 
                flags: [64] 
            });
            return;
        }

        if (!role) {
            await interaction.reply({ 
                content: '❌ Rôle invalide.', 
                flags: [64] 
            });
            return;
        }

        if (logsId && logsId !== 'none' && (!logsChannel || logsChannel.type !== 0)) {
            await interaction.reply({ 
                content: 'Salon de logs invalide.', 
                flags: [64] 
            });
            return;
        }

        // Récupérer l'image personnalisée des sélections si elle existe
        let customImage = selections && selections.customImage ? selections.customImage : null;

        // Sauvegarder la configuration
        await db.run(`INSERT OR REPLACE INTO tickets (guild, channel, category, role, logs, ping_message, welcome_message, embed_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [interaction.guild.id, interaction.channel.id, categoryId, roleId, logsId === 'none' ? null : logsId, 'Nouvelle interview de star !', 'Bienvenue star !', customImage]);

        // Récupérer l'image personnalisée si elle existe
        const imageResult = await db.get('SELECT embed_image FROM tickets WHERE guild = ?', [interaction.guild.id]);
        customImage = imageResult ? imageResult.embed_image : null;
        
        console.log('Création du panneau d\'interviews - Image personnalisée:', customImage);

        // Créer le panneau d'interviews
        const embed = new EmbedBuilder()
            .setTitle('INTERVIEW 2 STAR')
            .setDescription('T\'es une star de discord et tu veux passer dans nos interviews ?\n\nClique sur le bouton ci-dessous pour créer un ticket.')
            .setColor('#830c68')
            .setFooter({ text: 'Deviens la prochaine star de Discord !' });

        if (customImage) {
            console.log('Utilisation de l\'image personnalisée:', customImage);
            embed.setImage(customImage);
        } else {
            console.log('Utilisation de l\'image par défaut');
            embed.setImage('https://media.discordapp.net/attachments/1493321375820026018/1493423907175268492/I2S.png?ex=69deeae5&is=69dd9965&hm=a71901060e99ec7e93c7ddb264ecde2fe5c92df31225cee8f9d953805b733e1d&=&format=webp&quality=lossless&width=607&height=340');
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('create_ticket')
                    .setLabel('Créer une interview')
                    .setStyle(ButtonStyle.Primary)
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });

        // Supprimer le message de configuration
        await interaction.message.delete();
        
        // Nettoyer les sélections stockées
        ticketSelections.delete(messageId);

        const successEmbed = new EmbedBuilder()
            .setDescription(`✅ Le système d'interviews de stars a été configuré avec succès !\n\n**Catégorie:** ${category}\n**Rôle du staff:** ${role}\n**Logs:** ${logsChannel || 'Non défini'}\n**Image:** ${customImage ? 'Personnalisée' : 'Par défaut'}`)
            .setColor('#830c68');

        await interaction.reply({ embeds: [successEmbed], flags: [64] });

    } catch (error) {
        console.error('Erreur lors de la confirmation:', error);
        await interaction.reply({ 
            content: 'Une erreur est survenue lors de la confirmation.', 
            flags: [64] // Ephemeral flag
        });
    }
};

const handleTicketCancel = async (interaction) => {
    try {
        const messageId = interaction.message.id;
        
        // Nettoyer les sélections stockées
        ticketSelections.delete(messageId);
        
        await interaction.message.delete();
        await interaction.reply({ 
            content: 'Message de configuration annulé.', 
            flags: [64] // Ephemeral flag
        });
    } catch (error) {
        console.error('Erreur lors de l\'annulation:', error);
    }
};

const showMessagesModal = async (interaction) => {
    try {
        const modal = new ModalBuilder()
            .setCustomId('ticket_messages_modal')
            .setTitle('Messages personnalisés');

        const pingInput = new TextInputBuilder()
            .setCustomId('ping_message')
            .setLabel('Message de ping pour le staff')
            .setPlaceholder('Ex: Nouvelle interview de star !')
            .setValue('Nouvelle interview de star !')
            .setStyle(TextInputStyle.Short)
            .setMaxLength(100);

        const welcomeInput = new TextInputBuilder()
            .setCustomId('welcome_message')
            .setLabel('Message d\'accueil dans le ticket')
            .setPlaceholder('Ex: Bienvenue star !')
            .setValue('Bienvenue star !')
            .setStyle(TextInputStyle.Paragraph)
            .setMaxLength(500);

        const firstActionRow = new ActionRowBuilder().addComponents(pingInput);
        const secondActionRow = new ActionRowBuilder().addComponents(welcomeInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
    } catch (error) {
        console.error('Erreur lors de l\'affichage du modal:', error);
    }
};

const handleMessagesSubmit = async (interaction) => {
    try {
        const pingMessage = interaction.fields.getTextInputValue('ping_message');
        const welcomeMessage = interaction.fields.getTextInputValue('welcome_message');

        // Sauvegarder les messages personnalisés
        await db.run(`UPDATE tickets SET ping_message = ?, welcome_message = ? WHERE guild = ?`,
            [pingMessage, welcomeMessage, interaction.guild.id]);

        const embed = new EmbedBuilder()
            .setTitle('✅ Messages personnalisés enregistrés!')
            .addFields(
                { name: 'Message de ping', value: pingMessage, inline: false },
                { name: 'Message d\'accueil', value: welcomeMessage, inline: false }
            )
            .setColor('#830c68');

        await interaction.reply({ embeds: [embed], flags: [64] });

    } catch (error) {
        console.error('Erreur lors de la sauvegarde des messages:', error);
        await interaction.reply({ 
            content: 'Une erreur est survenue lors de la sauvegarde des messages.', 
            flags: [64] // Ephemeral flag
        });
    }
};

const handleCreateTicket = async (interaction) => {
    try {
        // Récupérer la configuration
        const config = await db.get('SELECT * FROM tickets WHERE guild = ?', [interaction.guild.id]);

        if (!config) {
            await interaction.reply({ 
                content: 'Le système de tickets n\'est pas configuré.', 
                flags: [64] 
            });
            return;
        }

        // Créer le salon de ticket
        const ticketChannel = await interaction.guild.channels.create({
            name: `interview-${interaction.user.username}`,
            type: 0,
            parent: config.category,
            permissionOverwrites: [
                {
                    id: interaction.guild.id,
                    deny: ['ViewChannel']
                },
                {
                    id: interaction.user.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                },
                {
                    id: config.role,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory']
                }
            ]
        });

        // Envoyer le message d'accueil
        const welcomeEmbed = new EmbedBuilder()
            .setTitle('INTERVIEW 2 STAR')
            .setDescription(config.welcome_message)
            .addFields(
                { name: 'Participant', value: interaction.user.toString(), inline: true },
                { name: 'Staff', value: `<@&${config.role}>`, inline: true }
            )
            .setColor('#830c68')
            .setTimestamp();

        // Créer le bouton de fermeture
        const closeRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('close_ticket')
                    .setLabel('Fermer le ticket')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒')
            );

        await ticketChannel.send({ 
            content: `${config.ping_message} <@&${config.role}>`,
            embeds: [welcomeEmbed],
            components: [closeRow]
        });

        // Envoyer les logs si configuré
        if (config.logs) {
            const logsChannel = interaction.guild.channels.cache.get(config.logs);
            if (logsChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle('🎫 Nouveau ticket créé')
                    .addFields(
                        { name: 'Utilisateur', value: interaction.user.toString(), inline: true },
                        { name: 'Salon', value: ticketChannel.toString(), inline: true },
                        { name: 'ID', value: interaction.user.id, inline: true }
                    )
                    .setColor('#830c68')
                    .setTimestamp();

                await logsChannel.send({ embeds: [logEmbed] });
            }
        }

        await interaction.reply({ 
            content: `✅ Votre ticket a été créé: ${ticketChannel.toString()}`, 
            flags: [64] 
        });

    } catch (error) {
        console.error('Erreur lors de la création du ticket:', error);
        await interaction.reply({ 
            content: 'Une erreur est survenue lors de la création du ticket.', 
            flags: [64] // Ephemeral flag
        });
    }
};

const handleCloseTicket = async (interaction) => {
    try {
        const ticketChannel = interaction.channel;
        
        // Vérifier si l'utilisateur a la permission de fermer le ticket
        if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            await interaction.reply({ 
                content: 'Vous n\'avez pas la permission de fermer ce ticket.', 
                flags: [64] // Ephemeral flag
            });
            return;
        }

        // Demander une confirmation avant de fermer
        const confirmEmbed = new EmbedBuilder()
            .setTitle('Fermeture du ticket')
            .setDescription('Êtes-vous sûr de vouloir fermer ce ticket ?\n\nCette action est irréversible.')
            .setColor('#ff0000')
            .setTimestamp();

        const confirmRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_close')
                    .setLabel('Confirmer la fermeture')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🔒'),
                new ButtonBuilder()
                    .setCustomId('cancel_close')
                    .setLabel('Annuler')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('❌')
            );

        await interaction.reply({ 
            embeds: [confirmEmbed], 
            components: [confirmRow] 
        });

        // Créer un collecteur pour les réactions
        const filter = (i) => i.user.id === interaction.user.id;
        const collector = interaction.channel.createMessageComponentCollector({ 
            filter, 
            time: 30000 // 30 secondes
        });

        collector.on('collect', async (i) => {
            if (i.customId === 'confirm_close') {
                // Envoyer un message de fermeture
                const closeEmbed = new EmbedBuilder()
                    .setTitle('Ticket fermé')
                    .setDescription('Ce ticket a été fermé avec succès.')
                    .addFields(
                        { name: 'Fermé par', value: interaction.user.toString(), inline: true },
                        { name: 'Date de fermeture', value: new Date().toLocaleString(), inline: true }
                    )
                    .setColor('#ff0000')
                    .setTimestamp();

                await i.update({ 
                    embeds: [closeEmbed], 
                    components: [] 
                });

                // Envoyer les logs de fermeture si configuré
                const config = await db.get('SELECT * FROM tickets WHERE guild = ?', [interaction.guild.id]);
                if (config && config.logs) {
                    const logsChannel = interaction.guild.channels.cache.get(config.logs);
                    if (logsChannel) {
                        const logEmbed = new EmbedBuilder()
                            .setTitle('Ticket fermé')
                            .addFields(
                                { name: 'Salon', value: ticketChannel.toString(), inline: true },
                                { name: 'Fermé par', value: interaction.user.toString(), inline: true },
                                { name: 'ID', value: interaction.user.id, inline: true }
                            )
                            .setColor('#ff0000')
                            .setTimestamp();

                        await logsChannel.send({ embeds: [logEmbed] });
                    }
                }

                // Fermer le canal après un délai
                setTimeout(async () => {
                    try {
                        await ticketChannel.delete();
                    } catch (error) {
                        console.error('Erreur lors de la suppression du canal:', error);
                    }
                }, 5000); // 5 secondes

            } else if (i.customId === 'cancel_close') {
                const cancelEmbed = new EmbedBuilder()
                    .setDescription('La fermeture du ticket a été annulée.')
                    .setColor('#830c68');

                await i.update({ 
                    embeds: [cancelEmbed], 
                    components: [] 
                });
            }
            collector.stop();
        });

        collector.on('end', (collected) => {
            if (collected.size === 0) {
                // Timeout - supprimer le message de confirmation
                interaction.deleteReply().catch(() => {});
            }
        });

    } catch (error) {
        console.error('Erreur lors de la fermeture du ticket:', error);
        await interaction.reply({ 
            content: 'Une erreur est survenue lors de la fermeture du ticket.', 
            flags: [64] // Ephemeral flag
        });
    }
};
