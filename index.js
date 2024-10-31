

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const path = require('path');
const express = require('express');
const axios = require('axios');
const { QuickDB } = require('quick.db');
const fs = require('fs');
const { Client: DiscordClient } = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = new QuickDB();
const BOT_TOKEN = ''; 
const GUILD_ID = '862311843259351070';
const OWNER_ID = '758423648901529652';

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

async function registerCommands() {
    const commands = [];
    const commandFiles = fs.readdirSync(path.join(__dirname, 'commands')).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        commands.push(command.data.toJSON());
    }

    try {
        await rest.put(Routes.applicationGuildCommands(BOT_TOKEN, GUILD_ID), { body: commands });
        console.log('Comandos slash registrados com sucesso.');
    } catch (error) {
        console.error('Erro ao registrar comandos slash:', error);
    }
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.once('ready', async () => {
    console.log(`Logado como ${client.user.tag}`);
    await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;
    const command = require(`./commands/${commandName}.js`);

    if (interaction.user.id !== OWNER_ID) {
        return interaction.reply('Você não tem permissão para usar este comando.');
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error('Erro ao executar o comando:', error);
        await interaction.reply('Erro ao executar o comando. Tente novamente.');
    }
});

client.login(BOT_TOKEN);


app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/XXXXXX'; 

function generateSerial() {
    return Math.floor(1000 + Math.random() * 9000);
}


app.post('/enviar-pergunta', async (req, res) => {
    const { pergunta } = req.body;
    const serial = generateSerial();

    try {
        await db.set(`pergunta_${serial}`, { pergunta, resposta: null });

        await axios.post(DISCORD_WEBHOOK_URL, {
            content: `Nova pergunta #${serial}: ${pergunta}`,
        });

        res.status(200).json({ mensagem: `Pergunta #${serial} enviada com sucesso!`, serial });
    } catch (error) {
        console.error('Erro ao enviar pergunta:', error);
        res.status(500).json({ mensagem: 'Erro ao enviar pergunta.' });
    }
});


app.post('/responder-pergunta', async (req, res) => {
    const { serial, respostaBot } = req.body;
    const perguntaData = await db.get(`pergunta_${serial}`);

    if (!perguntaData) {
        return res.status(404).json({ mensagem: `Pergunta com serial #${serial} não encontrada.` });
    }

    await db.set(`pergunta_${serial}.resposta`, respostaBot);
    res.status(200).json({ mensagem: `Resposta para pergunta #${serial} atualizada!` });
});


app.get('/checar-resposta/:serial', async (req, res) => {
    const serial = req.params.serial;
    const perguntaData = await db.get(`pergunta_${serial}`);

    if (!perguntaData) {
        return res.status(404).json({ mensagem: `Pergunta com serial #${serial} não encontrada.` });
    }

    res.status(200).json(perguntaData);
});

app.listen(process.env.PORT || 3000, () => {
    console.log(`Servidor rodando na porta ${process.env.PORT || 3000}`);
});
