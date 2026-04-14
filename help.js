import { EmbedBuilder } from 'discord.js';
import db from './loadDatabase.js';

export const command = {
	name: 'help',
	helpname: 'help',
	description: "Affiche l'aide pour le système de tickets",
	help: 'help',
	run: async (bot, message, args, config) => {
		const checkPerm = async (message, commandName) => {
			if (config.owners.includes(message.author.id)) {
				return true;
			}

			const publicStatut = await db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on']);

			if (publicStatut) {
				const checkPublicCmd = await db.get(
					'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
						['public', commandName, message.guild.id]
				);

				if (checkPublicCmd) {
					return true;
				}
			}

			try {
				const checkUserWl = await db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id]);

				if (checkUserWl) {
					return true;
				}

				const checkDbOwner = await db.get('SELECT id FROM owner WHERE id = ?', [message.author.id]);

				if (checkDbOwner) {
					return true;
				}

				const roles = message.member.roles.cache.map(role => role.id);

				const permissions = await db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id]);

				if (permissions.length === 0) {
					return false;
				}

				const checkCmdPermLevel = await db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id]);

				return checkCmdPermLevel.map(row => row.command).includes(commandName);
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

		const helpEmbed = new EmbedBuilder()
			.setTitle('Aide - Tickets d\'Interviews')
			.setColor('#830c68')
			.addFields(
				{
					name: 'Commandes Admin',
					value: '`!ticket setup` - Configuration avec menus\n`!ticket image` - Ajouter votre logo',
					inline: false
				},
				{
					name: 'Utilisation',
					value: 'Les membres cliquent sur "Créer une interview" dans le panneau configuré',
					inline: false
				}
			);

		await message.reply({ embeds: [helpEmbed], allowedMentions: { repliedUser: false } });
	},
};
