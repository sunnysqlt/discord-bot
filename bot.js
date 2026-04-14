import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import db from './loadDatabase.js';

export const command = {
	name: 'ticket',
	helpname: 'ticket <setup>',
	description: "Permet de gérer le système de tickets personnalisable",
	help: 'ticket setup [ping_message] [welcome_message] [category_name] [logs_channel]',
	run: async (bot, message, args, config) => {
		const checkPerm = async (message, commandName) => {
			if (config.owners.includes(message.author.id)) {
				return true;
			}

			const publicStatut = await new Promise((resolve, reject) => {
				db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
					if (err) reject(err);
					resolve(!!row);
				});
			});

			if (publicStatut) {
				const checkPublicCmd = await new Promise((resolve, reject) => {
					db.get(
						'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
							['public', commandName, message.guild.id],
							(err, row) => {
								if (err) reject(err);
								resolve(!!row);
							}
					);
				});

				if (checkPublicCmd) {
					return true;
				}
			}

			try {
				const checkUserWl = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (checkUserWl) {
					return true;
				}

				const checkDbOwner = await new Promise((resolve, reject) => {
					db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
						if (err) reject(err);
						resolve(!!row);
					});
				});

				if (checkDbOwner) {
					return true;
				}

				const roles = message.member.roles.cache.map(role => role.id);

				const permissions = await new Promise((resolve, reject) => {
					db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.perm));
					});
				});

				if (permissions.length === 0) {
					return false;
				}

				const checkCmdPermLevel = await new Promise((resolve, reject) => {
					db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
						if (err) reject(err);
						resolve(rows.map(row => row.command));
					});
				});

				return checkCmdPermLevel.includes(commandName);
			} catch (error) {
				console.error('Erreur lors de la vérification des permissions:', error);
				return false;
			}
		};

		if (!(await checkPerm(message, command.name))) {
			const noacces = new EmbedBuilder()
				.setDescription("Vous n'avez pas la permission d'utiliser cette commande")
				.setColor('#830c68');
			return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } }).then(m => setTimeout(() => m.delete().catch(() => { }), 2000));
		}

		if (!args[0]) {
			const embed = new EmbedBuilder()
				.setTitle('Ticket Interview de Star')
				.setDescription('Utilisation: `ticket setup` [image optionnelle]\n\n**Commande:**\n· `ticket setup` - Configure le système avec des menus déroulants\n\n**Astuce:** Joignez une image à la commande pour la définir directement !')
				.setColor('#830c68');
			return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		}

		if (args[0].toLowerCase() !== 'setup') {
			const embed = new EmbedBuilder()
				.setTitle('Ticket Interview de Star')
				.setDescription('Utilisation: `ticket setup` [image optionnelle]\n\n**Commande:**\n· `ticket setup` - Configure le système avec des menus déroulants\n\n**Astuce:** Joignez une image à la commande pour la définir directement !')
				.setColor('#830c68');
			return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		}

		if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
			const embed = new EmbedBuilder()
				.setDescription('Vous avez besoin de la permission "Gérer les salons" pour utiliser cette commande.')
				.setColor('#830c68');
			return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		}

		// Vérifier si une image est jointe pour la configuration directe
		let customImage = null;
		if (message.attachments.size > 0) {
			const attachment = message.attachments.first();
			if (attachment.contentType && attachment.contentType.startsWith('image/')) {
				customImage = attachment.url;
				console.log('Image détectée pour la configuration:', attachment.name);
			}
		}

		try {
			// Récupérer les catégories, rôles et salons textuels
			const categories = message.guild.channels.cache.filter(c => c.type === 4);
			const roles = message.guild.roles.cache.filter(r => r.name !== '@everyone');
			const textChannels = message.guild.channels.cache.filter(c => c.type === 0);

			// Créer les options pour les menus déroulants
			const categoryOptions = categories.map(cat => ({
				label: cat.name,
				value: cat.id,
				description: `Catégorie: ${cat.name}`
			}));

			const roleOptions = roles.map(role => ({
				label: role.name,
				value: role.id,
				description: `Rôle: ${role.name}`
			}));

			const channelOptions = textChannels.map(channel => ({
				label: channel.name,
				value: channel.id,
				description: `Salon: ${channel.name}`
			}));

			// Ajouter une option "Aucun" pour les logs
			channelOptions.unshift({
				label: 'Aucun',
				value: 'none',
				description: 'Ne pas utiliser de salon de logs'
			});

			// Créer l'embed de configuration
			const setupEmbed = new EmbedBuilder()
				.setTitle('Configuration du système d\'interviews')
				.setDescription('Configurez votre système de tickets en sélectionnant les options ci-dessous:')
				.addFields(
					{ name: 'Catégorie', value: 'Sélectionnez la catégorie où les tickets seront créés', inline: true },
					{ name: 'Rôle du staff', value: 'Sélectionnez le rôle à mentionner lors de la création d\'un ticket', inline: true },
					{ name: 'Salon de logs', value: 'Sélectionnez le salon pour recevoir les logs (optionnel)', inline: true },
					{ name: 'Image personnalisée', value: customImage ? 'Image détectée et appliquée !' : 'Joignez une image à la commande pour personnaliser l\'embed', inline: false }
				)
				.setColor('#830c68')
				.setFooter({ text: 'Sélectionnez vos options puis cliquez sur "Confirmer"' });

			// Afficher l'image si elle a été détectée
			if (customImage) {
				setupEmbed.setImage(customImage);
			}

			// Créer les menus déroulants
			const categoryRow = new ActionRowBuilder()
				.addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('ticket_category')
						.setPlaceholder('Sélectionnez une catégorie...')
						.addOptions(categoryOptions.slice(0, 25)) // Limite à 25 options
				);

			const roleRow = new ActionRowBuilder()
				.addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('ticket_role')
						.setPlaceholder('Sélectionnez un rôle du staff...')
						.addOptions(roleOptions.slice(0, 25)) // Limite à 25 options
				);

			const channelRow = new ActionRowBuilder()
				.addComponents(
					new StringSelectMenuBuilder()
						.setCustomId('ticket_logs')
						.setPlaceholder('Sélectionnez un salon de logs...')
						.addOptions(channelOptions.slice(0, 25)) // Limite à 25 options
				);

			// Créer les boutons de confirmation
			const buttonRow = new ActionRowBuilder()
				.addComponents(
					new ButtonBuilder()
						.setCustomId('ticket_confirm')
						.setLabel('✅ Confirmer')
						.setStyle(ButtonStyle.Success),
					new ButtonBuilder()
						.setCustomId('ticket_cancel')
						.setLabel('❌ Annuler')
						.setStyle(ButtonStyle.Danger),
					new ButtonBuilder()
						.setCustomId('ticket_messages')
						.setLabel('📝 Messages personnalisés')
						.setStyle(ButtonStyle.Secondary)
				);

			const setupMessage = await message.channel.send({ 
				embeds: [setupEmbed], 
				components: [categoryRow, roleRow, channelRow, buttonRow] 
			});

			// Stocker l'image personnalisée dans les sélections temporaires si elle existe
			if (customImage) {
				const { handleTicketInteractions } = await import('./interactionHandler.js');
				// Utiliser une variable globale pour stocker temporairement l'image
				global.tempTicketImages = global.tempTicketImages || new Map();
				global.tempTicketImages.set(setupMessage.id, customImage);
			}

			// Message de confirmation
			const confirmEmbed = new EmbedBuilder()
				.setDescription('📋 Panneau de configuration créé! Sélectionnez vos options puis cliquez sur "Confirmer".')
				.setColor('#830c68');

			return message.reply({ embeds: [confirmEmbed], allowedMentions: { repliedUser: false } });

		} catch (error) {
			console.error('Erreur lors de la configuration des tickets:', error);
			const embed = new EmbedBuilder()
				.setDescription('Une erreur est survenue lors de la configuration du système de tickets.')
				.setColor('#830c68');
			return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
		}
	},
};