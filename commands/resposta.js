const { SlashCommandBuilder } = require('@discordjs/builders');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resposta')
        .setDescription('Atualiza a resposta para uma pergunta com base no serial.')
        .addStringOption(option => 
            option.setName('serial')
                .setDescription('O serial da pergunta.')
                .setRequired(true))
        .addStringOption(option => 
            option.setName('resposta')
                .setDescription('A resposta para a pergunta.')
                .setRequired(true)),
    async execute(interaction) {
        const serial = interaction.options.getString('serial');
        const respostaBot = interaction.options.getString('resposta');

        try {
            await axios.post('http://localhost:3000/responder-pergunta', {
                serial,
                respostaBot
            });

            await interaction.reply(`Resposta para pergunta #${serial} enviada: "${respostaBot}"`);
        } catch (error) {
            console.error('Erro ao enviar resposta:', error);
            await interaction.reply('Erro ao enviar a resposta. Tente novamente.');
        }
    },
};
